import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  AccountNotification,
  AccountTag,
  AppStatus,
  BLUEPRINT_LIMITS,
  ConnectedApp,
  EventCategory,
  EventStatus,
  NotificationCategory,
  NotificationPreferences,
  OperationType,
  PlatformType,
  SecurityEvent,
  SecurityPreferences,
  TagTone,
  UserProfile,
} from '../types/systemOne';
import { db, handleFirestoreError } from './firebase';

function sanitizeString(value: unknown, maxLen: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLen) : '';
}

function isFirestoreTimestampLike(value: unknown): boolean {
  if (value instanceof Timestamp) return true;
  if (typeof value === 'object' && value !== null) {
    const candidate = value as { seconds?: unknown; nanoseconds?: unknown; toDate?: unknown };
    return (
      (typeof candidate.seconds === 'number' && typeof candidate.nanoseconds === 'number') ||
      typeof candidate.toDate === 'function'
    );
  }
  return false;
}

function sanitizeHandle(email: string, displayName: string): string {
  const base = (displayName || email.split('@')[0] || 'member')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, BLUEPRINT_LIMITS.MAX_HANDLE);
  return base || 'member';
}

function sanitizeTagArray(tags: string[], maxCount: number): string[] {
  const unique = Array.from(
    new Set(
      tags
        .map((t) => t.trim().slice(0, BLUEPRINT_LIMITS.MAX_TAG_LABEL))
        .filter((t) => t.length > 0)
    )
  );
  return unique.slice(0, maxCount);
}

function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone.slice(0, BLUEPRINT_LIMITS.MAX_TIMEZONE);
  } catch {
    return '';
  }
}

export function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const stamp = Date.now().toString(36);
  return `${prefix}_${stamp}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

const REQUIRED_PROFILE_KEYS = [
  'uid',
  'email',
  'secondaryEmail',
  'firstName',
  'lastName',
  'displayName',
  'handle',
  'dateOfBirth',
  'gender',
  'bio',
  'phone',
  'website',
  'streetAddress',
  'city',
  'stateRegion',
  'postalCode',
  'country',
  'location',
  'timezone',
  'preferredLanguage',
  'occupation',
  'company',
  'emergencyContactName',
  'emergencyContactPhone',
  'photoURL',
  'primaryPlatform',
  'linkedProviders',
  'tags',
  'securityPreferences',
  'notificationPreferences',
  'createdAt',
  'updatedAt',
] as const;

const REQUIRED_SECURITY_KEYS = [
  'twoFactorNotice',
  'loginAlerts',
  'sessionTimeoutMinutes',
  'requireReauthForSensitive',
  'trustedRedirectOnly',
  'passwordRecoveryEmail',
  'humanVerified',
  'humanVerifiedAt',
  'biometricsEnabled',
  'pinConfigured',
  'pinHash',
  'pinUpdatedAt',
  'pinExpiresAt',
  'authenticatorEnabled',
  'authenticatorSecret',
] as const;

const REQUIRED_NOTIFICATION_KEYS = [
  'securityDigest',
  'newDeviceAlert',
  'appAuthorizationAlert',
  'profileUpdateAlert',
  'webEnabled',
  'mobileEnabled',
  'desktopEnabled',
] as const;

export async function ensureUserProfileProvisioned(
  user: User,
  preferredPlatform: PlatformType = 'web'
): Promise<UserProfile> {
  if (!user.emailVerified) {
    throw new Error('Please confirm your email address before opening your profile.');
  }

  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  const providerIds = sanitizeTagArray(
    user.providerData.map((p) => p.providerId).filter(Boolean),
    5
  );
  const effectiveProviders = providerIds.length > 0 ? providerIds : ['password'];
  const email = sanitizeString(user.email, BLUEPRINT_LIMITS.MAX_EMAIL);

  if (existingSnap && existingSnap.exists()) {
    const rawDoc = existingSnap.data() as Record<string, unknown>;
    const existingData = normalizeUserProfile(
      {
        ...(rawDoc as Partial<UserProfile>),
        uid: user.uid,
        email: email || (rawDoc.email as string) || '',
      },
      user
    );

    const rawSec = (rawDoc.securityPreferences as Record<string, unknown> | undefined) ?? {};
    const rawNotif = (rawDoc.notificationPreferences as Record<string, unknown> | undefined) ?? {};

    const missingTopKey = REQUIRED_PROFILE_KEYS.some((k) => rawDoc[k] === undefined);
    const missingSecKey = REQUIRED_SECURITY_KEYS.some((k) => rawSec[k] === undefined);
    const missingNotifKey = REQUIRED_NOTIFICATION_KEYS.some((k) => rawNotif[k] === undefined);
    const extraTopKeys = Object.keys(rawDoc).filter(
      (k) => !(REQUIRED_PROFILE_KEYS as readonly string[]).includes(k)
    );
    const extraSecKeys = Object.keys(rawSec).filter(
      (k) => !(REQUIRED_SECURITY_KEYS as readonly string[]).includes(k)
    );
    const extraNotifKeys = Object.keys(rawNotif).filter(
      (k) => !(REQUIRED_NOTIFICATION_KEYS as readonly string[]).includes(k)
    );

    const hasValidCreatedAt = isFirestoreTimestampLike(rawDoc.createdAt);
    const hasValidUid = typeof rawDoc.uid === 'string' && rawDoc.uid === user.uid;

    const providersChanged =
      JSON.stringify(rawDoc.linkedProviders ?? []) !== JSON.stringify(effectiveProviders);
    const emailChanged = rawDoc.email !== email && Boolean(email);

    const stringKeysToValidate: Array<keyof UserProfile> = [
      'email',
      'secondaryEmail',
      'firstName',
      'lastName',
      'displayName',
      'handle',
      'dateOfBirth',
      'gender',
      'bio',
      'phone',
      'website',
      'streetAddress',
      'city',
      'stateRegion',
      'postalCode',
      'country',
      'location',
      'timezone',
      'preferredLanguage',
      'occupation',
      'company',
      'emergencyContactName',
      'emergencyContactPhone',
      'photoURL',
    ];
    const stringFieldInvalid = stringKeysToValidate.some(
      (k) => rawDoc[k] !== existingData[k]
    );
    const arrayFieldInvalid =
      !Array.isArray(rawDoc.tags) ||
      JSON.stringify(rawDoc.tags) !== JSON.stringify(existingData.tags);
    const secFieldInvalid = REQUIRED_SECURITY_KEYS.some(
      (k) => rawSec[k] !== existingData.securityPreferences[k]
    );
    const notifFieldInvalid = REQUIRED_NOTIFICATION_KEYS.some(
      (k) => rawNotif[k] !== existingData.notificationPreferences[k]
    );

    const needsSanitization =
      stringFieldInvalid ||
      arrayFieldInvalid ||
      secFieldInvalid ||
      notifFieldInvalid ||
      rawDoc.primaryPlatform !== existingData.primaryPlatform;

    if (
      missingTopKey ||
      missingSecKey ||
      missingNotifKey ||
      extraTopKeys.length > 0 ||
      extraSecKeys.length > 0 ||
      extraNotifKeys.length > 0 ||
      !hasValidCreatedAt ||
      !hasValidUid ||
      providersChanged ||
      emailChanged ||
      needsSanitization
    ) {
      try {
        const updatePayload: Record<string, unknown> = {
          email: existingData.email,
          secondaryEmail: existingData.secondaryEmail,
          firstName: existingData.firstName,
          lastName: existingData.lastName,
          displayName: existingData.displayName,
          handle: existingData.handle,
          dateOfBirth: existingData.dateOfBirth,
          gender: existingData.gender,
          bio: existingData.bio,
          phone: existingData.phone,
          website: existingData.website,
          streetAddress: existingData.streetAddress,
          city: existingData.city,
          stateRegion: existingData.stateRegion,
          postalCode: existingData.postalCode,
          country: existingData.country,
          location: existingData.location,
          timezone: existingData.timezone,
          preferredLanguage: existingData.preferredLanguage,
          occupation: existingData.occupation,
          company: existingData.company,
          emergencyContactName: existingData.emergencyContactName,
          emergencyContactPhone: existingData.emergencyContactPhone,
          photoURL: existingData.photoURL,
          primaryPlatform: existingData.primaryPlatform,
          linkedProviders: effectiveProviders,
          tags: existingData.tags,
          securityPreferences: existingData.securityPreferences,
          notificationPreferences: existingData.notificationPreferences,
          updatedAt: serverTimestamp(),
        };

        if (!hasValidUid) {
          updatePayload.uid = user.uid;
        }
        if (!hasValidCreatedAt) {
          updatePayload.createdAt = serverTimestamp();
        }
        for (const extraKey of extraTopKeys) {
          updatePayload[extraKey] = deleteField();
        }

        await updateDoc(userRef, updatePayload);
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.UPDATE,
          userPath,
          `caller=ensureUserProfileProvisioned missingTop=${missingTopKey} missingSec=${missingSecKey} missingNotif=${missingNotifKey} extraTop=${extraTopKeys.join(',')} hasValidCreatedAt=${hasValidCreatedAt} hasValidUid=${hasValidUid} needsSanitization=${needsSanitization}`
        );
      }
    }
    return {
      ...existingData,
      linkedProviders: effectiveProviders,
    };
  }

  const rawDisplay = sanitizeString(user.displayName, BLUEPRINT_LIMITS.MAX_DISPLAY_NAME);
  const nameParts = rawDisplay ? rawDisplay.split(/\s+/) : [];
  const firstName = sanitizeString(nameParts[0] || '', BLUEPRINT_LIMITS.MAX_FIRST_NAME);
  const lastName = sanitizeString(
    nameParts.length > 1 ? nameParts.slice(1).join(' ') : '',
    BLUEPRINT_LIMITS.MAX_LAST_NAME
  );

  const displayName =
    rawDisplay || sanitizeString(email.split('@')[0], BLUEPRINT_LIMITS.MAX_DISPLAY_NAME) || 'Member';

  const newProfile: UserProfile = {
    uid: user.uid,
    email,
    secondaryEmail: '',
    firstName,
    lastName,
    displayName,
    handle: sanitizeHandle(email, displayName),
    dateOfBirth: '',
    gender: '',
    bio: '',
    phone: '',
    website: '',
    streetAddress: '',
    city: '',
    stateRegion: '',
    postalCode: '',
    country: '',
    location: '',
    timezone: detectBrowserTimezone(),
    preferredLanguage: 'English',
    occupation: '',
    company: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    photoURL: sanitizeString(user.photoURL, BLUEPRINT_LIMITS.MAX_PHOTO_URL),
    primaryPlatform: preferredPlatform,
    linkedProviders: effectiveProviders,
    tags: [],
    securityPreferences: {
      twoFactorNotice: true,
      loginAlerts: true,
      sessionTimeoutMinutes: 60,
      requireReauthForSensitive: true,
      trustedRedirectOnly: true,
      passwordRecoveryEmail: email,
      humanVerified: false,
      humanVerifiedAt: '',
      biometricsEnabled: false,
      pinConfigured: false,
      pinHash: '',
      pinUpdatedAt: '',
      pinExpiresAt: '',
      authenticatorEnabled: false,
      authenticatorSecret: '',
    },
    notificationPreferences: {
      securityDigest: true,
      newDeviceAlert: true,
      appAuthorizationAlert: true,
      profileUpdateAlert: true,
      webEnabled: true,
      mobileEnabled: true,
      desktopEnabled: true,
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(userRef, newProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, userPath);
  }

  // Record the real account creation event and welcome notification (zero dummy apps or dummy tags)
  try {
    const batch = writeBatch(db);
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://systems-0ne.web.app';

    const welcomeEventId = makeSafeId('evt');
    batch.set(doc(db, 'users', user.uid, 'securityEvents', welcomeEventId), {
      id: welcomeEventId,
      ownerId: user.uid,
      title: 'System One account created',
      category: 'auth' as EventCategory,
      platform: preferredPlatform,
      provider: effectiveProviders[0] || 'password',
      targetUrl: origin,
      tags: [],
      status: 'verified' as EventStatus,
      createdAt: serverTimestamp(),
    });

    const welcomeNotifId = makeSafeId('notif');
    batch.set(doc(db, 'users', user.uid, 'notifications', welcomeNotifId), {
      id: welcomeNotifId,
      ownerId: user.uid,
      title: 'Welcome to System One',
      message:
        'Your account is ready. Complete your person check and fill out your profile details so all your apps stay in sync.',
      category: 'account' as NotificationCategory,
      sourcePlatform: preferredPlatform,
      targetPlatforms: ['web', 'mobile', 'desktop'],
      read: false,
      readAt: '',
      actionUrl: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/initial_records`);
  }

  return newProfile;
}

export function normalizeUserProfile(
  raw: Partial<UserProfile>,
  authUser?: User | null
): UserProfile {
  const sp = raw.securityPreferences;
  const np = raw.notificationPreferences;
  const email = sanitizeString(raw.email ?? authUser?.email ?? '', BLUEPRINT_LIMITS.MAX_EMAIL);

  const rawSecEmail = sanitizeString(raw.secondaryEmail, BLUEPRINT_LIMITS.MAX_EMAIL);
  const secondaryEmail =
    rawSecEmail && BLUEPRINT_LIMITS.EMAIL_REGEX.test(rawSecEmail) ? rawSecEmail : '';

  const rawRecEmail = sanitizeString(sp?.passwordRecoveryEmail, BLUEPRINT_LIMITS.MAX_EMAIL);
  const passwordRecoveryEmail =
    rawRecEmail && BLUEPRINT_LIMITS.EMAIL_REGEX.test(rawRecEmail) ? rawRecEmail : email;

  const validPlatform: PlatformType =
    raw.primaryPlatform === 'web' ||
    raw.primaryPlatform === 'mobile' ||
    raw.primaryPlatform === 'desktop'
      ? raw.primaryPlatform
      : 'web';

  const validTimeout: SecurityPreferences['sessionTimeoutMinutes'] =
    sp?.sessionTimeoutMinutes === 15 ||
    sp?.sessionTimeoutMinutes === 30 ||
    sp?.sessionTimeoutMinutes === 60 ||
    sp?.sessionTimeoutMinutes === 240 ||
    sp?.sessionTimeoutMinutes === 1440
      ? sp.sessionTimeoutMinutes
      : 60;

  const displayName =
    sanitizeString(raw.displayName, BLUEPRINT_LIMITS.MAX_DISPLAY_NAME) ||
    sanitizeString(authUser?.displayName, BLUEPRINT_LIMITS.MAX_DISPLAY_NAME) ||
    sanitizeString(email.split('@')[0], BLUEPRINT_LIMITS.MAX_DISPLAY_NAME) ||
    'Member';

  const rawHandle = (typeof raw.handle === 'string' ? raw.handle : '')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, BLUEPRINT_LIMITS.MAX_HANDLE);

  return {
    uid: sanitizeString(raw.uid ?? authUser?.uid ?? '', 128),
    email,
    secondaryEmail,
    firstName: sanitizeString(raw.firstName, BLUEPRINT_LIMITS.MAX_FIRST_NAME),
    lastName: sanitizeString(raw.lastName, BLUEPRINT_LIMITS.MAX_LAST_NAME),
    displayName,
    handle: rawHandle,
    dateOfBirth: sanitizeString(raw.dateOfBirth, BLUEPRINT_LIMITS.MAX_DOB),
    gender: sanitizeString(raw.gender, BLUEPRINT_LIMITS.MAX_GENDER),
    bio: sanitizeString(raw.bio, BLUEPRINT_LIMITS.MAX_BIO),
    phone: sanitizeString(raw.phone, BLUEPRINT_LIMITS.MAX_PHONE),
    website: sanitizeString(raw.website, BLUEPRINT_LIMITS.MAX_WEBSITE),
    streetAddress: sanitizeString(raw.streetAddress, BLUEPRINT_LIMITS.MAX_STREET),
    city: sanitizeString(raw.city, BLUEPRINT_LIMITS.MAX_CITY),
    stateRegion: sanitizeString(raw.stateRegion, BLUEPRINT_LIMITS.MAX_STATE),
    postalCode: sanitizeString(raw.postalCode, BLUEPRINT_LIMITS.MAX_POSTAL),
    country: sanitizeString(raw.country, BLUEPRINT_LIMITS.MAX_COUNTRY),
    location: sanitizeString(raw.location, BLUEPRINT_LIMITS.MAX_LOCATION),
    timezone: sanitizeString(raw.timezone, BLUEPRINT_LIMITS.MAX_TIMEZONE),
    preferredLanguage:
      sanitizeString(raw.preferredLanguage, BLUEPRINT_LIMITS.MAX_LANGUAGE) || 'English',
    occupation: sanitizeString(raw.occupation, BLUEPRINT_LIMITS.MAX_OCCUPATION),
    company: sanitizeString(raw.company, BLUEPRINT_LIMITS.MAX_COMPANY),
    emergencyContactName: sanitizeString(
      raw.emergencyContactName,
      BLUEPRINT_LIMITS.MAX_EMERGENCY_NAME
    ),
    emergencyContactPhone: sanitizeString(raw.emergencyContactPhone, BLUEPRINT_LIMITS.MAX_PHONE),
    photoURL: sanitizeString(raw.photoURL ?? authUser?.photoURL ?? '', BLUEPRINT_LIMITS.MAX_PHOTO_URL),
    primaryPlatform: validPlatform,
    linkedProviders: sanitizeTagArray(
      Array.isArray(raw.linkedProviders) && raw.linkedProviders.length > 0
        ? raw.linkedProviders
        : ['password'],
      5
    ),
    tags: sanitizeTagArray(Array.isArray(raw.tags) ? raw.tags : [], BLUEPRINT_LIMITS.MAX_PROFILE_TAGS),
    securityPreferences: {
      twoFactorNotice: Boolean(sp?.twoFactorNotice ?? true),
      loginAlerts: Boolean(sp?.loginAlerts ?? true),
      sessionTimeoutMinutes: validTimeout,
      requireReauthForSensitive: Boolean(sp?.requireReauthForSensitive ?? true),
      trustedRedirectOnly: Boolean(sp?.trustedRedirectOnly ?? true),
      passwordRecoveryEmail,
      humanVerified: Boolean(sp?.humanVerified ?? false),
      humanVerifiedAt: sanitizeString(sp?.humanVerifiedAt, 40),
      biometricsEnabled: Boolean(sp?.biometricsEnabled ?? false),
      pinConfigured: Boolean(sp?.pinConfigured ?? false),
      pinHash: sanitizeString(sp?.pinHash, 128),
      pinUpdatedAt: sanitizeString(sp?.pinUpdatedAt, 40),
      pinExpiresAt: sanitizeString(sp?.pinExpiresAt, 40),
      authenticatorEnabled: Boolean(sp?.authenticatorEnabled ?? false),
      authenticatorSecret: sanitizeString(sp?.authenticatorSecret, 64),
    },
    notificationPreferences: {
      securityDigest: Boolean(np?.securityDigest ?? true),
      newDeviceAlert: Boolean(np?.newDeviceAlert ?? true),
      appAuthorizationAlert: Boolean(np?.appAuthorizationAlert ?? true),
      profileUpdateAlert: Boolean(np?.profileUpdateAlert ?? true),
      webEnabled: Boolean(np?.webEnabled ?? true),
      mobileEnabled: Boolean(np?.mobileEnabled ?? true),
      desktopEnabled: Boolean(np?.desktopEnabled ?? true),
    },
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function subscribeToUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void
): () => void {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      onData(snap.exists() ? normalizeUserProfile(snap.data() as Partial<UserProfile>) : null);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeToConnectedApps(
  uid: string,
  onData: (apps: ConnectedApp[]) => void
): () => void {
  const path = `users/${uid}/connectedApps`;
  const q = query(
    collection(db, 'users', uid, 'connectedApps'),
    where('ownerId', '==', uid),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as ConnectedApp));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeToSecurityEvents(
  uid: string,
  onData: (events: SecurityEvent[]) => void
): () => void {
  const path = `users/${uid}/securityEvents`;
  const q = query(
    collection(db, 'users', uid, 'securityEvents'),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as SecurityEvent));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeToAccountTags(
  uid: string,
  onData: (tags: AccountTag[]) => void
): () => void {
  const path = `users/${uid}/tags`;
  const q = query(
    collection(db, 'users', uid, 'tags'),
    where('ownerId', '==', uid),
    orderBy('label', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as AccountTag));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeToNotifications(
  uid: string,
  onData: (notifications: AccountNotification[]) => void
): () => void {
  const path = `users/${uid}/notifications`;
  const q = query(
    collection(db, 'users', uid, 'notifications'),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as AccountNotification));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function updateProfileDetails(
  uid: string,
  updates: {
    secondaryEmail: string;
    firstName: string;
    lastName: string;
    displayName: string;
    handle: string;
    dateOfBirth: string;
    gender: string;
    bio: string;
    phone: string;
    website: string;
    streetAddress: string;
    city: string;
    stateRegion: string;
    postalCode: string;
    country: string;
    location: string;
    timezone: string;
    preferredLanguage: string;
    occupation: string;
    company: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    photoURL: string;
    primaryPlatform: PlatformType;
    tags: string[];
  }
): Promise<void> {
  const path = `users/${uid}`;
  const cleanSecondaryEmail = sanitizeString(
    updates.secondaryEmail,
    BLUEPRINT_LIMITS.MAX_EMAIL
  );
  if (cleanSecondaryEmail && !BLUEPRINT_LIMITS.EMAIL_REGEX.test(cleanSecondaryEmail)) {
    throw new Error('Please enter a valid backup email address or leave it blank.');
  }

  const cleanHandle = updates.handle
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, BLUEPRINT_LIMITS.MAX_HANDLE);

  const cityClean = sanitizeString(updates.city, BLUEPRINT_LIMITS.MAX_CITY);
  const countryClean = sanitizeString(updates.country, BLUEPRINT_LIMITS.MAX_COUNTRY);
  const derivedLocation =
    sanitizeString(updates.location, BLUEPRINT_LIMITS.MAX_LOCATION) ||
    [cityClean, countryClean].filter(Boolean).join(', ').slice(0, BLUEPRINT_LIMITS.MAX_LOCATION);

  const firstClean = sanitizeString(updates.firstName, BLUEPRINT_LIMITS.MAX_FIRST_NAME);
  const lastClean = sanitizeString(updates.lastName, BLUEPRINT_LIMITS.MAX_LAST_NAME);
  const fullNameFallback = `${firstClean} ${lastClean}`.trim();

  const payload = {
    secondaryEmail: cleanSecondaryEmail,
    firstName: firstClean,
    lastName: lastClean,
    displayName:
      sanitizeString(updates.displayName, BLUEPRINT_LIMITS.MAX_DISPLAY_NAME) ||
      fullNameFallback ||
      'Member',
    handle: cleanHandle,
    dateOfBirth: sanitizeString(updates.dateOfBirth, BLUEPRINT_LIMITS.MAX_DOB),
    gender: sanitizeString(updates.gender, BLUEPRINT_LIMITS.MAX_GENDER),
    bio: sanitizeString(updates.bio, BLUEPRINT_LIMITS.MAX_BIO),
    phone: sanitizeString(updates.phone, BLUEPRINT_LIMITS.MAX_PHONE),
    website: sanitizeString(updates.website, BLUEPRINT_LIMITS.MAX_WEBSITE),
    streetAddress: sanitizeString(updates.streetAddress, BLUEPRINT_LIMITS.MAX_STREET),
    city: cityClean,
    stateRegion: sanitizeString(updates.stateRegion, BLUEPRINT_LIMITS.MAX_STATE),
    postalCode: sanitizeString(updates.postalCode, BLUEPRINT_LIMITS.MAX_POSTAL),
    country: countryClean,
    location: derivedLocation,
    timezone: sanitizeString(updates.timezone, BLUEPRINT_LIMITS.MAX_TIMEZONE),
    preferredLanguage: sanitizeString(updates.preferredLanguage, BLUEPRINT_LIMITS.MAX_LANGUAGE),
    occupation: sanitizeString(updates.occupation, BLUEPRINT_LIMITS.MAX_OCCUPATION),
    company: sanitizeString(updates.company, BLUEPRINT_LIMITS.MAX_COMPANY),
    emergencyContactName: sanitizeString(
      updates.emergencyContactName,
      BLUEPRINT_LIMITS.MAX_EMERGENCY_NAME
    ),
    emergencyContactPhone: sanitizeString(
      updates.emergencyContactPhone,
      BLUEPRINT_LIMITS.MAX_PHONE
    ),
    photoURL: sanitizeString(updates.photoURL, BLUEPRINT_LIMITS.MAX_PHOTO_URL),
    primaryPlatform:
      updates.primaryPlatform === 'web' ||
      updates.primaryPlatform === 'mobile' ||
      updates.primaryPlatform === 'desktop'
        ? updates.primaryPlatform
        : 'web',
    tags: sanitizeTagArray(updates.tags, BLUEPRINT_LIMITS.MAX_PROFILE_TAGS),
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, 'users', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path, 'caller=updateProfileDetails');
  }
}

export async function updateSecurityPreferences(
  uid: string,
  prefs: SecurityPreferences
): Promise<void> {
  const path = `users/${uid}`;
  const recoveryEmail = sanitizeString(
    prefs.passwordRecoveryEmail,
    BLUEPRINT_LIMITS.MAX_EMAIL
  );
  if (recoveryEmail && !BLUEPRINT_LIMITS.EMAIL_REGEX.test(recoveryEmail)) {
    throw new Error('Please enter a valid backup recovery email address.');
  }

  const validTimeout: SecurityPreferences['sessionTimeoutMinutes'] =
    prefs.sessionTimeoutMinutes === 15 ||
    prefs.sessionTimeoutMinutes === 30 ||
    prefs.sessionTimeoutMinutes === 60 ||
    prefs.sessionTimeoutMinutes === 240 ||
    prefs.sessionTimeoutMinutes === 1440
      ? prefs.sessionTimeoutMinutes
      : 60;

  try {
    await updateDoc(doc(db, 'users', uid), {
      securityPreferences: {
        twoFactorNotice: Boolean(prefs.twoFactorNotice),
        loginAlerts: Boolean(prefs.loginAlerts),
        sessionTimeoutMinutes: validTimeout,
        requireReauthForSensitive: Boolean(prefs.requireReauthForSensitive),
        trustedRedirectOnly: Boolean(prefs.trustedRedirectOnly),
        passwordRecoveryEmail: recoveryEmail,
        humanVerified: Boolean(prefs.humanVerified),
        humanVerifiedAt: sanitizeString(prefs.humanVerifiedAt, 40),
        biometricsEnabled: Boolean(prefs.biometricsEnabled),
        pinConfigured: Boolean(prefs.pinConfigured),
        pinHash: sanitizeString(prefs.pinHash, 128),
        pinUpdatedAt: sanitizeString(prefs.pinUpdatedAt, 40),
        pinExpiresAt: sanitizeString(prefs.pinExpiresAt, 40),
        authenticatorEnabled: Boolean(prefs.authenticatorEnabled),
        authenticatorSecret: sanitizeString(prefs.authenticatorSecret, 64),
      },
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path, 'caller=updateSecurityPreferences');
  }
}

export async function updateNotificationPreferences(
  uid: string,
  prefs: NotificationPreferences
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      notificationPreferences: {
        securityDigest: Boolean(prefs.securityDigest),
        newDeviceAlert: Boolean(prefs.newDeviceAlert),
        appAuthorizationAlert: Boolean(prefs.appAuthorizationAlert),
        profileUpdateAlert: Boolean(prefs.profileUpdateAlert),
        webEnabled: Boolean(prefs.webEnabled),
        mobileEnabled: Boolean(prefs.mobileEnabled),
        desktopEnabled: Boolean(prefs.desktopEnabled),
      },
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path, 'caller=updateNotificationPreferences');
  }
}

export function resolveEnabledTargetPlatforms(
  prefs?: NotificationPreferences
): PlatformType[] {
  if (!prefs) return ['web', 'mobile', 'desktop'];
  const list: PlatformType[] = [];
  if (prefs.webEnabled) list.push('web');
  if (prefs.mobileEnabled) list.push('mobile');
  if (prefs.desktopEnabled) list.push('desktop');
  return list;
}

export async function createCrossPlatformNotification(
  uid: string,
  input: {
    title: string;
    message: string;
    category: NotificationCategory;
    sourcePlatform: PlatformType;
    targetPlatforms?: PlatformType[];
    actionUrl?: string;
  },
  prefs?: NotificationPreferences
): Promise<string | null> {
  const targets =
    input.targetPlatforms && input.targetPlatforms.length > 0
      ? input.targetPlatforms
      : resolveEnabledTargetPlatforms(prefs);

  if (targets.length === 0) {
    return null;
  }

  const notifId = makeSafeId('notif');
  const path = `users/${uid}/notifications/${notifId}`;
  const title = sanitizeString(input.title, BLUEPRINT_LIMITS.MAX_NOTIF_TITLE);
  const message = sanitizeString(input.message, BLUEPRINT_LIMITS.MAX_NOTIF_MESSAGE);

  if (!title || !message) {
    throw new Error('Notification title and message are required.');
  }

  const docData: AccountNotification = {
    id: notifId,
    ownerId: uid,
    title,
    message,
    category: input.category,
    sourcePlatform: input.sourcePlatform,
    targetPlatforms: Array.from(new Set(targets)).slice(0, 3),
    read: false,
    readAt: '',
    actionUrl: sanitizeString(input.actionUrl, BLUEPRINT_LIMITS.MAX_REDIRECT_URI),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', uid, 'notifications', notifId), docData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  // Trigger native browser notification if user opted in and Web delivery is enabled
  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted' &&
    docData.targetPlatforms.includes('web')
  ) {
    try {
      new Notification(title, { body: message });
    } catch {
      // Ignore environments restricting Notification constructor
    }
  }

  return notifId;
}

export async function markNotificationRead(
  uid: string,
  notificationId: string,
  read: boolean
): Promise<void> {
  const path = `users/${uid}/notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'notifications', notificationId), {
      read,
      readAt: read ? new Date().toISOString() : '',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markAllNotificationsRead(
  uid: string,
  notifications: AccountNotification[]
): Promise<void> {
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return;
  const nowIso = new Date().toISOString();
  const batch = writeBatch(db);
  for (const item of unread) {
    batch.update(doc(db, 'users', uid, 'notifications', item.id), {
      read: true,
      readAt: nowIso,
      updatedAt: serverTimestamp(),
    });
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/notifications`);
  }
}

export async function deleteNotification(
  uid: string,
  notificationId: string
): Promise<void> {
  const path = `users/${uid}/notifications/${notificationId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'notifications', notificationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createConnectedApp(
  uid: string,
  input: {
    name: string;
    platform: PlatformType;
    description: string;
    redirectUri: string;
    tags: string[];
    scopes: string[];
  }
): Promise<string> {
  const appId = makeSafeId('app');
  const path = `users/${uid}/connectedApps/${appId}`;
  const name = sanitizeString(input.name, BLUEPRINT_LIMITS.MAX_APP_NAME);
  const redirectUri = sanitizeString(input.redirectUri, BLUEPRINT_LIMITS.MAX_REDIRECT_URI);

  if (!name || !redirectUri) {
    throw new Error('Application name and redirect URI are required.');
  }

  const docData: ConnectedApp = {
    id: appId,
    ownerId: uid,
    name,
    platform: input.platform,
    description: sanitizeString(input.description, BLUEPRINT_LIMITS.MAX_APP_DESCRIPTION),
    redirectUri,
    status: 'active',
    tags: sanitizeTagArray(input.tags, BLUEPRINT_LIMITS.MAX_APP_TAGS),
    scopes: sanitizeTagArray(input.scopes, BLUEPRINT_LIMITS.MAX_APP_SCOPES),
    lastPlatformSource: input.platform,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', uid, 'connectedApps', appId), docData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return appId;
}

export async function updateConnectedAppDetails(
  uid: string,
  appId: string,
  input: {
    name: string;
    platform: PlatformType;
    description: string;
    redirectUri: string;
    tags: string[];
    scopes: string[];
  }
): Promise<void> {
  const path = `users/${uid}/connectedApps/${appId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'connectedApps', appId), {
      name: sanitizeString(input.name, BLUEPRINT_LIMITS.MAX_APP_NAME) || 'Connected App',
      platform: input.platform,
      description: sanitizeString(input.description, BLUEPRINT_LIMITS.MAX_APP_DESCRIPTION),
      redirectUri: sanitizeString(input.redirectUri, BLUEPRINT_LIMITS.MAX_REDIRECT_URI) || '/',
      tags: sanitizeTagArray(input.tags, BLUEPRINT_LIMITS.MAX_APP_TAGS),
      scopes: sanitizeTagArray(input.scopes, BLUEPRINT_LIMITS.MAX_APP_SCOPES),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateConnectedAppStatus(
  uid: string,
  appId: string,
  status: AppStatus
): Promise<void> {
  const path = `users/${uid}/connectedApps/${appId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'connectedApps', appId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteConnectedApp(uid: string, appId: string): Promise<void> {
  const path = `users/${uid}/connectedApps/${appId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'connectedApps', appId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function logSecurityEvent(
  uid: string,
  input: {
    title: string;
    category: EventCategory;
    platform: PlatformType;
    provider: string;
    targetUrl: string;
    tags: string[];
    status: EventStatus;
  }
): Promise<void> {
  const eventId = makeSafeId('evt');
  const path = `users/${uid}/securityEvents/${eventId}`;

  const docData: SecurityEvent = {
    id: eventId,
    ownerId: uid,
    title: sanitizeString(input.title, BLUEPRINT_LIMITS.MAX_EVENT_TITLE) || 'Account Event',
    category: input.category,
    platform: input.platform,
    provider: sanitizeString(input.provider, BLUEPRINT_LIMITS.MAX_PROVIDER),
    targetUrl: sanitizeString(input.targetUrl, BLUEPRINT_LIMITS.MAX_REDIRECT_URI),
    tags: sanitizeTagArray(input.tags, BLUEPRINT_LIMITS.MAX_APP_TAGS),
    status: input.status,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', uid, 'securityEvents', eventId), docData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteSecurityEvent(uid: string, eventId: string): Promise<void> {
  const path = `users/${uid}/securityEvents/${eventId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'securityEvents', eventId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createAccountTag(
  uid: string,
  input: { label: string; description: string; tone: TagTone }
): Promise<string> {
  const tagId = makeSafeId('tag');
  const path = `users/${uid}/tags/${tagId}`;
  const label = sanitizeString(input.label, BLUEPRINT_LIMITS.MAX_TAG_LABEL);
  if (!label) {
    throw new Error('Tag label cannot be empty.');
  }

  const docData: AccountTag = {
    id: tagId,
    ownerId: uid,
    label,
    description: sanitizeString(input.description, BLUEPRINT_LIMITS.MAX_TAG_DESCRIPTION),
    tone: input.tone,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', uid, 'tags', tagId), docData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return tagId;
}

export async function updateAccountTag(
  uid: string,
  tagId: string,
  input: { label: string; description: string; tone: TagTone }
): Promise<void> {
  const path = `users/${uid}/tags/${tagId}`;
  const label = sanitizeString(input.label, BLUEPRINT_LIMITS.MAX_TAG_LABEL);
  if (!label) {
    throw new Error('Tag label cannot be empty.');
  }
  try {
    await updateDoc(doc(db, 'users', uid, 'tags', tagId), {
      label,
      description: sanitizeString(input.description, BLUEPRINT_LIMITS.MAX_TAG_DESCRIPTION),
      tone: input.tone,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAccountTag(uid: string, tagId: string): Promise<void> {
  const path = `users/${uid}/tags/${tagId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'tags', tagId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

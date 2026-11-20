import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  AccountTag,
  AppStatus,
  BLUEPRINT_LIMITS,
  ConnectedApp,
  EventCategory,
  EventStatus,
  NotificationPreferences,
  OperationType,
  PlatformType,
  SecurityEvent,
  SecurityPreferences,
  TagTone,
  UserProfile,
} from '../types/systemOne';
import { db, handleFirestoreError } from './firebase';

function sanitizeString(value: string | null | undefined, maxLen: number): string {
  return (value ?? '').trim().slice(0, maxLen);
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

export function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const stamp = Date.now().toString(36);
  return `${prefix}_${stamp}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

export async function ensureUserProfileProvisioned(
  user: User,
  preferredPlatform: PlatformType = 'web'
): Promise<UserProfile> {
  if (!user.emailVerified) {
    throw new Error('Email verification is required before activating System One profile storage.');
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
  const email = sanitizeString(user.email, BLUEPRINT_LIMITS.MAX_EMAIL);

  if (existingSnap && existingSnap.exists()) {
    const existingData = normalizeUserProfile(existingSnap.data() as UserProfile);
    const providersChanged =
      JSON.stringify(existingData.linkedProviders) !== JSON.stringify(providerIds);
    if (providersChanged || existingData.email !== email) {
      try {
        await updateDoc(userRef, {
          linkedProviders: providerIds.length > 0 ? providerIds : ['password'],
          email,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userPath);
      }
    }
    return existingData;
  }

  const displayName =
    sanitizeString(user.displayName, BLUEPRINT_LIMITS.MAX_DISPLAY_NAME) ||
    sanitizeString(email.split('@')[0], BLUEPRINT_LIMITS.MAX_DISPLAY_NAME) ||
    'System One Member';

  const newProfile: UserProfile = {
    uid: user.uid,
    email,
    displayName,
    handle: sanitizeHandle(email, displayName),
    bio: 'Unified System One identity across web, mobile, and desktop workspaces.',
    phone: '',
    location: '',
    photoURL: sanitizeString(user.photoURL, BLUEPRINT_LIMITS.MAX_PHOTO_URL),
    primaryPlatform: preferredPlatform,
    linkedProviders: providerIds.length > 0 ? providerIds : ['password'],
    tags: ['Core Identity', 'SSO Enabled'],
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
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(userRef, newProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, userPath);
  }

  // Seed default tags, starter connected apps, and initial verified audit event atomically
  try {
    const batch = writeBatch(db);
    const defaultTags: Array<{ id: string; label: string; description: string; tone: TagTone }> = [
      {
        id: 'tag_core_identity',
        label: 'Core Identity',
        description: 'Primary account resources and universal sign-on credentials',
        tone: 'sky',
      },
      {
        id: 'tag_mobile_suite',
        label: 'Mobile Suite',
        description: 'iOS and Android client applications using deep-link redirect_to',
        tone: 'emerald',
      },
      {
        id: 'tag_desktop_tools',
        label: 'Desktop Tools',
        description: 'Native macOS, Windows, and Linux desktop utilities',
        tone: 'indigo',
      },
      {
        id: 'tag_security_audit',
        label: 'Security Audit',
        description: 'Sensitive configuration changes and sign-in verifications',
        tone: 'amber',
      },
    ];

    for (const tag of defaultTags) {
      batch.set(doc(db, 'users', user.uid, 'tags', tag.id), {
        id: tag.id,
        ownerId: user.uid,
        label: tag.label,
        description: tag.description,
        tone: tag.tone,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://systems-0ne.web.app';

    const starterApps: Array<Omit<ConnectedApp, 'createdAt' | 'updatedAt'>> = [
      {
        id: 'app_atlas_web',
        ownerId: user.uid,
        name: 'Atlas Web Workspace',
        platform: 'web',
        description: 'Primary browser workspace utilizing System One SSO and return redirect_to.',
        redirectUri: `${origin}/?workspace=atlas`,
        status: 'active',
        tags: ['Core Identity'],
        scopes: ['profile:read', 'email:read', 'prefs:sync'],
        lastPlatformSource: 'web',
      },
      {
        id: 'app_pulse_mobile',
        ownerId: user.uid,
        name: 'Pulse Mobile Companion',
        platform: 'mobile',
        description: 'iOS & Android companion app with custom scheme callback continuity.',
        redirectUri: 'systemone-pulse://auth/callback',
        status: 'active',
        tags: ['Mobile Suite', 'Core Identity'],
        scopes: ['profile:read', 'session:persist'],
        lastPlatformSource: 'mobile',
      },
      {
        id: 'app_studio_desktop',
        ownerId: user.uid,
        name: 'Studio Desktop Client',
        platform: 'desktop',
        description: 'Cross-platform desktop client synchronized with unified security policies.',
        redirectUri: 'systemone-desktop://sso/complete',
        status: 'active',
        tags: ['Desktop Tools'],
        scopes: ['profile:read', 'security:read'],
        lastPlatformSource: 'desktop',
      },
    ];

    for (const appItem of starterApps) {
      batch.set(doc(db, 'users', user.uid, 'connectedApps', appItem.id), {
        ...appItem,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const welcomeEventId = makeSafeId('evt');
    batch.set(doc(db, 'users', user.uid, 'securityEvents', welcomeEventId), {
      id: welcomeEventId,
      ownerId: user.uid,
      title: 'Unified System One profile initialized',
      category: 'auth' as EventCategory,
      platform: preferredPlatform,
      provider: providerIds[0] || 'password',
      targetUrl: origin,
      tags: ['Core Identity', 'Security Audit'],
      status: 'verified' as EventStatus,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/starter_seed`);
  }

  return newProfile;
}

export function normalizeUserProfile(raw: Partial<UserProfile>): UserProfile {
  const sp = raw.securityPreferences;
  const email = raw.email ?? '';
  return {
    uid: raw.uid ?? '',
    email,
    displayName: raw.displayName ?? 'System One Member',
    handle: raw.handle ?? '',
    bio: raw.bio ?? '',
    phone: raw.phone ?? '',
    location: raw.location ?? '',
    photoURL: raw.photoURL ?? '',
    primaryPlatform: raw.primaryPlatform ?? 'web',
    linkedProviders: raw.linkedProviders ?? ['password'],
    tags: raw.tags ?? [],
    securityPreferences: {
      twoFactorNotice: sp?.twoFactorNotice ?? true,
      loginAlerts: sp?.loginAlerts ?? true,
      sessionTimeoutMinutes: sp?.sessionTimeoutMinutes ?? 60,
      requireReauthForSensitive: sp?.requireReauthForSensitive ?? true,
      trustedRedirectOnly: sp?.trustedRedirectOnly ?? true,
      passwordRecoveryEmail: sp?.passwordRecoveryEmail ?? email,
      humanVerified: sp?.humanVerified ?? true,
      humanVerifiedAt: sp?.humanVerifiedAt ?? '',
      biometricsEnabled: sp?.biometricsEnabled ?? false,
      pinConfigured: sp?.pinConfigured ?? false,
      pinHash: sp?.pinHash ?? '',
      pinUpdatedAt: sp?.pinUpdatedAt ?? '',
      pinExpiresAt: sp?.pinExpiresAt ?? '',
      authenticatorEnabled: sp?.authenticatorEnabled ?? false,
      authenticatorSecret: sp?.authenticatorSecret ?? '',
    },
    notificationPreferences: {
      securityDigest: raw.notificationPreferences?.securityDigest ?? true,
      newDeviceAlert: raw.notificationPreferences?.newDeviceAlert ?? true,
      appAuthorizationAlert: raw.notificationPreferences?.appAuthorizationAlert ?? true,
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

export async function updateProfileDetails(
  uid: string,
  updates: {
    displayName: string;
    handle: string;
    bio: string;
    phone: string;
    location: string;
    photoURL: string;
    primaryPlatform: PlatformType;
    tags: string[];
  }
): Promise<void> {
  const path = `users/${uid}`;
  const cleanHandle = updates.handle
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, BLUEPRINT_LIMITS.MAX_HANDLE);

  const payload = {
    displayName:
      sanitizeString(updates.displayName, BLUEPRINT_LIMITS.MAX_DISPLAY_NAME) || 'Member',
    handle: cleanHandle,
    bio: sanitizeString(updates.bio, BLUEPRINT_LIMITS.MAX_BIO),
    phone: sanitizeString(updates.phone, BLUEPRINT_LIMITS.MAX_PHONE),
    location: sanitizeString(updates.location, BLUEPRINT_LIMITS.MAX_LOCATION),
    photoURL: sanitizeString(updates.photoURL, BLUEPRINT_LIMITS.MAX_PHOTO_URL),
    primaryPlatform: updates.primaryPlatform,
    tags: sanitizeTagArray(updates.tags, BLUEPRINT_LIMITS.MAX_PROFILE_TAGS),
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, 'users', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
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

  try {
    await updateDoc(doc(db, 'users', uid), {
      securityPreferences: {
        twoFactorNotice: Boolean(prefs.twoFactorNotice),
        loginAlerts: Boolean(prefs.loginAlerts),
        sessionTimeoutMinutes: prefs.sessionTimeoutMinutes,
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
    handleFirestoreError(error, OperationType.UPDATE, path);
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
      },
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
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

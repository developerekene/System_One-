import { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Bell,
  CheckCircle2,
  Fingerprint,
  Globe,
  KeyRound,
  Lock,
  Monitor,
  Save,
  ShieldCheck,
  Smartphone,
  Tag as TagIcon,
} from 'lucide-react';
import { generateTotpSecret, verifyTotpCode } from '../lib/authenticator';
import { formatFirestoreTimestamp, getTagButtonClasses } from '../lib/formatters';
import {
  createCrossPlatformNotification,
  logSecurityEvent,
  updateProfileDetails,
  updateSecurityPreferences,
} from '../lib/firestoreService';
import {
  attemptPlatformBiometricEnrollment,
  daysUntilPinRotation,
  isPinExpiredOrDue,
} from '../lib/securityEnrollment';
import {
  AccountNotification,
  AccountTag,
  ConnectedApp,
  PlatformType,
  UserProfile,
  WorkspaceTab,
} from '../types/systemOne';
import { BuiltInAuthenticatorCard } from './BuiltInAuthenticatorCard';

interface OverviewSectionProps {
  authUser: User;
  profile: UserProfile;
  connectedApps: ConnectedApp[];
  notifications: AccountNotification[];
  availableTags: AccountTag[];
  searchQuery: string;
  selectedTagFilter: string | null;
  isMobileDevice: boolean;
  onSelectTagFilter: (tag: string | null) => void;
  onNavigateTab: (tab: WorkspaceTab) => void;
  onTriggerEnrollmentModal: () => void;
}

const LANGUAGE_OPTIONS = [
  'English',
  'French',
  'Spanish',
  'German',
  'Portuguese',
  'Arabic',
  'Chinese',
  'Japanese',
  'Other',
];

export function OverviewSection({
  authUser,
  profile,
  connectedApps,
  notifications,
  availableTags,
  searchQuery,
  selectedTagFilter,
  isMobileDevice,
  onSelectTagFilter,
  onNavigateTab,
  onTriggerEnrollmentModal,
}: OverviewSectionProps) {
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [handle, setHandle] = useState(profile.handle);
  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth);
  const [gender, setGender] = useState(profile.gender);
  const [bio, setBio] = useState(profile.bio);
  const [photoURL, setPhotoURL] = useState(profile.photoURL);

  const [secondaryEmail, setSecondaryEmail] = useState(profile.secondaryEmail);
  const [phone, setPhone] = useState(profile.phone);
  const [website, setWebsite] = useState(profile.website);

  const [streetAddress, setStreetAddress] = useState(profile.streetAddress);
  const [city, setCity] = useState(profile.city);
  const [stateRegion, setStateRegion] = useState(profile.stateRegion);
  const [postalCode, setPostalCode] = useState(profile.postalCode);
  const [country, setCountry] = useState(profile.country);
  const [timezone, setTimezone] = useState(profile.timezone);
  const [preferredLanguage, setPreferredLanguage] = useState(
    profile.preferredLanguage || 'English'
  );

  const [occupation, setOccupation] = useState(profile.occupation);
  const [company, setCompany] = useState(profile.company);
  const [emergencyContactName, setEmergencyContactName] = useState(
    profile.emergencyContactName
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    profile.emergencyContactPhone
  );
  const [primaryPlatform, setPrimaryPlatform] = useState<PlatformType>(
    profile.primaryPlatform
  );
  const [tags, setTags] = useState<string[]>(profile.tags);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [pendingSecret] = useState(
    () => profile.securityPreferences.authenticatorSecret || generateTotpSecret()
  );
  const [mobileVerifyChoice, setMobileVerifyChoice] = useState<
    'biometrics' | 'authenticator'
  >('biometrics');
  const [totpCodeInput, setTotpCodeInput] = useState('');
  const [verifyingHuman, setVerifyingHuman] = useState(false);
  const [humanError, setHumanError] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setDisplayName(profile.displayName);
    setHandle(profile.handle);
    setDateOfBirth(profile.dateOfBirth);
    setGender(profile.gender);
    setBio(profile.bio);
    setPhotoURL(profile.photoURL);
    setSecondaryEmail(profile.secondaryEmail);
    setPhone(profile.phone);
    setWebsite(profile.website);
    setStreetAddress(profile.streetAddress);
    setCity(profile.city);
    setStateRegion(profile.stateRegion);
    setPostalCode(profile.postalCode);
    setCountry(profile.country);
    setTimezone(profile.timezone);
    setPreferredLanguage(profile.preferredLanguage || 'English');
    setOccupation(profile.occupation);
    setCompany(profile.company);
    setEmergencyContactName(profile.emergencyContactName);
    setEmergencyContactPhone(profile.emergencyContactPhone);
    setPrimaryPlatform(profile.primaryPlatform);
    setTags(profile.tags);
  }, [profile]);

  const isHumanVerified = profile.securityPreferences.humanVerified;
  const activeSecret =
    profile.securityPreferences.authenticatorSecret || pendingSecret;

  const needsDeviceActivation = useMemo(() => {
    if (isMobileDevice) {
      return !profile.securityPreferences.biometricsEnabled;
    }
    return (
      !profile.securityPreferences.pinConfigured ||
      isPinExpiredOrDue(profile.securityPreferences)
    );
  }, [isMobileDevice, profile.securityPreferences]);

  const pinDaysRemaining = daysUntilPinRotation(
    profile.securityPreferences.pinExpiresAt
  );

  const unreadNotifications = notifications.filter((n) => !n.read);

  const toggleProfileTag = (label: string) => {
    setTags((prev) => {
      if (prev.includes(label)) {
        return prev.filter((item) => item !== label);
      }
      if (prev.length >= 10) return prev;
      return [...prev, label];
    });
  };

  const handleVerifyHumanWithAuthenticator = async (e: React.FormEvent) => {
    e.preventDefault();
    setHumanError(null);

    const cleaned = totpCodeInput.replace(/\D/g, '').trim();
    if (cleaned.length !== 6) {
      setHumanError('Please enter all 6 numbers shown on the screen.');
      return;
    }

    setVerifyingHuman(true);
    try {
      const valid = await verifyTotpCode(activeSecret, cleaned);
      if (!valid) {
        setHumanError(
          'That 6-digit code did not match or just expired. Please enter the current numbers.'
        );
        return;
      }

      await updateSecurityPreferences(authUser.uid, {
        ...profile.securityPreferences,
        humanVerified: true,
        humanVerifiedAt: new Date().toISOString(),
        authenticatorEnabled: true,
        authenticatorSecret: activeSecret,
      });

      await logSecurityEvent(authUser.uid, {
        title: 'Person check completed with 6-digit authenticator code',
        category: 'security',
        platform: isMobileDevice ? 'mobile' : primaryPlatform,
        provider: 'totp_authenticator',
        targetUrl: window.location.origin,
        tags: profile.tags.slice(0, 4),
        status: 'verified',
      });

      await createCrossPlatformNotification(
        authUser.uid,
        {
          title: 'Account unlocked',
          message:
            'Your person check is done and your 6-digit login code is turned on.',
          category: 'security',
          sourcePlatform: isMobileDevice ? 'mobile' : primaryPlatform,
        },
        profile.notificationPreferences
      );

      setSaveMessage(
        'Thank you! Your person check is done. You can now fill out and save your profile.'
      );
      if (needsDeviceActivation) {
        onTriggerEnrollmentModal();
      }
    } catch (err) {
      setHumanError(
        err instanceof Error ? err.message : 'Unable to save verification right now.'
      );
    } finally {
      setVerifyingHuman(false);
    }
  };

  const handleVerifyHumanWithBiometrics = async () => {
    setHumanError(null);
    setVerifyingHuman(true);
    try {
      const result = await attemptPlatformBiometricEnrollment(
        authUser.uid,
        profile.email,
        profile.displayName
      );

      await updateSecurityPreferences(authUser.uid, {
        ...profile.securityPreferences,
        humanVerified: true,
        humanVerifiedAt: new Date().toISOString(),
        biometricsEnabled: true,
        authenticatorSecret: activeSecret,
      });

      await logSecurityEvent(authUser.uid, {
        title: `Person check completed with mobile biometrics (${result.method})`,
        category: 'security',
        platform: 'mobile',
        provider: result.method,
        targetUrl: window.location.origin,
        tags: profile.tags.slice(0, 4),
        status: 'verified',
      });

      await createCrossPlatformNotification(
        authUser.uid,
        {
          title: 'Fingerprint / face unlock turned on',
          message:
            'Your person check is complete and mobile quick unlock is active.',
          category: 'security',
          sourcePlatform: 'mobile',
        },
        profile.notificationPreferences
      );

      setSaveMessage(
        'Thank you! Your person check is done. You can now fill out and save your profile.'
      );
    } catch (err) {
      setHumanError(
        err instanceof Error
          ? err.message
          : 'Could not verify with fingerprint/face unlock. Try the 6-digit code instead.'
      );
    } finally {
      setVerifyingHuman(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHumanVerified) {
      setErrorMessage('Please finish the quick person check above before saving.');
      return;
    }

    setSaving(true);
    setSaveMessage(null);
    setErrorMessage(null);

    try {
      const locationSummary = [city.trim(), country.trim()]
        .filter(Boolean)
        .join(', ');

      await updateProfileDetails(authUser.uid, {
        secondaryEmail,
        firstName,
        lastName,
        displayName,
        handle,
        dateOfBirth,
        gender,
        bio,
        phone,
        website,
        streetAddress,
        city,
        stateRegion,
        postalCode,
        country,
        location: locationSummary,
        timezone,
        preferredLanguage,
        occupation,
        company,
        emergencyContactName,
        emergencyContactPhone,
        photoURL,
        primaryPlatform,
        tags,
      });

      await logSecurityEvent(authUser.uid, {
        title: 'Profile details updated',
        category: 'profile',
        platform: primaryPlatform,
        provider: profile.linkedProviders[0] || 'password',
        targetUrl: window.location.origin,
        tags: tags.slice(0, 4),
        status: 'completed',
      });

      if (profile.notificationPreferences.profileUpdateAlert) {
        await createCrossPlatformNotification(
          authUser.uid,
          {
            title: 'Profile updated',
            message:
              'Your personal details were saved and are ready across all your connected apps.',
            category: 'account',
            sourcePlatform: isMobileDevice ? 'mobile' : primaryPlatform,
          },
          profile.notificationPreferences
        );
      }

      setSaveMessage('Your profile has been saved and updated across all your apps.');

      if (needsDeviceActivation) {
        onTriggerEnrollmentModal();
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to save your profile changes.'
      );
    } finally {
      setSaving(false);
    }
  };

  const activeAppsCount = connectedApps.filter((a) => a.status === 'active').length;
  const q = searchQuery.trim().toLowerCase();

  const matchingApps = connectedApps.filter((app) => {
    const matchesTag = !selectedTagFilter || app.tags.includes(selectedTagFilter);
    const matchesQuery =
      !q ||
      app.name.toLowerCase().includes(q) ||
      app.platform.toLowerCase().includes(q) ||
      app.tags.some((t) => t.toLowerCase().includes(q));
    return matchesTag && matchesQuery;
  });

  const initials = (profile.displayName || profile.email || 'M')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <div className="space-y-8">
      {/* Step 1: Plain-Language Human Check */}
      {!isHumanVerified && (
        <section
          aria-label="Confirm you are a real person"
          className="bg-gradient-to-r from-sky-50 via-white to-indigo-50/70 border border-sky-200 rounded-2xl p-6 sm:p-8"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-6 space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-sky-800">
                <ShieldCheck className="w-4 h-4 text-sky-700" />
                <span>Quick Safety Check</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                {isMobileDevice
                  ? 'Confirm you are a real person'
                  : 'Enter the 6-digit code to unlock your profile'}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {isMobileDevice
                  ? 'Choose your fingerprint/face unlock or enter the 6-digit code below. Once done, you can update all of your profile details.'
                  : 'Before you edit your profile, type the 6 numbers shown below. This protects your account and turns on your 6-digit login code.'}
              </p>

              {(!isMobileDevice || mobileVerifyChoice === 'authenticator') && (
                <BuiltInAuthenticatorCard
                  secret={activeSecret}
                  email={profile.email}
                  onFillCode={(c) => setTotpCodeInput(c)}
                />
              )}
            </div>

            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
              {isMobileDevice && (
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileVerifyChoice('biometrics');
                      setHumanError(null);
                    }}
                    className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg transition-colors ${
                      mobileVerifyChoice === 'biometrics'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Fingerprint / Face
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileVerifyChoice('authenticator');
                      setHumanError(null);
                    }}
                    className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg transition-colors ${
                      mobileVerifyChoice === 'authenticator'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    6-Digit Code
                  </button>
                </div>
              )}

              {humanError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800"
                >
                  {humanError}
                </div>
              )}

              {isMobileDevice && mobileVerifyChoice === 'biometrics' ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200/80 flex items-start gap-3">
                    <Fingerprint className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                      Tap the button below to confirm using your phone&apos;s fingerprint or face
                      unlock.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={verifyingHuman}
                    onClick={handleVerifyHumanWithBiometrics}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-60 rounded-xl transition-colors"
                  >
                    <Fingerprint className="w-4 h-4" />
                    <span>
                      {verifyingHuman ? 'Checking...' : 'Confirm with Fingerprint / Face'}
                    </span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleVerifyHumanWithAuthenticator} className="space-y-4">
                  <div>
                    <label
                      htmlFor="human-totp-input"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Type the 6-digit code
                    </label>
                    <input
                      id="human-totp-input"
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      required
                      value={totpCodeInput}
                      onChange={(e) =>
                        setTotpCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      placeholder="000000"
                      className="w-full px-4 py-3 text-xl font-mono tracking-[0.35em] text-center text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    You can also click &ldquo;Use Code&rdquo; on the card to fill in the 6 numbers
                    automatically.
                  </p>

                  <button
                    type="submit"
                    disabled={verifyingHuman}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-60 rounded-xl transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {verifyingHuman ? 'Checking...' : 'Confirm & Unlock Profile'}
                    </span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Plain-Language Profile Header */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-4 min-w-0">
            {photoURL.trim() ? (
              <img
                src={photoURL.trim()}
                alt={`${profile.displayName} profile photo`}
                referrerPolicy="no-referrer"
                onError={() => setPhotoURL('')}
                className="w-16 h-16 rounded-2xl object-cover border border-slate-200 bg-slate-100 shrink-0"
              />
            ) : (
              <div
                aria-hidden="true"
                className="w-16 h-16 rounded-2xl bg-sky-100 text-sky-800 border border-sky-200 flex items-center justify-center text-lg font-bold shrink-0"
              >
                {initials}
              </div>
            )}

            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
                {profile.displayName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-slate-600">
                <span>{profile.email}</span>
                {profile.handle && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>@{profile.handle}</span>
                  </>
                )}
                {profile.location && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{profile.location}</span>
                  </>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Everything you save on your profile works across all your apps and devices.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTab('notifications')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <Bell className="w-4 h-4" />
              <span>Notifications ({unreadNotifications.length})</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('security')}
              className="px-4 py-2.5 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
            >
              Security Settings
            </button>
          </div>
        </div>

        {/* Simple Summary Numbers */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
          <div>
            <p className="text-xs font-medium text-slate-500">Apps You Connected</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums font-mono">
              {activeAppsCount}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Unread Alerts</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums font-mono">
              {unreadNotifications.length}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Sign-In Methods</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums font-mono">
              {profile.linkedProviders.length}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Your Labels</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums font-mono">
              {availableTags.length}
            </p>
          </div>
        </div>
      </section>

      {/* Main Split: Elaborate Update Profile Form + Plain-Language Status Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Update Your Profile Information
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Fill in your details below so all your apps have the right information about you.
              </p>
            </div>
            {!isHumanVerified && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 shrink-0">
                <Lock className="w-3.5 h-3.5" />
                <span>Unlock above first</span>
              </span>
            )}
          </div>

          {saveMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{saveMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800"
            >
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-8">
            <fieldset disabled={!isHumanVerified || saving} className="space-y-8 disabled:opacity-60">
              {/* Group 1: Personal Details */}
              <div className="space-y-4">
                <div className="pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900">
                    1. Personal Details
                  </h3>
                  <p className="text-xs text-slate-500">
                    Your name, birthday, and a short note about yourself.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="profile-first-name"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      First Name
                    </label>
                    <input
                      id="profile-first-name"
                      type="text"
                      maxLength={40}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Enter your first name"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="profile-last-name"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Last Name
                    </label>
                    <input
                      id="profile-last-name"
                      type="text"
                      maxLength={40}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Enter your last name"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="profile-display-name"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Display Name
                    </label>
                    <input
                      id="profile-display-name"
                      type="text"
                      required
                      maxLength={80}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="How your name appears in apps"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="profile-handle"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Username
                    </label>
                    <input
                      id="profile-handle"
                      type="text"
                      maxLength={40}
                      value={handle}
                      onChange={(e) =>
                        setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))
                      }
                      placeholder="Letters, numbers, dots, or underscores"
                      className="w-full px-3.5 py-2.5 text-sm font-mono text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="profile-dob"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Date of Birth
                    </label>
                    <input
                      id="profile-dob"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="profile-gender"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Gender
                    </label>
                    <select
                      id="profile-gender"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    >
                      <option value="">Prefer not to say</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Non-binary">Non-binary</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="profile-bio"
                    className="block text-sm font-medium text-slate-800 mb-1.5"
                  >
                    About You
                  </label>
                  <textarea
                    id="profile-bio"
                    rows={3}
                    maxLength={300}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Write a short introduction about yourself"
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                  />
                  <p className="mt-1 text-xs text-slate-500 text-right tabular-nums">
                    {bio.length} / 300
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="profile-photo"
                    className="block text-sm font-medium text-slate-800 mb-1.5"
                  >
                    Profile Photo Link (Optional)
                  </label>
                  <input
                    id="profile-photo"
                    type="text"
                    maxLength={500}
                    value={photoURL}
                    onChange={(e) => setPhotoURL(e.target.value)}
                    placeholder="Paste a link to your photo, or leave blank to use your initials"
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                  />
                </div>
              </div>

              {/* Group 2: Contact Information */}
              <div className="space-y-4">
                <div className="pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900">
                    2. Contact Information
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ways to reach you or help you get back into your account.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="profile-primary-email"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Primary Email
                    </label>
                    <input
                      id="profile-primary-email"
                      type="email"
                      readOnly
                      value={profile.email}
                      className="w-full px-3.5 py-2.5 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="profile-secondary-email"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Backup Email (Optional)
                    </label>
                    <input
                      id="profile-secondary-email"
                      type="email"
                      maxLength={254}
                      value={secondaryEmail}
                      onChange={(e) => setSecondaryEmail(e.target.value)}
                      placeholder="Another email address you check"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="profile-phone"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Phone Number
                    </label>
                    <input
                      id="profile-phone"
                      type="tel"
                      maxLength={32}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Enter your phone number"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="profile-website"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Personal Website (Optional)
                    </label>
                    <input
                      id="profile-website"
                      type="text"
                      maxLength={200}
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://yourwebsite.com"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </div>
              </div>

              {/* Group 3: Address & Language */}
              <div className="space-y-4">
                <div className="pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900">
                    3. Home Address &amp; Language
                  </h3>
                  <p className="text-xs text-slate-500">
                    Where you live and what language and time zone you prefer.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="profile-street"
                    className="block text-sm font-medium text-slate-800 mb-1.5"
                  >
                    Street Address
                  </label>
                  <input
                    id="profile-street"
                    type="text"
                    maxLength={120}
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    placeholder="House number and street name"
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="profile-city"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      City
                    </label>
                    <input
                      id="profile-city"
                      type="text"
                      maxLength={60}
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Enter your city"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="profile-state"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      State / Province
                    </label>
                    <input
                      id="profile-state"
                      type="text"
                      maxLength={60}
                      value={stateRegion}
                      onChange={(e) => setStateRegion(e.target.value)}
                      placeholder="Enter your state or province"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="profile-postal"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Postal / ZIP Code
                    </label>
                    <input
                      id="profile-postal"
                      type="text"
                      maxLength={24}
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="Enter postal or ZIP code"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="profile-country"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Country
                    </label>
                    <input
                      id="profile-country"
                      type="text"
                      maxLength={80}
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Enter your country"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="profile-language"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Preferred Language
                    </label>
                    <select
                      id="profile-language"
                      value={preferredLanguage}
                      onChange={(e) => setPreferredLanguage(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    >
                      {LANGUAGE_OPTIONS.map((lang) => (
                        <option key={lang} value={lang}>
                          {lang}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="profile-timezone"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Time Zone
                    </label>
                    <input
                      id="profile-timezone"
                      type="text"
                      maxLength={64}
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      placeholder="For example: Europe/London"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </div>
              </div>

              {/* Group 4: Work & Education */}
              <div className="space-y-4">
                <div className="pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900">
                    4. Work &amp; Organization
                  </h3>
                  <p className="text-xs text-slate-500">
                    Your job, school, or group (optional).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="profile-occupation"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Job Title or Role
                    </label>
                    <input
                      id="profile-occupation"
                      type="text"
                      maxLength={80}
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      placeholder="What you do"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="profile-company"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Company or School
                    </label>
                    <input
                      id="profile-company"
                      type="text"
                      maxLength={80}
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Where you work or study"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </div>
              </div>

              {/* Group 5: Emergency Contact & Device Choice */}
              <div className="space-y-4">
                <div className="pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900">
                    5. Emergency Contact &amp; Main Device
                  </h3>
                  <p className="text-xs text-slate-500">
                    Someone we should keep on file in an emergency, plus your main device.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="profile-emergency-name"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Emergency Contact Name
                    </label>
                    <input
                      id="profile-emergency-name"
                      type="text"
                      maxLength={80}
                      value={emergencyContactName}
                      onChange={(e) => setEmergencyContactName(e.target.value)}
                      placeholder="Full name of someone you trust"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="profile-emergency-phone"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Emergency Contact Phone
                    </label>
                    <input
                      id="profile-emergency-phone"
                      type="tel"
                      maxLength={32}
                      value={emergencyContactPhone}
                      onChange={(e) => setEmergencyContactPhone(e.target.value)}
                      placeholder="Their phone number"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </div>

                <div>
                  <span className="block text-sm font-medium text-slate-800 mb-2">
                    Main Device You Use
                  </span>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { id: 'web' as PlatformType, label: 'Web', Icon: Globe },
                      { id: 'mobile' as PlatformType, label: 'Mobile', Icon: Smartphone },
                      { id: 'desktop' as PlatformType, label: 'Desktop', Icon: Monitor },
                    ].map(({ id, label, Icon }) => {
                      const active = primaryPlatform === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setPrimaryPlatform(id)}
                          className={`flex items-center justify-center gap-2 py-2.5 px-3 text-sm font-medium rounded-xl border transition-colors ${
                            active
                              ? 'bg-sky-50 border-sky-600 text-sky-900'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-800">
                      Your Labels
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('tags')}
                      className="text-xs font-medium text-sky-700 hover:text-sky-800"
                    >
                      Create or manage labels
                    </button>
                  </div>
                  {availableTags.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      You have not created any labels yet. Use labels to organize your profile and apps.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {availableTags.map((tag) => {
                        const selected = tags.includes(tag.label);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleProfileTag(tag.label)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${getTagButtonClasses(
                              tag.tone,
                              selected
                            )}`}
                          >
                            <TagIcon className="w-3 h-3" />
                            <span>{tag.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </fieldset>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
              <p className="text-xs text-slate-500">
                Last saved {formatFirestoreTimestamp(profile.updatedAt)}
              </p>
              <button
                type="submit"
                disabled={!isHumanVerified || saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-60 rounded-xl transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Profile'}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Right Column: Plain-Language Account Status, Authenticator, Notifications & Real Apps */}
        <aside className="lg:col-span-5 space-y-6">
          <section className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-slate-900">
              Account Safety Summary
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              A quick look at how your account is protected.
            </p>
            <dl className="mt-4 divide-y divide-slate-100 text-sm">
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Account ID</dt>
                <dd className="font-mono text-xs text-slate-900 truncate max-w-[190px]">
                  {profile.uid}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Email confirmed</dt>
                <dd className="font-medium text-emerald-700">
                  {authUser.emailVerified ? 'Yes' : 'Waiting'}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Person check</dt>
                <dd
                  className={`font-medium ${
                    isHumanVerified ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {isHumanVerified ? 'Done' : 'Needed'}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">6-digit login code</dt>
                <dd className="font-medium">
                  {profile.securityPreferences.authenticatorEnabled ? (
                    <span className="text-emerald-700">On</span>
                  ) : (
                    <span className="text-slate-500">Off</span>
                  )}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">
                  {isMobileDevice ? 'Fingerprint / face' : '6-digit PIN'}
                </dt>
                <dd className="font-medium text-right">
                  {isMobileDevice ? (
                    profile.securityPreferences.biometricsEnabled ? (
                      <span className="text-emerald-700">On</span>
                    ) : (
                      <span className="text-amber-700">Not set up</span>
                    )
                  ) : profile.securityPreferences.pinConfigured ? (
                    <span className="text-emerald-700 tabular-nums">
                      On · {pinDaysRemaining ?? 90}d left
                    </span>
                  ) : (
                    <span className="text-amber-700">Not set up</span>
                  )}
                </dd>
              </div>
            </dl>

            {isHumanVerified && (
              <button
                type="button"
                onClick={onTriggerEnrollmentModal}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-sky-800 bg-sky-50 hover:bg-sky-100 rounded-xl transition-colors"
              >
                {isMobileDevice ? (
                  <>
                    <Fingerprint className="w-4 h-4" />
                    <span>
                      {profile.securityPreferences.biometricsEnabled
                        ? 'Check Fingerprint / Face Unlock'
                        : 'Turn On Fingerprint / Face Unlock'}
                    </span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>
                      {profile.securityPreferences.pinConfigured
                        ? 'Change Your 6-Digit PIN'
                        : 'Set Up Your 6-Digit PIN (90-Day Change)'}
                    </span>
                  </>
                )}
              </button>
            )}
          </section>

          {isHumanVerified && profile.securityPreferences.authenticatorEnabled && (
            <BuiltInAuthenticatorCard
              secret={profile.securityPreferences.authenticatorSecret}
              email={profile.email}
            />
          )}

          {/* Cross-Platform Notifications Quick Feed */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-base font-semibold text-slate-900">
                Recent Notifications
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('notifications')}
                className="text-xs font-medium text-sky-700 hover:text-sky-800"
              >
                Open Notifications
              </button>
            </div>

            {notifications.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">
                No notifications yet. Alerts for your web, mobile, and desktop apps will show up here.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notifications.slice(0, 3).map((item) => (
                  <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {item.title}
                      </p>
                      <span
                        className={`text-xs shrink-0 ${
                          item.read ? 'text-slate-400' : 'text-sky-700 font-medium'
                        }`}
                      >
                        {item.read ? 'Read' : 'New'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                      {item.message}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Connected Apps (Zero Dummy Data) */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-base font-semibold text-slate-900">
                Your Connected Apps
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('apps')}
                className="text-xs font-medium text-sky-700 hover:text-sky-800"
              >
                Manage Apps
              </button>
            </div>

            {matchingApps.length === 0 ? (
              <div className="py-2 space-y-2">
                <p className="text-sm text-slate-500">
                  {connectedApps.length === 0
                    ? 'You have not connected any apps yet.'
                    : 'No apps match your search or selected label.'}
                </p>
                {connectedApps.length === 0 && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('apps')}
                    className="text-xs font-medium text-sky-700 hover:text-sky-800"
                  >
                    Connect your first app
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {matchingApps.slice(0, 4).map((app) => (
                  <li key={app.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {app.name}
                      </p>
                      <span className="text-xs font-medium text-slate-600 capitalize shrink-0">
                        {app.platform} · {app.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-mono text-slate-500 truncate">
                      {app.redirectUri}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
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
  AccountTag,
  ConnectedApp,
  PlatformType,
  SecurityEvent,
  UserProfile,
} from '../types/systemOne';
import { BuiltInAuthenticatorCard } from './BuiltInAuthenticatorCard';

interface OverviewSectionProps {
  authUser: User;
  profile: UserProfile;
  connectedApps: ConnectedApp[];
  securityEvents: SecurityEvent[];
  availableTags: AccountTag[];
  searchQuery: string;
  selectedTagFilter: string | null;
  isMobileDevice: boolean;
  onSelectTagFilter: (tag: string | null) => void;
  onNavigateTab: (tab: 'apps' | 'security' | 'tags') => void;
  onTriggerEnrollmentModal: () => void;
}

const DEFAULT_AVATAR = '/src/assets/images/default_profile_avatar_1795162285217.jpg';

export function OverviewSection({
  authUser,
  profile,
  connectedApps,
  securityEvents,
  availableTags,
  searchQuery,
  selectedTagFilter,
  isMobileDevice,
  onSelectTagFilter,
  onNavigateTab,
  onTriggerEnrollmentModal,
}: OverviewSectionProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [handle, setHandle] = useState(profile.handle);
  const [bio, setBio] = useState(profile.bio);
  const [phone, setPhone] = useState(profile.phone);
  const [location, setLocation] = useState(profile.location);
  const [photoURL, setPhotoURL] = useState(profile.photoURL);
  const [primaryPlatform, setPrimaryPlatform] = useState<PlatformType>(
    profile.primaryPlatform
  );
  const [tags, setTags] = useState<string[]>(profile.tags);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Human Verification State:
  // Non-mobile devices MUST use the built-in 6-digit authenticator.
  // Mobile devices can choose Biometrics OR the built-in 6-digit authenticator.
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
    setDisplayName(profile.displayName);
    setHandle(profile.handle);
    setBio(profile.bio);
    setPhone(profile.phone);
    setLocation(profile.location);
    setPhotoURL(profile.photoURL);
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
      setHumanError('Please enter the 6-digit code shown in the System One Authenticator.');
      return;
    }

    setVerifyingHuman(true);
    try {
      const valid = await verifyTotpCode(activeSecret, cleaned);
      if (!valid) {
        setHumanError(
          'That 6-digit authenticator code does not match or just rotated. Please enter the current 6 digits.'
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
        title: 'Human verification completed via 6-digit authenticator',
        category: 'security',
        platform: isMobileDevice ? 'mobile' : primaryPlatform,
        provider: 'totp_authenticator',
        targetUrl: window.location.origin,
        tags: ['Security Audit', 'Core Identity'],
        status: 'verified',
      });

      setSaveMessage(
        'Human verification complete and built-in authenticator activated. You can now update your profile.'
      );
      if (needsDeviceActivation) {
        onTriggerEnrollmentModal();
      }
    } catch (err) {
      setHumanError(
        err instanceof Error ? err.message : 'Unable to save human verification status.'
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
        title: `Human verification completed via mobile biometrics (${result.method})`,
        category: 'security',
        platform: 'mobile',
        provider: result.method,
        targetUrl: window.location.origin,
        tags: ['Security Audit', 'Mobile Suite'],
        status: 'verified',
      });

      setSaveMessage(
        'Human verification and mobile biometrics login confirmed. You can now update your profile.'
      );
    } catch (err) {
      setHumanError(
        err instanceof Error ? err.message : 'Unable to complete biometric verification.'
      );
    } finally {
      setVerifyingHuman(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHumanVerified) {
      setErrorMessage('Complete the human verification check above before saving your profile.');
      return;
    }

    setSaving(true);
    setSaveMessage(null);
    setErrorMessage(null);

    try {
      await updateProfileDetails(authUser.uid, {
        displayName,
        handle,
        bio,
        phone,
        location,
        photoURL,
        primaryPlatform,
        tags,
      });

      await logSecurityEvent(authUser.uid, {
        title: 'Unified account profile settings updated',
        category: 'profile',
        platform: primaryPlatform,
        provider: profile.linkedProviders[0] || 'password',
        targetUrl: window.location.origin,
        tags: tags.slice(0, 4),
        status: 'completed',
      });

      setSaveMessage('Profile changes synchronized across all connected applications.');

      if (needsDeviceActivation) {
        onTriggerEnrollmentModal();
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to save profile updates.'
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

  const avatarSrc = photoURL.trim() || DEFAULT_AVATAR;

  return (
    <div className="space-y-8">
      {/* Step 1 Post-Signup Gate: Authenticator-Only on Desktop/Web; Biometrics OR Authenticator on Mobile */}
      {!isHumanVerified && (
        <section
          aria-label="Human verification required"
          className="bg-gradient-to-r from-sky-50 via-white to-indigo-50/70 border border-sky-200 rounded-2xl p-6 sm:p-8"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-6 space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-sky-800">
                <ShieldCheck className="w-4 h-4 text-sky-700" />
                <span>
                  {isMobileDevice
                    ? 'Step 1 · Human Verification (Biometrics or Authenticator)'
                    : 'Step 1 · Human Verification (Authenticator App Required)'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                {isMobileDevice
                  ? 'Verify you are human with biometrics or your 6-digit authenticator'
                  : 'Verify you are human using the 6-digit System One Authenticator'}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {isMobileDevice
                  ? 'On mobile devices, choose between hardware biometrics or the built-in 6-digit authenticator code to unlock your unified profile.'
                  : 'On desktop and web browsers, you must verify using the 6-digit authenticator code below before editing your profile or activating your 90-day 6-digit PIN.'}
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
                    Biometrics
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
                    Authenticator App
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
                      Confirm you are human and enable mobile biometric sign-in right away, or
                      switch to the Authenticator App tab above.
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
                      {verifyingHuman ? 'Verifying...' : 'Verify Human with Biometrics'}
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
                      Enter 6-Digit Authenticator Code
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
                    Enter the 6 digits from the Built-In System One Authenticator (or scan the
                    setup key into your authenticator app). This activates 6-digit login protection
                    and confirms you are human.
                  </p>

                  <button
                    type="submit"
                    disabled={verifyingHuman}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-60 rounded-xl transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {verifyingHuman
                        ? 'Verifying...'
                        : 'Verify Code & Unlock Profile'}
                    </span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Unified Summary Strip */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-4 min-w-0">
            <img
              src={avatarSrc}
              alt={`${profile.displayName} avatar`}
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR;
              }}
              className="w-16 h-16 rounded-2xl object-cover border border-slate-200 bg-slate-100 shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
                {profile.displayName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-slate-600">
                <span>{profile.email}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">@{profile.handle || 'member'}</span>
                <span aria-hidden="true">·</span>
                <span className="capitalize">{profile.primaryPlatform} primary</span>
              </div>
              {profile.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  {profile.tags.map((t, idx) => (
                    <span key={t} className="inline-flex items-center gap-2">
                      {idx > 0 && <span aria-hidden="true">·</span>}
                      <button
                        type="button"
                        onClick={() =>
                          onSelectTagFilter(selectedTagFilter === t ? null : t)
                        }
                        className={`hover:text-sky-700 transition-colors ${
                          selectedTagFilter === t ? 'text-sky-700 font-semibold' : ''
                        }`}
                      >
                        #{t}
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTab('apps')}
              className="px-4 py-2.5 text-sm font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              Manage Apps
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('security')}
              className="px-4 py-2.5 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
            >
              Security Center
            </button>
          </div>
        </div>

        {/* Clean 4-column Tabular KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
          <div>
            <p className="text-xs font-medium text-slate-500">Active Connected Apps</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums font-mono">
              {activeAppsCount}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Linked Sign-In Methods</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums font-mono">
              {profile.linkedProviders.length}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Account Tags</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums font-mono">
              {availableTags.length}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Recorded Events</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums font-mono">
              {securityEvents.length}
            </p>
          </div>
        </div>
      </section>

      {/* Main Split: Profile Settings Form + Identity Credentials & Quick Apps */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Unified Profile & Identity Details
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Changes made here automatically propagate across every connected mobile, desktop,
                and web application.
              </p>
            </div>
            {!isHumanVerified && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 shrink-0">
                <Lock className="w-3.5 h-3.5" />
                <span>Verify First</span>
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

          <form onSubmit={handleSaveProfile} className="space-y-5">
            <fieldset disabled={!isHumanVerified || saving} className="space-y-5 disabled:opacity-60">
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
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="profile-handle"
                    className="block text-sm font-medium text-slate-800 mb-1.5"
                  >
                    Universal Handle
                  </label>
                  <input
                    id="profile-handle"
                    type="text"
                    maxLength={40}
                    value={handle}
                    onChange={(e) =>
                      setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))
                    }
                    placeholder="alex.morgan"
                    className="w-full px-3.5 py-2.5 text-sm font-mono text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="profile-bio"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  Account Summary
                </label>
                <textarea
                  id="profile-bio"
                  rows={3}
                  maxLength={300}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                />
                <p className="mt-1 text-xs text-slate-500 text-right tabular-nums">
                  {bio.length} / 300
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="profile-phone"
                    className="block text-sm font-medium text-slate-800 mb-1.5"
                  >
                    Recovery Phone (Optional)
                  </label>
                  <input
                    id="profile-phone"
                    type="tel"
                    maxLength={32}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 240-9100"
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="profile-location"
                    className="block text-sm font-medium text-slate-800 mb-1.5"
                  >
                    Region / Location
                  </label>
                  <input
                    id="profile-location"
                    type="text"
                    maxLength={80}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="San Francisco, CA"
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="profile-photo"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  Avatar Image URL
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="profile-photo"
                    type="text"
                    maxLength={500}
                    value={photoURL}
                    onChange={(e) => setPhotoURL(e.target.value)}
                    placeholder="https://... or leave blank for System One default"
                    className="flex-1 px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotoURL(DEFAULT_AVATAR)}
                    className="px-3.5 py-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap"
                  >
                    Use Default Portrait
                  </button>
                </div>
              </div>

              <div>
                <span className="block text-sm font-medium text-slate-800 mb-2">
                  Primary Platform
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
                    Account Organization Tags
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('tags')}
                    className="text-xs font-medium text-sky-700 hover:text-sky-800"
                  >
                    Manage Tags
                  </button>
                </div>
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
              </div>
            </fieldset>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
              <p className="text-xs text-slate-500">
                Last synced {formatFirestoreTimestamp(profile.updatedAt)}
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

        {/* Right Column: Identity Metadata, Built-In Authenticator & Quick Apps */}
        <aside className="lg:col-span-5 space-y-6">
          <section className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-slate-900">
              Identity & Device Protection
            </h2>
            <dl className="mt-4 divide-y divide-slate-100 text-sm">
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">System One UID</dt>
                <dd className="font-mono text-xs text-slate-900 truncate max-w-[200px]">
                  {profile.uid}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Email Verification</dt>
                <dd className="font-medium text-emerald-700">
                  {authUser.emailVerified ? 'Verified' : 'Pending'}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Human Verification</dt>
                <dd
                  className={`font-medium ${
                    isHumanVerified ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {isHumanVerified ? 'Confirmed' : 'Action Required'}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">6-Digit Authenticator</dt>
                <dd className="font-medium">
                  {profile.securityPreferences.authenticatorEnabled ? (
                    <span className="text-emerald-700">Active</span>
                  ) : (
                    <span className="text-slate-500">Optional on Mobile</span>
                  )}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">
                  {isMobileDevice ? 'Mobile Biometrics' : '6-Digit Security PIN'}
                </dt>
                <dd className="font-medium text-right">
                  {isMobileDevice ? (
                    profile.securityPreferences.biometricsEnabled ? (
                      <span className="text-emerald-700">Active</span>
                    ) : (
                      <span className="text-amber-700">Not Activated</span>
                    )
                  ) : profile.securityPreferences.pinConfigured ? (
                    <span className="text-emerald-700 tabular-nums">
                      Active · {pinDaysRemaining ?? 90}d left
                    </span>
                  ) : (
                    <span className="text-amber-700">Not Configured</span>
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
                        ? 'Re-Verify Mobile Biometrics'
                        : 'Activate Mobile Biometrics'}
                    </span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>
                      {profile.securityPreferences.pinConfigured
                        ? 'Update 6-Digit Security PIN'
                        : 'Activate 6-Digit PIN (90-Day Cycle)'}
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

          <section className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-base font-semibold text-slate-900">
                Connected Applications
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('apps')}
                className="text-xs font-medium text-sky-700 hover:text-sky-800"
              >
                View All
              </button>
            </div>

            {matchingApps.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">
                No connected applications match your current search or tag filter.
              </p>
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

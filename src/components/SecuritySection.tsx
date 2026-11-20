import { useEffect, useState } from 'react';
import { sendPasswordResetEmail, User } from 'firebase/auth';
import { CheckCircle2, Fingerprint, KeyRound, RefreshCw, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { generateTotpSecret } from '../lib/authenticator';
import { auth } from '../lib/firebase';
import { formatFirestoreTimestamp } from '../lib/formatters';
import {
  createCrossPlatformNotification,
  deleteSecurityEvent,
  logSecurityEvent,
  updateNotificationPreferences,
  updateSecurityPreferences,
} from '../lib/firestoreService';
import { daysUntilPinRotation, isPinExpiredOrDue } from '../lib/securityEnrollment';
import {
  EventCategory,
  NotificationPreferences,
  SecurityEvent,
  SecurityPreferences,
  UserProfile,
} from '../types/systemOne';
import { BuiltInAuthenticatorCard } from './BuiltInAuthenticatorCard';

interface SecuritySectionProps {
  authUser: User;
  profile: UserProfile;
  securityEvents: SecurityEvent[];
  searchQuery: string;
  selectedTagFilter: string | null;
  isMobileDevice: boolean;
  onTriggerEnrollmentModal: () => void;
}

export function SecuritySection({
  authUser,
  profile,
  securityEvents,
  searchQuery,
  selectedTagFilter,
  isMobileDevice,
  onTriggerEnrollmentModal,
}: SecuritySectionProps) {
  const [secPrefs, setSecPrefs] = useState<SecurityPreferences>(
    profile.securityPreferences
  );
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(
    profile.notificationPreferences
  );
  const [categoryFilter, setCategoryFilter] = useState<'all' | EventCategory>('all');
  const [saving, setSaving] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setSecPrefs(profile.securityPreferences);
    setNotifPrefs(profile.notificationPreferences);
  }, [profile]);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusNotice(null);
    setErrorMsg(null);
    try {
      await updateSecurityPreferences(authUser.uid, secPrefs);
      await updateNotificationPreferences(authUser.uid, notifPrefs);
      await logSecurityEvent(authUser.uid, {
        title: 'Security settings updated',
        category: 'security',
        platform: profile.primaryPlatform,
        provider: 'system_one_policy',
        targetUrl: window.location.origin,
        tags: profile.tags.slice(0, 4),
        status: 'verified',
      });
      await createCrossPlatformNotification(
        authUser.uid,
        {
          title: 'Security settings saved',
          message: 'Your updated safety rules are active across your web, mobile, and desktop apps.',
          category: 'security',
          sourcePlatform: isMobileDevice ? 'mobile' : profile.primaryPlatform,
        },
        notifPrefs
      );
      setStatusNotice('Security and notification settings saved for all your devices.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendPasswordReset = async () => {
    const targetEmail = authUser.email;
    if (!targetEmail) return;
    setSaving(true);
    setStatusNotice(null);
    setErrorMsg(null);
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      await logSecurityEvent(authUser.uid, {
        title: 'Password reset email sent',
        category: 'security',
        platform: profile.primaryPlatform,
        provider: 'password',
        targetUrl: window.location.origin,
        tags: profile.tags.slice(0, 4),
        status: 'completed',
      });
      await createCrossPlatformNotification(
        authUser.uid,
        {
          title: 'Password reset email sent',
          message: `We sent password reset instructions to ${targetEmail}.`,
          category: 'security',
          sourcePlatform: isMobileDevice ? 'mobile' : profile.primaryPlatform,
        },
        notifPrefs
      );
      setStatusNotice(`Password reset link sent to ${targetEmail}.`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to send password reset email.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleOrRotateAuthenticator = async (rotateSecret = false) => {
    setSaving(true);
    setStatusNotice(null);
    setErrorMsg(null);
    try {
      const nextSecret =
        rotateSecret || !secPrefs.authenticatorSecret
          ? generateTotpSecret()
          : secPrefs.authenticatorSecret;
      const nextEnabled = rotateSecret ? true : !secPrefs.authenticatorEnabled;

      const updated: SecurityPreferences = {
        ...secPrefs,
        authenticatorEnabled: nextEnabled,
        authenticatorSecret: nextSecret,
      };
      await updateSecurityPreferences(authUser.uid, updated);
      setSecPrefs(updated);
      await logSecurityEvent(authUser.uid, {
        title: rotateSecret
          ? 'Generated new 6-digit authenticator key'
          : nextEnabled
            ? 'Turned on 6-digit authenticator'
            : 'Turned off 6-digit authenticator',
        category: 'security',
        platform: isMobileDevice ? 'mobile' : profile.primaryPlatform,
        provider: 'totp_authenticator',
        targetUrl: window.location.origin,
        tags: profile.tags.slice(0, 4),
        status: 'verified',
      });
      await createCrossPlatformNotification(
        authUser.uid,
        {
          title: rotateSecret
            ? 'Authenticator key updated'
            : nextEnabled
              ? '6-digit authenticator turned on'
              : '6-digit authenticator turned off',
          message: rotateSecret
            ? 'A fresh 6-digit setup key was generated for your account.'
            : nextEnabled
              ? 'Sign-ins will ask for a 6-digit code from your authenticator.'
              : '6-digit login code check was turned off.',
          category: 'security',
          sourcePlatform: isMobileDevice ? 'mobile' : profile.primaryPlatform,
        },
        notifPrefs
      );
      setStatusNotice(
        rotateSecret
          ? 'New 6-digit authenticator key created.'
          : nextEnabled
            ? '6-digit authenticator turned on for logins.'
            : '6-digit authenticator turned off.'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to update authenticator setting.'
      );
    } finally {
      setSaving(false);
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredEvents = securityEvents.filter((evt) => {
    const matchesCategory = categoryFilter === 'all' || evt.category === categoryFilter;
    const matchesTag = !selectedTagFilter || evt.tags.includes(selectedTagFilter);
    const matchesSearch =
      !q ||
      evt.title.toLowerCase().includes(q) ||
      evt.platform.toLowerCase().includes(q) ||
      evt.provider.toLowerCase().includes(q) ||
      evt.targetUrl.toLowerCase().includes(q) ||
      evt.tags.some((t) => t.toLowerCase().includes(q));
    return matchesCategory && matchesTag && matchesSearch;
  });

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Unified Security Preferences */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Security &amp; Privacy Settings
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Control how your account stays safe across all your connected apps and devices.
              </p>
            </div>
            <ShieldCheck className="w-6 h-6 text-sky-700 shrink-0 mt-1" />
          </div>

          {statusNotice && (
            <div className="mt-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{statusNotice}</span>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="mt-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800"
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSavePreferences} className="mt-6 space-y-6">
            <div className="divide-y divide-slate-100">
              <label className="py-4 first:pt-0 flex items-start justify-between gap-4 cursor-pointer">
                <div>
                  <span className="block text-sm font-semibold text-slate-900">
                    Check unfamiliar return links
                  </span>
                  <span className="block text-xs text-slate-600 mt-0.5">
                    Warn before sending you back to an app you have not added to Connected Apps.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={secPrefs.trustedRedirectOnly}
                  onChange={(e) =>
                    setSecPrefs({ ...secPrefs, trustedRedirectOnly: e.target.checked })
                  }
                  className="mt-1 w-4 h-4 accent-sky-700 rounded"
                />
              </label>

              <label className="py-4 flex items-start justify-between gap-4 cursor-pointer">
                <div>
                  <span className="block text-sm font-semibold text-slate-900">
                    Protect sensitive changes
                  </span>
                  <span className="block text-xs text-slate-600 mt-0.5">
                    Make sure your email is confirmed before editing safety settings or removing apps.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={secPrefs.requireReauthForSensitive}
                  onChange={(e) =>
                    setSecPrefs({
                      ...secPrefs,
                      requireReauthForSensitive: e.target.checked,
                    })
                  }
                  className="mt-1 w-4 h-4 accent-sky-700 rounded"
                />
              </label>

              <label className="py-4 flex items-start justify-between gap-4 cursor-pointer">
                <div>
                  <span className="block text-sm font-semibold text-slate-900">
                    Record sign-in activity
                  </span>
                  <span className="block text-xs text-slate-600 mt-0.5">
                    Keep a log of your sign-ins and app connections in the activity list below.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={secPrefs.loginAlerts}
                  onChange={(e) =>
                    setSecPrefs({ ...secPrefs, loginAlerts: e.target.checked })
                  }
                  className="mt-1 w-4 h-4 accent-sky-700 rounded"
                />
              </label>

              <label className="py-4 flex items-start justify-between gap-4 cursor-pointer">
                <div>
                  <span className="block text-sm font-semibold text-slate-900">
                    Two-step sign-in reminder
                  </span>
                  <span className="block text-xs text-slate-600 mt-0.5">
                    Remind connected devices to check your second verification step on new logins.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={secPrefs.twoFactorNotice}
                  onChange={(e) =>
                    setSecPrefs({ ...secPrefs, twoFactorNotice: e.target.checked })
                  }
                  className="mt-1 w-4 h-4 accent-sky-700 rounded"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label
                  htmlFor="session-timeout"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  Auto Sign-Out After Inactivity
                </label>
                <select
                  id="session-timeout"
                  value={secPrefs.sessionTimeoutMinutes}
                  onChange={(e) =>
                    setSecPrefs({
                      ...secPrefs,
                      sessionTimeoutMinutes: Number(
                        e.target.value
                      ) as SecurityPreferences['sessionTimeoutMinutes'],
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 tabular-nums"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>60 minutes</option>
                  <option value={240}>4 hours</option>
                  <option value={1440}>24 hours</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="recovery-email"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  Backup Recovery Email
                </label>
                <input
                  id="recovery-email"
                  type="email"
                  maxLength={254}
                  value={secPrefs.passwordRecoveryEmail}
                  onChange={(e) =>
                    setSecPrefs({ ...secPrefs, passwordRecoveryEmail: e.target.value })
                  }
                  placeholder="Enter a backup email"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-60 rounded-xl transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Security Settings'}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Right: Password Recovery, PIN/Biometrics & Built-In Authenticator */}
        <aside className="lg:col-span-5 space-y-6">
          <section className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center gap-2.5 text-slate-900">
              <KeyRound className="w-5 h-5 text-sky-700" />
              <h2 className="text-base font-semibold">Password Reset</h2>
            </div>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Send a password reset link to{' '}
              <span className="font-medium text-slate-900">{authUser.email}</span> whenever you want
              to change or add a password.
            </p>
            <button
              type="button"
              disabled={saving}
              onClick={handleSendPasswordReset}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 rounded-xl transition-colors"
            >
              <KeyRound className="w-4 h-4" />
              <span>Send Password Reset Email</span>
            </button>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-slate-900">
              {isMobileDevice ? (
                <Fingerprint className="w-5 h-5 text-sky-700" />
              ) : (
                <KeyRound className="w-5 h-5 text-sky-700" />
              )}
              <h2 className="text-base font-semibold">
                {isMobileDevice
                  ? 'Mobile Fingerprint / Face Unlock'
                  : '6-Digit PIN (90-Day Change)'}
              </h2>
            </div>
            {isMobileDevice ? (
              <p className="text-sm text-slate-600 leading-relaxed">
                Status:{' '}
                <strong className="text-slate-900">
                  {profile.securityPreferences.biometricsEnabled
                    ? 'Active'
                    : 'Not set up'}
                </strong>
                . Use your phone&apos;s fingerprint or face unlock for fast sign-in.
              </p>
            ) : (
              <p className="text-sm text-slate-600 leading-relaxed tabular-nums">
                {profile.securityPreferences.pinConfigured ? (
                  isPinExpiredOrDue(profile.securityPreferences) ? (
                    <span className="text-red-700 font-medium">
                      Your 90-day PIN period is up. Please set a new 6-digit PIN.
                    </span>
                  ) : (
                    <span>
                      Your 6-digit PIN is active. Next change due in{' '}
                      <strong className="text-slate-900">
                        {daysUntilPinRotation(profile.securityPreferences.pinExpiresAt) ?? 90}{' '}
                        days
                      </strong>
                      .
                    </span>
                  )
                ) : (
                  'Desktop and web users set a 6-digit PIN that is updated every 3 months (90 days).'
                )}
              </p>
            )}
            <button
              type="button"
              onClick={onTriggerEnrollmentModal}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-xl transition-colors"
            >
              <span>
                {isMobileDevice
                  ? profile.securityPreferences.biometricsEnabled
                    ? 'Manage Biometrics Login'
                    : 'Turn On Biometrics Login'
                  : profile.securityPreferences.pinConfigured
                    ? 'Change 6-Digit PIN'
                    : 'Set Up 6-Digit PIN'}
              </span>
            </button>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 text-slate-900">
                <ShieldCheck className="w-5 h-5 text-sky-700" />
                <h2 className="text-base font-semibold">Built-In 6-Digit Authenticator</h2>
              </div>
              {secPrefs.authenticatorEnabled && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleToggleOrRotateAuthenticator(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-800"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>New Key</span>
                </button>
              )}
            </div>

            {secPrefs.authenticatorEnabled && secPrefs.authenticatorSecret ? (
              <BuiltInAuthenticatorCard
                secret={secPrefs.authenticatorSecret}
                email={profile.email}
              />
            ) : (
              <p className="text-sm text-slate-600 leading-relaxed">
                Get rotating 6-digit codes right here so you can verify logins from any device.
              </p>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={() => handleToggleOrRotateAuthenticator(false)}
              className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                secPrefs.authenticatorEnabled
                  ? 'text-slate-800 bg-slate-100 hover:bg-slate-200'
                  : 'text-white bg-sky-700 hover:bg-sky-800'
              }`}
            >
              <span>
                {secPrefs.authenticatorEnabled
                  ? 'Turn Off 6-Digit Authenticator'
                  : 'Turn On 6-Digit Authenticator'}
              </span>
            </button>
          </section>
        </aside>
      </div>

      {/* Audit & Session Activity Table */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Account Activity History
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Real sign-ins, profile updates, and security changes on your account.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {(['all', 'auth', 'redirect', 'security', 'app', 'profile'] as const).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors whitespace-nowrap ${
                    categoryFilter === cat
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              )
            )}
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            No activity recorded matching your filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-3 pr-4">Activity</th>
                  <th className="py-3 px-4">Device</th>
                  <th className="py-3 px-4">Labels</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Date</th>
                  <th className="py-3 pl-4 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 pr-4">
                      <p className="font-medium text-slate-900">{evt.title}</p>
                      {evt.targetUrl && (
                        <p className="text-xs font-mono text-slate-500 truncate max-w-xs">
                          {evt.targetUrl}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 capitalize text-slate-700 whitespace-nowrap">
                      {evt.platform}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {evt.tags.length > 0 ? evt.tags.map((t) => `#${t}`).join(' · ') : '—'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`text-xs font-medium capitalize ${
                          evt.status === 'verified' || evt.status === 'completed'
                            ? 'text-emerald-700'
                            : evt.status === 'revoked'
                              ? 'text-red-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {evt.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {formatFirestoreTimestamp(evt.createdAt)}
                    </td>
                    <td className="py-3.5 pl-4 text-right">
                      <button
                        type="button"
                        aria-label={`Remove event ${evt.title}`}
                        onClick={() => deleteSecurityEvent(authUser.uid, evt.id)}
                        className="p-1.5 text-slate-400 hover:text-red-700 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

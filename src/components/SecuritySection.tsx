import { useEffect, useState } from 'react';
import { sendPasswordResetEmail, User } from 'firebase/auth';
import { CheckCircle2, Fingerprint, KeyRound, RefreshCw, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { generateTotpSecret } from '../lib/authenticator';
import { auth } from '../lib/firebase';
import { formatFirestoreTimestamp } from '../lib/formatters';
import {
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
        title: 'Security & notification preferences updated',
        category: 'security',
        platform: profile.primaryPlatform,
        provider: 'system_one_policy',
        targetUrl: window.location.origin,
        tags: ['Security Audit', 'Core Identity'],
        status: 'verified',
      });
      setStatusNotice('Security and notification preferences saved across all platforms.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save preferences.');
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
        title: 'Password recovery email dispatched',
        category: 'security',
        platform: profile.primaryPlatform,
        provider: 'password',
        targetUrl: window.location.origin,
        tags: ['Security Audit'],
        status: 'completed',
      });
      setStatusNotice(`Password reset link sent to ${targetEmail}.`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to send password recovery email.'
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
          ? 'Rotated built-in 6-digit authenticator secret'
          : nextEnabled
            ? 'Built-in 6-digit authenticator enabled'
            : 'Built-in 6-digit authenticator disabled',
        category: 'security',
        platform: isMobileDevice ? 'mobile' : profile.primaryPlatform,
        provider: 'totp_authenticator',
        targetUrl: window.location.origin,
        tags: ['Security Audit'],
        status: 'verified',
      });
      setStatusNotice(
        rotateSecret
          ? 'New 6-digit authenticator secret generated.'
          : nextEnabled
            ? 'Built-in 6-digit authenticator activated for logins.'
            : 'Built-in 6-digit authenticator turned off.'
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
                Cross-Platform Security Preferences
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Govern session lifetimes, redirect trust boundaries, and account recovery
                behavior for every app linked to System One.
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
                    Strict Trusted Redirect Enforcement
                  </span>
                  <span className="block text-xs text-slate-600 mt-0.5">
                    Warn before redirecting via <code className="font-mono">redirect_to</code>{' '}
                    to origins not registered in Connected Apps.
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
                    Require Fresh Verification on Sensitive Edits
                  </span>
                  <span className="block text-xs text-slate-600 mt-0.5">
                    Enforce verified email status before modifying security rules or revoking app
                    access.
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
                    Sign-In & Redirect Activity Alerts
                  </span>
                  <span className="block text-xs text-slate-600 mt-0.5">
                    Record authentication and cross-app return transitions in your audit trail.
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
                    Multi-Factor Verification Prompt
                  </span>
                  <span className="block text-xs text-slate-600 mt-0.5">
                    Remind connected platforms to request elevated factor verification on new
                    devices.
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
                  Idle Session Timeout
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
                  placeholder="backup@example.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <span className="block text-sm font-semibold text-slate-900">
                Notification Channels
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-center gap-2.5 p-3 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={notifPrefs.newDeviceAlert}
                    onChange={(e) =>
                      setNotifPrefs({ ...notifPrefs, newDeviceAlert: e.target.checked })
                    }
                    className="w-4 h-4 accent-sky-700"
                  />
                  <span>New Device Alerts</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={notifPrefs.appAuthorizationAlert}
                    onChange={(e) =>
                      setNotifPrefs({
                        ...notifPrefs,
                        appAuthorizationAlert: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-sky-700"
                  />
                  <span>App Authorizations</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={notifPrefs.securityDigest}
                    onChange={(e) =>
                      setNotifPrefs({ ...notifPrefs, securityDigest: e.target.checked })
                    }
                    className="w-4 h-4 accent-sky-700"
                  />
                  <span>Weekly Digest</span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-60 rounded-xl transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Security Policy'}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Right: Password Recovery & Session Hygiene */}
        <aside className="lg:col-span-5 space-y-6">
          <section className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center gap-2.5 text-slate-900">
              <KeyRound className="w-5 h-5 text-sky-700" />
              <h2 className="text-base font-semibold">Password & Credential Recovery</h2>
            </div>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Send a Firebase password reset link to{' '}
              <span className="font-medium text-slate-900">{authUser.email}</span> at any time.
              If you sign in solely with Google, setting a password lets you also sign in via
              email on desktop or mobile clients.
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
                  ? 'Mobile Biometrics Login'
                  : '6-Digit Security PIN (90-Day Policy)'}
              </h2>
            </div>
            {isMobileDevice ? (
              <p className="text-sm text-slate-600 leading-relaxed">
                Status:{' '}
                <strong className="text-slate-900">
                  {profile.securityPreferences.biometricsEnabled
                    ? 'Biometrics Active'
                    : 'Not Activated'}
                </strong>
                . Mobile devices use platform biometrics for rapid sign-on verification.
              </p>
            ) : (
              <p className="text-sm text-slate-600 leading-relaxed tabular-nums">
                {profile.securityPreferences.pinConfigured ? (
                  isPinExpiredOrDue(profile.securityPreferences) ? (
                    <span className="text-red-700 font-medium">
                      Your 90-day PIN rotation period has elapsed. Please activate a new 6-digit
                      PIN.
                    </span>
                  ) : (
                    <span>
                      6-digit PIN active. Next mandatory rotation in{' '}
                      <strong className="text-slate-900">
                        {daysUntilPinRotation(profile.securityPreferences.pinExpiresAt) ?? 90}{' '}
                        days
                      </strong>
                      .
                    </span>
                  )
                ) : (
                  'Desktop and web sessions require a 6-digit security PIN changed every 3 months (90 days).'
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
                    : 'Activate Biometrics Login'
                  : profile.securityPreferences.pinConfigured
                    ? 'Change 6-Digit PIN'
                    : 'Activate 6-Digit PIN'}
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
                  <span>Rotate Key</span>
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
                Generate 6-digit TOTP codes inside System One for logging in from any browser or
                connected app.
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
                  ? 'Disable 6-Digit Authenticator'
                  : 'Activate Built-In 6-Digit Authenticator'}
              </span>
            </button>
          </section>

          <section className="bg-gradient-to-br from-sky-50/70 to-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-slate-900">
              Session Continuity Guarantee
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              System One persists authentication state locally across page reloads and
              cross-platform <code className="font-mono text-xs">redirect_to</code> transitions so
              returning users keep their verified context.
            </p>
          </section>
        </aside>
      </div>

      {/* Audit & Session Activity Table */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Session & Audit Activity Log
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Searchable record of sign-ins, redirect handoffs, and preference updates.
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
            No security events match your current search or tag filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-3 pr-4">Event</th>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4">Tags</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Recorded</th>
                  <th className="py-3 pl-4 text-right">Action</th>
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

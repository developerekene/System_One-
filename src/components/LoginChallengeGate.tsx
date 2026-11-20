import { useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowRight,
  Fingerprint,
  KeyRound,
  LogOut,
  Monitor,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { verifyTotpCode } from '../lib/authenticator';
import { createCrossPlatformNotification, logSecurityEvent } from '../lib/firestoreService';
import { attemptPlatformBiometricEnrollment } from '../lib/securityEnrollment';
import { RedirectContext, UserProfile } from '../types/systemOne';
import { BuiltInAuthenticatorCard } from './BuiltInAuthenticatorCard';
import { SystemOneLogo } from './SystemOneLogo';

interface LoginChallengeGateProps {
  authUser: User;
  profile: UserProfile;
  isMobileDevice: boolean;
  redirectContext: RedirectContext | null;
  onVerified: () => void;
  onSignOut: () => void;
}

export function LoginChallengeGate({
  authUser,
  profile,
  isMobileDevice,
  redirectContext,
  onVerified,
  onSignOut,
}: LoginChallengeGateProps) {
  const canUseBiometrics =
    isMobileDevice && profile.securityPreferences.biometricsEnabled;
  const hasAuthenticator =
    profile.securityPreferences.authenticatorEnabled &&
    Boolean(profile.securityPreferences.authenticatorSecret);

  const [method, setMethod] = useState<'authenticator' | 'biometrics'>(
    canUseBiometrics ? 'biometrics' : 'authenticator'
  );
  const [codeInput, setCodeInput] = useState('');
  const [showBuiltInGenerator, setShowBuiltInGenerator] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const notifySignIn = async (platformLabel: 'web' | 'mobile' | 'desktop') => {
    if (!profile.notificationPreferences.newDeviceAlert) return;
    await createCrossPlatformNotification(
      authUser.uid,
      {
        title: `New sign-in on ${platformLabel}`,
        message: `You signed into your System One account on a ${platformLabel} device.`,
        category: 'security',
        sourcePlatform: platformLabel,
      },
      profile.notificationPreferences
    );
  };

  const handleVerifyAuthenticator = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleaned = codeInput.replace(/\D/g, '').trim();
    if (cleaned.length !== 6) {
      setErrorMsg('Please enter all 6 digits from your authenticator.');
      return;
    }

    setBusy(true);
    try {
      const ok = await verifyTotpCode(
        profile.securityPreferences.authenticatorSecret,
        cleaned
      );
      if (!ok) {
        setErrorMsg(
          'That 6-digit code did not match or just expired. Try the newest code.'
        );
        return;
      }

      const activePlatform = isMobileDevice ? 'mobile' : profile.primaryPlatform;

      await logSecurityEvent(authUser.uid, {
        title: 'Signed in with 6-digit authenticator code',
        category: 'auth',
        platform: activePlatform,
        provider: 'totp_authenticator',
        targetUrl: redirectContext?.redirectTo || window.location.origin,
        tags: profile.tags.slice(0, 4),
        status: 'verified',
      });

      await notifySignIn(activePlatform);
      onVerified();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to check authenticator code.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyBiometrics = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const result = await attemptPlatformBiometricEnrollment(
        authUser.uid,
        profile.email,
        profile.displayName
      );
      await logSecurityEvent(authUser.uid, {
        title: `Signed in with mobile biometrics (${result.method})`,
        category: 'auth',
        platform: 'mobile',
        provider: result.method,
        targetUrl: redirectContext?.redirectTo || window.location.origin,
        tags: profile.tags.slice(0, 4),
        status: 'verified',
      });
      await notifySignIn('mobile');
      onVerified();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Biometric check did not complete. Please use the 6-digit code instead.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-[#F1F5F9] to-[#E0F2FE]/60 flex flex-col">
      <header className="bg-white/90 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <SystemOneLogo size="md" />
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <section className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-sky-700">
              {isMobileDevice ? (
                <>
                  <Smartphone className="w-4 h-4" />
                  <span>Mobile Login Check</span>
                </>
              ) : (
                <>
                  <Monitor className="w-4 h-4" />
                  <span>Authenticator Login Check</span>
                </>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              Confirm it&apos;s really you
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Signed in as <strong className="text-slate-900">{profile.email}</strong>.{' '}
              {redirectContext
                ? `Finish this step to go back to ${redirectContext.appName}.`
                : 'Finish this step to open your System One profile.'}
            </p>
          </div>

          {canUseBiometrics && hasAuthenticator && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setMethod('biometrics');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                  method === 'biometrics'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Fingerprint / Face
              </button>
              <button
                type="button"
                onClick={() => {
                  setMethod('authenticator');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                  method === 'authenticator'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                6-Digit Code
              </button>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800"
            >
              {errorMsg}
            </div>
          )}

          {method === 'biometrics' && canUseBiometrics ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200/80 flex items-start gap-3">
                <Fingerprint className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  Use your phone&apos;s fingerprint or face unlock, or switch to the 6-digit code tab above.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleVerifyBiometrics}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-60 rounded-xl transition-colors"
              >
                <Fingerprint className="w-4 h-4" />
                <span>{busy ? 'Checking...' : 'Confirm with Fingerprint / Face'}</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleVerifyAuthenticator} className="space-y-4">
              <div>
                <label
                  htmlFor="login-totp-code"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  Enter 6-Digit Code
                </label>
                <input
                  id="login-totp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  value={codeInput}
                  onChange={(e) =>
                    setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="000000"
                  className="w-full px-4 py-3 text-xl font-mono tracking-[0.35em] text-center text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-60 rounded-xl transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{busy ? 'Checking...' : 'Confirm & Open Profile'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {hasAuthenticator && (
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowBuiltInGenerator((s) => !s)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 hover:text-sky-800"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>
                      {showBuiltInGenerator
                        ? 'Hide Built-In Authenticator'
                        : 'Show Built-In 6-Digit Code'}
                    </span>
                  </button>

                  {showBuiltInGenerator && (
                    <div className="mt-3">
                      <BuiltInAuthenticatorCard
                        secret={profile.securityPreferences.authenticatorSecret}
                        email={profile.email}
                        compact
                        onFillCode={(c) => setCodeInput(c)}
                      />
                    </div>
                  )}
                </div>
              )}
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

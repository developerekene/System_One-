import { useState } from 'react';
import { User } from 'firebase/auth';
import {
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Monitor,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  createCrossPlatformNotification,
  logSecurityEvent,
  updateSecurityPreferences,
} from '../lib/firestoreService';
import {
  attemptPlatformBiometricEnrollment,
  buildPinRotationDates,
  hashSecurityPin,
  PIN_ROTATION_DAYS,
} from '../lib/securityEnrollment';
import { UserProfile } from '../types/systemOne';

interface SecurityEnrollmentBottomModalProps {
  open: boolean;
  isMobile: boolean;
  isPinRotationRenewal?: boolean;
  authUser: User;
  profile: UserProfile;
  onClose: () => void;
  onCompleted: (message: string) => void;
}

export function SecurityEnrollmentBottomModal({
  open,
  isMobile,
  isPinRotationRenewal = false,
  authUser,
  profile,
  onClose,
  onCompleted,
}: SecurityEnrollmentBottomModalProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleActivateBiometrics = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const result = await attemptPlatformBiometricEnrollment(
        authUser.uid,
        profile.email,
        profile.displayName
      );

      await updateSecurityPreferences(authUser.uid, {
        ...profile.securityPreferences,
        biometricsEnabled: true,
      });

      await logSecurityEvent(authUser.uid, {
        title: `Mobile fingerprint / face unlock activated (${result.method})`,
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
          title: 'Mobile unlock active',
          message: 'Fingerprint or face login is now turned on for your mobile device.',
          category: 'security',
          sourcePlatform: 'mobile',
        },
        profile.notificationPreferences
      );

      onCompleted('Fingerprint / face login is now turned on for your phone.');
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to turn on biometrics login.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleActivatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanPin = pin.trim();
    const cleanConfirm = confirmPin.trim();

    if (!/^\d{6}$/.test(cleanPin)) {
      setErrorMsg('Please enter 6 numbers (0–9).');
      return;
    }

    if (cleanPin !== cleanConfirm) {
      setErrorMsg('The two PINs do not match. Please enter both again.');
      return;
    }

    if (/^(\d)\1{5}$/.test(cleanPin) || cleanPin === '123456' || cleanPin === '654321') {
      setErrorMsg('Please pick a stronger 6-digit PIN without repeated or simple sequences.');
      return;
    }

    setBusy(true);
    try {
      const pinHash = await hashSecurityPin(cleanPin, authUser.uid);
      const { pinUpdatedAt, pinExpiresAt } = buildPinRotationDates();

      await updateSecurityPreferences(authUser.uid, {
        ...profile.securityPreferences,
        pinConfigured: true,
        pinHash,
        pinUpdatedAt,
        pinExpiresAt,
      });

      await logSecurityEvent(authUser.uid, {
        title: isPinRotationRenewal
          ? '6-digit security PIN updated (90-day cycle)'
          : '6-digit security PIN set up (90-day change policy)',
        category: 'security',
        platform: profile.primaryPlatform === 'mobile' ? 'desktop' : profile.primaryPlatform,
        provider: 'pin_6_digit',
        targetUrl: window.location.origin,
        tags: profile.tags.slice(0, 4),
        status: 'verified',
      });

      await createCrossPlatformNotification(
        authUser.uid,
        {
          title: '6-digit PIN updated',
          message: `Your 6-digit PIN is saved. Remember to change it again in ${PIN_ROTATION_DAYS} days.`,
          category: 'security',
          sourcePlatform: profile.primaryPlatform === 'mobile' ? 'desktop' : profile.primaryPlatform,
        },
        profile.notificationPreferences
      );

      setPin('');
      setConfirmPin('');
      onCompleted(
        `Your 6-digit PIN is active. Next change due in ${PIN_ROTATION_DAYS} days.`
      );
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to save your 6-digit PIN.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="security-bottom-modal-title"
          className="fixed inset-0 z-50 flex items-end justify-center"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/35 backdrop-blur-[2px]"
          />

          <motion.div
            initial={{ y: '100%', opacity: 0.9 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.9 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-xl bg-white border-t sm:border border-slate-200 rounded-t-2xl sm:rounded-2xl sm:mb-6 p-6 sm:p-8 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
                  {isMobile ? (
                    <Fingerprint className="w-5 h-5" />
                  ) : (
                    <KeyRound className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-sky-700">
                    {isMobile ? (
                      <>
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Mobile Device</span>
                      </>
                    ) : (
                      <>
                        <Monitor className="w-3.5 h-3.5" />
                        <span>Desktop / Web Device</span>
                      </>
                    )}
                  </div>
                  <h2
                    id="security-bottom-modal-title"
                    className="text-lg font-bold text-slate-900 mt-0.5"
                  >
                    {isMobile
                      ? 'Turn On Fingerprint / Face Unlock'
                      : isPinRotationRenewal
                        ? 'Update Your 6-Digit PIN'
                        : 'Set Up Your 6-Digit PIN'}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                aria-label="Close security modal"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800"
              >
                {errorMsg}
              </div>
            )}

            {isMobile ? (
              <div className="mt-5 space-y-5">
                <p className="text-sm text-slate-600 leading-relaxed">
                  You are on a mobile phone. Turn on fingerprint or face unlock so you can sign
                  into your apps quickly without typing your password every time.
                </p>

                <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200/80 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-700 leading-relaxed">
                    Your fingerprint or face scan never leaves your phone.
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleActivateBiometrics}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-60 rounded-xl transition-colors"
                  >
                    <Fingerprint className="w-4 h-4" />
                    <span>{busy ? 'Turning on...' : 'Turn On Biometrics'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-3 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Later
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleActivatePin} className="mt-5 space-y-4">
                <p className="text-sm text-slate-600 leading-relaxed">
                  On desktop and web browsers, choose a{' '}
                  <strong className="text-slate-900">6-digit PIN</strong> to keep your account extra
                  safe. You will be asked to change this PIN every{' '}
                  <strong className="text-slate-900">3 months (90 days)</strong>.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="pin-input"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Enter 6-Digit PIN
                    </label>
                    <input
                      id="pin-input"
                      type="password"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      required
                      value={pin}
                      onChange={(e) =>
                        setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      placeholder="••••••"
                      className="w-full px-3.5 py-2.5 text-base font-mono tracking-[0.3em] text-center text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="pin-confirm-input"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Confirm 6-Digit PIN
                    </label>
                    <input
                      id="pin-confirm-input"
                      type="password"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      required
                      value={confirmPin}
                      onChange={(e) =>
                        setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      placeholder="••••••"
                      className="w-full px-3.5 py-2.5 text-base font-mono tracking-[0.3em] text-center text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5 text-xs text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-sky-700 shrink-0" />
                  <span>
                    Safely encrypted before saving · Must be changed every 90 days (3 months)
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-60 rounded-xl transition-colors"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>
                      {busy
                        ? 'Saving PIN...'
                        : isPinRotationRenewal
                          ? 'Update 6-Digit PIN'
                          : 'Save 6-Digit PIN'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-3 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Later
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

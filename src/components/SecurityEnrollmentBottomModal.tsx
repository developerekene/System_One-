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
import { logSecurityEvent, updateSecurityPreferences } from '../lib/firestoreService';
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
        title: `Mobile biometrics login activated (${result.method})`,
        category: 'security',
        platform: 'mobile',
        provider: result.method,
        targetUrl: window.location.origin,
        tags: ['Security Audit', 'Mobile Suite'],
        status: 'verified',
      });

      onCompleted('Biometrics login activated for your mobile device.');
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to activate biometrics login.'
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
      setErrorMsg('Please enter an exact 6-digit numeric PIN (0–9).');
      return;
    }

    if (cleanPin !== cleanConfirm) {
      setErrorMsg('PIN confirmation does not match. Please re-enter both fields.');
      return;
    }

    if (/^(\d)\1{5}$/.test(cleanPin) || cleanPin === '123456' || cleanPin === '654321') {
      setErrorMsg('Please choose a stronger 6-digit PIN without repeated or sequential digits.');
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
          ? '6-digit security PIN rotated (90-day cycle)'
          : '6-digit security PIN activated (90-day rotation policy)',
        category: 'security',
        platform: profile.primaryPlatform === 'mobile' ? 'desktop' : profile.primaryPlatform,
        provider: 'pin_6_digit',
        targetUrl: window.location.origin,
        tags: ['Security Audit', 'Core Identity'],
        status: 'verified',
      });

      setPin('');
      setConfirmPin('');
      onCompleted(
        `6-digit PIN activated. Next mandatory rotation in ${PIN_ROTATION_DAYS} days.`
      );
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to activate 6-digit security PIN.'
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
          {/* Backdrop Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/35 backdrop-blur-[2px]"
          />

          {/* Bottom-Sheet Drawer */}
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
                        <span>Mobile Device Detected</span>
                      </>
                    ) : (
                      <>
                        <Monitor className="w-3.5 h-3.5" />
                        <span>Desktop / Web Browser Detected</span>
                      </>
                    )}
                  </div>
                  <h2
                    id="security-bottom-modal-title"
                    className="text-lg font-bold text-slate-900 mt-0.5"
                  >
                    {isMobile
                      ? 'Activate Biometrics Login'
                      : isPinRotationRenewal
                        ? 'Rotate Your 6-Digit Security PIN'
                        : 'Activate 6-Digit Security PIN'}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                aria-label="Close security activation modal"
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
                  You are signing in from a mobile device. Enable Face ID, Touch ID, or device
                  biometrics to unlock System One and authorize connected mobile apps quickly
                  without re-typing your password.
                </p>

                <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200/80 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-700 leading-relaxed">
                    Biometric credentials stay on your mobile hardware enclave. System One stores
                    only your verified enrollment state.
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
                    <span>{busy ? 'Activating...' : 'Activate Biometrics Login'}</span>
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
                  Because you are on a desktop or web device, System One requires a{' '}
                  <strong className="text-slate-900">6-digit security PIN</strong>. For ongoing
                  account protection, this PIN must be changed every{' '}
                  <strong className="text-slate-900">3 months (90 days)</strong>.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="pin-input"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      6-Digit PIN
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
                    Hashed with SHA-256 before storage · Mandatory 90-day (3-month) rotation cycle
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
                          : 'Activate 6-Digit PIN'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-3 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Dismiss
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

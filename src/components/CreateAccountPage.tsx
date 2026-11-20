import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Monitor,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { verifyEmailAccount } from '../lib/emailValidator';
import { auth, googleProvider } from '../lib/firebase';
import { PlatformType, RedirectContext } from '../types/systemOne';
import { Footer } from './Footer';
import { SystemOneLogo } from './SystemOneLogo';

interface CreateAccountPageProps {
  redirectContext: RedirectContext | null;
  selectedPlatform: PlatformType;
  onSelectPlatform: (platform: PlatformType) => void;
  onBackToSignIn: () => void;
  onClearRedirect: () => void;
}

const PLATFORM_OPTIONS: Array<{
  id: PlatformType;
  label: string;
  Icon: typeof Globe;
}> = [
  { id: 'web', label: 'Web', Icon: Globe },
  { id: 'mobile', label: 'Mobile', Icon: Smartphone },
  { id: 'desktop', label: 'Desktop', Icon: Monitor },
];

export function CreateAccountPage({
  redirectContext,
  selectedPlatform,
  onSelectPlatform,
  onBackToSignIn,
  onClearRedirect,
}: CreateAccountPageProps) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailCheckMsg, setEmailCheckMsg] = useState<{
    valid: boolean;
    text: string;
    suggestion?: string;
  } | null>(null);

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  const mapFirebaseError = (err: unknown): string => {
    const code = (err as { code?: string })?.code || '';
    switch (code) {
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Return to Sign In or reset your password.';
      case 'auth/weak-password':
        return 'Please choose a password with at least 6 characters.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/popup-closed-by-user':
        return 'Google sign-up popup was closed before finishing.';
      case 'auth/popup-blocked':
        return 'Your browser blocked the sign-up popup. Please allow popups and try again.';
      case 'auth/operation-not-allowed':
        return 'Email/Password sign-up is not yet enabled in Firebase Console for project systems-0ne. Enable it under Authentication > Sign-in method, or sign up with Google.';
      default:
        return err instanceof Error ? err.message : 'Account creation could not be completed.';
    }
  };

  const runEmailCheck = async (valueToVerify: string): Promise<boolean> => {
    if (!valueToVerify.trim()) {
      setEmailCheckMsg(null);
      return false;
    }
    setCheckingEmail(true);
    try {
      const result = await verifyEmailAccount(valueToVerify);
      setEmailCheckMsg({
        valid: result.valid,
        text: result.reason,
        suggestion: result.suggestion,
      });
      return result.valid;
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setBusy(true);
    setErrorMsg(null);
    setNoticeMsg(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setErrorMsg(mapFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNoticeMsg(null);

    const isEmailValid = await runEmailCheck(email);
    if (!isEmailValid) {
      setErrorMsg('Please provide a valid, active email account before creating your ID.');
      return;
    }

    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName.trim()) {
        await updateProfile(cred.user, {
          displayName: displayName.trim().slice(0, 80),
        });
      }
      await sendEmailVerification(cred.user);
      setNoticeMsg(
        'Your System One ID has been created. Please verify the link sent to your inbox to proceed to your Profile page.'
      );
    } catch (err) {
      setErrorMsg(mapFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-[#F1F5F9] to-[#E0F2FE]/60 flex flex-col">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200/80">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={onBackToSignIn}
            className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-700 rounded"
          >
            <SystemOneLogo size="md" />
          </button>

          <div className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <span>New Account Registration</span>
            <span aria-hidden="true">·</span>
            <span>Real Email Verification</span>
            <span aria-hidden="true">·</span>
            <span>Authenticator Protection</span>
          </div>

          <button
            type="button"
            onClick={onBackToSignIn}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Sign In</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Context Card */}
          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <p className="text-xs font-medium text-sky-700">
                Dedicated Registration · System One
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
                Create your System One ID
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                Register once for unified sign-on across web, mobile, and desktop software. Your
                email domain is verified live against active mail servers before provisioning.
              </p>

              <ol className="pt-4 border-t border-slate-100 space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-xs font-semibold text-sky-700 mt-0.5">01</span>
                  <span>Verify your real email account or sign up with Google.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-xs font-semibold text-sky-700 mt-0.5">02</span>
                  <span>
                    Redirect to your Profile page for human verification via our 6-digit
                    authenticator (or biometrics on mobile).
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-xs font-semibold text-sky-700 mt-0.5">03</span>
                  <span>
                    Customize your unified profile and activate mobile biometrics or your 90-day
                    6-digit PIN.
                  </span>
                </li>
              </ol>
            </div>

            {redirectContext && (
              <div className="p-4 rounded-xl bg-sky-50/80 border border-sky-200/80 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-900">
                    <ShieldCheck className="w-4 h-4 text-sky-700" />
                    <span>Return Target Preserved</span>
                  </span>
                  <button
                    type="button"
                    onClick={onClearRedirect}
                    className="text-xs font-medium text-sky-800 hover:underline"
                  >
                    Clear
                  </button>
                </div>
                <p className="text-xs text-slate-700">
                  Origin: <strong>{redirectContext.appName}</strong> ({redirectContext.platform})
                </p>
                <p className="text-xs font-mono text-slate-600 break-all">
                  redirect_to={redirectContext.redirectTo}
                </p>
              </div>
            )}
          </section>

          {/* Right Registration Form */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
            <button
              type="button"
              disabled={busy}
              onClick={handleGoogleSignUp}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-medium text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 rounded-xl transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-8.97z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                />
              </svg>
              <span>Sign up with Google</span>
            </button>

            <div className="relative my-6 flex items-center">
              <div className="flex-1 border-t border-slate-200" />
              <span className="px-3 text-xs font-medium text-slate-500">
                or register with email
              </span>
              <div className="flex-1 border-t border-slate-200" />
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800"
              >
                {errorMsg}
              </div>
            )}

            {noticeMsg && (
              <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>{noticeMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="signup-name"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  Full Name
                </label>
                <input
                  id="signup-name"
                  type="text"
                  required
                  maxLength={80}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Morgan"
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div>
                <span className="block text-sm font-medium text-slate-800 mb-1.5">
                  Starting Platform
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {PLATFORM_OPTIONS.map(({ id, label, Icon }) => {
                    const active = selectedPlatform === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSelectPlatform(id)}
                        className={`flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-medium rounded-xl border transition-colors ${
                          active
                            ? 'bg-sky-50 border-sky-600 text-sky-800'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="signup-email"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  Valid Email Account
                </label>
                <input
                  id="signup-email"
                  type="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailCheckMsg(null);
                  }}
                  onBlur={() => runEmailCheck(email)}
                  placeholder="you@domain.com"
                  autoComplete="email"
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                />

                {checkingEmail && (
                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-slate-600">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying email domain mail server (MX)...</span>
                  </p>
                )}

                {!checkingEmail && emailCheckMsg && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={
                        emailCheckMsg.valid
                          ? 'text-emerald-700 font-medium'
                          : 'text-red-700 font-medium'
                      }
                    >
                      {emailCheckMsg.text}
                    </span>
                    {emailCheckMsg.suggestion && (
                      <button
                        type="button"
                        onClick={() => {
                          setEmail(emailCheckMsg.suggestion!);
                          runEmailCheck(emailCheckMsg.suggestion!);
                        }}
                        className="text-sky-700 underline font-medium"
                      >
                        Use {emailCheckMsg.suggestion}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="signup-password"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    className="w-full pl-3.5 pr-11 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy || checkingEmail}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-60 rounded-xl transition-colors"
              >
                <span>{busy ? 'Creating System One ID...' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-slate-600">
              Already have a System One ID?{' '}
              <button
                type="button"
                onClick={onBackToSignIn}
                className="font-medium text-sky-700 hover:text-sky-800"
              >
                Sign in here
              </button>
            </p>
          </section>
        </div>
      </main>

      <Footer
        isAuthenticated={false}
        onSelectAuthMode={(m) => {
          if (m !== 'signup') onBackToSignIn();
        }}
      />
    </div>
  );
}

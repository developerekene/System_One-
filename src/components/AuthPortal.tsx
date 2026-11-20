import { useState } from 'react';
import {
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { RedirectContext } from '../types/systemOne';
import { Footer } from './Footer';
import { HomeSections } from './HomeSections';
import { SystemOneLogo } from './SystemOneLogo';

type HomeAuthMode = 'signin' | 'reset';

interface AuthPortalProps {
  currentUser: User | null;
  redirectContext: RedirectContext | null;
  onClearRedirect: () => void;
  onVerificationConfirmed: () => void;
  onNavigateToSignUp: () => void;
  onFreshSignIn: (uid: string) => void;
}

export function AuthPortal({
  currentUser,
  redirectContext,
  onClearRedirect,
  onVerificationConfirmed,
  onNavigateToSignUp,
  onFreshSignIn,
}: AuthPortalProps) {
  const [mode, setMode] = useState<HomeAuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  const mapFirebaseError = (err: unknown): string => {
    const code = (err as { code?: string })?.code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'The email or password entered does not match an active account.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/popup-closed-by-user':
        return 'Google sign-in popup was closed before finishing.';
      case 'auth/popup-blocked':
        return 'Your browser blocked the sign-in popup. Please allow popups for this site and try again.';
      case 'auth/operation-not-allowed':
        return 'Email/Password sign-in is not yet enabled in the Firebase Console for project systems-0ne. Enable it under Authentication > Sign-in method, or continue with Google.';
      case 'auth/too-many-requests':
        return 'Too many attempts detected. Please wait a moment before trying again.';
      default:
        return err instanceof Error ? err.message : 'Authentication could not be completed.';
    }
  };

  const handleGoogleAuth = async () => {
    setBusy(true);
    setErrorMsg(null);
    setNoticeMsg(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      onFreshSignIn(cred.user.uid);
    } catch (err) {
      setErrorMsg(mapFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    setNoticeMsg(null);

    try {
      if (mode === 'signin') {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        onFreshSignIn(cred.user.uid);
      } else {
        await sendPasswordResetEmail(auth, email.trim());
        setNoticeMsg(
          `Password recovery instructions were sent to ${email.trim()}. Your redirect context will remain preserved.`
        );
      }
    } catch (err) {
      setErrorMsg(mapFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    if (!currentUser) return;
    setBusy(true);
    setErrorMsg(null);
    setNoticeMsg(null);
    try {
      await sendEmailVerification(currentUser);
      setNoticeMsg(`A fresh verification link has been sent to ${currentUser.email}.`);
    } catch (err) {
      setErrorMsg(mapFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!currentUser) return;
    setBusy(true);
    setErrorMsg(null);
    setNoticeMsg(null);
    try {
      await reload(currentUser);
      await currentUser.getIdToken(true);
      if (auth.currentUser?.emailVerified) {
        onVerificationConfirmed();
      } else {
        setNoticeMsg(
          'Email is not verified yet. Open the verification link in your inbox, then check again.'
        );
      }
    } catch (err) {
      setErrorMsg(mapFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleJumpAction = (target: 'signin' | 'signup' | 'reset') => {
    if (target === 'signup') {
      onNavigateToSignUp();
      return;
    }
    setMode(target);
    setErrorMsg(null);
    setNoticeMsg(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-[#F1F5F9] to-[#E0F2FE]/60 flex flex-col">
      {/* 3-Zone Public Top Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-slate-200/80">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <SystemOneLogo size="md" />
          <div className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <a
              href="#section-purpose"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Purpose
            </a>
            <a
              href="#section-redirect-protocol"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              SSO Redirects
            </a>
            <a
              href="#section-adaptive-lock"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Authenticator & PIN
            </a>
            <a
              href="#section-developer"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Developer
            </a>
          </div>
          <div className="shrink-0 flex items-center gap-2.5">
            {redirectContext && (
              <button
                type="button"
                onClick={onClearRedirect}
                className="px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Clear Return
              </button>
            )}
            <button
              type="button"
              onClick={onNavigateToSignUp}
              className="px-4 py-2 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Create Account
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Editorial Identity Column */}
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
            <div className="aspect-[16/9] w-full bg-gradient-to-br from-slate-100 to-sky-50 overflow-hidden relative">
              <img
                src="/src/assets/images/sso_secure_encrypted_banner_1795163537448.jpg"
                alt="Precision brushed silver padlock and frosted encryption shield marked Secure and Protected"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between gap-6">
              <div>
                <p className="text-xs font-medium text-sky-700 mb-2">
                  Single Sign-On · Web · Mobile · Desktop
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
                  One account across every application you use.
                </h1>
                <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
                  Sign in once to manage your unified profile, in-built 6-digit authenticator,
                  connected applications, and cross-platform return sessions without re-entering
                  credentials.
                </p>
              </div>

              {redirectContext ? (
                <div className="p-4 rounded-xl bg-sky-50/80 border border-sky-200/80">
                  <div className="flex items-center gap-2 text-xs font-semibold text-sky-900">
                    <ShieldCheck className="w-4 h-4 text-sky-700 shrink-0" />
                    <span>Preserved Return Journey ({redirectContext.platform})</span>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-800">
                    After authentication, you can return directly to{' '}
                    <span className="font-semibold">{redirectContext.appName}</span>.
                  </p>
                  <p className="mt-1 text-xs font-mono text-slate-600 break-all">
                    redirect_to={redirectContext.redirectTo}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                  <div>
                    <p className="text-xs text-slate-500">Auth Methods</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">
                      Google & Email
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">2-Step Security</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">
                      6-Digit TOTP
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Session Continuity</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">
                      redirect_to Ready
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Right Sign-In & Recovery Card */}
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-center">
            {currentUser && !currentUser.emailVerified ? (
              <div className="space-y-6">
                <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
                  <MailCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    Verify your email address
                  </h2>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    We sent a verification link to{' '}
                    <span className="font-semibold text-slate-900">{currentUser.email}</span>.
                    Confirming your inbox directs you to your Profile page for human verification.
                  </p>
                </div>

                {errorMsg && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800"
                  >
                    {errorMsg}
                  </div>
                )}

                {noticeMsg && (
                  <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sm text-sky-900">
                    {noticeMsg}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleCheckVerification}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-60 rounded-lg transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
                    <span>I Have Verified</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleResendVerification}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 rounded-lg transition-colors"
                  >
                    <span>Resend Link</span>
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => signOut(auth)}
                    className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Use a different account
                  </button>
                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    className="text-sm font-medium text-sky-700 hover:text-sky-800 transition-colors"
                  >
                    Continue with Google instead
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* Segmented Mode Switcher (Sign In | Recover) */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setErrorMsg(null);
                      setNoticeMsg(null);
                    }}
                    className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                      mode === 'signin'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setErrorMsg(null);
                      setNoticeMsg(null);
                    }}
                    className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                      mode === 'reset'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Recover Password
                  </button>
                </div>

                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">
                    {mode === 'signin'
                      ? 'Sign in to System One'
                      : 'Reset your password'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {mode === 'signin'
                      ? 'Access your unified profile, security preferences, and connected apps.'
                      : 'Enter your account email and we will send a secure password recovery link.'}
                  </p>
                </div>

                {mode === 'signin' && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleGoogleAuth}
                      className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-medium text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
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
                      <span>Continue with Google</span>
                    </button>

                    <div className="relative my-6 flex items-center">
                      <div className="flex-1 border-t border-slate-200" />
                      <span className="px-3 text-xs font-medium text-slate-500">
                        or sign in with email
                      </span>
                      <div className="flex-1 border-t border-slate-200" />
                    </div>
                  </>
                )}

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

                <form onSubmit={handleEmailAuth} className="space-y-4">
                  <div>
                    <label
                      htmlFor="auth-email"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      Email Address
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      required
                      maxLength={254}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>

                  {mode === 'signin' && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          htmlFor="auth-password"
                          className="block text-sm font-medium text-slate-800"
                        >
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setMode('reset');
                            setErrorMsg(null);
                            setNoticeMsg(null);
                          }}
                          className="text-xs font-medium text-sky-700 hover:text-sky-800"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          id="auth-password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          autoComplete="current-password"
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
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-60 rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
                  >
                    {mode === 'reset' && <KeyRound className="w-4 h-4" />}
                    <span>
                      {busy
                        ? 'Processing...'
                        : mode === 'signin'
                          ? 'Sign In'
                          : 'Send Recovery Email'}
                    </span>
                    {mode === 'signin' && <ArrowRight className="w-4 h-4" />}
                  </button>

                  {mode === 'reset' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin');
                        setErrorMsg(null);
                        setNoticeMsg(null);
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back to Sign In</span>
                    </button>
                  )}
                </form>

                {/* Dedicated Link to Standalone Create Account Page */}
                <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-600">New to System One?</span>
                  <button
                    type="button"
                    onClick={onNavigateToSignUp}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Create your System One ID</span>
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <HomeSections onJumpToAuth={handleJumpAction} />

      <Footer
        isAuthenticated={false}
        onSelectAuthMode={handleJumpAction}
      />
    </div>
  );
}

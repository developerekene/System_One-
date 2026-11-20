import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  ArrowUpRight,
  CheckCircle2,
  Search,
  Tag as TagIcon,
  X,
} from 'lucide-react';
import { AuthPortal } from './components/AuthPortal';
import { ConnectedAppsSection } from './components/ConnectedAppsSection';
import { CreateAccountPage } from './components/CreateAccountPage';
import { Footer } from './components/Footer';
import { LoginChallengeGate } from './components/LoginChallengeGate';
import { NotificationsSection } from './components/NotificationsSection';
import { OverviewSection } from './components/OverviewSection';
import { PageSkeletonLoader } from './components/PageSkeletonLoader';
import { RedirectHandoffBanner } from './components/RedirectHandoffBanner';
import { SecurityEnrollmentBottomModal } from './components/SecurityEnrollmentBottomModal';
import { SecuritySection } from './components/SecuritySection';
import { TagsSection } from './components/TagsSection';
import { TopBar } from './components/TopBar';
import { auth, testFirestoreConnection } from './lib/firebase';
import {
  createCrossPlatformNotification,
  ensureUserProfileProvisioned,
  logSecurityEvent,
  subscribeToAccountTags,
  subscribeToConnectedApps,
  subscribeToNotifications,
  subscribeToSecurityEvents,
  subscribeToUserProfile,
} from './lib/firestoreService';
import { getTagButtonClasses } from './lib/formatters';
import {
  buildReturnDestinationUrl,
  captureRedirectContextFromUrl,
  clearRedirectContext,
  isRedirectTrusted,
  setActiveRedirectContext,
} from './lib/redirect';
import { detectMobileDevice, isPinExpiredOrDue } from './lib/securityEnrollment';
import {
  AccountNotification,
  AccountTag,
  ConnectedApp,
  PlatformType,
  RedirectContext,
  SecurityEvent,
  UserProfile,
  WorkspaceTab,
} from './types/systemOne';

type PublicView = 'home' | 'signup';

function getSessionVerifiedKey(uid: string): string {
  return `system_one_session_verified_${uid}`;
}

function readInitialPublicView(): PublicView {
  if (typeof window === 'undefined') return 'home';
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') === 'signup' || window.location.pathname === '/signup') {
    return 'signup';
  }
  return 'home';
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [verificationTick, setVerificationTick] = useState(0);

  const [publicView, setPublicView] = useState<PublicView>(() => readInitialPublicView());
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType>('web');
  const [redirectContext, setRedirectContext] = useState<RedirectContext | null>(() =>
    captureRedirectContextFromUrl()
  );

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [pageLoading, setPageLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [connectedApps, setConnectedApps] = useState<ConnectedApp[]>([]);
  const [notifications, setNotifications] = useState<AccountNotification[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [accountTags, setAccountTags] = useState<AccountTag[]>([]);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);
  const [handoffNotice, setHandoffNotice] = useState<{
    appName: string;
    destinationUrl: string;
    isDeepLink: boolean;
  } | null>(null);

  const [sessionVerifiedForUid, setSessionVerifiedForUid] = useState<string | null>(null);
  const [enrollmentModalOpen, setEnrollmentModalOpen] = useState(false);
  const [enrollmentToast, setEnrollmentToast] = useState<string | null>(null);
  const [isMobileDevice, setIsMobileDevice] = useState(() => detectMobileDevice());

  // Trigger clean skeleton card/item loading state whenever navigating to any page
  const triggerPageSkeleton = () => {
    setPageLoading(true);
    window.setTimeout(() => {
      setPageLoading(false);
    }, 320);
  };

  // Initial page load skeleton
  useEffect(() => {
    const timer = window.setTimeout(() => setPageLoading(false), 360);
    return () => window.clearTimeout(timer);
  }, []);

  // Keep browser back/forward synced for dedicated Create Account route
  useEffect(() => {
    const handlePopState = () => {
      setPublicView(readInitialPublicView());
      triggerPageSkeleton();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Keep mobile hardware detection responsive
  useEffect(() => {
    const updateDeviceContext = () => {
      setIsMobileDevice(detectMobileDevice(profile?.primaryPlatform));
    };
    updateDeviceContext();
    window.addEventListener('resize', updateDeviceContext);
    return () => window.removeEventListener('resize', updateDeviceContext);
  }, [profile?.primaryPlatform]);

  // Sync starting platform with redirect context if present
  useEffect(() => {
    if (redirectContext?.platform) {
      setSelectedPlatform(redirectContext.platform);
    }
  }, [redirectContext]);

  // Verify Firestore connectivity on startup
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (user) {
        try {
          const ok = sessionStorage.getItem(getSessionVerifiedKey(user.uid)) === 'true';
          setSessionVerifiedForUid(ok ? user.uid : null);
        } catch {
          setSessionVerifiedForUid(null);
        }
      } else {
        setSessionVerifiedForUid(null);
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Provision and subscribe to Firestore data once user is verified
  useEffect(() => {
    if (!authReady || !authUser || !authUser.emailVerified) {
      setProfile(null);
      setConnectedApps([]);
      setNotifications([]);
      setSecurityEvents([]);
      setAccountTags([]);
      return;
    }

    let active = true;
    let unsubProfile: (() => void) | undefined;
    let unsubApps: (() => void) | undefined;
    let unsubNotifications: (() => void) | undefined;
    let unsubEvents: (() => void) | undefined;
    let unsubTags: (() => void) | undefined;

    (async () => {
      try {
        setProvisioningError(null);
        const initialProfile = await ensureUserProfileProvisioned(authUser, selectedPlatform);
        if (!active) return;

        // Always navigate authenticated users to their Profile page on sign-in
        setActiveTab('overview');

        if (!initialProfile.securityPreferences.humanVerified) {
          try {
            sessionStorage.setItem(getSessionVerifiedKey(authUser.uid), 'true');
          } catch {
            // Ignore storage errors
          }
          setSessionVerifiedForUid(authUser.uid);
        }

        unsubProfile = subscribeToUserProfile(authUser.uid, setProfile);
        unsubApps = subscribeToConnectedApps(authUser.uid, setConnectedApps);
        unsubNotifications = subscribeToNotifications(authUser.uid, setNotifications);
        unsubEvents = subscribeToSecurityEvents(authUser.uid, setSecurityEvents);
        unsubTags = subscribeToAccountTags(authUser.uid, setAccountTags);
      } catch (err) {
        if (active) {
          setProvisioningError(
            err instanceof Error ? err.message : 'Unable to load your System One profile.'
          );
        }
      }
    })();

    return () => {
      active = false;
      unsubProfile?.();
      unsubApps?.();
      unsubNotifications?.();
      unsubEvents?.();
      unsubTags?.();
    };
  }, [authReady, authUser?.uid, authUser?.emailVerified, verificationTick]);

  // Automatically prompt bottom modal if 90-day PIN rotation is overdue for a human-verified desktop/web user
  useEffect(() => {
    if (
      profile &&
      profile.securityPreferences.humanVerified &&
      !isMobileDevice &&
      isPinExpiredOrDue(profile.securityPreferences)
    ) {
      setEnrollmentModalOpen(true);
    }
  }, [profile, isMobileDevice]);

  const navigatePublicView = (nextView: PublicView) => {
    setPublicView(nextView);
    const url = new URL(window.location.href);
    if (nextView === 'signup') {
      url.searchParams.set('view', 'signup');
    } else {
      url.searchParams.delete('view');
    }
    window.history.pushState({}, '', url.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
    triggerPageSkeleton();
  };

  const navigateWorkspaceTab = (tab: WorkspaceTab) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      triggerPageSkeleton();
    }
  };

  const handleFreshSignIn = (uid: string) => {
    try {
      sessionStorage.removeItem(getSessionVerifiedKey(uid));
    } catch {
      // Ignore storage error
    }
    setSessionVerifiedForUid(null);
    setActiveTab('overview');
  };

  const handleLoginChallengeVerified = () => {
    if (!authUser) return;
    try {
      sessionStorage.setItem(getSessionVerifiedKey(authUser.uid), 'true');
    } catch {
      // Ignore storage error
    }
    setSessionVerifiedForUid(authUser.uid);
    setActiveTab('overview');
    triggerPageSkeleton();
  };

  const unreadNotificationCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  const isTrustedTarget = useMemo(() => {
    if (!redirectContext) return true;
    return isRedirectTrusted(redirectContext.redirectTo, connectedApps);
  }, [redirectContext, connectedApps]);

  const executeReturnHandoff = async (contextToUse: RedirectContext) => {
    if (!authUser) return;
    const finalUrl = buildReturnDestinationUrl(contextToUse, {
      uid: authUser.uid,
      email: authUser.email,
      displayName: authUser.displayName,
      unreadNotifications: unreadNotificationCount,
    });

    try {
      await logSecurityEvent(authUser.uid, {
        title: `Returned to ${contextToUse.appName} via redirect_to`,
        category: 'redirect',
        platform: contextToUse.platform,
        provider: 'system_one_sso',
        targetUrl: contextToUse.redirectTo,
        tags: [],
        status: 'completed',
      });
      if (profile?.notificationPreferences.newDeviceAlert) {
        await createCrossPlatformNotification(
          authUser.uid,
          {
            title: `Signed in to ${contextToUse.appName}`,
            message: `Your account opened ${contextToUse.appName} on ${contextToUse.platform}.`,
            category: 'app',
            sourcePlatform: contextToUse.platform,
            actionUrl: contextToUse.redirectTo,
          },
          profile.notificationPreferences
        );
      }
    } catch {
      // Proceed with redirect even if logging encounters transient network lag
    }

    clearRedirectContext();
    setRedirectContext(null);

    if (contextToUse.isDeepLink) {
      setHandoffNotice({
        appName: contextToUse.appName,
        destinationUrl: finalUrl,
        isDeepLink: true,
      });
      window.location.href = finalUrl;
    } else {
      setHandoffNotice({
        appName: contextToUse.appName,
        destinationUrl: finalUrl,
        isDeepLink: false,
      });
      window.location.assign(finalUrl);
    }
  };

  const handleClearRedirect = () => {
    clearRedirectContext();
    setRedirectContext(null);
    setHandoffNotice(null);
  };

  const handleLaunchReturnFromApp = async (
    redirectTo: string,
    platform: PlatformType,
    appName: string
  ) => {
    const nextCtx = setActiveRedirectContext(redirectTo, platform, appName);
    if (nextCtx) {
      setRedirectContext(nextCtx);
      await executeReturnHandoff(nextCtx);
    }
  };

  const handleSignOut = async () => {
    if (authUser) {
      try {
        sessionStorage.removeItem(getSessionVerifiedKey(authUser.uid));
      } catch {
        // Ignore
      }
    }
    setSessionVerifiedForUid(null);
    setEnrollmentModalOpen(false);
    await signOut(auth);
  };

  if (!authReady) {
    return <PageSkeletonLoader variant="home" withHeaderShell />;
  }

  // Unauthenticated or unverified email state -> Home Sign-In Portal OR Dedicated Create Account Page
  if (!authUser || !authUser.emailVerified) {
    if (pageLoading) {
      return (
        <PageSkeletonLoader
          variant={publicView === 'signup' ? 'signup' : 'home'}
          withHeaderShell
        />
      );
    }

    if (publicView === 'signup') {
      return (
        <CreateAccountPage
          redirectContext={redirectContext}
          selectedPlatform={selectedPlatform}
          onSelectPlatform={setSelectedPlatform}
          onBackToSignIn={() => navigatePublicView('home')}
          onClearRedirect={handleClearRedirect}
        />
      );
    }

    return (
      <AuthPortal
        currentUser={authUser}
        redirectContext={redirectContext}
        onClearRedirect={handleClearRedirect}
        onVerificationConfirmed={() => setVerificationTick((t) => t + 1)}
        onNavigateToSignUp={() => navigatePublicView('signup')}
        onFreshSignIn={handleFreshSignIn}
      />
    );
  }

  // Provisioning / Loading profile state
  if (!profile) {
    if (provisioningError) {
      return (
        <div className="min-h-screen bg-[#F8FAFC]">
          <TopBar
            activeTab={activeTab}
            onSelectTab={navigateWorkspaceTab}
            unreadNotifications={unreadNotificationCount}
            redirectContext={redirectContext}
            onReturnToRedirect={() => redirectContext && executeReturnHandoff(redirectContext)}
            onSignOut={handleSignOut}
          />
          <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10">
            <div className="bg-white border border-red-200 rounded-2xl p-6 text-sm text-red-800">
              {provisioningError}
            </div>
          </main>
        </div>
      );
    }
    return <PageSkeletonLoader variant="overview" withHeaderShell />;
  }

  // Pre-login 2-step authenticator / mobile biometrics gate for verified users signing in
  const requiresLoginChallenge =
    profile.securityPreferences.humanVerified &&
    sessionVerifiedForUid !== authUser.uid &&
    (profile.securityPreferences.authenticatorEnabled ||
      (isMobileDevice && profile.securityPreferences.biometricsEnabled));

  if (requiresLoginChallenge) {
    return (
      <LoginChallengeGate
        authUser={authUser}
        profile={profile}
        isMobileDevice={isMobileDevice}
        redirectContext={redirectContext}
        onVerified={handleLoginChallengeVerified}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8FAFC] via-[#F8FAFC] to-[#F1F5F9] flex flex-col">
      <TopBar
        activeTab={activeTab}
        onSelectTab={navigateWorkspaceTab}
        unreadNotifications={unreadNotificationCount}
        redirectContext={redirectContext}
        onReturnToRedirect={() => redirectContext && executeReturnHandoff(redirectContext)}
        onSignOut={handleSignOut}
      />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Active SSO redirect_to Return Handoff Banner */}
        {redirectContext && (
          <RedirectHandoffBanner
            context={redirectContext}
            isTrusted={isTrustedTarget}
            trustedOnlyEnabled={profile.securityPreferences.trustedRedirectOnly}
            onReturnNow={() => executeReturnHandoff(redirectContext)}
            onDismiss={handleClearRedirect}
          />
        )}

        {/* Security Enrollment Confirmation Toast */}
        {enrollmentToast && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-sm text-emerald-950">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{enrollmentToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setEnrollmentToast(null)}
              aria-label="Dismiss security notification"
              className="p-1.5 text-emerald-800 hover:bg-emerald-100 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Deep-link handoff confirmation & manual fallback */}
        {handoffNotice && (
          <section className="mb-8 bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-emerald-950">
                  Returning to {handoffNotice.appName}
                </h2>
                <p className="text-xs font-mono text-emerald-900 break-all mt-1">
                  {handoffNotice.destinationUrl}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <a
                href={handoffNotice.destinationUrl}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors"
              >
                <span>Open Destination</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => setHandoffNotice(null)}
                className="p-2 text-emerald-800 hover:bg-emerald-100 rounded-lg"
                aria-label="Dismiss return notice"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </section>
        )}

        {/* Global Search & Clear Tag Filter Toolbar */}
        <section
          aria-label="Search and tag filtering"
          className="mb-8 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3"
        >
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                aria-label="Search System One apps, notifications, labels, and activity"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your apps, notifications, activity, or labels..."
                className="w-full pl-10 pr-10 py-2.5 text-sm text-slate-900 bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {selectedTagFilter && (
              <button
                type="button"
                onClick={() => setSelectedTagFilter(null)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-sky-800 bg-sky-50 border border-sky-200 hover:bg-sky-100 rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Label: {selectedTagFilter}</span>
              </button>
            )}
          </div>

          {accountTags.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 shrink-0 mr-1">
                <TagIcon className="w-3.5 h-3.5" />
                <span>Labels:</span>
              </span>
              {accountTags.map((tag) => {
                const active = selectedTagFilter === tag.label;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setSelectedTagFilter(active ? null : tag.label)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${getTagButtonClasses(
                      tag.tone,
                      active
                    )}`}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Active Workspace View with Skeleton Loading */}
        {pageLoading ? (
          <PageSkeletonLoader variant={activeTab} />
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewSection
                authUser={authUser}
                profile={profile}
                connectedApps={connectedApps}
                notifications={notifications}
                availableTags={accountTags}
                searchQuery={searchQuery}
                selectedTagFilter={selectedTagFilter}
                isMobileDevice={isMobileDevice}
                onSelectTagFilter={setSelectedTagFilter}
                onNavigateTab={navigateWorkspaceTab}
                onTriggerEnrollmentModal={() => setEnrollmentModalOpen(true)}
              />
            )}

            {activeTab === 'notifications' && (
              <NotificationsSection
                authUser={authUser}
                profile={profile}
                notifications={notifications}
                searchQuery={searchQuery}
              />
            )}

            {activeTab === 'apps' && (
              <ConnectedAppsSection
                authUser={authUser}
                connectedApps={connectedApps}
                availableTags={accountTags}
                notificationPreferences={profile.notificationPreferences}
                searchQuery={searchQuery}
                selectedTagFilter={selectedTagFilter}
                onLaunchReturn={handleLaunchReturnFromApp}
              />
            )}

            {activeTab === 'security' && (
              <SecuritySection
                authUser={authUser}
                profile={profile}
                securityEvents={securityEvents}
                searchQuery={searchQuery}
                selectedTagFilter={selectedTagFilter}
                isMobileDevice={isMobileDevice}
                onTriggerEnrollmentModal={() => setEnrollmentModalOpen(true)}
              />
            )}

            {activeTab === 'tags' && (
              <TagsSection
                authUser={authUser}
                profile={profile}
                tags={accountTags}
                connectedApps={connectedApps}
                securityEvents={securityEvents}
                searchQuery={searchQuery}
                selectedTagFilter={selectedTagFilter}
                onSelectTagFilter={setSelectedTagFilter}
              />
            )}
          </>
        )}
      </main>

      {/* Bottom-Sheet Security Enrollment Modal (Mobile Biometrics / Desktop 6-Digit 90-Day PIN) */}
      <SecurityEnrollmentBottomModal
        open={enrollmentModalOpen}
        isMobile={isMobileDevice}
        isPinRotationRenewal={isPinExpiredOrDue(profile.securityPreferences)}
        authUser={authUser}
        profile={profile}
        onClose={() => setEnrollmentModalOpen(false)}
        onCompleted={(msg) => setEnrollmentToast(msg)}
      />

      <Footer
        isAuthenticated
        onNavigateWorkspace={navigateWorkspaceTab}
        onSignOut={handleSignOut}
      />
    </div>
  );
}

import { ExternalLink, Lock } from 'lucide-react';
import { WorkspaceTab } from '../types/systemOne';
import { SystemOneLogo } from './SystemOneLogo';

interface FooterProps {
  isAuthenticated: boolean;
  onNavigateWorkspace?: (tab: WorkspaceTab) => void;
  onSelectAuthMode?: (mode: 'signin' | 'signup' | 'reset') => void;
  onSignOut?: () => void;
}

export function Footer({
  isAuthenticated,
  onNavigateWorkspace,
  onSelectAuthMode,
  onSignOut,
}: FooterProps) {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <footer className="bg-white border-t border-slate-200 mt-16">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12 sm:py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-slate-200/80">
          {/* Brand & Purpose Description */}
          <div className="md:col-span-5 space-y-4">
            <SystemOneLogo size="md" />
            <p className="text-sm text-slate-600 leading-relaxed max-w-md">
              System One is a unified single sign-on, identity verification, and cross-platform
              security preference portal built to synchronize accounts cleanly across web,
              mobile, and desktop applications.
            </p>
            <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <Lock className="w-3.5 h-3.5 text-sky-700 shrink-0" />
              <span>Encrypted Firebase Authentication · Owner-Isolated Firestore Storage</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="md:col-span-2 space-y-3">
            <h3 className="text-xs font-semibold text-slate-900">
              {isAuthenticated ? 'Workspace' : 'Access Portal'}
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-600">
              {isAuthenticated && onNavigateWorkspace ? (
                <>
                  <li>
                    <button
                      type="button"
                      onClick={() => onNavigateWorkspace('overview')}
                      className="hover:text-sky-700 transition-colors"
                    >
                      My Profile
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => onNavigateWorkspace('notifications')}
                      className="hover:text-sky-700 transition-colors"
                    >
                      Notifications
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => onNavigateWorkspace('apps')}
                      className="hover:text-sky-700 transition-colors"
                    >
                      Connected Apps
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => onNavigateWorkspace('security')}
                      className="hover:text-sky-700 transition-colors"
                    >
                      Security & PIN Policy
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => onNavigateWorkspace('tags')}
                      className="hover:text-sky-700 transition-colors"
                    >
                      Tag Organization
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectAuthMode?.('signin');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="hover:text-sky-700 transition-colors"
                    >
                      Sign In
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectAuthMode?.('signup');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="hover:text-sky-700 transition-colors"
                    >
                      Create Account
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectAuthMode?.('reset');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="hover:text-sky-700 transition-colors"
                    >
                      Password Recovery
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => scrollToSection('section-purpose')}
                      className="hover:text-sky-700 transition-colors"
                    >
                      Platform Overview
                    </button>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Architecture Links */}
          <div className="md:col-span-2 space-y-3">
            <h3 className="text-xs font-semibold text-slate-900">Architecture</h3>
            <ul className="space-y-2.5 text-sm text-slate-600">
              <li>
                <button
                  type="button"
                  onClick={() =>
                    isAuthenticated
                      ? onNavigateWorkspace?.('apps')
                      : scrollToSection('section-redirect-protocol')
                  }
                  className="hover:text-sky-700 transition-colors text-left"
                >
                  redirect_to Continuity
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() =>
                    isAuthenticated
                      ? onNavigateWorkspace?.('overview')
                      : scrollToSection('section-human-check')
                  }
                  className="hover:text-sky-700 transition-colors text-left"
                >
                  Human Verification
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() =>
                    isAuthenticated
                      ? onNavigateWorkspace?.('security')
                      : scrollToSection('section-adaptive-lock')
                  }
                  className="hover:text-sky-700 transition-colors text-left"
                >
                  Biometrics & 90-Day PIN
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() =>
                    isAuthenticated
                      ? onNavigateWorkspace?.('security')
                      : scrollToSection('section-zero-trust')
                  }
                  className="hover:text-sky-700 transition-colors text-left"
                >
                  Zero-Trust Isolation
                </button>
              </li>
            </ul>
          </div>

          {/* Developer Ekene Links */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-semibold text-slate-900">Developer</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Engineered by <span className="font-semibold text-slate-900">Developer Ekene</span>{' '}
              for unified cross-application identity and secure user journeys.
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://github.com/developerekene"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-sky-700 hover:text-sky-800 transition-colors"
                >
                  <span>GitHub (@developerekene)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </li>
              <li>
                <a
                  href="https://ekenedilichukwu.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-sky-700 hover:text-sky-800 transition-colors"
                >
                  <span>ekenedilichukwu.com</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </li>
              {isAuthenticated && onSignOut && (
                <li className="pt-1">
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    Sign out of session
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Bottom Copyright & Version Bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>© {new Date().getFullYear()} System One</span>
            <span aria-hidden="true">·</span>
            <span>Built by Developer Ekene</span>
          </div>
          <div className="flex items-center gap-3 font-mono tabular-nums text-slate-600">
            <span>System One</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-slate-900">v0.0.1</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

import { AlertCircle, ArrowUpRight, Monitor, Smartphone, Globe, X } from 'lucide-react';
import { RedirectContext } from '../types/systemOne';

interface RedirectHandoffBannerProps {
  context: RedirectContext;
  isTrusted: boolean;
  trustedOnlyEnabled: boolean;
  onReturnNow: () => void;
  onDismiss: () => void;
}

export function RedirectHandoffBanner({
  context,
  isTrusted,
  trustedOnlyEnabled,
  onReturnNow,
  onDismiss,
}: RedirectHandoffBannerProps) {
  const PlatformIcon =
    context.platform === 'mobile'
      ? Smartphone
      : context.platform === 'desktop'
        ? Monitor
        : Globe;

  const platformLabel =
    context.platform === 'mobile'
      ? 'Mobile App'
      : context.platform === 'desktop'
        ? 'Desktop App'
        : 'Web Application';

  return (
    <section
      aria-label="Single sign-on return context"
      className="bg-gradient-to-r from-sky-50 via-white to-indigo-50/70 border border-sky-200/80 rounded-2xl p-5 sm:p-6 mb-8"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center shrink-0 mt-0.5">
            <PlatformIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-sky-800">
              <span>Active Return Session</span>
              <span aria-hidden="true">·</span>
              <span>{platformLabel}</span>
              <span aria-hidden="true">·</span>
              <span>Session Preserved</span>
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 mt-0.5">
              Ready to return to {context.appName}
            </h2>
            <p className="text-xs sm:text-sm font-mono text-slate-600 truncate mt-1">
              redirect_to: {context.redirectTo}
            </p>
            {!isTrusted && trustedOnlyEnabled && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  This destination is not yet listed in your Connected Apps. Review the URI before continuing.
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onReturnNow}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
          >
            <span>Continue to {context.appName}</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
          >
            <X className="w-4 h-4" />
            <span>Stay Here</span>
          </button>
        </div>
      </div>
    </section>
  );
}

import {
  ArrowRight,
  ArrowUpRight,
  Fingerprint,
  Globe,
  KeyRound,
  Layers,
  Lock,
  Monitor,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Tag,
  UserCheck,
} from 'lucide-react';

interface HomeSectionsProps {
  onJumpToAuth: (mode: 'signin' | 'signup' | 'reset') => void;
}

export function HomeSections({ onJumpToAuth }: HomeSectionsProps) {
  return (
    <div className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 pb-8 space-y-16 sm:space-y-20">
      {/* Section 01: Core Purpose */}
      <section
        id="section-purpose"
        className="pt-10 border-t border-slate-200/80 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        <div className="lg:col-span-5">
          <p className="text-xs font-medium text-sky-700 mb-2">01. Core Purpose</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Why System One exists across your application ecosystem
          </h2>
        </div>
        <div className="lg:col-span-7 space-y-4 text-sm sm:text-base text-slate-600 leading-relaxed">
          <p>
            Modern product suites span web dashboards, mobile companions, and native desktop tools.
            Forcing people to create separate logins and re-configure privacy rules in every app
            causes password fatigue and fractured account security.
          </p>
          <p>
            System One serves as the central identity authority: one verified credential, one
            unified profile, and one set of security policies shared consistently across every
            application connected to your account.
          </p>
        </div>
      </section>

      {/* Section 02: Unified Authentication Stack */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <p className="text-xs font-medium text-sky-700 mb-1.5">
              02. Unified Authentication Stack
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Multiple entry paths converging into a single verified session
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onJumpToAuth('signup')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-800 whitespace-nowrap"
          >
            <span>Start registration</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6">
          <div className="space-y-2">
            <UserCheck className="w-5 h-5 text-sky-700" />
            <h3 className="text-base font-semibold text-slate-900">Google Single Sign-On</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Instant popup-based Google OAuth sign-up and login with automatic email verification
              and provider binding.
            </p>
          </div>
          <div className="space-y-2">
            <Lock className="w-5 h-5 text-sky-700" />
            <h3 className="text-base font-semibold text-slate-900">Email & Password Vault</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Dedicated email registration protected by inbox verification gating before profile or
              application access is activated.
            </p>
          </div>
          <div className="space-y-2">
            <KeyRound className="w-5 h-5 text-sky-700" />
            <h3 className="text-base font-semibold text-slate-900">Self-Service Recovery</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              One-click Firebase password reset dispatch that keeps the user&apos;s incoming{' '}
              <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">redirect_to</code>{' '}
              target intact.
            </p>
          </div>
        </div>
      </section>

      {/* Section 03: Cross-Platform redirect_to Protocol */}
      <section
        id="section-redirect-protocol"
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
      >
        <div className="lg:col-span-6 space-y-4">
          <p className="text-xs font-medium text-sky-700">03. Return Journey Continuity</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 [text-wrap:balance]">
            Seamless handoff and return via the <code className="font-mono text-2xl">redirect_to</code> parameter
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            When a user arrives from another web app or native mobile client, System One captures the{' '}
            <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              redirect_to
            </code>{' '}
            query key, validates the scheme, and preserves it across sign-up, login, password
            recovery, and verification transitions.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            Once authenticated, the Return Handoff bar guides the user right back to their exact
            destination with preserved session state.
          </p>
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <p className="text-xs font-semibold text-slate-500">Protocol Sequence</p>
          <ol className="space-y-3 text-sm text-slate-700 divide-y divide-slate-100">
            <li className="pt-1 flex items-start justify-between gap-4">
              <span className="font-medium text-slate-900">1. Origin Dispatch</span>
              <span className="font-mono text-xs text-slate-600 text-right break-all">
                ?redirect_to=https://app.domain/home
              </span>
            </li>
            <li className="pt-3 flex items-start justify-between gap-4">
              <span className="font-medium text-slate-900">2. Context Preservation</span>
              <span className="text-xs text-slate-600 text-right">
                URL + sessionStorage persistence
              </span>
            </li>
            <li className="pt-3 flex items-start justify-between gap-4">
              <span className="font-medium text-slate-900">3. Return Execution</span>
              <span className="font-mono text-xs text-sky-700 text-right">
                sso_status=authenticated
              </span>
            </li>
          </ol>
        </div>
      </section>

      {/* Section 04: Mobile, Desktop & Web Continuity */}
      <section className="bg-gradient-to-br from-white via-white to-sky-50/70 border border-slate-200 rounded-2xl p-6 sm:p-10">
        <p className="text-xs font-medium text-sky-700 mb-2">
          04. Mobile, Desktop & Web Continuity
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-6">
          Built for every client surface in your stack
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-2">
            <Globe className="w-5 h-5 text-sky-700" />
            <h3 className="text-sm font-semibold text-slate-900">Web Applications</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Standard <code className="font-mono text-xs">https://</code> callbacks and relative
              workspace routes with automatic browser session persistence.
            </p>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-2">
            <Smartphone className="w-5 h-5 text-sky-700" />
            <h3 className="text-sm font-semibold text-slate-900">Mobile Apps (iOS & Android)</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Supports custom deep-link schemes such as{' '}
              <code className="font-mono text-xs">systemone-pulse://auth/callback</code> with fallback
              return triggers.
            </p>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-2">
            <Monitor className="w-5 h-5 text-sky-700" />
            <h3 className="text-sm font-semibold text-slate-900">Desktop Clients</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Handles desktop protocol handlers seamlessly while syncing idle timeout and PIN
              policies across workstations.
            </p>
          </div>
        </div>
      </section>

      {/* Section 05 & 06 Split: Human Verification + Adaptive Biometrics / 90-Day PIN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section
          id="section-human-check"
          className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-4"
        >
          <p className="text-xs font-medium text-sky-700">05. Human Verification Gate</p>
          <h2 className="text-xl font-bold text-slate-900">
            Immediate post-registration human check on the profile page
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Every newly created account is routed directly to the Profile page for an interactive
            human verification step before unlocking profile editing and connected application
            controls. This prevents automated account abuse at the threshold.
          </p>
          <p className="text-xs text-slate-500">
            Verified human timestamp recorded directly to your private Firestore profile.
          </p>
        </section>

        <section
          id="section-adaptive-lock"
          className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-4"
        >
          <p className="text-xs font-medium text-sky-700">
            06. Adaptive Second-Layer Security
          </p>
          <h2 className="text-xl font-bold text-slate-900">
            Mobile biometrics or rotating 90-day 6-digit PIN
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            After human verification and profile setup, a bottom-sheet security prompt triggers
            automatically based on your hardware context:
          </p>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <Fingerprint className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
              <span>
                <strong>Mobile Devices:</strong> Activates hardware-backed biometric sign-in.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <RefreshCw className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
              <span>
                <strong>Desktop & Web:</strong> Activates a hashed 6-digit PIN with mandatory
                rotation every 3 months (90 days).
              </span>
            </li>
          </ul>
        </section>
      </div>

      {/* Section 07: Unified Profile Portability */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-4 border-t border-slate-200/80">
        <div className="lg:col-span-4">
          <p className="text-xs font-medium text-sky-700 mb-1.5">07. Unified Profile</p>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            Edit your identity once, sync everywhere
          </h2>
        </div>
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
          <div>
            <h3 className="font-semibold text-slate-900">Universal Handle</h3>
            <p className="mt-1 text-slate-600">
              Reserve one canonical handle, display name, and portrait across all connected apps.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Recovery Channels</h3>
            <p className="mt-1 text-slate-600">
              Maintain verified backup email and optional recovery phone in an isolated profile doc.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Platform Preference</h3>
            <p className="mt-1 text-slate-600">
              Declare your primary device context so new sessions initialize cleanly.
            </p>
          </div>
        </div>
      </section>

      {/* Section 08: Connected Application Governance */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3">
            <p className="text-xs font-medium text-sky-700">08. Application Governance</p>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Pause, resume, or permanently revoke app access
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Register every web, mobile, and desktop app that relies on your System One account.
              Each application records its callback URI, granted scopes, and lifecycle state. Revoked
              apps are permanently locked at the database rule layer.
            </p>
          </div>
          <div className="lg:col-span-5 grid grid-cols-3 gap-3 text-center">
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/70">
              <p className="text-xs font-medium text-emerald-900">Active</p>
              <p className="text-xs text-emerald-700 mt-1">SSO Enabled</p>
            </div>
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/70">
              <p className="text-xs font-medium text-amber-900">Paused</p>
              <p className="text-xs text-amber-700 mt-1">Temp Hold</p>
            </div>
            <div className="p-4 rounded-xl bg-red-50/70 border border-red-200/70">
              <p className="text-xs font-medium text-red-900">Revoked</p>
              <p className="text-xs text-red-700 mt-1">Locked</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 09: Clear Tagging & Live Search */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-3">
          <Tag className="w-5 h-5 text-sky-700" />
          <p className="text-xs font-medium text-sky-700">09. Tag Organization</p>
          <h2 className="text-xl font-bold text-slate-900">
            Categorize apps, profile contexts, and logs with custom tags
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Create color-toned tags such as Core Identity, Mobile Suite, or Production Apps and
            click any tag to filter your entire System One workspace instantaneously.
          </p>
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-3">
          <Search className="w-5 h-5 text-sky-700" />
          <p className="text-xs font-medium text-sky-700">10. Instant Global Search</p>
          <h2 className="text-xl font-bold text-slate-900">
            Find any redirect URI, connected client, or event in milliseconds
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Real-time client filtering scans connected app names, deep-link schemes, security audit
            entries, and tags simultaneously without page reloads.
          </p>
        </div>
      </section>

      {/* Section 10 / 11: Zero-Trust Isolation & Real-World Usage */}
      <section
        id="section-zero-trust"
        className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 space-y-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-6 space-y-3">
            <ShieldCheck className="w-5 h-5 text-sky-700" />
            <p className="text-xs font-medium text-sky-700">11. Zero-Trust Security Architecture</p>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Strict owner-only isolation enforced at Firestore
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Every profile document, connected application, tag, and security event lives under an
              owner-gated path validating authenticated UID, verified email status, server
              timestamps, and strict field allowlists.
            </p>
          </div>

          <div className="lg:col-span-6 space-y-3">
            <Layers className="w-5 h-5 text-sky-700" />
            <p className="text-xs font-medium text-sky-700">12. Practical Integration Patterns</p>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              How your other applications connect to System One
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Link any external app simply by sending users to System One with{' '}
              <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                ?redirect_to=YOUR_APP_URL&amp;platform=mobile
              </code>
              . System One handles signup, recovery, verification, and sends the user straight back.
            </p>
          </div>
        </div>
      </section>

      {/* Section 13: Trusted Redirect Guard & Audit Trail */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2">
          <p className="text-xs font-medium text-sky-700">13. Redirect Trust Policy</p>
          <h3 className="text-base font-bold text-slate-900">Allowlist Protection</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Block unsafe protocols like <code className="font-mono text-xs">javascript:</code> and
            warn users when returning to an unregistered external domain.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2">
          <p className="text-xs font-medium text-sky-700">14. Immutable Audit Log</p>
          <h3 className="text-base font-bold text-slate-900">Append-Only History</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Sign-ins, redirect handoffs, human checks, and PIN rotations are recorded as immutable
            audit events with server timestamps.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2">
          <p className="text-xs font-medium text-sky-700">15. Accessible Light Design</p>
          <h3 className="text-base font-bold text-slate-900">High-Contrast Clarity</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Crafted exclusively in crisp light mode with soft sky-slate gradients and WCAG AA+
            typography for desktop and mobile clarity.
          </p>
        </div>
      </section>

      {/* Dedicated Call-to-Action Section: Use System One today */}
      <section
        id="section-use-today"
        className="bg-gradient-to-br from-sky-700 to-slate-900 text-white rounded-2xl p-8 sm:p-12"
      >
        <div className="max-w-3xl space-y-4">
          <p className="text-xs font-semibold tracking-wide text-sky-200">
            Ready for Every Platform
          </p>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
            Use System One today
          </h2>
          <p className="text-base sm:text-lg text-sky-50 leading-relaxed">
            No need to worry about your application&apos;s backend. We got you covered.
          </p>
          <p className="text-sm text-slate-200 leading-relaxed max-w-2xl">
            Offload user registration, real email domain checks, 6-digit authenticator
            verification, mobile biometrics, rotating PIN enforcement, and cross-app{' '}
            <code className="font-mono text-xs bg-white/10 px-1.5 py-0.5 rounded">
              redirect_to
            </code>{' '}
            session continuity to System One in minutes.
          </p>
          <div className="pt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onJumpToAuth('signup')}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-900 bg-white hover:bg-sky-50 rounded-xl transition-colors"
            >
              <span>Create your System One ID</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onJumpToAuth('signin')}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
            >
              <span>Sign In</span>
            </button>
          </div>
        </div>
      </section>

      {/* About the Developer Section (Developer Ekene) */}
      <section
        id="section-developer"
        className="bg-gradient-to-r from-sky-50/90 via-white to-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-10"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <p className="text-xs font-medium text-sky-700">About the Developer</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Developer Ekene
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              System One is architected and maintained by{' '}
              <span className="font-semibold text-slate-900">Developer Ekene</span> as a unified
              authentication, account governance, and cross-platform single sign-on hub powering a
              connected suite of web, mobile, and desktop software.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <a
                href="https://github.com/developerekene"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
              >
                <span>github.com/developerekene</span>
                <ArrowUpRight className="w-4 h-4" />
              </a>
              <a
                href="https://ekenedilichukwu.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-xl transition-colors"
              >
                <span>ekenedilichukwu.com</span>
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="lg:w-72 bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shrink-0">
            <p className="text-xs font-semibold text-slate-500">Release Snapshot</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Application</span>
                <span className="font-semibold text-slate-900">System One</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Version</span>
                <span className="font-mono font-semibold text-slate-900">v0.0.1</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">PIN Rotation</span>
                <span className="font-mono text-slate-900">90 Days</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onJumpToAuth('signup')}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-sky-800 bg-sky-50 hover:bg-sky-100 rounded-xl transition-colors"
            >
              <span>Create Your System One ID</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

# System One (`v0.0.1`)

**System One** is a unified single sign-on (SSO), authentication, profile governance, and cross-platform security preferences application built with React, TypeScript, Tailwind CSS, Firebase Authentication, and Cloud Firestore (`systems-0ne`).

Engineered by **Developer Ekene** ([GitHub](https://github.com/developerekene) · [Website](https://ekenedilichukwu.com)).

---

## Core Features Built

### 1. Unified Authentication & Dedicated Registration Page
- **Sign-In & Password Recovery Home Portal (`src/components/AuthPortal.tsx`)**:
  - Supports **Google OAuth** sign-in (`signInWithPopup`), **Email & Password** login, and **Password Recovery** (`sendPasswordResetEmail`).
  - Features a custom locked-padlock-infused **System One** logo (`src/components/SystemOneLogo.tsx`) and a dedicated light-mode editorial landing experience with 15+ informative sections (`src/components/HomeSections.tsx`), including **"Use System One today"** and **About the Developer**.
- **Standalone "Create your System One ID" Page (`src/components/CreateAccountPage.tsx`)**:
  - Dedicated registration route (`?view=signup`) with browser history support and preserved `redirect_to` context.
  - Supports Google sign-up and Email/Password registration with inbox verification gating.

### 2. Real Email Account & Mail-Server Verification (`src/lib/emailValidator.ts`)
- Validates RFC 5322 email syntax and dot placement.
- Blocks known disposable/temporary/placeholder email domains.
- Detects common domain typos (e.g., `gmial.com`, `outlok.com`) with one-click suggestions.
- Queries live **DNS-over-HTTPS MX records** (`https://dns.google/resolve`) to confirm the email domain publishes an active mail server capable of receiving verification emails.

### 3. Cross-Platform `redirect_to` Return Continuity (`src/lib/redirect.ts`, `src/components/RedirectHandoffBanner.tsx`)
- Captures and safely validates the `redirect_to` query parameter for web URLs (`http(s)://`), relative routes (`/...`), and mobile/desktop deep-link schemes (`myapp://auth/callback`, `systemone-desktop://sso/complete`) while rejecting unsafe schemes (`javascript:`, `data:`).
- Persists `redirect_to`, platform, and app name in both URL parameters and `sessionStorage` across sign-up, login, password recovery, email verification, and 2-step authentication transitions.
- Appends safe session continuity parameters (`sso_status=authenticated`, `sso_uid`, `sso_platform`, `sso_origin`) when returning to the originating app, governed by the user's `trustedRedirectOnly` security preference.
- Includes an interactive **Test Incoming `redirect_to` Flow** simulator in the Connected Apps workspace.

### 4. In-Built 6-Digit TOTP Authenticator & Adaptive Post-Signup Security
- **Built-In RFC 6238 6-Digit Authenticator (`src/lib/authenticator.ts`, `src/components/BuiltInAuthenticatorCard.tsx`)**:
  - Pure Web Crypto HMAC-SHA1 TOTP engine generating live rotating 6-digit codes every 30 seconds with a Base32 setup key and `otpauth://` URI.
  - Accessible inside the Profile page, Security Center, Human Verification gate, and Login Verification challenge.
- **Post-Signup Profile Human Verification Gate (`src/components/OverviewSection.tsx`)**:
  - Newly created accounts are directed straight to the Profile (`Overview`) page to verify they are human before creating or updating their profile:
    - **Desktop / Web (non-mobile)**: Requires the **6-digit Authenticator App** only.
    - **Mobile devices**: Offers a choice between **Biometrics** or the **6-digit Authenticator App**.
- **Pre-Login Challenge Gate (`src/components/LoginChallengeGate.tsx`)**:
  - Requires entering a 6-digit authenticator code (or choosing Biometrics on mobile) before completing login and redirecting back to connected apps.
- **Bottom-Sheet Security Modal (`src/components/SecurityEnrollmentBottomModal.tsx`, `src/lib/securityEnrollment.ts`)**:
  - Pops up smoothly from the bottom of the screen after human verification and profile setup:
    - **Mobile**: Activates **Biometrics Login** (WebAuthn platform authenticator with device attestation fallback).
    - **Desktop / Web**: Requires activating a SHA-256 salted **6-digit security PIN** enforced on a **3-month (90-day)** rotation cycle (`pinUpdatedAt` / `pinExpiresAt`).

### 5. Unified Profile, Connected Apps, Security Center, Search & Tagging
- **Unified Profile (`src/components/OverviewSection.tsx`)**: Manage display name, universal handle, summary, recovery phone, location, avatar portrait, primary platform, and account tags.
- **Connected Apps Governance (`src/components/ConnectedAppsSection.tsx`)**: Register web, mobile, and desktop apps, assign tags, filter by platform/status, pause/resume/revoke access, and trigger `redirect_to` handoffs.
- **Security Center & Audit Log (`src/components/SecuritySection.tsx`)**: Configure idle session timeouts, trusted redirect enforcement, notification channels, password reset emails, rotating 6-digit PIN status, built-in authenticator keys, and searchable immutable audit events.
- **Tag Organization & Live Search (`src/components/TagsSection.tsx`, `src/App.tsx`)**: Create, edit, tone, and delete custom tags; filter across apps, events, and profile settings alongside global live search.
- **Page-Wide Skeleton Loading (`src/components/PageSkeletonLoader.tsx`)**: Renders light-mode loading skeletons for cards and list items when navigating across pages.

### 6. Light-Mode Accessibility & Hardened Firestore Security
- Exclusively light-mode UI using `#F8FAFC` / `#FFFFFF` surfaces, soft sky-slate gradients, high-contrast slate typography (`Plus Jakarta Sans`, `DM Sans`, `JetBrains Mono`), and responsive mobile navigation.
- Firestore schema (`firebase-blueprint.json`) and security rules (`firestore.rules`) enforce strict owner-only PII isolation (`request.auth.uid == userId`), verified email checks, strict field allowlists, server timestamps (`request.time`), immutable audit trails, and terminal app revocation locks.

---

## Project Structure

- `src/App.tsx` — Root router, auth/session verification state, skeleton transitions, and workspace orchestration.
- `src/lib/firebase.ts` — Firebase initialization using `firebase-applet-config.json`, `browserLocalPersistence`, connectivity test, and structured `handleFirestoreError`.
- `src/lib/firestoreService.ts` — Defensive Firestore CRUD and real-time `onSnapshot` subscriptions.
- `src/lib/authenticator.ts` — RFC 6238 6-digit TOTP secret generator, code generator, and verifier.
- `src/lib/emailValidator.ts` — Email syntax, disposable blocklist, typo detection, and DNS-over-HTTPS MX checker.
- `src/lib/redirect.ts` — `redirect_to` parser, sanitizer, `sessionStorage` continuity, and return URL builder.
- `src/lib/securityEnrollment.ts` — Mobile detection, WebAuthn biometrics enrollment, and SHA-256 90-day PIN hashing.
- `src/components/` — Modular UI components (`AuthPortal`, `CreateAccountPage`, `LoginChallengeGate`, `BuiltInAuthenticatorCard`, `OverviewSection`, `ConnectedAppsSection`, `SecuritySection`, `TagsSection`, `SecurityEnrollmentBottomModal`, `PageSkeletonLoader`, `HomeSections`, `Footer`, `TopBar`, `SystemOneLogo`, `RedirectHandoffBanner`, `ErrorBoundary`).

---

## Developer

- **Developer Ekene**
- GitHub: [https://github.com/developerekene](https://github.com/developerekene)
- Website: [https://ekenedilichukwu.com](https://ekenedilichukwu.com)
- Version: `v0.0.1`

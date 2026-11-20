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
- Captures and safely validates the `redirect_to` query parameter for web URLs (`http(s)://`), relative routes (`/...`), and mobile/desktop deep-link schemes (`myapp://auth/callback`, `myapp-desktop://sso/complete`) while rejecting unsafe schemes (`javascript:`, `data:`).
- Persists `redirect_to`, platform, and app name in both URL parameters and `sessionStorage` across sign-up, login, password recovery, email verification, and 2-step authentication transitions.
- Appends safe session continuity parameters (`sso_status=authenticated`, `sso_uid`, `sso_platform`, `sso_origin`, `sso_unread_notifications`) when returning to the originating app, governed by the user's `trustedRedirectOnly` security preference.

### 4. In-Built 6-Digit TOTP Authenticator & Adaptive Post-Signup Security
- **Built-In RFC 6238 6-Digit Authenticator (`src/lib/authenticator.ts`, `src/components/BuiltInAuthenticatorCard.tsx`)**:
  - Pure Web Crypto HMAC-SHA1 TOTP engine generating live rotating 6-digit codes every 30 seconds with a Base32 setup key and `otpauth://` URI.
  - Accessible inside the Profile page, Security page, Human Check gate, and Login Verification challenge.
- **Post-Signup Profile Human Verification Gate (`src/components/OverviewSection.tsx`)**:
  - Newly signed-in and newly created accounts open directly on the **Profile** page. Before editing profile details, new users complete an easy plain-language human check:
    - **Desktop / Web (non-mobile)**: Uses the **6-digit Authenticator App** only.
    - **Mobile devices**: Offers a choice between **Biometrics** or the **6-digit Authenticator App**.
- **Pre-Login Challenge Gate (`src/components/LoginChallengeGate.tsx`)**:
  - Requires entering a 6-digit authenticator code (or using Biometrics on mobile) before finishing sign-in and navigating to the Profile page or returning to a connected app.
- **Bottom-Sheet Security Modal (`src/components/SecurityEnrollmentBottomModal.tsx`, `src/lib/securityEnrollment.ts`)**:
  - Pops up smoothly from the bottom of the screen after the human check and profile setup:
    - **Mobile**: Activates **Biometrics Login** (WebAuthn platform authenticator with device enrollment fallback).
    - **Desktop / Web**: Requires activating a SHA-256 salted **6-digit security PIN** enforced on a **3-month (90-day)** rotation cycle (`pinUpdatedAt` / `pinExpiresAt`).

### 5. Plain-Language Elaborate Profile, Cross-Platform Notifications & Zero Dummy Data
- **Zero Pre-Seeded Dummy Data (`src/lib/firestoreService.ts`)**:
  - Signed-in accounts start completely clean with no fake apps, fake tags, or sample profile bios—everything displayed reflects real user actions and real Firestore records.
- **Plain-Language Elaborate Profile Page (`src/components/OverviewSection.tsx`)**:
  - Written in clear, everyday language that anyone can easily understand.
  - Captures complete profile information organized across five structured sections:
    1. **Personal Details** (First Name, Last Name, Display Name, Username/Handle, Date of Birth, Gender, Short Bio, Profile Photo URL).
    2. **Contact Information** (Recovery Email, Phone Number, Personal/Company Website).
    3. **Home Address & Language** (Street Address, City, State/Region, Postal Code, Country, Preferred Language, Time Zone).
    4. **Work & Organization** (Job Title/Occupation, Company or Organization).
    5. **Emergency Contact & Main Device** (Emergency Contact Name, Emergency Contact Phone, Main Device Type, Custom Labels).
- **Cross-Platform Notifications (`src/components/NotificationsSection.tsx`)**:
  - Real-time Firestore-backed notification center (`/users/{userId}/notifications/{notificationId}`) synced across **Web**, **Mobile**, and **Desktop**.
  - Users can filter by platform (`All`, `Web`, `Mobile`, `Desktop`) or status (`Unread`, `Read`), mark individual or all alerts as read, delete alerts, send custom cross-platform notifications, opt into browser push alerts (`Notification` API), and configure per-platform delivery and event preferences (`webEnabled`, `mobileEnabled`, `desktopEnabled`, `loginAlert`, `appLinkAlert`, `newDeviceAlert`, `profileUpdateAlert`, `weeklySecurityDigest`).
  - Also passes `sso_unread_notifications` count back to connected external apps on `redirect_to` handoff.
- **Connected Apps, Security & Label Organization (`src/components/ConnectedAppsSection.tsx`, `src/components/SecuritySection.tsx`, `src/components/TagsSection.tsx`)**:
  - Register real web, mobile, and desktop apps, manage access status (`Active`, `Paused`, `Revoked`), inspect activity logs, rotate 90-day PINs, and filter everything cleanly with custom labels and live search.
- **Page-Wide Skeleton Loading (`src/components/PageSkeletonLoader.tsx`)**: Renders light-mode loading skeletons for cards and list items when navigating across pages.

### 6. Light-Mode Accessibility & Hardened Firestore Security
- Exclusively light-mode UI using `#F8FAFC` / `#FFFFFF` surfaces, soft sky-slate gradients, high-contrast slate typography (`Plus Jakarta Sans`, `DM Sans`, `JetBrains Mono`), and responsive mobile navigation.
- Firestore schema (`firebase-blueprint.json`) and security rules (`firestore.rules`) enforce strict owner-only PII isolation (`request.auth.uid == userId`), verified email checks, strict field allowlists, server timestamps (`request.time`), immutable audit trails, and terminal app revocation locks.

---

## Project Structure

- `src/App.tsx` — Root router, auth/session verification state, skeleton transitions, notification subscriptions, and workspace orchestration.
- `src/lib/firebase.ts` — Firebase initialization using `firebase-applet-config.json`, `browserLocalPersistence`, connectivity test, and structured `handleFirestoreError`.
- `src/lib/firestoreService.ts` — Defensive Firestore CRUD, schema backfill, cross-platform notifications, and real-time `onSnapshot` subscriptions.
- `src/lib/authenticator.ts` — RFC 6238 6-digit TOTP secret generator, code generator, and verifier.
- `src/lib/emailValidator.ts` — Email syntax, disposable blocklist, typo detection, and DNS-over-HTTPS MX checker.
- `src/lib/redirect.ts` — `redirect_to` parser, sanitizer, `sessionStorage` continuity, and return URL builder.
- `src/lib/securityEnrollment.ts` — Mobile detection, WebAuthn biometrics enrollment, and SHA-256 90-day PIN hashing.
- `src/components/` — Modular UI components (`AuthPortal`, `CreateAccountPage`, `LoginChallengeGate`, `BuiltInAuthenticatorCard`, `OverviewSection`, `NotificationsSection`, `ConnectedAppsSection`, `SecuritySection`, `TagsSection`, `SecurityEnrollmentBottomModal`, `PageSkeletonLoader`, `HomeSections`, `Footer`, `TopBar`, `SystemOneLogo`, `RedirectHandoffBanner`, `ErrorBoundary`).

---

## Developer

- **Developer Ekene**
- GitHub: [https://github.com/developerekene](https://github.com/developerekene)
- Website: [https://ekenedilichukwu.com](https://ekenedilichukwu.com)
- Version: `v0.0.1`

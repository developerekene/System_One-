# System One Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Strict Identity Ownership (PII Isolation)**: A `UserProfile` document at `/users/{userId}` contains sensitive PII (`email`, `secondaryEmail`, `phone`, `streetAddress`, `dateOfBirth`, `emergencyContactPhone`) and may only be read, created, or updated by the verified authenticated user whose `request.auth.uid == userId`. Cross-user reads and blanket `list` queries on `/users` are strictly denied.
2. **Master Gate Subcollection Ownership**: Every document inside `/users/{userId}/connectedApps/{appId}`, `/users/{userId}/securityEvents/{eventId}`, `/users/{userId}/tags/{tagId}`, and `/users/{userId}/notifications/{notificationId}` requires both `request.auth.uid == userId` and `exists(/databases/$(database)/documents/users/$(userId))` (Master Gate), plus `ownerId == request.auth.uid`.
3. **Immutable Ownership & Creation Timestamps**: `uid`, `ownerId`, and `createdAt` cannot be modified after creation. All `createdAt` and `updatedAt` timestamps must strictly equal `request.time`.
4. **Verified User Mandate**: All reads and writes require `request.auth != null && request.auth.token.email_verified == true`.
5. **Bounded Arrays & String Lengths**: Every string field enforces explicit `.size()` bounds and regex patterns where defined; arrays (`tags`, `scopes`, `linkedProviders`, `targetPlatforms`) are strictly size-capped and validated.
6. **Immutable Audit Log, Notification Field Isolation & Terminal App Revocation**: `securityEvents` are append-only (`allow update: if false`). `notifications` only allow updating `['read', 'readAt', 'updatedAt']` after creation. `connectedApps` marked with `status == 'revoked'` cannot transition back to `'active'` or `'paused'`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Cross-Tenant Profile Read**: User B attempts `get(/users/userA)` -> `PERMISSION_DENIED`.
2. **Blanket Users List Scrape**: Authenticated user attempts `list(/users)` -> `PERMISSION_DENIED`.
3. **Unverified Email Write**: User with `email_verified: false` attempts `create(/users/userA)` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Profile**: User A sends `create(/users/userA)` with extra field `isAdmin: true` -> `PERMISSION_DENIED`.
5. **Identity Spoofing on ConnectedApp**: User A sends `create(/users/userA/connectedApps/app1)` with `ownerId: "userB"` -> `PERMISSION_DENIED`.
6. **Orphaned Subcollection Write**: User A sends `create(/users/userA/notifications/notif1)` before `/users/userA` exists -> `PERMISSION_DENIED`.
7. **ID Poisoning**: User A attempts `create(/users/userA/tags/invalid$id@1500chars...)` -> `PERMISSION_DENIED`.
8. **Client-Forged Timestamp**: User A sends `createdAt: Timestamp(2020-01-01)` instead of `request.time` -> `PERMISSION_DENIED`.
9. **Immutable Field Mutation**: User A sends `update(/users/userA)` attempting to alter `uid` or `createdAt` -> `PERMISSION_DENIED`.
10. **Terminal State Resurrection**: User A attempts `update(/users/userA/connectedApps/app1)` changing `status` from `'revoked'` back to `'active'` -> `PERMISSION_DENIED`.
11. **Notification Content Tampering on Update**: User A attempts `update(/users/userA/notifications/notif1)` changing `title` or `targetPlatforms` instead of only `read`/`readAt` -> `PERMISSION_DENIED`.
12. **Audit Log Tampering**: User A attempts `update(/users/userA/securityEvents/ev1)` to modify `status` or `title` -> `PERMISSION_DENIED`.

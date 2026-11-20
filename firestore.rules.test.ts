/**
 * Phase 0 Payload-First Security Test Suite for System One Firestore Rules.
 * Verifies the "Dirty Dozen" adversarial payloads against the Eight Pillars.
 * Intended to run against the Firebase Emulator Suite (`@firebase/rules-unit-testing`).
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const dirtyDozenPayloads: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Cross-Tenant Profile Read',
    operation: 'get',
    path: 'users/userA',
    auth: { uid: 'userB', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Blanket Users List Scrape',
    operation: 'list',
    path: 'users',
    auth: { uid: 'userA', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Write',
    operation: 'create',
    path: 'users/userA',
    auth: { uid: 'userA', email_verified: false },
    payload: {
      uid: 'userA',
      email: 'usera@example.com',
      displayName: 'User A',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Profile',
    operation: 'create',
    path: 'users/userA',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      uid: 'userA',
      email: 'usera@example.com',
      displayName: 'User A',
      isAdmin: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Identity Spoofing on ConnectedApp',
    operation: 'create',
    path: 'users/userA/connectedApps/app_1',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      id: 'app_1',
      ownerId: 'userB',
      name: 'Spoofed App',
      platform: 'web',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Orphaned Subcollection Write (No Parent User Doc)',
    operation: 'create',
    path: 'users/orphanUser/connectedApps/app_1',
    auth: { uid: 'orphanUser', email_verified: true },
    payload: {
      id: 'app_1',
      ownerId: 'orphanUser',
      name: 'Orphan App',
      platform: 'mobile',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'ID Poisoning with Invalid Characters',
    operation: 'create',
    path: 'users/userA/tags/bad$id@invalid!',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      id: 'bad$id@invalid!',
      ownerId: 'userA',
      label: 'Test',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Client-Forged Timestamp on Create',
    operation: 'create',
    path: 'users/userA/tags/tag_1',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      id: 'tag_1',
      ownerId: 'userA',
      label: 'Work',
      description: 'Work apps',
      tone: 'sky',
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Immutable Field Mutation (uid)',
    operation: 'update',
    path: 'users/userA',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      uid: 'userB',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Terminal State Resurrection on Revoked App',
    operation: 'update',
    path: 'users/userA/connectedApps/revoked_app',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      status: 'active',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Value Poisoning on Display Name (>80 chars)',
    operation: 'update',
    path: 'users/userA',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      displayName: 'X'.repeat(200),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Audit Log Tampering on SecurityEvent',
    operation: 'update',
    path: 'users/userA/securityEvents/ev_1',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      status: 'verified',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];

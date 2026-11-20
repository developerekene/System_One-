export type PlatformType = 'web' | 'mobile' | 'desktop';
export type AppStatus = 'active' | 'paused' | 'revoked';
export type EventCategory = 'auth' | 'redirect' | 'security' | 'profile' | 'app';
export type EventStatus = 'verified' | 'completed' | 'pending' | 'revoked';
export type TagTone = 'slate' | 'sky' | 'emerald' | 'amber' | 'indigo';
export type WorkspaceTab = 'overview' | 'notifications' | 'apps' | 'security' | 'tags';
export type NotificationCategory = 'account' | 'security' | 'app' | 'system';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  details?: string;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface SecurityPreferences {
  twoFactorNotice: boolean;
  loginAlerts: boolean;
  sessionTimeoutMinutes: 15 | 30 | 60 | 240 | 1440;
  requireReauthForSensitive: boolean;
  trustedRedirectOnly: boolean;
  passwordRecoveryEmail: string;
  humanVerified: boolean;
  humanVerifiedAt: string;
  biometricsEnabled: boolean;
  pinConfigured: boolean;
  pinHash: string;
  pinUpdatedAt: string;
  pinExpiresAt: string;
  authenticatorEnabled: boolean;
  authenticatorSecret: string;
}

export interface NotificationPreferences {
  securityDigest: boolean;
  newDeviceAlert: boolean;
  appAuthorizationAlert: boolean;
  profileUpdateAlert: boolean;
  webEnabled: boolean;
  mobileEnabled: boolean;
  desktopEnabled: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  secondaryEmail: string;
  firstName: string;
  lastName: string;
  displayName: string;
  handle: string;
  dateOfBirth: string;
  gender: string;
  bio: string;
  phone: string;
  website: string;
  streetAddress: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  location: string;
  timezone: string;
  preferredLanguage: string;
  occupation: string;
  company: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  photoURL: string;
  primaryPlatform: PlatformType;
  linkedProviders: string[];
  tags: string[];
  securityPreferences: SecurityPreferences;
  notificationPreferences: NotificationPreferences;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AccountNotification {
  id: string;
  ownerId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  sourcePlatform: PlatformType;
  targetPlatforms: PlatformType[];
  read: boolean;
  readAt: string;
  actionUrl: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ConnectedApp {
  id: string;
  ownerId: string;
  name: string;
  platform: PlatformType;
  description: string;
  redirectUri: string;
  status: AppStatus;
  tags: string[];
  scopes: string[];
  lastPlatformSource: PlatformType;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SecurityEvent {
  id: string;
  ownerId: string;
  title: string;
  category: EventCategory;
  platform: PlatformType;
  provider: string;
  targetUrl: string;
  tags: string[];
  status: EventStatus;
  createdAt?: unknown;
}

export interface AccountTag {
  id: string;
  ownerId: string;
  label: string;
  description: string;
  tone: TagTone;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RedirectContext {
  redirectTo: string;
  platform: PlatformType;
  appName: string;
  originDisplay: string;
  isDeepLink: boolean;
  isRelative: boolean;
  capturedAt: string;
}

export const BLUEPRINT_LIMITS = {
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  HANDLE_REGEX: /^[a-z0-9_.-]*$/,
  MAX_ID: 128,
  MAX_EMAIL: 254,
  MAX_FIRST_NAME: 40,
  MAX_LAST_NAME: 40,
  MAX_DISPLAY_NAME: 80,
  MAX_HANDLE: 40,
  MAX_DOB: 20,
  MAX_GENDER: 32,
  MAX_BIO: 300,
  MAX_PHONE: 32,
  MAX_WEBSITE: 200,
  MAX_STREET: 120,
  MAX_CITY: 60,
  MAX_STATE: 60,
  MAX_POSTAL: 24,
  MAX_COUNTRY: 80,
  MAX_LOCATION: 80,
  MAX_TIMEZONE: 64,
  MAX_LANGUAGE: 40,
  MAX_OCCUPATION: 80,
  MAX_COMPANY: 80,
  MAX_EMERGENCY_NAME: 80,
  MAX_PHOTO_URL: 500,
  MAX_APP_NAME: 60,
  MAX_APP_DESCRIPTION: 200,
  MAX_REDIRECT_URI: 500,
  MAX_EVENT_TITLE: 100,
  MAX_PROVIDER: 40,
  MAX_TAG_LABEL: 32,
  MAX_TAG_DESCRIPTION: 120,
  MAX_NOTIF_TITLE: 100,
  MAX_NOTIF_MESSAGE: 300,
  MAX_PROFILE_TAGS: 10,
  MAX_APP_TAGS: 8,
  MAX_APP_SCOPES: 8,
} as const;

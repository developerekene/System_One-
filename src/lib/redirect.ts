import { ConnectedApp, PlatformType, RedirectContext } from '../types/systemOne';

const STORAGE_KEY = 'system_one_redirect_context';
const SAFE_CUSTOM_SCHEME_REGEX = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s]+$/;
const BLOCKED_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'file:'];

export function sanitizeRedirectUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 500) return null;

  const lower = trimmed.toLowerCase();
  if (BLOCKED_SCHEMES.some((scheme) => lower.startsWith(scheme))) {
    return null;
  }

  // Allow safe relative paths
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  // Allow http(s) URLs
  if (lower.startsWith('https://') || lower.startsWith('http://')) {
    try {
      const parsed = new URL(trimmed);
      return parsed.toString();
    } catch {
      return null;
    }
  }

  // Allow mobile or desktop custom deep-link schemes (e.g. myapp://auth/callback, exp://...)
  if (SAFE_CUSTOM_SCHEME_REGEX.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function inferPlatformFromUrl(
  url: string,
  explicitPlatform?: string | null
): PlatformType {
  if (explicitPlatform === 'mobile' || explicitPlatform === 'desktop' || explicitPlatform === 'web') {
    return explicitPlatform;
  }

  const lower = url.toLowerCase();
  if (
    !lower.startsWith('http://') &&
    !lower.startsWith('https://') &&
    !lower.startsWith('/')
  ) {
    if (lower.includes('desktop') || lower.includes('electron') || lower.includes('tauri')) {
      return 'desktop';
    }
    return 'mobile';
  }

  if (lower.includes('platform=mobile') || lower.includes('mobile.')) {
    return 'mobile';
  }
  if (lower.includes('platform=desktop') || lower.includes('desktop.')) {
    return 'desktop';
  }
  return 'web';
}

export function extractOriginDisplay(url: string): string {
  if (url.startsWith('/')) {
    return `${window.location.origin}${url}`;
  }
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const parsed = new URL(url);
      return `${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}`;
    }
  } catch {
    // Fallback below
  }
  return url;
}

export function captureRedirectContextFromUrl(): RedirectContext | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const rawRedirect = params.get('redirect_to');
  const sanitized = sanitizeRedirectUrl(rawRedirect);

  if (sanitized) {
    const platform = inferPlatformFromUrl(sanitized, params.get('platform'));
    const appNameParam = params.get('app_name')?.trim().slice(0, 60);
    const context: RedirectContext = {
      redirectTo: sanitized,
      platform,
      appName: appNameParam || deriveAppName(sanitized, platform),
      originDisplay: extractOriginDisplay(sanitized),
      isDeepLink:
        !sanitized.startsWith('http://') &&
        !sanitized.startsWith('https://') &&
        !sanitized.startsWith('/'),
      isRelative: sanitized.startsWith('/'),
      capturedAt: new Date().toISOString(),
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
    } catch {
      // Ignore storage quota issues
    }
    return context;
  }

  // Fallback: restore preserved redirect context across auth transitions
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as RedirectContext;
      if (parsed && sanitizeRedirectUrl(parsed.redirectTo)) {
        syncRedirectQueryParam(parsed);
        return parsed;
      }
    }
  } catch {
    // Ignore parse error
  }

  return null;
}

export function syncRedirectQueryParam(context: RedirectContext | null): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (context) {
    url.searchParams.set('redirect_to', context.redirectTo);
    url.searchParams.set('platform', context.platform);
    if (context.appName) {
      url.searchParams.set('app_name', context.appName);
    }
  } else {
    url.searchParams.delete('redirect_to');
    url.searchParams.delete('platform');
    url.searchParams.delete('app_name');
  }
  window.history.replaceState({}, '', url.toString());
}

export function clearRedirectContext(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage error
  }
  syncRedirectQueryParam(null);
}

export function setActiveRedirectContext(
  redirectTo: string,
  platform?: PlatformType,
  appName?: string
): RedirectContext | null {
  const sanitized = sanitizeRedirectUrl(redirectTo);
  if (!sanitized) return null;

  const resolvedPlatform = inferPlatformFromUrl(sanitized, platform);
  const context: RedirectContext = {
    redirectTo: sanitized,
    platform: resolvedPlatform,
    appName: appName?.trim().slice(0, 60) || deriveAppName(sanitized, resolvedPlatform),
    originDisplay: extractOriginDisplay(sanitized),
    isDeepLink:
      !sanitized.startsWith('http://') &&
      !sanitized.startsWith('https://') &&
      !sanitized.startsWith('/'),
    isRelative: sanitized.startsWith('/'),
    capturedAt: new Date().toISOString(),
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  } catch {
    // Ignore
  }
  syncRedirectQueryParam(context);
  return context;
}

function deriveAppName(url: string, platform: PlatformType): string {
  if (url.startsWith('/')) return 'System One Workspace';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      const label = host.split('.')[0] || 'Web Application';
      return label.charAt(0).toUpperCase() + label.slice(1);
    } catch {
      return 'Web Application';
    }
  }
  const scheme = url.split('://')[0] || 'App';
  if (platform === 'desktop') return `${scheme} Desktop`;
  if (platform === 'mobile') return `${scheme} Mobile`;
  return scheme;
}

export function isRedirectTrusted(
  redirectTo: string,
  connectedApps: ConnectedApp[]
): boolean {
  if (redirectTo.startsWith('/')) return true;

  if (typeof window !== 'undefined' && redirectTo.startsWith(window.location.origin)) {
    return true;
  }

  return connectedApps.some((app) => {
    if (app.status === 'revoked') return false;
    const registered = app.redirectUri.trim();
    if (!registered) return false;
    if (redirectTo === registered) return true;
    try {
      if (registered.startsWith('http') && redirectTo.startsWith('http')) {
        return new URL(registered).origin === new URL(redirectTo).origin;
      }
      const regScheme = registered.split('://')[0];
      const targetScheme = redirectTo.split('://')[0];
      return Boolean(regScheme && regScheme === targetScheme);
    } catch {
      return false;
    }
  });
}

export function buildReturnDestinationUrl(
  context: RedirectContext,
  userSession: {
    uid: string;
    email: string | null;
    displayName: string | null;
    unreadNotifications?: number;
  }
): string {
  const base = context.redirectTo;
  const paramsToAppend: Record<string, string> = {
    sso_status: 'authenticated',
    sso_uid: userSession.uid,
    sso_platform: context.platform,
    sso_origin: 'system_one',
  };

  if (typeof userSession.unreadNotifications === 'number') {
    paramsToAppend.sso_unread_notifications = String(userSession.unreadNotifications);
  }

  if (base.startsWith('/')) {
    const resolved = new URL(base, window.location.origin);
    Object.entries(paramsToAppend).forEach(([k, v]) => resolved.searchParams.set(k, v));
    return resolved.toString();
  }

  if (base.startsWith('http://') || base.startsWith('https://')) {
    const resolved = new URL(base);
    Object.entries(paramsToAppend).forEach(([k, v]) => resolved.searchParams.set(k, v));
    return resolved.toString();
  }

  // Custom mobile/desktop deep-link URI
  const separator = base.includes('?') ? '&' : '?';
  const query = new URLSearchParams(paramsToAppend).toString();
  return `${base}${separator}${query}`;
}

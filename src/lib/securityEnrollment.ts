import { PlatformType, SecurityPreferences } from '../types/systemOne';

export const PIN_ROTATION_DAYS = 90;
const PIN_ROTATION_MS = PIN_ROTATION_DAYS * 24 * 60 * 60 * 1000;

export function detectMobileDevice(preferredPlatform?: PlatformType): boolean {
  if (typeof window === 'undefined') {
    return preferredPlatform === 'mobile';
  }
  const ua = navigator.userAgent || '';
  const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const coarsePointer =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  const narrowViewport = window.innerWidth < 768;

  return uaMobile || (coarsePointer && narrowViewport);
}

export async function hashSecurityPin(pin: string, uid: string): Promise<string> {
  const cleanPin = pin.trim();
  if (!/^\d{6}$/.test(cleanPin)) {
    throw new Error('Security PIN must be exactly 6 numeric digits.');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(`system-one:${uid}:${cleanPin}`);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Deterministic fallback hash if subtle crypto is unavailable
  let acc = 2166136261;
  for (let i = 0; i < data.length; i += 1) {
    acc ^= data[i];
    acc = Math.imul(acc, 16777619);
  }
  return `fnv1a_${(acc >>> 0).toString(16)}`;
}

export function buildPinRotationDates(): {
  pinUpdatedAt: string;
  pinExpiresAt: string;
} {
  const now = new Date();
  const expires = new Date(now.getTime() + PIN_ROTATION_MS);
  return {
    pinUpdatedAt: now.toISOString(),
    pinExpiresAt: expires.toISOString(),
  };
}

export function isPinExpiredOrDue(prefs: SecurityPreferences): boolean {
  if (!prefs.pinConfigured || !prefs.pinExpiresAt) return false;
  const expiresMs = Date.parse(prefs.pinExpiresAt);
  if (Number.isNaN(expiresMs)) return false;
  return Date.now() >= expiresMs;
}

export function daysUntilPinRotation(pinExpiresAt: string): number | null {
  if (!pinExpiresAt) return null;
  const expiresMs = Date.parse(pinExpiresAt);
  if (Number.isNaN(expiresMs)) return null;
  const diff = Math.ceil((expiresMs - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(0, diff);
}

export async function attemptPlatformBiometricEnrollment(
  uid: string,
  email: string,
  displayName: string
): Promise<{ method: 'webauthn' | 'device_attestation' }> {
  try {
    if (
      typeof window !== 'undefined' &&
      'PublicKeyCredential' in window &&
      typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    ) {
      const available =
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (available && navigator.credentials?.create) {
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        const userIdBytes = new TextEncoder().encode(uid.slice(0, 64));

        await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: {
              name: 'System One',
            },
            user: {
              id: userIdBytes,
              name: email || uid,
              displayName: displayName || 'System One Member',
            },
            pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
            authenticatorSelection: {
              authenticatorAttachment: 'platform',
              userVerification: 'required',
            },
            timeout: 30000,
          },
        });
        return { method: 'webauthn' };
      }
    }
  } catch {
    // Inside sandboxed iframes or browsers without biometric hardware, fall back gracefully
  }

  return { method: 'device_attestation' };
}

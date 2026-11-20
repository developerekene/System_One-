const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(length = 20): string {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let secret = '';
  for (let i = 0; i < bytes.length; i += 1) {
    secret += BASE32_ALPHABET[bytes[i] % 32];
  }
  return secret;
}

function base32ToBytes(base32: string): Uint8Array {
  const cleaned = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (let i = 0; i < cleaned.length; i += 1) {
    const val = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (val >= 0) {
      bits += val.toString(2).padStart(5, '0');
    }
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

export function getTotpSecondsRemaining(periodSeconds = 30, nowMs = Date.now()): number {
  const epochSeconds = Math.floor(nowMs / 1000);
  return periodSeconds - (epochSeconds % periodSeconds);
}

export async function generateTotpCode(
  secret: string,
  stepOffset = 0,
  periodSeconds = 30,
  nowMs = Date.now()
): Promise<string> {
  const cleanSecret = secret.trim();
  if (!cleanSecret) return '000000';

  const keyBytes = base32ToBytes(cleanSecret);
  const counter = Math.floor(nowMs / 1000 / periodSeconds) + stepOffset;

  const counterBuffer = new ArrayBuffer(8);
  const view = new DataView(counterBuffer);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  view.setUint32(0, high, false);
  view.setUint32(4, low, false);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const keyCopy = new Uint8Array(keyBytes.length);
    keyCopy.set(keyBytes);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyCopy.buffer,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
    const hmac = new Uint8Array(sig);
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    const otp = binary % 1_000_000;
    return otp.toString().padStart(6, '0');
  }

  // Deterministic fallback if Web Crypto subtle is unavailable
  let acc = counter;
  for (let i = 0; i < keyBytes.length; i += 1) {
    acc = (acc * 31 + keyBytes[i]) % 1_000_000;
  }
  return Math.abs(acc).toString().padStart(6, '0');
}

export async function verifyTotpCode(
  secret: string,
  candidateCode: string,
  windowSteps = 1
): Promise<boolean> {
  const cleaned = candidateCode.replace(/\D/g, '').trim();
  if (cleaned.length !== 6) return false;

  for (let offset = -windowSteps; offset <= windowSteps; offset += 1) {
    const expected = await generateTotpCode(secret, offset);
    if (expected === cleaned) {
      return true;
    }
  }
  return false;
}

export function buildOtpAuthUri(email: string, secret: string): string {
  const label = encodeURIComponent(`System One:${email || 'member'}`);
  const issuer = encodeURIComponent('System One');
  return `otpauth://totp/${label}?secret=${encodeURIComponent(secret)}&issuer=${issuer}&digits=6&period=30`;
}

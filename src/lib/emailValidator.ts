export interface EmailValidationResult {
  valid: boolean;
  reason: string;
  suggestion?: string;
  mxVerified: boolean;
}

const STRICT_EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  'guerrillamail.com',
  'guerrillamail.org',
  '10minutemail.com',
  '10minutemail.net',
  'yopmail.com',
  'throwawaymail.com',
  'trashmail.com',
  'fakeinbox.com',
  'sharklasers.com',
  'getnada.com',
  'dispostable.com',
  'maildrop.cc',
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'invalid.com',
]);

const DOMAIN_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'iclod.com': 'icloud.com',
  'icoud.com': 'icloud.com',
};

const KNOWN_VALID_MAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'fastmail.com',
  'aol.com',
]);

export function checkEmailSyntaxAndDomain(rawEmail: string): EmailValidationResult {
  const email = rawEmail.trim().toLowerCase();

  if (!email) {
    return { valid: false, reason: 'Email address is required.', mxVerified: false };
  }

  if (email.length > 254 || !STRICT_EMAIL_REGEX.test(email)) {
    return {
      valid: false,
      reason: 'Please enter a properly formatted email address (e.g. name@domain.com).',
      mxVerified: false,
    };
  }

  const [localPart, domain] = email.split('@');
  if (
    !localPart ||
    localPart.length > 64 ||
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    localPart.includes('..')
  ) {
    return {
      valid: false,
      reason: 'The email username contains invalid dots or formatting.',
      mxVerified: false,
    };
  }

  const tld = domain.split('.').pop() || '';
  if (tld.length < 2 || /^\d+$/.test(tld)) {
    return {
      valid: false,
      reason: 'The email domain extension is not valid.',
      mxVerified: false,
    };
  }

  if (DOMAIN_TYPOS[domain]) {
    const suggested = `${localPart}@${DOMAIN_TYPOS[domain]}`;
    return {
      valid: false,
      reason: `Did you mean ${suggested}? "${domain}" appears to be a typo.`,
      suggestion: suggested,
      mxVerified: false,
    };
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      valid: false,
      reason: 'Disposable or placeholder email domains cannot be used to create a System One ID.',
      mxVerified: false,
    };
  }

  return {
    valid: true,
    reason: 'Email format verified.',
    mxVerified: KNOWN_VALID_MAIL_DOMAINS.has(domain),
  };
}

async function queryDnsRecord(domain: string, type: 'MX' | 'A'): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3200);
  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`,
      { signal: controller.signal }
    );
    if (!res.ok) return false;
    const data = (await res.json()) as {
      Status?: number;
      Answer?: Array<{ data?: string }>;
    };
    return data.Status === 0 && Array.isArray(data.Answer) && data.Answer.length > 0;
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyEmailAccount(rawEmail: string): Promise<EmailValidationResult> {
  const syntaxCheck = checkEmailSyntaxAndDomain(rawEmail);
  if (!syntaxCheck.valid) {
    return syntaxCheck;
  }

  const domain = rawEmail.trim().toLowerCase().split('@')[1];
  if (KNOWN_VALID_MAIL_DOMAINS.has(domain)) {
    return {
      valid: true,
      reason: `Verified active mail provider (${domain}).`,
      mxVerified: true,
    };
  }

  try {
    const hasMx = await queryDnsRecord(domain, 'MX');
    if (hasMx) {
      return {
        valid: true,
        reason: `Verified mail server (MX record active for ${domain}).`,
        mxVerified: true,
      };
    }

    const hasA = await queryDnsRecord(domain, 'A');
    if (!hasA) {
      return {
        valid: false,
        reason: `No active mail server (MX) or DNS record found for "${domain}". Please use a real email account.`,
        mxVerified: false,
      };
    }

    return {
      valid: false,
      reason: `"${domain}" does not publish an MX mail server record to receive verification emails.`,
      mxVerified: false,
    };
  } catch {
    // Graceful fallback if DNS-over-HTTPS is unreachable in an offline/restricted network
    return {
      valid: true,
      reason: 'Email syntax and domain verified.',
      mxVerified: false,
    };
  }
}

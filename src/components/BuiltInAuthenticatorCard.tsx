import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, ShieldCheck } from 'lucide-react';
import {
  buildOtpAuthUri,
  generateTotpCode,
  getTotpSecondsRemaining,
} from '../lib/authenticator';

interface BuiltInAuthenticatorCardProps {
  secret: string;
  email: string;
  compact?: boolean;
  onFillCode?: (code: string) => void;
}

export function BuiltInAuthenticatorCard({
  secret,
  email,
  compact = false,
  onFillCode,
}: BuiltInAuthenticatorCardProps) {
  const [code, setCode] = useState('------');
  const [secondsLeft, setSecondsLeft] = useState(() => getTotpSecondsRemaining());
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const nextCode = await generateTotpCode(secret);
      if (active) {
        setCode(nextCode);
        setSecondsLeft(getTotpSecondsRemaining());
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [secret]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // Ignore clipboard permissions
    }
  };

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopiedSecret(true);
      window.setTimeout(() => setCopiedSecret(false), 1800);
    } catch {
      // Ignore clipboard permissions
    }
  };

  const formattedCode = code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
  const progressPct = Math.round((secondsLeft / 30) * 100);
  const otpUri = buildOtpAuthUri(email, secret);

  return (
    <div className="bg-gradient-to-br from-sky-50/80 via-white to-slate-50 border border-sky-200/80 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              System One Built-In Authenticator
            </p>
            <p className="text-xs text-slate-600">
              Use this 6-digit code anywhere you sign in with System One
            </p>
          </div>
        </div>
        <span className="text-xs font-mono font-semibold text-sky-800 tabular-nums shrink-0">
          {secondsLeft}s
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-2xl sm:text-3xl font-bold tracking-[0.2em] text-slate-900 tabular-nums">
          {formattedCode}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyCode}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
          </button>
          {onFillCode && (
            <button
              type="button"
              onClick={() => onFillCode(code)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors"
            >
              <span>Use Code</span>
            </button>
          )}
        </div>
      </div>

      {/* Countdown Progress Bar */}
      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-sky-700 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {!compact && (
        <div className="pt-2 border-t border-slate-200/70 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              <span>Setup Secret (Base32):</span>
            </span>
            <button
              type="button"
              onClick={handleCopySecret}
              className="font-mono text-sky-700 hover:text-sky-800 font-medium"
            >
              {copiedSecret ? 'Secret Copied' : secret}
            </button>
          </div>
          <p className="font-mono text-[11px] text-slate-500 break-all">
            {otpUri}
          </p>
        </div>
      )}
    </div>
  );
}

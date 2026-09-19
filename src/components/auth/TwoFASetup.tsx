'use client';

import { useState, useCallback } from 'react';
import { Copy, Check, AlertTriangle, Loader2 } from 'lucide-react';
import type { Setup2FAResponse } from '@/hooks/useSecurity';

interface TwoFASetupProps {
  setupData: Setup2FAResponse;
  onVerify: (code: string) => void;
  isVerifying: boolean;
  verifyError?: string;
  onDone: () => void;
  verified: boolean;
}

export default function TwoFASetup({
  setupData,
  onVerify,
  isVerifying,
  verifyError,
  onDone,
  verified,
}: TwoFASetupProps) {
  const [step, setStep] = useState<1 | 2 | 3>(verified ? 3 : 1);
  const [verifyCode, setVerifyCode] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  const handleCopySecret = useCallback(() => {
    if (setupData.secret) {
      navigator.clipboard.writeText(setupData.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  }, [setupData.secret]);

  const handleCopyAllCodes = useCallback(() => {
    if (setupData.recovery_codes) {
      navigator.clipboard.writeText(setupData.recovery_codes.join('\n'));
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    }
  }, [setupData.recovery_codes]);

  const handleVerifySubmit = () => {
    if (verifyCode.length !== 6) return;
    onVerify(verifyCode);
  };

  if (step === 1) {
    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            Step 1: Set up your authenticator app
          </h3>
          <p className="text-xs text-muted-foreground">
            Scan the QR code below with your authenticator app (Google Authenticator, Authy, etc.)
            or manually enter the secret key.
          </p>
        </div>

        {/* QR Code Image */}
        <div className="flex justify-center rounded-xl border border-border bg-brand-card p-4">
          <img
            src={setupData.qr_code_url}
            alt="2FA QR Code"
            className="h-48 w-48"
          />
        </div>

        {/* Secret key */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Secret Key</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-background border border-border px-3 py-2 font-mono text-sm tracking-wider text-foreground">
              {setupData.secret}
            </code>
            <button
              type="button"
              onClick={handleCopySecret}
              className="shrink-0 rounded-lg border border-border bg-brand-card p-2 text-muted-foreground transition-colors hover:bg-background"
            >
              {copiedSecret ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setStep(2)}
          className="w-full rounded-xl bg-primary-tint py-3 text-sm font-bold text-white transition-all hover:bg-primary-ink"
        >
          Next
        </button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            Step 2: Verify your authenticator
          </h3>
          <p className="text-xs text-muted-foreground">
            Enter the 6-digit code from your authenticator app to confirm the setup.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">Verification Code</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={verifyCode}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 6);
              setVerifyCode(val);
            }}
            className="w-full rounded-xl border border-border bg-brand-card px-4 py-3 text-center font-mono text-lg tracking-[0.5em] text-foreground outline-hidden transition-all placeholder:text-primary-ink/50 focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {verifyError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {verifyError}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex-1 rounded-xl border border-border bg-brand-card py-2.5 text-sm font-semibold text-muted-foreground transition-all hover:bg-background"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => {
              handleVerifySubmit();
              if (verifyCode.length === 6) {
                setTimeout(() => {
                  if (!verifyError) setStep(3);
                }, 1500);
              }
            }}
            disabled={isVerifying || verifyCode.length !== 6}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-tint py-2.5 text-sm font-bold text-white transition-all hover:bg-primary-ink disabled:opacity-50"
          >
            {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
          </button>
        </div>
      </div>
    );
  }

  // Step 3: Recovery Codes
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">
          Step 3: Save your recovery codes
        </h3>
        <p className="text-xs text-muted-foreground">
          These codes can be used to access your account if you lose your authenticator device.
          Each code can only be used once.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm font-semibold text-amber-700">
            Save these codes in a safe place. You will not be able to see them again.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {setupData.recovery_codes.map((code) => (
          <div
            key={code}
            className="rounded-lg bg-background border border-border px-3 py-2 text-center font-mono text-sm tracking-wider text-foreground"
          >
            {code}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleCopyAllCodes}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-brand-card py-2.5 text-sm font-semibold text-muted-foreground transition-all hover:bg-background"
      >
        {copiedCodes ? (
          <>
            <Check className="h-4 w-4 text-emerald-600" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy All Codes
          </>
        )}
      </button>

      <button
        type="button"
        onClick={onDone}
        className="w-full rounded-xl bg-primary-tint py-3 text-sm font-bold text-white transition-all hover:bg-primary-ink"
      >
        Done
      </button>
    </div>
  );
}

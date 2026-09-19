'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { verify2FA } from '@/services/authService';

function TwoFAPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const userId = searchParams.get('user_id') || '';
  const pendingToken = searchParams.get('pending_token') || '';

  const [code, setCode] = useState('');
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, []);

  // Redirect if missing params
  useEffect(() => {
    if (!userId || !pendingToken) {
      router.replace('/login');
    }
  }, [userId, pendingToken, router]);

  const handleVerify = useCallback(
    async (verifyCode: string) => {
      if (isVerifying) return;
      setError(null);
      setIsVerifying(true);

      const result = await verify2FA(userId, verifyCode, pendingToken);

      if (result.success) {
        router.push('/');
        return;
      }

      setError(result.error || 'Verification failed. Please try again.');
      setIsVerifying(false);
      setCode('');
    },
    [userId, pendingToken, isVerifying, router]
  );

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (isRecoveryMode) {
      setCode(value);
      return;
    }

    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    setCode(digitsOnly);

    if (digitsOnly.length === 6) {
      handleVerify(digitsOnly);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    await handleVerify(code.trim());
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 selection:bg-primary-tint/20 selection:text-foreground">
      <div className="w-full max-w-md">
        <div className="rounded-4xl border border-border bg-brand-card p-7 shadow-[0_20px_50px_rgba(60,36,21,0.08)] sm:p-8">
          {/* Header */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary-ink"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-background">
                <ShieldCheck className="h-6 w-6 text-primary-ink" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-foreground">
                  Two-Factor Auth
                </h1>
                <p className="text-[11px] font-bold tracking-[0.18em] text-primary-ink">
                  Verification Required
                </p>
              </div>
            </div>
          </div>

          <p className="mb-5 text-sm font-medium text-muted-foreground">
            {isRecoveryMode
              ? 'Enter one of your recovery codes to verify your identity.'
              : 'Enter the 6-digit code from your authenticator app.'}
          </p>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}

          {/* Code Input */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="twoFACode">
                {isRecoveryMode ? 'Recovery Code' : 'Verification Code'}
              </label>
              <input
                ref={codeInputRef}
                id="twoFACode"
                type="text"
                inputMode={isRecoveryMode ? 'text' : 'numeric'}
                autoComplete="one-time-code"
                value={code}
                onChange={handleCodeChange}
                placeholder={isRecoveryMode ? 'xxxx-xxxx-xxxx' : '000000'}
                className="w-full rounded-xl border border-border bg-brand-card px-4 py-3 text-center text-lg font-bold tracking-[0.3em] text-foreground outline-hidden transition-all placeholder:tracking-[0.3em] placeholder:text-primary-ink/40 focus:ring-4 focus:ring-primary/10 focus:border-primary-outline"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || (!isRecoveryMode && code.length < 6)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-tint py-3 text-sm font-bold text-white transition-all hover:bg-primary-ink hover:scale-[1.01] disabled:opacity-60"
            >
              {isVerifying && <Loader2 className="h-4 w-4 animate-spin" />}
              {isVerifying ? 'Verifying...' : 'Verify'}
            </button>
          </form>

          {/* Recovery toggle */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRecoveryMode(!isRecoveryMode);
                setCode('');
                setError(null);
              }}
              className="text-sm font-semibold text-primary-ink transition-colors hover:text-foreground"
            >
              {isRecoveryMode
                ? 'Use authenticator code instead'
                : 'Use recovery code'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TwoFAPageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Loader2 className="h-6 w-6 animate-spin text-primary-ink" />
    </div>
  );
}

export default function TwoFAPage() {
  return (
    <Suspense fallback={<TwoFAPageFallback />}>
      <TwoFAPageContent />
    </Suspense>
  );
}

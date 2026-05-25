'use client';

// A13 anomaly step-up page. Login server-side flagged this attempt as
// high-risk (new /24 + new device) and returned a `requires_step_up`
// envelope instead of minting tokens. The user proves they're really
// themselves via either an email OTP (sent to their verified email)
// or a TOTP code from their authenticator app, then we exchange the
// pending_token for a real session.

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2, ShieldAlert } from 'lucide-react';
import { verifyStepUpEmail, verifyStepUp2FA } from '@/services/authService';

type Method = 'email_otp' | 'totp';

function StepUpPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pendingToken = searchParams.get('pending_token') ?? '';
  const redirectTo = searchParams.get('redirect') || '/';
  const methods = useMemo<Method[]>(() => {
    const raw = (searchParams.get('methods') ?? '').split(',').map(s => s.trim());
    return raw.filter((m): m is Method => m === 'email_otp' || m === 'totp');
  }, [searchParams]);

  // If only one method is available, lock to it. Otherwise default to
  // email_otp (lower-friction) when both are available.
  const initialMethod: Method =
    methods.length === 1 ? methods[0] : methods.includes('email_otp') ? 'email_otp' : 'totp';

  const [method, setMethod] = useState<Method>(initialMethod);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pendingToken || methods.length === 0) {
      router.replace('/login');
    }
  }, [pendingToken, methods, router]);

  useEffect(() => {
    if (codeInputRef.current) codeInputRef.current.focus();
  }, [method]);

  const handleVerify = useCallback(
    async (verifyCode: string) => {
      if (isVerifying) return;
      setError(null);
      setIsVerifying(true);

      const fn = method === 'email_otp' ? verifyStepUpEmail : verifyStepUp2FA;
      const result = await fn(pendingToken, verifyCode);

      if (result.success) {
        router.push(redirectTo);
        return;
      }
      setError(result.error || 'Verification failed. Please try again.');
      setIsVerifying(false);
      setCode('');
    },
    [method, pendingToken, redirectTo, isVerifying, router],
  );

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    setCode(digitsOnly);
    if (digitsOnly.length === 6) handleVerify(digitsOnly);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    await handleVerify(code.trim());
  };

  const description =
    method === 'email_otp'
      ? 'Enter the 6-digit code we just sent to your registered email.'
      : 'Enter the 6-digit code from your authenticator app.';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF5F0] px-4 py-8 selection:bg-[#D4A574]/20 selection:text-[#3C2415]">
      <div className="w-full max-w-md">
        <div className="rounded-[2rem] border border-[#F0E6DC] bg-brand-card p-7 shadow-[0_20px_50px_rgba(60,36,21,0.08)] sm:p-8">
          <div className="mb-6">
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-[#7B5B3A] transition-colors hover:text-[#D4A574]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100">
                <ShieldAlert className="h-6 w-6 text-amber-700" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-[#3C2415]">
                  Verify it's you
                </h1>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
                  Unfamiliar sign-in
                </p>
              </div>
            </div>
          </div>

          <p className="mb-5 text-sm font-medium text-[#7B5B3A]">
            We noticed this sign-in is from a new device on a new network.
            {' '}{description}
          </p>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#7B5B3A]" htmlFor="stepUpCode">
                Verification Code
              </label>
              <input
                ref={codeInputRef}
                id="stepUpCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={handleCodeChange}
                placeholder="000000"
                className="w-full rounded-xl border border-[#F0E6DC] bg-brand-card px-4 py-3 text-center text-lg font-bold tracking-[0.3em] text-[#3C2415] outline-none transition-all placeholder:tracking-[0.3em] placeholder:text-[#D4A574]/40 focus:ring-4 focus:ring-[#D4A574]/10 focus:border-[#D4A574]"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || code.length < 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4A574] py-3 text-sm font-bold text-white transition-all hover:bg-[#c4955f] hover:scale-[1.01] disabled:opacity-60"
            >
              {isVerifying && <Loader2 className="h-4 w-4 animate-spin" />}
              {isVerifying ? 'Verifying...' : 'Verify'}
            </button>
          </form>

          {methods.length > 1 && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setMethod(method === 'email_otp' ? 'totp' : 'email_otp');
                  setCode('');
                  setError(null);
                }}
                className="text-sm font-semibold text-[#D4A574] transition-colors hover:text-[#3C2415]"
              >
                {method === 'email_otp'
                  ? 'Use authenticator app instead'
                  : 'Use email code instead'}
              </button>
            </div>
          )}

          <p className="mt-6 text-[11px] leading-relaxed text-[#9A8369]">
            If this wasn't you, change your password immediately and review
            recent activity from your account settings.
          </p>
        </div>
      </div>
    </div>
  );
}

function Fallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF5F0] px-4 py-8">
      <Loader2 className="h-6 w-6 animate-spin text-[#D4A574]" />
    </div>
  );
}

export default function StepUpPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <StepUpPageContent />
    </Suspense>
  );
}

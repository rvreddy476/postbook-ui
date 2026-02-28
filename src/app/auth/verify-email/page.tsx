'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle, Loader2, Mail } from 'lucide-react';
import { useVerifyEmail, useResendVerification } from '@/hooks/useSecurity';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const verifyEmail = useVerifyEmail();
  const resendVerification = useResendVerification();

  useEffect(() => {
    if (codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    setError(null);

    verifyEmail.mutate(code, {
      onSuccess: () => {
        setSuccess(true);
        setTimeout(() => {
          router.push('/');
        }, 2000);
      },
      onError: (err) => {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Invalid verification code. Please try again.';
        setError(message);
      },
    });
  };

  const handleResend = () => {
    if (resendCooldown > 0) return;

    resendVerification.mutate('email', {
      onSuccess: () => {
        setResendCooldown(60);
        setError(null);
      },
      onError: (err) => {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to resend verification code.';
        setError(message);
      },
    });
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(digitsOnly);
    if (error) setError(null);
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF5F0] px-4 py-8">
        <div className="w-full max-w-md">
          <div className="rounded-[2rem] border border-[#F0E6DC] bg-white p-8 shadow-[0_20px_50px_rgba(60,36,21,0.08)]">
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-[#3C2415]">Email Verified!</h2>
              <p className="mt-2 text-sm text-[#7B5B3A]">
                Your email has been verified successfully. Redirecting you to the homepage...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF5F0] px-4 py-8 selection:bg-[#D4A574]/20 selection:text-[#3C2415]">
      <div className="w-full max-w-md">
        <div className="rounded-[2rem] border border-[#F0E6DC] bg-white p-7 shadow-[0_20px_50px_rgba(60,36,21,0.08)] sm:p-8">
          {/* Header */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FAF5F0]">
              <Mail className="h-6 w-6 text-[#D4A574]" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#3C2415]">
                Verify Email
              </h1>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4A574]">
                Check Your Inbox
              </p>
            </div>
          </div>

          <p className="mb-5 text-sm font-medium text-[#7B5B3A]">
            We sent a 6-digit verification code to your email address. Please enter it below to verify your account.
          </p>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}

          {/* Code Input */}
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#7B5B3A]" htmlFor="verifyCode">
                Verification Code
              </label>
              <input
                ref={codeInputRef}
                id="verifyCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={handleCodeChange}
                placeholder="000000"
                maxLength={6}
                className="w-full rounded-xl border border-[#F0E6DC] bg-white px-4 py-3 text-center text-lg font-bold tracking-[0.3em] text-[#3C2415] outline-none transition-all placeholder:tracking-[0.3em] placeholder:text-[#D4A574]/40 focus:ring-4 focus:ring-[#D4A574]/10 focus:border-[#D4A574]"
                required
              />
            </div>

            <button
              type="submit"
              disabled={verifyEmail.isPending || code.length < 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4A574] py-3 text-sm font-bold text-white transition-all hover:bg-[#c4955f] hover:scale-[1.01] disabled:opacity-60"
            >
              {verifyEmail.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {verifyEmail.isPending ? 'Verifying...' : 'Verify Email'}
            </button>
          </form>

          {/* Resend button */}
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || resendVerification.isPending}
              className="text-sm font-semibold text-[#D4A574] transition-colors hover:text-[#3C2415] disabled:opacity-50"
            >
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : resendVerification.isPending
                  ? 'Sending...'
                  : 'Resend Code'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

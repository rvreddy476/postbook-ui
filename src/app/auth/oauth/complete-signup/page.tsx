'use client';

// A5 OAuth pre-creation completion. When an OAuth provider didn't
// assert `email_verified` (or asserted false), the backend refuses to
// auto-create the user, stashes the provider claims under an opaque
// pending_token in Redis (5-min TTL), and redirects the browser here
// with ?token=...&provider=...&email=... so we can collect a real
// phone number, send an OTP, and only then materialise the account.
//
// Two-step UI: (1) phone entry → POST /complete-signup sends OTP,
// (2) OTP entry → POST /verify-signup creates the user + issues a
// session.

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { HttpClient, HttpClientError } from '@/services/core/httpClient';
import { mapAuthResponse } from '@/services/auth/responseMapper';
import { AuthSessionStore } from '@/services/auth/AuthSessionStore';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
const DEVICE_ID_KEY = 'postbook_device_id';

const getDeviceId = () => {
  if (typeof window === 'undefined') return 'web-server';
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.trim()) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `web_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return 'web-fallback';
  }
};

const formatErr = (err: unknown, fallback: string) => {
  if (err instanceof HttpClientError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

type Step = 'phone' | 'otp';

function CompleteSignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pendingToken = searchParams.get('token') ?? '';
  const provider = searchParams.get('provider') ?? '';
  const email = searchParams.get('email') ?? '';

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const otpRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  const http = useRef(new HttpClient(API_BASE_URL, 15_000)).current;

  useEffect(() => {
    if (!pendingToken) {
      router.replace('/login');
    }
  }, [pendingToken, router]);

  useEffect(() => {
    if (step === 'phone') phoneRef.current?.focus();
    else otpRef.current?.focus();
  }, [step]);

  const sendOtp = useCallback(async (toPhone: string) => {
    setError(null);
    setIsBusy(true);
    try {
      await http.post('/v1/auth/oauth/complete-signup', {
        pending_token: pendingToken,
        phone: toPhone,
      });
      setStep('otp');
    } catch (err) {
      setError(formatErr(err, 'Could not send code. Please try again.'));
    } finally {
      setIsBusy(false);
    }
  }, [http, pendingToken]);

  const verifyOtp = useCallback(async (code: string) => {
    setError(null);
    setIsBusy(true);
    try {
      const response = await http.post<unknown>('/v1/auth/oauth/verify-signup', {
        pending_token: pendingToken,
        otp: code,
        device_id: getDeviceId(),
        platform: 'web',
      });
      const authResult = mapAuthResponse(response, email || phone);
      new AuthSessionStore().save(authResult);
      router.replace('/');
    } catch (err) {
      setError(formatErr(err, 'Verification failed. Please try again.'));
      setIsBusy(false);
      setOtp('');
    }
  }, [http, pendingToken, email, phone, router]);

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = phone.trim();
    if (!cleaned) return;
    sendOtp(cleaned);
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(digits);
    if (digits.length === 6) verifyOtp(digits);
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) return;
    verifyOtp(otp);
  };

  const providerLabel = provider
    ? provider.charAt(0).toUpperCase() + provider.slice(1)
    : 'your provider';

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
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FAF5F0]">
                <ShieldCheck className="h-6 w-6 text-[#D4A574]" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-[#3C2415]">
                  Finish signing up
                </h1>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4A574]">
                  One more step
                </p>
              </div>
            </div>
          </div>

          <p className="mb-5 text-sm font-medium text-[#7B5B3A]">
            {providerLabel} couldn&apos;t confirm that your email
            {email ? ` (${email})` : ''} is verified. To keep your account
            safe, please verify a phone number — we&apos;ll send a one-time
            code.
          </p>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}

          {step === 'phone' ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#7B5B3A]" htmlFor="phoneNumber">
                  Phone Number
                </label>
                <input
                  ref={phoneRef}
                  id="phoneNumber"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-xl border border-[#F0E6DC] bg-brand-card px-4 py-3 text-base font-semibold text-[#3C2415] outline-none transition-all placeholder:text-[#D4A574]/40 focus:ring-4 focus:ring-[#D4A574]/10 focus:border-[#D4A574]"
                  required
                />
                <p className="text-[11px] text-[#9A8369]">
                  Include the country code. We&apos;ll text a 6-digit code.
                </p>
              </div>

              <button
                type="submit"
                disabled={isBusy || !phone.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4A574] py-3 text-sm font-bold text-white transition-all hover:bg-[#c4955f] hover:scale-[1.01] disabled:opacity-60"
              >
                {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                {isBusy ? 'Sending code...' : 'Send code'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#7B5B3A]" htmlFor="otpCode">
                  Verification code sent to {phone}
                </label>
                <input
                  ref={otpRef}
                  id="otpCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={handleOtpChange}
                  placeholder="000000"
                  className="w-full rounded-xl border border-[#F0E6DC] bg-brand-card px-4 py-3 text-center text-lg font-bold tracking-[0.3em] text-[#3C2415] outline-none transition-all placeholder:tracking-[0.3em] placeholder:text-[#D4A574]/40 focus:ring-4 focus:ring-[#D4A574]/10 focus:border-[#D4A574]"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isBusy || otp.length < 6}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4A574] py-3 text-sm font-bold text-white transition-all hover:bg-[#c4955f] hover:scale-[1.01] disabled:opacity-60"
              >
                {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                {isBusy ? 'Verifying...' : 'Verify and create account'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('phone'); setOtp(''); setError(null); }}
                className="block w-full text-sm font-semibold text-[#D4A574] transition-colors hover:text-[#3C2415]"
              >
                Use a different phone number
              </button>
            </form>
          )}

          <p className="mt-6 text-[11px] leading-relaxed text-[#9A8369]">
            Your account uses {providerLabel} for sign-in. The phone number
            is for security verification only — you can change it later
            from settings.
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

export default function CompleteSignupPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <CompleteSignupContent />
    </Suspense>
  );
}

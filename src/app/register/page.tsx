'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CheckCircle, Loader2, Mail } from 'lucide-react';
import { getSession, registerUser } from '@/services/authService';
import { useVerifyEmail, useResendVerification } from '@/hooks/useSecurity';
import OAuthButtons from '@/components/auth/OAuthButtons';

type Screen = 'register' | 'verify-email';

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

export default function RegisterPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>('register');
  const [direction, setDirection] = useState(0);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Others'>('Male');
  const [dob, setDob] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Email verification state
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const verifyEmail = useVerifyEmail();
  const resendVerification = useResendVerification();

  useEffect(() => {
    if (getSession()) {
      router.replace('/');
    }
  }, [router]);

  useEffect(() => {
    if (screen === 'verify-email' && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [screen]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await registerUser({
      firstName,
      lastName,
      gender,
      dob,
      loginId,
      password,
    });

    if (result.success) {
      // Check if loginId is an email - show verification prompt
      const isEmail = /.+@.+\..+/.test(loginId.trim());
      if (isEmail) {
        setDirection(1);
        setScreen('verify-email');
        setIsLoading(false);
      } else {
        router.push('/');
      }
      return;
    }

    setError(result.error || 'Registration failed.');
    setIsLoading(false);
  };

  const handleVerifyEmail = () => {
    if (verifyCode.length !== 6) {
      setVerifyError('Please enter the 6-digit verification code.');
      return;
    }
    setVerifyError(null);

    verifyEmail.mutate(verifyCode, {
      onSuccess: () => {
        setVerifySuccess(true);
        setTimeout(() => {
          router.push('/');
        }, 2000);
      },
      onError: (err) => {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Invalid verification code. Please try again.';
        setVerifyError(message);
      },
    });
  };

  const handleResendCode = () => {
    if (resendCooldown > 0) return;

    resendVerification.mutate('email', {
      onSuccess: () => {
        setResendCooldown(60);
      },
      onError: (err) => {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to resend verification code.';
        setVerifyError(message);
      },
    });
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
    setVerifyCode(digitsOnly);
    if (verifyError) setVerifyError(null);
  };

  return (
    <div className="flex h-screen items-center justify-center overflow-hidden px-4 py-3 selection:bg-brand-accent/20 selection:text-brand-text">
      <div className="w-full max-w-md">
        <div className="relative overflow-hidden rounded-[1.5rem] border border-brand-divider bg-brand-card p-5 shadow-lg sm:p-6">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            {screen === 'register' && (
              <motion.div
                key="register"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <div className="mb-4 flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-accent shadow-lg">
                    <span className="text-sm font-black tracking-tighter text-brand-bg">VC</span>
                  </div>
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-brand-text">Create Account</h1>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Registration</p>
                  </div>
                </div>

                {error && (
                  <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                    {error}
                  </div>
                )}

                <form className="space-y-2" onSubmit={handleSubmit}>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-brand-text/60" htmlFor="firstName">
                        FirstName
                      </label>
                      <input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full rounded-lg border border-brand-divider bg-brand-card px-3 py-2 text-sm font-medium text-brand-text outline-none transition-all focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-brand-text/60" htmlFor="lastName">
                        LastName
                      </label>
                      <input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full rounded-lg border border-brand-divider bg-brand-card px-3 py-2 text-sm font-medium text-brand-text outline-none transition-all focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-brand-text/60">Gender</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Male', 'Female', 'Others'] as const).map((value) => (
                        <label
                          key={value}
                          className={`flex cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-xs font-semibold transition-all ${
                            gender === value
                              ? 'border-brand-accent bg-brand-accent/10 text-brand-text'
                              : 'border-brand-divider bg-brand-card text-brand-text/60'
                          }`}
                        >
                          <input
                            type="radio"
                            name="gender"
                            value={value}
                            checked={gender === value}
                            onChange={() => setGender(value)}
                            className="sr-only"
                          />
                          {value}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-brand-text/60" htmlFor="dob">
                      DOB
                    </label>
                    <input
                      id="dob"
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full rounded-lg border border-brand-divider bg-brand-card px-3 py-2 text-sm font-medium text-brand-text outline-none transition-all focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-brand-text/60" htmlFor="loginId">
                      Mail or phone number for login
                    </label>
                    <input
                      id="loginId"
                      type="text"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      placeholder="you@example.com or 9876543210"
                      className="w-full rounded-lg border border-brand-divider bg-brand-card px-3 py-2 text-sm font-medium text-brand-text outline-none transition-all placeholder:text-brand-text/30 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-brand-text/60" htmlFor="password">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="********"
                      className="w-full rounded-lg border border-brand-divider bg-brand-card px-3 py-2 text-sm font-medium text-brand-text outline-none transition-all placeholder:text-brand-text/30 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="mt-1 w-full rounded-lg bg-brand-accent py-2.5 text-sm font-bold text-brand-bg transition-all hover:opacity-90 hover:scale-[1.01] disabled:opacity-60"
                  >
                    {isLoading ? 'Creating...' : 'Create Account'}
                  </button>
                </form>

                {/* OAuth Buttons */}
                <OAuthButtons label="or sign up with" />

                <div className="mt-3 text-center text-xs text-brand-text/60">
                  <span>Already have account? </span>
                  <Link href="/login" className="font-bold text-brand-accent hover:text-brand-text">
                    Login
                  </Link>
                </div>
              </motion.div>
            )}

            {screen === 'verify-email' && (
              <motion.div
                key="verify-email"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                {verifySuccess ? (
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                      <CheckCircle className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h2 className="text-xl font-bold text-brand-text">Email Verified!</h2>
                    <p className="mt-2 text-sm text-brand-text/60">
                      Your email has been verified successfully. Redirecting you to the homepage...
                    </p>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setDirection(-1);
                        setScreen('register');
                      }}
                      className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-brand-text/60 transition-colors hover:text-brand-accent"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </button>

                    <div className="mb-6 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-secondary">
                        <Mail className="h-6 w-6 text-brand-accent" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black tracking-tight text-brand-text">
                          Verify Your Email
                        </h2>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-accent">
                          Almost There
                        </p>
                      </div>
                    </div>

                    <p className="mb-5 text-sm font-medium text-brand-text/60">
                      We sent a 6-digit verification code to <strong className="text-brand-text">{loginId}</strong>.
                      Please enter it below to verify your email address.
                    </p>

                    {verifyError && (
                      <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                        {verifyError}
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-brand-text/60" htmlFor="verifyCode">
                          Verification Code
                        </label>
                        <input
                          ref={codeInputRef}
                          id="verifyCode"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={verifyCode}
                          onChange={handleCodeChange}
                          placeholder="000000"
                          maxLength={6}
                          className="w-full rounded-xl border border-brand-divider bg-brand-card px-4 py-3 text-center text-lg font-bold tracking-[0.3em] text-brand-text outline-none transition-all placeholder:tracking-[0.3em] placeholder:text-brand-text/30 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent"
                          required
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleVerifyEmail}
                        disabled={verifyEmail.isPending || verifyCode.length < 6}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-accent py-3 text-sm font-bold text-brand-bg transition-all hover:opacity-90 hover:scale-[1.01] disabled:opacity-60"
                      >
                        {verifyEmail.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        {verifyEmail.isPending ? 'Verifying...' : 'Verify Email'}
                      </button>
                    </div>

                    <div className="mt-4 text-center">
                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={resendCooldown > 0 || resendVerification.isPending}
                        className="text-sm font-semibold text-brand-accent transition-colors hover:text-brand-text disabled:opacity-50"
                      >
                        {resendCooldown > 0
                          ? `Resend code in ${resendCooldown}s`
                          : resendVerification.isPending
                            ? 'Sending...'
                            : 'Resend Code'}
                      </button>
                    </div>

                    <div className="mt-4 text-center">
                      <button
                        type="button"
                        onClick={() => router.push('/')}
                        className="text-xs font-medium text-brand-text/60 transition-colors hover:text-brand-text"
                      >
                        Skip for now
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

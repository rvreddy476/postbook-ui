'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  User,
  Loader2,
} from 'lucide-react';
import { getSession, registerUser } from '@/services/authService';
import { DobPicker, validateDob } from '@/components/ui/dob-picker';
import { useVerifyEmail, useResendVerification } from '@/hooks/useSecurity';

type Screen = 'register' | 'verify-email';

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
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
  const [dobError, setDobError] = useState<string | null>(null);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const verifyEmail = useVerifyEmail();
  const resendVerification = useResendVerification();

  useEffect(() => {
    if (getSession()) router.replace('/');
  }, [router]);

  useEffect(() => {
    if (screen === 'verify-email' && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [screen]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const isEmailId = /.+@.+\..+/.test(loginId.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const dobErr = validateDob(dob);
    setDobError(dobErr);
    if (dobErr) return;

    setIsLoading(true);

    const result = await registerUser({ firstName, lastName, gender, dob, loginId, password });

    if (result.success) {
      if (isEmailId) {
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
        setTimeout(() => router.push('/'), 2000);
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
      onSuccess: () => setResendCooldown(60),
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

  const inputBase =
    'w-full rounded-xl border border-brand-divider bg-brand-secondary px-4 py-3 text-sm font-medium text-brand-text outline-none transition-all placeholder:text-brand-text/30 focus:border-brand-accent focus:bg-brand-card focus:ring-4 focus:ring-brand-accent/10';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-bg px-4 py-8 selection:bg-brand-accent/20 selection:text-brand-text">
      {/* Ambient monochrome glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-brand-text/[0.06] blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-48 -right-32 h-[520px] w-[520px] rounded-full bg-brand-text/[0.05] blur-[160px]" />
      {/* Hairline ring accent behind the card */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-text/[0.04]" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className={`relative w-full transition-all duration-300 ${screen === 'register' ? 'max-w-xl' : 'max-w-md'}`}
      >
        {/* Brand mark above the card — logo only */}
        <div className="mb-6 flex px-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-accent shadow-md">
            <span className="text-base font-black tracking-tighter text-brand-bg">VC</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[1.75rem] border border-brand-divider bg-brand-card/85 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
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
                {/* Header */}
                <div className="mb-6">
                  <h2 className="text-xl font-black tracking-tight text-brand-text">Create account</h2>
                  <p className="mt-1 text-sm text-brand-text/50">Join VChat and connect with your community.</p>
                </div>

                {/* Error banner */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      className="mb-4"
                    >
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                        {error}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form className="space-y-4" onSubmit={handleSubmit}>
                  {/* Name row */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-brand-text/60" htmlFor="firstName">
                        First Name
                      </label>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text/30" />
                        <input
                          id="firstName"
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Ada"
                          className={`${inputBase} pl-10`}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-brand-text/60" htmlFor="lastName">
                        Last Name
                      </label>
                      <input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Lovelace"
                        className={inputBase}
                        required
                      />
                    </div>
                  </div>

                  {/* Gender selection and DOB row */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Gender */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-brand-text/60">
                        Gender
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['Male', 'Female', 'Others'] as const).map((g) => (
                          <label
                            key={g}
                            className={`relative flex cursor-pointer items-center justify-center rounded-xl border py-3 text-xs font-bold transition-all ${
                              gender === g
                                ? 'border-brand-accent bg-brand-accent text-brand-bg shadow-sm'
                                : 'border-brand-divider bg-brand-secondary text-brand-text/50 hover:border-brand-accent/40 hover:text-brand-text/70'
                            }`}
                          >
                            <input
                              type="radio"
                              name="gender"
                              value={g}
                              checked={gender === g}
                              onChange={() => setGender(g)}
                              className="sr-only"
                            />
                            {g}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Date of Birth */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-brand-text/60">
                        Date of Birth
                      </label>
                      <DobPicker
                        value={dob}
                        onChange={(v) => { setDob(v); setDobError(null); }}
                        error={dobError ?? undefined}
                      />
                    </div>
                  </div>

                  {/* Email / Phone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-brand-text/60" htmlFor="loginId">
                      Email or phone number
                    </label>
                    <div className="relative">
                      {isEmailId ? (
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text/30" />
                      ) : (
                        <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text/30" />
                      )}
                      <input
                        id="loginId"
                        type="text"
                        value={loginId}
                        onChange={(e) => setLoginId(e.target.value)}
                        placeholder="you@example.com or 9876543210"
                        className={`${inputBase} pl-10`}
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-brand-text/60" htmlFor="password">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text/30" />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className={`${inputBase} pl-10 pr-11`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text/40 transition-colors hover:text-brand-text"
                        tabIndex={-1}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-accent py-3.5 text-sm font-bold text-brand-bg shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:hover:scale-100"
                  >
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </button>
                </form>

                {/* Footer */}
                <div className="mt-6 border-t border-brand-divider pt-5 text-center text-sm text-brand-text/60">
                  <span>Already have an account? </span>
                  <Link
                    href="/login"
                    className="font-bold text-brand-accent hover:underline"
                  >
                    Sign in
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
                  <div className="py-8 text-center animate-fade-in">
                    <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 ring-8 ring-emerald-500/5">
                      <CheckCircle className="h-10 w-10 text-emerald-500" />
                    </div>
                    <h2 className="text-xl font-black text-brand-text">Email Verified</h2>
                    <p className="mt-2 text-sm text-brand-text/50">
                      Your account is ready. Redirecting you now…
                    </p>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { setDirection(-1); setScreen('register'); }}
                      className="mb-6 flex items-center gap-1.5 text-sm font-semibold text-brand-text/60 transition-colors hover:text-brand-accent"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to registration
                    </button>

                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-secondary">
                      <Mail className="h-6 w-6 text-brand-accent" />
                    </div>

                    <h2 className="text-2xl font-black tracking-tight text-brand-text">
                      Check your email
                    </h2>
                    <p className="mt-2 text-sm text-brand-text/60 leading-relaxed">
                      We sent a 6-digit verification code to{' '}
                      <strong className="font-semibold text-brand-text">{loginId}</strong>.
                      Enter the code below to verify your account.
                    </p>

                    {verifyError && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
                      >
                        {verifyError}
                      </motion.div>
                    )}

                    <div className="mt-6 space-y-4">
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
                        className="w-full rounded-xl border border-brand-divider bg-brand-secondary px-4 py-4 text-center text-2xl font-black tracking-[0.5em] text-brand-text outline-none transition-all placeholder:tracking-[0.5em] placeholder:text-brand-text/20 focus:border-brand-accent focus:bg-brand-card focus:ring-4 focus:ring-brand-accent/10"
                        required
                      />

                      <button
                        type="button"
                        onClick={handleVerifyEmail}
                        disabled={verifyEmail.isPending || verifyCode.length < 6}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-accent py-3.5 text-sm font-bold text-brand-bg shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:hover:scale-100"
                      >
                        {verifyEmail.isPending && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        {verifyEmail.isPending ? 'Verifying…' : 'Verify Email'}
                      </button>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-brand-divider pt-5">
                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={resendCooldown > 0 || resendVerification.isPending}
                        className="text-xs font-bold uppercase tracking-wider text-brand-accent transition-colors hover:text-brand-text disabled:opacity-50"
                      >
                        {resendCooldown > 0
                          ? `Resend in ${resendCooldown}s`
                          : resendVerification.isPending
                            ? 'Sending…'
                            : 'Resend code'}
                      </button>

                      <button
                        type="button"
                        onClick={() => router.push('/')}
                        className="text-xs font-bold uppercase tracking-wider text-brand-text/40 transition-colors hover:text-brand-text/70"
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

        {/* Terms note */}
        <p className="mt-6 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-text/30">
          By creating an account, you agree to our{' '}
          <span className="cursor-pointer underline underline-offset-2 hover:text-brand-text/60">Terms</span>{' '}
          and{' '}
          <span className="cursor-pointer underline underline-offset-2 hover:text-brand-text/60">Privacy Policy</span>.
        </p>
      </motion.div>
    </div>
  );
}

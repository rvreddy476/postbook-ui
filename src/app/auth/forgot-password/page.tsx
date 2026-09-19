'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CheckCircle, Eye, EyeOff, KeyRound, Loader2, Mail } from 'lucide-react';
import { useForgotPassword, useResetPassword } from '@/hooks/useSecurity';

type Step = 'request' | 'reset' | 'success';

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

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('request');
  const [direction, setDirection] = useState(0);

  // Step 1 state
  const [identifier, setIdentifier] = useState('');
  const [requestError, setRequestError] = useState<string | null>(null);

  // Step 2 state
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const forgotPassword = useForgotPassword();
  const resetPassword = useResetPassword();

  const handleRequestCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setRequestError('Please enter your email or phone number.');
      return;
    }
    setRequestError(null);

    forgotPassword.mutate(identifier.trim(), {
      onSuccess: () => {
        setDirection(1);
        setStep('reset');
      },
      onError: (err) => {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to send reset code. Please try again.';
        setRequestError(message);
      },
    });
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCode.trim()) {
      setResetError('Please enter the reset code.');
      return;
    }
    if (newPassword.length < 8) {
      setResetError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }
    setResetError(null);

    resetPassword.mutate(
      {
        identifier: identifier.trim(),
        code: resetCode.trim(),
        new_password: newPassword,
      },
      {
        onSuccess: () => {
          setDirection(1);
          setStep('success');
        },
        onError: (err) => {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            'Failed to reset password. Please check your code and try again.';
          setResetError(message);
        },
      }
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 selection:bg-primary-tint/20 selection:text-foreground">
      <div className="w-full max-w-md">
        <div className="relative overflow-hidden rounded-4xl border border-border bg-brand-card p-7 shadow-[0_20px_50px_rgba(60,36,21,0.08)] sm:p-8">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            {/* Step 1: Enter email or phone */}
            {step === 'request' && (
              <motion.div
                key="request"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <Link
                  href="/login"
                  className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary-ink"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to login
                </Link>

                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-background">
                    <KeyRound className="h-6 w-6 text-primary-ink" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black tracking-tight text-foreground">
                      Forgot Password
                    </h1>
                    <p className="text-[11px] font-bold tracking-[0.18em] text-primary-ink">
                      Account Recovery
                    </p>
                  </div>
                </div>

                <p className="mb-5 text-sm font-medium text-muted-foreground">
                  Enter your email address or phone number and we will send you a code to reset your password.
                </p>

                {requestError && (
                  <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    {requestError}
                  </div>
                )}

                <form onSubmit={handleRequestCode} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground" htmlFor="identifier">
                      Email or Phone Number
                    </label>
                    <input
                      id="identifier"
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="you@example.com or 9876543210"
                      className="w-full rounded-xl border border-border bg-brand-card px-4 py-2.5 text-sm font-medium text-foreground outline-hidden transition-all placeholder:text-primary-ink/40 focus:ring-4 focus:ring-primary/10 focus:border-primary-outline"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={forgotPassword.isPending}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-tint py-3 text-sm font-bold text-white transition-all hover:bg-primary-ink hover:scale-[1.01] disabled:opacity-60"
                  >
                    {forgotPassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {forgotPassword.isPending ? 'Sending...' : 'Send Reset Code'}
                  </button>
                </form>
              </motion.div>
            )}

            {/* Step 2: Enter code + new password */}
            {step === 'reset' && (
              <motion.div
                key="reset"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setDirection(-1);
                    setStep('request');
                  }}
                  className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary-ink"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>

                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-background">
                    <Mail className="h-6 w-6 text-primary-ink" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tight text-foreground">
                      Reset Password
                    </h2>
                    <p className="text-[11px] font-bold tracking-[0.18em] text-primary-ink">
                      Enter Code & New Password
                    </p>
                  </div>
                </div>

                <p className="mb-5 text-sm font-medium text-muted-foreground">
                  We sent a reset code to <strong className="text-foreground">{identifier}</strong>.
                  Enter it below along with your new password.
                </p>

                {resetError && (
                  <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    {resetError}
                  </div>
                )}

                <form onSubmit={handleResetPassword} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground" htmlFor="resetCode">
                      Reset Code
                    </label>
                    <input
                      id="resetCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full rounded-xl border border-border bg-brand-card px-4 py-3 text-center text-lg font-bold tracking-[0.3em] text-foreground outline-hidden transition-all placeholder:tracking-[0.3em] placeholder:text-primary-ink/40 focus:ring-4 focus:ring-primary/10 focus:border-primary-outline"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground" htmlFor="newPassword">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        id="newPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 8 characters"
                        className="w-full rounded-xl border border-border bg-brand-card px-4 py-2.5 pr-11 text-sm font-medium text-foreground outline-hidden transition-all placeholder:text-primary-ink/40 focus:ring-4 focus:ring-primary/10 focus:border-primary-outline"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground" htmlFor="confirmPassword">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full rounded-xl border border-border bg-brand-card px-4 py-2.5 pr-11 text-sm font-medium text-foreground outline-hidden transition-all placeholder:text-primary-ink/40 focus:ring-4 focus:ring-primary/10 focus:border-primary-outline"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={resetPassword.isPending}
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-tint py-3 text-sm font-bold text-white transition-all hover:bg-primary-ink hover:scale-[1.01] disabled:opacity-60"
                  >
                    {resetPassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {resetPassword.isPending ? 'Resetting...' : 'Reset Password'}
                  </button>
                </form>

                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      forgotPassword.mutate(identifier.trim());
                    }}
                    disabled={forgotPassword.isPending}
                    className="text-sm font-semibold text-primary-ink transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    {forgotPassword.isPending ? 'Sending...' : 'Resend Code'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Success */}
            {step === 'success' && (
              <motion.div
                key="success"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Password Reset!</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Your password has been successfully reset. You can now log in with your new password.
                  </p>
                  <Link
                    href="/login"
                    className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary-tint px-8 py-3 text-sm font-bold text-white transition-all hover:bg-primary-ink hover:scale-[1.01]"
                  >
                    Back to Login
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

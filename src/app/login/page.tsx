'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { getSession, loginUser, verify2FA } from '@/services/authService';

type Screen = 'login' | '2fa';

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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const [screen, setScreen] = useState<Screen>('login');
  const [direction, setDirection] = useState(0);

  // Login state
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 2FA state
  const [twoFACode, setTwoFACode] = useState('');
  const [pendingToken, setPendingToken] = useState('');
  const [userId, setUserId] = useState('');
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [twoFAError, setTwoFAError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (getSession()) {
      router.replace(redirectTo);
    }
  }, [router, redirectTo]);

  useEffect(() => {
    if (screen === '2fa' && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [screen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await loginUser(loginId, password);

    if (!result.success) {
      setError(result.error || 'Authentication failed.');
      setIsLoading(false);
      return;
    }

    if (result.requiresStepUp) {
      // A13 anomaly step-up. Forward the pending token + available
      // methods to the dedicated page; never store these in URL state
      // when sensitive, but the pending_token is one-shot + 5-min TTL
      // server-side so query params are acceptable here.
      const methods = (result.stepUpMethods ?? []).join(',');
      const params = new URLSearchParams({
        pending_token: result.pendingToken ?? '',
        methods,
        redirect: redirectTo,
      });
      router.push(`/auth/step-up?${params.toString()}`);
      return;
    }

    if (result.requires2FA) {
      setPendingToken(result.pendingToken || '');
      setUserId(result.userId || '');
      setDirection(1);
      setScreen('2fa');
      setIsLoading(false);
      return;
    }

    router.push(redirectTo);
  };

  const handleVerify2FA = useCallback(
    async (code: string) => {
      if (isVerifying) return;
      setTwoFAError(null);
      setIsVerifying(true);

      const result = await verify2FA(userId, code, pendingToken);

      if (result.success) {
        router.push(redirectTo);
        return;
      }

      setTwoFAError(result.error || 'Verification failed.');
      setIsVerifying(false);
      setTwoFACode('');
    },
    [userId, pendingToken, isVerifying, router]
  );

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (isRecoveryMode) {
      setTwoFACode(value);
      return;
    }

    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    setTwoFACode(digitsOnly);

    if (digitsOnly.length === 6) {
      handleVerify2FA(digitsOnly);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFACode.trim()) return;
    await handleVerify2FA(twoFACode.trim());
  };

  const handleBackToLogin = () => {
    setDirection(-1);
    setScreen('login');
    setTwoFACode('');
    setTwoFAError(null);
    setIsRecoveryMode(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-bg px-4 py-8 selection:bg-brand-accent/20 selection:text-brand-text">
      {/* Ambient monochrome glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-brand-text/[0.06] blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-48 -right-32 h-[520px] w-[520px] rounded-full bg-brand-text/[0.05] blur-[160px]" />
      {/* Hairline ring accent behind the card */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-text/[0.04]" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        {/* Brand mark above the card — logo only */}
        <div className="mb-6 flex px-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-accent shadow-md">
            <span className="text-base font-black tracking-tighter text-brand-bg">VC</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[1.75rem] border border-brand-divider bg-brand-card/80 p-7 shadow-2xl backdrop-blur-xl sm:p-8">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            {screen === 'login' && (
              <motion.div
                key="login"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                {/* Header */}
                <div className="mb-6">
                  <h2 className="text-xl font-black tracking-tight text-brand-text">Welcome back</h2>
                  <p className="mt-1 text-sm text-brand-text/50">Sign in to continue to your feed.</p>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mb-4"
                    >
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                        {error}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Form */}
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-1.5">
                    <label
                      className="text-xs font-semibold text-brand-text/60"
                      htmlFor="loginId"
                    >
                      Email or phone number
                    </label>
                    <input
                      id="loginId"
                      type="text"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      placeholder="you@example.com or 9876543210"
                      className="w-full rounded-xl border border-brand-divider bg-brand-secondary px-4 py-3 text-sm font-medium text-brand-text outline-none transition-all placeholder:text-brand-text/30 focus:border-brand-accent focus:bg-brand-card focus:ring-4 focus:ring-brand-accent/10"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        className="text-xs font-semibold text-brand-text/60"
                        htmlFor="password"
                      >
                        Password
                      </label>
                      <Link
                        href="/auth/forgot-password"
                        className="text-xs font-semibold text-brand-accent transition-colors hover:text-brand-text"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="********"
                        className="w-full rounded-xl border border-brand-divider bg-brand-secondary px-4 py-3 pr-11 text-sm font-medium text-brand-text outline-none transition-all placeholder:text-brand-text/30 focus:border-brand-accent focus:bg-brand-card focus:ring-4 focus:ring-brand-accent/10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text/60 transition-colors hover:text-brand-text"
                        tabIndex={-1}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4.5 w-4.5" />
                        ) : (
                          <Eye className="h-4.5 w-4.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-accent py-3.5 text-sm font-bold text-brand-bg shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
                  >
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>

                {/* Register link */}
                <div className="mt-6 border-t border-brand-divider pt-5 text-center text-sm text-brand-text/60">
                  <span>New to VChat? </span>
                  <Link
                    href="/register"
                    className="font-bold text-brand-accent hover:underline"
                  >
                    Create an account
                  </Link>
                </div>
              </motion.div>
            )}

            {screen === '2fa' && (
              <motion.div
                key="2fa"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                {/* 2FA Header */}
                <div className="mb-6">
                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-brand-text/60 transition-colors hover:text-brand-accent"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to login
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-secondary">
                      <ShieldCheck className="h-6 w-6 text-brand-accent" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-brand-text">
                        Two-Factor Auth
                      </h2>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-accent">
                        Verification Required
                      </p>
                    </div>
                  </div>
                </div>

                <p className="mb-5 text-sm font-medium text-brand-text/60">
                  {isRecoveryMode
                    ? 'Enter one of your recovery codes to verify your identity.'
                    : 'Enter the 6-digit code from your authenticator app.'}
                </p>

                {/* 2FA Error */}
                <AnimatePresence>
                  {twoFAError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mb-4"
                    >
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                        {twoFAError}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 2FA Form */}
                <form onSubmit={handle2FASubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      className="text-xs font-semibold text-brand-text/60"
                      htmlFor="twoFACode"
                    >
                      {isRecoveryMode ? 'Recovery Code' : 'Verification Code'}
                    </label>
                    <input
                      ref={codeInputRef}
                      id="twoFACode"
                      type="text"
                      inputMode={isRecoveryMode ? 'text' : 'numeric'}
                      autoComplete="one-time-code"
                      value={twoFACode}
                      onChange={handleCodeChange}
                      placeholder={isRecoveryMode ? 'xxxx-xxxx-xxxx' : '000000'}
                      className="w-full rounded-xl border border-brand-divider bg-brand-card px-4 py-3 text-center text-lg font-bold tracking-[0.3em] text-brand-text outline-none transition-all placeholder:tracking-[0.3em] placeholder:text-brand-text/30 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifying || (!isRecoveryMode && twoFACode.length < 6)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-accent py-3 text-sm font-bold text-brand-bg transition-all hover:opacity-90 hover:scale-[1.01] disabled:opacity-60"
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
                      setTwoFACode('');
                      setTwoFAError(null);
                    }}
                    className="text-sm font-semibold text-brand-accent transition-colors hover:text-brand-text"
                  >
                    {isRecoveryMode
                      ? 'Use authenticator code instead'
                      : 'Use recovery code'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[10px] font-semibold uppercase tracking-[0.25em] text-brand-text/30">
          &copy; 2026 VChat
        </p>
      </motion.div>
    </div>
  );
}


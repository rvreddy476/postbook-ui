'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { getSession, getOAuthUrl, loginUser, verify2FA } from '@/services/authService';
import OAuthButtons from '@/components/auth/OAuthButtons';

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
  const router = useRouter();
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
      router.replace('/');
    }
  }, [router]);

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

    if (result.requires2FA) {
      setPendingToken(result.pendingToken || '');
      setUserId(result.userId || '');
      setDirection(1);
      setScreen('2fa');
      setIsLoading(false);
      return;
    }

    router.push('/');
  };

  const handleVerify2FA = useCallback(
    async (code: string) => {
      if (isVerifying) return;
      setTwoFAError(null);
      setIsVerifying(true);

      const result = await verify2FA(userId, code, pendingToken);

      if (result.success) {
        router.push('/');
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
    <div className="flex min-h-screen items-center justify-center bg-[#FAF5F0] px-4 py-8 selection:bg-[#D4A574]/20 selection:text-[#3C2415]">
      <div className="w-full max-w-md">
        <div className="relative overflow-hidden rounded-[2rem] border border-[#F0E6DC] bg-white p-7 shadow-[0_20px_50px_rgba(60,36,21,0.08)] sm:p-8">
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
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D4A574] shadow-lg shadow-[#D4A574]/20">
                    <span className="text-lg font-black tracking-tighter text-white">PB</span>
                  </div>
                  <div>
                    <h1 className="text-2xl font-black tracking-tight text-[#3C2415]">
                      PostBoek.com
                    </h1>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4A574]">
                      Welcome Back
                    </p>
                  </div>
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
                <form className="space-y-3" onSubmit={handleSubmit}>
                  <div className="space-y-1.5">
                    <label
                      className="text-xs font-semibold text-[#7B5B3A]"
                      htmlFor="loginId"
                    >
                      Mail or phone number for login
                    </label>
                    <input
                      id="loginId"
                      type="text"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      placeholder="you@example.com or 9876543210"
                      className="w-full rounded-xl border border-[#F0E6DC] bg-white px-4 py-2.5 text-sm font-medium text-[#3C2415] outline-none transition-all placeholder:text-[#D4A574]/40 focus:ring-4 focus:ring-[#D4A574]/10 focus:border-[#D4A574]"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        className="text-xs font-semibold text-[#7B5B3A]"
                        htmlFor="password"
                      >
                        Password
                      </label>
                      <Link
                        href="/auth/forgot-password"
                        className="text-xs font-semibold text-[#D4A574] transition-colors hover:text-[#3C2415]"
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
                        className="w-full rounded-xl border border-[#F0E6DC] bg-white px-4 py-2.5 pr-11 text-sm font-medium text-[#3C2415] outline-none transition-all placeholder:text-[#D4A574]/40 focus:ring-4 focus:ring-[#D4A574]/10 focus:border-[#D4A574]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B5B3A] transition-colors hover:text-[#3C2415]"
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
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4A574] py-3 text-sm font-bold text-white transition-all hover:bg-[#c4955f] hover:scale-[1.01] disabled:opacity-60"
                  >
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isLoading ? 'Logging in...' : 'Login'}
                  </button>
                </form>

                {/* OAuth Buttons */}
                <OAuthButtons label="or continue with" />

                {/* Register link */}
                <div className="mt-5 text-center text-sm text-[#7B5B3A]">
                  <span>Don&apos;t have account? </span>
                  <Link
                    href="/register"
                    className="font-bold text-[#D4A574] hover:text-[#3C2415]"
                  >
                    Create One
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
                      <h2 className="text-xl font-black tracking-tight text-[#3C2415]">
                        Two-Factor Auth
                      </h2>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4A574]">
                        Verification Required
                      </p>
                    </div>
                  </div>
                </div>

                <p className="mb-5 text-sm font-medium text-[#7B5B3A]">
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
                      className="text-xs font-semibold text-[#7B5B3A]"
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
                      className="w-full rounded-xl border border-[#F0E6DC] bg-white px-4 py-3 text-center text-lg font-bold tracking-[0.3em] text-[#3C2415] outline-none transition-all placeholder:tracking-[0.3em] placeholder:text-[#D4A574]/40 focus:ring-4 focus:ring-[#D4A574]/10 focus:border-[#D4A574]"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifying || (!isRecoveryMode && twoFACode.length < 6)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4A574] py-3 text-sm font-bold text-white transition-all hover:bg-[#c4955f] hover:scale-[1.01] disabled:opacity-60"
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
                    className="text-sm font-semibold text-[#D4A574] transition-colors hover:text-[#3C2415]"
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
      </div>
    </div>
  );
}

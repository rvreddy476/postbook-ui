'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { getSession, getOAuthUrl, loginUser, verify2FA } from '@/services/authService';

type Screen = 'login' | '2fa';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

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

  const handleOAuth = (provider: string) => {
    window.location.href = getOAuthUrl(provider);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fcfaff] px-4 py-8 selection:bg-rose-100 selection:text-rose-900">
      <div className="w-full max-w-md">
        <div className="glass-panel relative overflow-hidden rounded-[2rem] border border-white/90 p-7 shadow-[0_20px_50px_rgba(124,58,237,0.12)] sm:p-8">
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
                  <div className="orchid-gradient flex h-11 w-11 items-center justify-center rounded-xl shadow-lg shadow-violet-500/20">
                    <span className="text-lg font-black tracking-tighter text-white">PB</span>
                  </div>
                  <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-950">
                      PostBoek.com
                    </h1>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-500">
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
                      className="text-xs font-semibold text-slate-600"
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
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:ring-4 focus:ring-violet-500/10"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        className="text-xs font-semibold text-slate-600"
                        htmlFor="password"
                      >
                        Password
                      </label>
                      <Link
                        href="/forgot-password"
                        className="text-xs font-semibold text-violet-600 transition-colors hover:text-rose-500"
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
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-11 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:ring-4 focus:ring-violet-500/10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
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
                    className="orchid-gradient mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all hover:scale-[1.01] disabled:opacity-60"
                  >
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isLoading ? 'Logging in...' : 'Login'}
                  </button>
                </form>

                {/* Divider */}
                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs font-semibold text-slate-400">or continue with</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                {/* OAuth Buttons */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleOAuth('google')}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 hover:shadow-sm"
                  >
                    <GoogleIcon />
                    Google
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOAuth('github')}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-sm"
                  >
                    <GitHubIcon />
                    GitHub
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOAuth('apple')}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-black/90 hover:shadow-sm"
                  >
                    <AppleIcon />
                    Apple
                  </button>
                </div>

                {/* Register link */}
                <div className="mt-5 text-center text-sm text-slate-600">
                  <span>Don&apos;t have account? </span>
                  <Link
                    href="/register"
                    className="font-bold text-violet-700 hover:text-rose-600"
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
                    className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-violet-600"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to login
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100">
                      <ShieldCheck className="h-6 w-6 text-violet-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-slate-950">
                        Two-Factor Auth
                      </h2>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-500">
                        Verification Required
                      </p>
                    </div>
                  </div>
                </div>

                <p className="mb-5 text-sm font-medium text-slate-600">
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
                      className="text-xs font-semibold text-slate-600"
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
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-lg font-bold tracking-[0.3em] text-slate-900 outline-none transition-all placeholder:tracking-[0.3em] placeholder:text-slate-300 focus:ring-4 focus:ring-violet-500/10"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifying || (!isRecoveryMode && twoFACode.length < 6)}
                    className="orchid-gradient flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all hover:scale-[1.01] disabled:opacity-60"
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
                    className="text-sm font-semibold text-violet-600 transition-colors hover:text-rose-500"
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

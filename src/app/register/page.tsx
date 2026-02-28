'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { getSession, getOAuthUrl, registerUser } from '@/services/authService';

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Others'>('Male');
  const [dob, setDob] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (getSession()) {
      router.replace('/');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const result = await registerUser({
      firstName,
      lastName,
      gender,
      dob,
      loginId,
      password,
    });
    if (result.success) {
      router.push('/');
      return;
    }

    setError(result.error || 'Registration failed.');
    setIsLoading(false);
  };

  const handleOAuth = (provider: string) => {
    window.location.href = getOAuthUrl(provider);
  };

  return (
    <div className="flex h-screen items-center justify-center overflow-hidden bg-[#fcfaff] px-4 py-3 selection:bg-rose-100 selection:text-rose-900">
      <div className="w-full max-w-md">
        <div className="glass-panel rounded-[1.5rem] border border-white/90 p-5 shadow-[0_20px_50px_rgba(124,58,237,0.12)] sm:p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="orchid-gradient flex h-9 w-9 items-center justify-center rounded-lg shadow-lg shadow-violet-500/20">
              <span className="text-sm font-black tracking-tighter text-white">PB</span>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-950">Create Account</h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-rose-500">Registration</p>
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
                <label className="mb-1 block text-[11px] font-semibold text-slate-600" htmlFor="firstName">
                  FirstName
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition-all focus:ring-4 focus:ring-violet-500/10"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600" htmlFor="lastName">
                  LastName
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition-all focus:ring-4 focus:ring-violet-500/10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600">Gender</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Male', 'Female', 'Others'] as const).map((value) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-xs font-semibold transition-all ${
                      gender === value
                        ? 'border-violet-500 bg-violet-50 text-violet-700'
                        : 'border-slate-200 bg-white text-slate-600'
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
              <label className="mb-1 block text-[11px] font-semibold text-slate-600" htmlFor="dob">
                DOB
              </label>
              <input
                id="dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition-all focus:ring-4 focus:ring-violet-500/10"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600" htmlFor="loginId">
                Mail or phone number for login
              </label>
              <input
                id="loginId"
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="you@example.com or 9876543210"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:ring-4 focus:ring-violet-500/10"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:ring-4 focus:ring-violet-500/10"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="orchid-gradient mt-1 w-full rounded-lg py-2.5 text-sm font-bold text-white transition-all hover:scale-[1.01] disabled:opacity-60"
            >
              {isLoading ? 'Creating...' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-semibold text-slate-400">or sign up with</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* OAuth Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 hover:shadow-sm"
            >
              <GoogleIcon />
              Google
            </button>
            <button
              type="button"
              onClick={() => handleOAuth('github')}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-sm"
            >
              <GitHubIcon />
              GitHub
            </button>
            <button
              type="button"
              onClick={() => handleOAuth('apple')}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-black/90 hover:shadow-sm"
            >
              <AppleIcon />
              Apple
            </button>
          </div>

          <div className="mt-3 text-center text-xs text-slate-600">
            <span>Already have account? </span>
            <Link href="/login" className="font-bold text-violet-700 hover:text-rose-600">
              Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

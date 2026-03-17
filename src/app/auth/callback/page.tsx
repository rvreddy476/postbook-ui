'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { AuthSessionStore } from '@/services/auth/AuthSessionStore';
import { mapAuthResponse } from '@/services/auth/responseMapper';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const completeOAuth = async () => {
      try {
        const response = await api.get('/v1/auth/me');
        const payload = response.data;

        const authResult = mapAuthResponse(payload, '');
        const sessionStore = new AuthSessionStore();
        sessionStore.save(authResult);

        router.replace('/');
      } catch (err) {
        console.error('[Auth] OAuth callback failed:', err);
        setError('Sign in could not be completed. Please try again.');
        setTimeout(() => {
          router.replace('/login?error=oauth_failed');
        }, 2000);
      }
    };

    completeOAuth();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg px-4 selection:bg-rose-100 selection:text-rose-900">
      <div className="glass-panel rounded-[2rem] border border-white/90 p-8 shadow-[0_20px_50px_rgba(124,58,237,0.12)]">
        <div className="flex flex-col items-center gap-4">
          {error ? (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100">
                <svg
                  className="h-6 w-6 text-rose-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-rose-700">{error}</p>
                <p className="mt-1 text-xs text-brand-highlight">Redirecting to login...</p>
              </div>
            </>
          ) : (
            <>
              <div className="orchid-gradient flex h-12 w-12 items-center justify-center rounded-xl shadow-lg shadow-[#D8103F]/20">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-brand-text">Completing sign in...</p>
                <p className="mt-1 text-xs text-brand-highlight">Please wait a moment</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

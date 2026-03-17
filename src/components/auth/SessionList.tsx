'use client';

import { useMemo } from 'react';
import { Laptop, Smartphone, Monitor, Globe, Loader2, LogOut } from 'lucide-react';
import type { Session } from '@/hooks/useSecurity';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseUserAgent(ua: string): string {
  if (!ua) return 'Unknown device';

  let browser = 'Unknown browser';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('OPR/') || ua.includes('Opera')) browser = 'Opera';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox/')) browser = 'Firefox';

  let os = 'Unknown OS';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return `${browser} on ${os}`;
}

function getPlatformIcon(platform: string) {
  const p = platform.toLowerCase();
  if (p.includes('mobile') || p.includes('android') || p.includes('ios')) {
    return <Smartphone className="h-5 w-5 text-[#D4A574]" />;
  }
  if (p.includes('desktop') || p.includes('windows') || p.includes('mac') || p.includes('linux')) {
    return <Monitor className="h-5 w-5 text-[#D4A574]" />;
  }
  if (p.includes('web')) {
    return <Globe className="h-5 w-5 text-[#D4A574]" />;
  }
  return <Laptop className="h-5 w-5 text-[#D4A574]" />;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/* ------------------------------------------------------------------ */
/*  Session Item                                                       */
/* ------------------------------------------------------------------ */

function SessionItem({
  session,
  isCurrent,
  onRevoke,
  isRevoking,
}: {
  session: Session;
  isCurrent: boolean;
  onRevoke: (id: string) => void;
  isRevoking: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[#F0E6DC] bg-brand-card px-4 py-3 transition-colors hover:bg-[#FAF5F0]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FAF5F0]">
        {getPlatformIcon(session.platform)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-[#3C2415]">
            {parseUserAgent(session.user_agent)}
          </p>
          {isCurrent && (
            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              Current
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-[#7B5B3A]">
          <span>{session.ip}</span>
          <span className="text-[#F0E6DC]">|</span>
          <span>{formatDate(session.created_at)}</span>
        </div>
      </div>
      {!isCurrent && (
        <button
          type="button"
          onClick={() => onRevoke(session.id)}
          disabled={isRevoking}
          className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
        >
          {isRevoking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Revoke'}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function SessionSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[#F0E6DC] bg-brand-card px-4 py-3">
      <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[#F0E6DC]" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-48 animate-pulse rounded bg-[#F0E6DC]" />
        <div className="h-3 w-32 animate-pulse rounded bg-[#F0E6DC]" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

interface SessionListProps {
  sessions: Session[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRevoke: (sessionId: string) => void;
  revokingId: string | null;
  onLogoutAll: () => void;
  isLoggingOutAll: boolean;
}

export default function SessionList({
  sessions,
  isLoading,
  error,
  onRevoke,
  revokingId,
  onLogoutAll,
  isLoggingOutAll,
}: SessionListProps) {
  const currentSessionId = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;
    const sorted = [...sessions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return sorted[0].id;
  }, [sessions]);

  const otherSessions = useMemo(
    () => (sessions ?? []).filter((s) => s.id !== currentSessionId),
    [sessions, currentSessionId]
  );

  return (
    <div className="space-y-3">
      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-2">
          <SessionSkeleton />
          <SessionSkeleton />
          <SessionSkeleton />
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          Failed to load sessions. Please try again later.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && sessions && sessions.length === 0 && (
        <div className="py-8 text-center">
          <Laptop className="mx-auto h-10 w-10 text-[#F0E6DC]" />
          <p className="mt-2 text-sm font-medium text-[#7B5B3A]">No active sessions found.</p>
        </div>
      )}

      {/* Session list */}
      {!isLoading && sessions && sessions.length > 0 && (
        <div className="space-y-2">
          {/* Current session first */}
          {sessions
            .filter((s) => s.id === currentSessionId)
            .map((s) => (
              <SessionItem
                key={s.id}
                session={s}
                isCurrent={true}
                onRevoke={onRevoke}
                isRevoking={revokingId === s.id}
              />
            ))}
          {/* Other sessions */}
          {otherSessions.map((s) => (
            <SessionItem
              key={s.id}
              session={s}
              isCurrent={false}
              onRevoke={onRevoke}
              isRevoking={revokingId === s.id}
            />
          ))}
        </div>
      )}

      {/* Logout all button */}
      {!isLoading && otherSessions.length > 0 && (
        <div className="border-t border-[#F0E6DC] pt-4">
          <button
            type="button"
            onClick={onLogoutAll}
            disabled={isLoggingOutAll}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-brand-card py-2.5 text-sm font-semibold text-rose-600 transition-all hover:bg-rose-50 disabled:opacity-50"
          >
            {isLoggingOutAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Revoke All Other Sessions
          </button>
        </div>
      )}
    </div>
  );
}

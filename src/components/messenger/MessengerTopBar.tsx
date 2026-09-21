'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Search, Settings, SquarePen } from 'lucide-react';

import Avatar from '@/components/ui/Avatar';
import { useMyProfile } from '@/hooks/useEditProfile';

interface MessengerTopBarProps {
  onCompose: () => void;
  unread?: number;
}

/**
 * The messenger's own top bar.
 *
 * The messenger is a full-screen page outside the app shell, so it had no
 * header at all: no way home, no global search, and no compose.
 *
 * Every control here goes somewhere real. The mockup's "@" mentions icon is
 * deliberately absent — there is no mentions view to open, and an icon that
 * leads nowhere is worse than one that is missing.
 *
 * This search is the GLOBAL one: it hands the query to /search, which
 * covers people, posts and the rest. The left column has its own field that
 * filters the conversation list. Two fields, two different jobs — the point
 * of the earlier "2 Searches" complaint was repetition, not the count.
 */
export default function MessengerTopBar({ onCompose, unread = 0 }: MessengerTopBarProps) {
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const [query, setQuery] = useState('');

  const runSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-brand-divider bg-brand-bg px-4">
      {/* Home */}
      <Link href="/" className="flex shrink-0 items-center gap-2" title="Home">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-ink">
          <span className="text-xs font-bold -tracking-[0.02em] text-white">VC</span>
        </span>
        <span className="hidden text-base font-semibold -tracking-[0.014em] text-brand-text sm:block">
          VChat
        </span>
      </Link>

      {/* Global search. Enter hands the query to /search. */}
      <form role="search" onSubmit={runSearch} className="relative w-full max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search everything"
          placeholder="Jump to workspace, chat, or files..."
          className="w-full rounded-xl border border-transparent bg-brand-secondary py-2.5 pl-10 pr-4 text-sm text-brand-text outline-hidden transition-colors placeholder:text-brand-text/40 focus:border-primary-outline focus:bg-brand-bg"
        />
      </form>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <button
          onClick={() => router.push('/notifications')}
          aria-label="Notifications"
          title="Notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-brand-text/70 transition-colors duration-200 hover:bg-brand-secondary hover:text-brand-text active:scale-95"
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-primary-ink px-1 text-[10px] font-semibold tabular-nums text-white ring-2 ring-brand-bg">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>

        <button
          onClick={() => router.push('/settings')}
          aria-label="Settings"
          title="Settings"
          className="flex h-10 w-10 items-center justify-center rounded-full text-brand-text/70 transition-colors duration-200 hover:bg-brand-secondary hover:text-brand-text active:scale-95"
        >
          <Settings className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>

        <button
          onClick={onCompose}
          className="ml-1 flex items-center gap-1.5 rounded-full bg-primary-ink px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-hover active:scale-95"
        >
          <SquarePen className="h-4 w-4" strokeWidth={1.75} />
          <span className="hidden sm:inline">Compose</span>
        </button>

        <Link href="/profile" className="ml-1" title="Your profile">
          <Avatar
            src={profile?.avatar_media_id ? `/v1/media/${profile.avatar_media_id}/serve` : undefined}
            name={profile?.display_name || 'You'}
            className="h-9 w-9 ring-2 ring-primary-outline"
          />
        </Link>
      </div>
    </header>
  );
}

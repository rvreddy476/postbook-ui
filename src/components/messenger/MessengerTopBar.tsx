'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Search, Settings, SquarePen } from 'lucide-react';

import Avatar from '@/components/ui/Avatar';
import { useMyProfile } from '@/hooks/useEditProfile';

interface MessengerTopBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onCompose: () => void;
  unread?: number;
}

/**
 * The messenger's own top bar.
 *
 * The messenger is a full-screen page outside the app shell, so it had no
 * header at all: no way home, no search above the columns, and no compose.
 *
 * Every control here goes somewhere real. The mockup's "@" mentions icon is
 * deliberately absent — there is no mentions view to open, and an icon that
 * leads nowhere is worse than one that is missing.
 *
 * There is ONE search, not two. The mockup shows a global search here and a
 * conversation search in the left column; this is the conversation search,
 * moved up. Two fields on one screen is the complaint the founder already
 * made about the feed header.
 */
export default function MessengerTopBar({
  search,
  onSearchChange,
  onCompose,
  unread = 0,
}: MessengerTopBarProps) {
  const router = useRouter();
  const { data: profile } = useMyProfile();

  const navItems = [
    { label: 'Channels', href: '/channels', active: false },
    { label: 'Direct', href: '/messenger', active: true },
    { label: 'Spaces', href: '/groups', active: false },
  ];

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

      {/* The one search on this page: it filters the list beside it. */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text/40" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search conversations"
          className="w-full rounded-full border border-transparent bg-brand-secondary py-2 pl-9 pr-4 text-sm text-brand-text outline-hidden transition-colors placeholder:text-brand-text/40 focus:border-primary-outline focus:bg-brand-bg"
        />
      </div>

      {/* Where else you can go. Links, not tabs: each one leaves this page. */}
      <nav className="mx-auto hidden items-center gap-0.5 rounded-full bg-brand-text/[0.06] p-1 lg:flex">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-current={item.active ? 'page' : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              item.active
                ? 'bg-brand-bg text-brand-text shadow-xs'
                : 'text-brand-text/55 hover:text-brand-text/80'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

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

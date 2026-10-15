'use client';

import Link from 'next/link';
import { Clapperboard, FileText, PlayCircle } from 'lucide-react';

import type { PostCardView } from './postCards';

/*
  A shared post inside a chat bubble (audit T-25). The view is decided by
  postCardView (postCards.ts) from the thread's one batch read; this only
  draws it. Unavailable is a neutral line, never a hint of what it was.
*/
export function PostMessageCard({ view, onRetry }: { view: PostCardView; onRetry?: () => void }) {
  if (view.state === 'loading') {
    return (
      <div className="w-60 max-w-full overflow-hidden rounded-xl border border-brand-divider bg-brand-card" aria-busy="true" aria-label="Loading post">
        <div className="aspect-video animate-pulse bg-brand-secondary" />
        <div className="space-y-1.5 p-2.5">
          <div className="h-3 w-3/4 animate-pulse rounded bg-brand-secondary" />
          <div className="h-2.5 w-1/3 animate-pulse rounded bg-brand-secondary" />
        </div>
      </div>
    );
  }

  if (view.state === 'unavailable' || view.state === 'error') {
    return (
      <div className="w-60 max-w-full rounded-xl border border-dashed border-brand-divider bg-brand-card px-3 py-3 text-[13px] text-brand-text/60">
        <p>{view.state === 'unavailable' ? view.text : "Couldn't load this post."}</p>
        {view.state === 'error' && onRetry ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRetry(); }}
            className="mt-1 text-[12px] font-semibold text-primary-ink hover:underline"
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  const KindIcon = view.kindLabel === 'Reel' ? Clapperboard : view.kindLabel === 'Video' ? PlayCircle : FileText;
  return (
    <Link
      href={view.href}
      className="block w-60 max-w-full overflow-hidden rounded-xl border border-brand-divider bg-brand-card text-brand-text no-underline transition-colors hover:bg-brand-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
      aria-label={`${view.kindLabel}: ${view.title}${view.authorName ? `, by ${view.authorName}` : ''}`}
    >
      {view.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={view.posterUrl} alt="" loading="lazy" decoding="async" className="aspect-video w-full bg-brand-secondary object-cover" />
      ) : null}
      <span className="block p-2.5">
        <span className="line-clamp-2 block text-[13px] font-semibold leading-snug">{view.title}</span>
        <span className="mt-1 flex items-center gap-1 text-[11px] text-brand-text/60">
          <KindIcon className="h-3 w-3" aria-hidden />
          {view.kindLabel}
          {view.authorName ? <span className="truncate">· {view.authorName}</span> : null}
        </span>
      </span>
    </Link>
  );
}

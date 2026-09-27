import Link from "next/link";
import { Loader2, RefreshCw, SearchX } from "lucide-react";
import type { ReactNode } from "react";

/*
  The three states every discovery screen can be in, drawn the same way
  everywhere: a quiet loading line or a skeleton grid, an empty card with
  one suggested next step, and an error card with Retry.
*/

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="disco-state is-loading" role="status" aria-live="polite">
      <Loader2 className="disco-spin" size={18} strokeWidth={1.75} aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function TileSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="disco-grid" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="disco-skeleton">
          <div className="disco-skeleton__thumb" />
          <div className="disco-skeleton__line" />
          <div className="disco-skeleton__line is-short" />
        </div>
      ))}
    </div>
  );
}

export function RowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="disco-rows" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="disco-skeleton is-row">
          <div className="disco-skeleton__thumb" />
          <div className="disco-skeleton__body">
            <div className="disco-skeleton__line" />
            <div className="disco-skeleton__line is-short" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  actionHref,
  actionLabel,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="disco-state">
      <span className="disco-state__icon" aria-hidden>
        {icon ?? <SearchX size={20} strokeWidth={1.75} />}
      </span>
      <p className="disco-state__title">{title}</p>
      {body ? <p className="disco-state__body">{body}</p> : null}
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="disco-state__action">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function ErrorState({ onRetry, what = "this page" }: { onRetry?: () => void; what?: string }) {
  return (
    <div className="disco-state" role="alert">
      <span className="disco-state__icon" aria-hidden>
        <RefreshCw size={20} strokeWidth={1.75} />
      </span>
      <p className="disco-state__title">Could not load {what}</p>
      <p className="disco-state__body">Check your connection and try again.</p>
      {onRetry ? (
        <button type="button" className="disco-state__action" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function LoadMore({ hasMore, loading, onLoadMore }: { hasMore: boolean; loading: boolean; onLoadMore: () => void }) {
  if (!hasMore) return null;
  return (
    <div className="disco-more">
      <button type="button" className="disco-more__button" onClick={onLoadMore} disabled={loading}>
        {loading ? <Loader2 className="disco-spin" size={14} aria-hidden /> : null}
        {loading ? "Loading…" : "Show more"}
      </button>
    </div>
  );
}

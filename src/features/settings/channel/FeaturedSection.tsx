import { Check, Loader2, Search, Star, X } from "lucide-react";

import { formatDuration, timeAgo } from "@/features/posttube/model";

import { Card, inputClass, pillButtonClass } from "./ui";
import type { FeaturedProps, VideoRow } from "./view";

function views(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0 views";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K views`;
  return `${n} ${n === 1 ? "view" : "views"}`;
}

function Thumb({ v }: { v: VideoRow }) {
  const dur = formatDuration(v.duration_seconds);
  return (
    <div className="relative h-[54px] w-[96px] shrink-0 overflow-hidden rounded-lg bg-brand-secondary">
      {v.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : null}
      {dur ? <span className="absolute bottom-1 right-1 rounded bg-brand-deep/90 px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">{dur}</span> : null}
    </div>
  );
}

function Meta({ v }: { v: VideoRow }) {
  return (
    <p className="truncate text-[11px] text-muted-foreground">
      {views(v.view_count)}
      {v.published_at ? ` · ${timeAgo(v.published_at)}` : ""}
    </p>
  );
}

export function FeaturedSection(p: FeaturedProps) {
  const q = p.query.trim().toLowerCase();
  const list = q ? p.videos.filter((v) => v.title.toLowerCase().includes(q)) : p.videos;

  return (
    <Card id="featured" title="Featured" hint="One video pinned at the top of your channel. Pick from your videos.">
      <div className="space-y-3">
        {p.selectedId ? (
          <div className="flex items-center gap-3 rounded-xl border border-brand-accent/40 bg-brand-secondary/40 p-2.5" data-featured-selected>
            {p.selected ? (
              <>
                <Thumb v={p.selected} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-text">
                    <Star className="h-3 w-3" /> Featured
                  </p>
                  <p className="truncate text-[13px] font-medium text-brand-text">{p.selected.title || "Untitled"}</p>
                  <Meta v={p.selected} />
                </div>
              </>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-2 text-[12px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the featured video
              </div>
            )}
            <button type="button" className={pillButtonClass} onClick={() => p.onSelect(null)}>
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-[12px] text-muted-foreground">Nothing featured yet.</p>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input aria-label="Search your videos" value={p.query} onChange={(e) => p.onQuery(e.target.value)} className={`${inputClass} pl-8`} placeholder="Search your videos" />
        </div>

        {p.error ? (
          <p role="alert" className="text-[11px] text-danger">
            {p.error}
          </p>
        ) : null}

        <ul className="max-h-[360px] divide-y divide-border overflow-y-auto rounded-xl border border-border" aria-label="Your videos">
          {list.map((v) => {
            const active = v.id === p.selectedId;
            return (
              <li key={v.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => p.onSelect(active ? null : v.id)}
                  className={`flex w-full items-center gap-3 p-2 text-left transition-colors hover:bg-brand-secondary/60 ${active ? "bg-brand-secondary/60" : ""}`}
                >
                  <Thumb v={v} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-brand-text">{v.title || "Untitled"}</p>
                    <Meta v={v} />
                  </div>
                  <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${active ? "bg-primary-ink text-primary-foreground" : "border border-border text-transparent"}`}>
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </button>
              </li>
            );
          })}
          {!p.loading && list.length === 0 ? <li className="p-4 text-center text-[12px] text-muted-foreground">{q ? "No videos match that." : "You have no long videos yet."}</li> : null}
          {p.loading ? (
            <li className="flex items-center justify-center gap-2 p-4 text-[12px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your videos
            </li>
          ) : null}
        </ul>

        {p.hasMore && !p.loading ? (
          <button type="button" className={pillButtonClass} onClick={p.onMore}>
            Show more
          </button>
        ) : null}
      </div>
    </Card>
  );
}

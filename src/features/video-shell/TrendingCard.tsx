"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import api from "@/lib/api";
import { useBatchProfiles } from "@/hooks/useProfile";
import { trendingHeading, trendingRow, type TrendingKind, type TrendingPost, type TrendingRow } from "./trending";
import "./video-shell.css";

export interface TrendingCardProps {
  kind: TrendingKind;
  limit?: number;
}

interface TrendingResponse {
  data?: { items?: TrendingPost[] | null; next_cursor?: string | null } | null;
}

function useTrending(kind: TrendingKind, limit: number) {
  return useQuery({
    queryKey: ["video-shell", "trending", kind, limit],
    queryFn: async () => {
      const res = await api.get<TrendingResponse>("/v1/posts/trending", { params: { content_type: kind, limit } });
      const items = Array.isArray(res.data?.data?.items) ? res.data.data.items : [];
      return items.filter((p): p is TrendingPost => !!p && typeof p.id === "string").map((p) => trendingRow(p, kind));
    },
    staleTime: 120_000,
    retry: 1,
  });
}

/*
  The right column's "Trending reels" / "Trending videos" card. A ranked
  list with a poster, the title, who posted it and the numbers. Authors are
  filled from the profile batch endpoint when the row does not carry them.
  On error it renders nothing: a column that says "could not load" is
  worse than a column that is simply shorter.
*/
export function TrendingCard({ kind, limit = 8 }: TrendingCardProps) {
  const trending = useTrending(kind, limit);
  const rows = useMemo(() => trending.data ?? [], [trending.data]);
  const missingAuthorIds = useMemo(
    () => Array.from(new Set(rows.filter((r) => !r.authorName && r.authorId).map((r) => r.authorId))),
    [rows],
  );
  const profiles = useBatchProfiles(missingAuthorIds);

  if (trending.isError) return <></>;

  const heading = trendingHeading(kind);

  return (
    <section className="trending-card" aria-labelledby={`trending-${kind}`}>
      <header className="trending-card__head">
        <span className="trending-card__flame"><Flame size={16} strokeWidth={2} aria-hidden /></span>
        <h2 id={`trending-${kind}`} className="trending-card__title">{heading}</h2>
      </header>

      {trending.isPending ? (
        <ol className="trending-card__list" aria-busy="true" aria-label="Loading">
          {Array.from({ length: Math.min(limit, 5) }).map((_, i) => (
            <li key={i} className="trending-card__row is-skeleton" aria-hidden>
              <span className="trending-card__rank" />
              <span className="trending-card__poster" />
              <span className="trending-card__meta">
                <span className="trending-card__bone" style={{ width: "82%" }} />
                <span className="trending-card__bone" style={{ width: "46%" }} />
              </span>
            </li>
          ))}
        </ol>
      ) : rows.length === 0 ? (
        <p className="trending-card__empty">Nothing trending yet</p>
      ) : (
        <ol className="trending-card__list">
          {rows.map((row, index) => (
            <TrendingRowView key={row.id} row={row} rank={index + 1} authorName={row.authorName ?? profiles.data?.get(row.authorId)?.display_name ?? profiles.data?.get(row.authorId)?.username ?? null} />
          ))}
        </ol>
      )}
    </section>
  );
}

function TrendingRowView({ row, rank, authorName }: { row: TrendingRow; rank: number; authorName: string | null }) {
  return (
    <li className="trending-card__row">
      <Link href={row.href} className="trending-card__link">
        <span className="trending-card__rank" aria-hidden>{rank}</span>
        <span className="trending-card__poster">
          {row.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.posterUrl} alt="" loading="lazy" decoding="async" />
          ) : null}
        </span>
        <span className="trending-card__meta">
          <span className="trending-card__row-title">{row.title}</span>
          {authorName ? <span className="trending-card__author">{authorName}</span> : null}
          <span className="trending-card__stats">{row.stats}</span>
        </span>
      </Link>
    </li>
  );
}

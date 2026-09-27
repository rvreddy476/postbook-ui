"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Clapperboard, Heart, RefreshCw, Search, SearchX } from "lucide-react";

import { VideoShell } from "@/features/video-shell";
import { useReelSearch } from "@/features/reels/hooks/useReelSearch";
import { formatCount } from "@/features/reels/model";
import { REEL_SEARCH_LIMIT, reelSearchHref } from "@/features/reels/search";
import "./reels-screen.css";

/*
  /reels/search?q=… — reels only. The query comes from the URL (the stage's
  gap search sends viewers here); the box at the top refines it. Results
  are the same 3:5 poster grid as the liked page, each tile opening the
  stage pinned on that reel. Same frame as the stage: sidebar chrome, no
  header, no aside.
*/
export function ReelSearchScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get("q") ?? "";
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);

  const search = useReelSearch(query);
  const items = search.data ?? [];

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const href = reelSearchHref(draft);
    if (href) router.push(href);
  };

  return (
    <VideoShell app="reels" chrome="sidebar" immersive>
      <div className="liked-reels__scroll">
        <section className="liked-reels" aria-labelledby="reel-search-title">
          <header className="liked-reels__head">
            <div>
              <h1 id="reel-search-title" className="liked-reels__title">{query ? `Reels for “${query}”` : "Search reels"}</h1>
              {query && search.isSuccess ? (
                <p className="liked-reels__count">{items.length === 0 ? "No reels match" : `${items.length}${items.length >= REEL_SEARCH_LIMIT ? "+" : ""} reel${items.length === 1 ? "" : "s"}`}</p>
              ) : null}
            </div>
            <form role="search" className="reel-search-form" onSubmit={onSubmit}>
              <Search size={16} aria-hidden />
              <input
                type="search"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Search reels"
                aria-label="Search reels"
                enterKeyHint="search"
                autoFocus={!query}
              />
            </form>
          </header>

          {!query ? (
            <div className="liked-reels__empty">
              <Search size={28} className="opacity-60" />
              <h2>Search reels</h2>
              <p>Type what you are looking for and press Enter. Only reels are searched.</p>
            </div>
          ) : search.isPending ? (
            <ul className="liked-reels__grid" aria-busy="true" aria-label="Searching">
              {Array.from({ length: 12 }).map((_, i) => (
                <li key={i} className="liked-reels__tile is-skeleton" aria-hidden />
              ))}
            </ul>
          ) : search.isError ? (
            <div className="liked-reels__empty" role="alert">
              <h2>Couldn't search right now</h2>
              <p>Check your connection and try again.</p>
              <button type="button" onClick={() => void search.refetch()} className="liked-reels__cta">
                <RefreshCw size={15} /> Retry
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="liked-reels__empty">
              <SearchX size={28} className="opacity-60" />
              <h2>No reels match “{query}”</h2>
              <p>Try another word, a hashtag or a creator's name.</p>
              <Link href="/reels" className="liked-reels__cta">
                <Clapperboard size={15} /> Back to reels
              </Link>
            </div>
          ) : (
            <ul className="liked-reels__grid">
              {items.map((reel) => (
                <li key={reel.id}>
                  <Link
                    href={`/reels?reelId=${encodeURIComponent(reel.id)}`}
                    className="liked-reels__tile"
                    aria-label={`${reel.title || reel.caption || `Reel by ${reel.authorName}`}, ${formatCount(reel.likeCount)} likes`}
                  >
                    {reel.media.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={reel.media.posterUrl} alt="" loading="lazy" decoding="async" />
                    ) : null}
                    <span className="liked-reels__tile-meta" aria-hidden>
                      <Heart size={13} className="fill-current" /> {formatCount(reel.likeCount)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </VideoShell>
  );
}

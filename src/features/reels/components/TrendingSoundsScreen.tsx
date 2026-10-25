"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Clapperboard, LogIn, Music2, RefreshCw } from "lucide-react";

import { VideoShell } from "@/features/video-shell";
import { TrendingSoundsList } from "@/features/reels/components/TrendingSoundsList";
import { useTrendingSounds } from "@/features/reels/hooks/useSounds";
import { readSessionUserId } from "@/features/reels/session";
import { signInHref, soundServeHref, studioHrefForSound } from "@/features/reels/sounds";
import {
  mergeTrendingPages,
  TRENDING_FILTERS,
  trendingEmptyText,
  trendingSoundsHref,
  type TrendingFilter,
  type TrendingSound,
} from "@/features/reels/trendingSounds";
import { nextTabIndex, startPreview, stopPreview } from "@/features/upload/soundPicker";
import "./reels-screen.css";

/*
  /reels/sounds/trending — this week's most-used sounds, ranked, on two
  tabs: All and Rising. Each row: the rank, a cover (the disc when the
  sound has none), the title (to the sound's page), who made it, "42 reels
  this week", a preview and "Use this sound" (the studio with the sound
  chosen). GET /v1/audio/trending is for signed-in viewers, so a signed-out
  one is asked to sign in. One <audio> element plays the previews, only
  from a press, and stops on a tab change and when the page goes away.
*/

export function TrendingSoundsScreen({ initialFilter = "all" }: { initialFilter?: TrendingFilter }) {
  // Signed-in state is read on the client; the server render is neutral.
  const [session, setSession] = useState<"unknown" | "in" | "out">("unknown");
  useEffect(() => {
    setSession(readSessionUserId() ? "in" : "out");
  }, []);

  const [filter, setFilter] = useState<TrendingFilter>(initialFilter);
  const list = useTrendingSounds(filter, { enabled: session === "in" });
  const entries = mergeTrendingPages(list.data?.pages);

  /* previews: one element, nothing until a press */
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(() => new Set());
  const stop = useCallback(() => {
    stopPreview(audioRef.current);
    setPlayingId(null);
  }, []);
  useEffect(() => {
    const audio = audioRef.current;
    return () => stopPreview(audio);
  }, []);
  const markFailed = useCallback((id: string) => {
    setFailedIds((prev) => (prev.has(id) ? prev : new Set([...prev, id])));
    setPlayingId((p) => (p === id ? null : p));
  }, []);
  const togglePreview = useCallback(
    (entry: TrendingSound) => {
      const audio = audioRef.current;
      if (!audio) return;
      const id = entry.sound.id;
      if (playingId === id) {
        stop();
        return;
      }
      setPlayingId(id);
      startPreview(audio, soundServeHref(id)).catch(() => markFailed(id));
    },
    [playingId, stop, markFailed],
  );

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const changeFilter = (next: TrendingFilter, focus = false) => {
    stop();
    setFilter(next);
    // The address follows the tab (shareable), without a server round trip.
    window.history.replaceState(window.history.state, "", trendingSoundsHref(next));
    if (focus) tabRefs.current[TRENDING_FILTERS.findIndex((f) => f.id === next)]?.focus();
  };
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = nextTabIndex(index, e.key, TRENDING_FILTERS.length);
    if (next === null) return;
    e.preventDefault();
    changeFilter(TRENDING_FILTERS[next].id, true);
  };

  // More pages as the end of the list comes into view; the button does the same by hand.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = moreRef.current;
    if (!el || !hasNextPage || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (items) => {
        if (items.some((i) => i.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "320px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, entries.length]);

  const empty = trendingEmptyText(filter);
  const panelId = "trending-sounds-panel";

  return (
    <VideoShell app="reels" chrome="sidebar" immersive>
      <div className="liked-reels__scroll">
        <section className="liked-reels" aria-labelledby="trending-sounds-title">
          <header className="liked-reels__head">
            <div>
              <h1 id="trending-sounds-title" className="liked-reels__title">Trending sounds</h1>
              <p className="trending-sounds__sub">The sounds most used in reels this week.</p>
            </div>
          </header>

          <div role="tablist" aria-label="Trending sounds" className="trending-sounds__tabs">
            {TRENDING_FILTERS.map((f, index) => {
              const selected = f.id === filter;
              return (
                <button
                  key={f.id}
                  ref={(el) => {
                    tabRefs.current[index] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`trending-sounds-tab-${f.id}`}
                  aria-selected={selected}
                  aria-controls={panelId}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => changeFilter(f.id)}
                  onKeyDown={(e) => onTabKey(e, index)}
                  className="trending-sounds__tab"
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div role="tabpanel" id={panelId} aria-labelledby={`trending-sounds-tab-${filter}`}>
            {session === "out" ? (
              <div className="liked-reels__empty">
                <LogIn size={28} className="opacity-60" />
                <h2>Sign in to see trending sounds</h2>
                <p>Find the sounds everyone is using this week, and make a reel with one.</p>
                <Link href={signInHref(trendingSoundsHref(filter))} className="liked-reels__cta">Sign in</Link>
              </div>
            ) : session === "unknown" || list.isPending ? (
              <ol className="trending-sounds__list" aria-busy="true" aria-label="Loading">
                {Array.from({ length: 8 }).map((_, i) => (
                  <li key={i} className="trending-sounds__row is-skeleton" aria-hidden>
                    <span className="trending-sounds__rank" />
                    <span className="trending-sounds__cover" />
                  </li>
                ))}
              </ol>
            ) : list.isError && entries.length === 0 ? (
              <div className="liked-reels__empty" role="alert">
                <h2>Couldn't load trending sounds</h2>
                <p>Check your connection and try again.</p>
                <button type="button" onClick={() => void list.refetch()} className="liked-reels__cta">
                  <RefreshCw size={15} /> Retry
                </button>
              </div>
            ) : entries.length === 0 ? (
              <div className="liked-reels__empty" data-trending-empty={filter}>
                <Music2 size={28} className="opacity-60" />
                <h2>{empty.title}</h2>
                <p>{empty.body}</p>
                <Link href="/reels/create" className="liked-reels__cta">
                  <Clapperboard size={15} /> Make a reel
                </Link>
              </div>
            ) : (
              <>
                <TrendingSoundsList
                  entries={entries}
                  playingId={playingId}
                  failedIds={failedIds}
                  useHref={(id) => studioHrefForSound(id, true)}
                  onTogglePreview={togglePreview}
                />
                {hasNextPage ? (
                  <div ref={moreRef} className="sound-page__more">
                    <button type="button" className="liked-reels__link" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
                      {isFetchingNextPage ? "Loading…" : "Show more"}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
          {/* Muted, preload="none" and no source until a play press: nothing is heard or downloaded on open. */}
          <audio
            ref={audioRef}
            preload="none"
            muted
            hidden
            aria-hidden
            onEnded={stop}
            onError={() => {
              if (playingId) markFailed(playingId);
            }}
          />
        </section>
      </div>
    </VideoShell>
  );
}

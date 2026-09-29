"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clapperboard, Heart, Music2, RefreshCw } from "lucide-react";

import { VideoShell } from "@/features/video-shell";
import { SoundPageHeader } from "@/features/reels/components/SoundPageHeader";
import { useSoundPreview } from "@/features/reels/components/SoundPreview";
import { useSoundReels } from "@/features/reels/hooks/useSounds";
import { formatCount } from "@/features/reels/model";
import { readSessionUserId } from "@/features/reels/session";
import { reelStageHref, soundReelTiles, studioHrefForSound, type SoundReelsPage } from "@/features/reels/sounds";
import "./reels-screen.css";

/*
  /reels/sound/[id] — one sound and the reels that play it, newest first,
  as the liked page's 3:5 poster grid. GET /v1/posts/by-sound/:id answers
  the sound, the reel it was taken from (first page only, marked
  "Original" and shown first) and a page of reels; more load as the end of
  the grid comes into view. A sound that is missing, or that this viewer
  may not hear, is a 404 and reads as not available. Same frame as the
  stage: the sidebar chrome, no header, no aside.
*/
export function SoundReelsScreen({ soundId }: { soundId: string }) {
  // Signed-in state is read on the client; the server render is neutral.
  const [session, setSession] = useState<"unknown" | "in" | "out">("unknown");
  useEffect(() => {
    setSession(readSessionUserId() ? "in" : "out");
  }, []);

  const reels = useSoundReels(soundId);
  const pages = (reels.data?.pages ?? []).filter((p): p is SoundReelsPage => p !== null);
  const missing = reels.isSuccess && pages.length === 0;
  const sound = pages[0]?.sound ?? null;
  const origin = pages[0]?.origin ?? null;
  const tiles = soundReelTiles(pages);
  const uses = tiles.filter((t) => !t.isOrigin).length;
  const preview = useSoundPreview(sound?.id ?? null);

  // More pages as the end of the grid comes into view; the button does the same by hand.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = reels;
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = moreRef.current;
    if (!el || !hasNextPage || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "320px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, tiles.length]);

  return (
    <VideoShell app="reels" chrome="sidebar" immersive>
      <div className="liked-reels__scroll">
        <section className="liked-reels" aria-labelledby="sound-page-title">
          <SoundPageHeader
            sound={sound}
            loading={reels.isPending}
            reelCount={Math.max(sound?.useCount ?? 0, uses)}
            creatorHref={origin ? `/u/${origin.authorUsername || origin.authorId}` : null}
            preview={preview.state}
            onTogglePreview={preview.toggle}
            useHref={studioHrefForSound(soundId, session !== "out")}
          />
          {preview.element}

          {reels.isPending ? (
            <ul className="liked-reels__grid" aria-busy="true" aria-label="Loading">
              {Array.from({ length: 12 }).map((_, i) => (
                <li key={i} className="liked-reels__tile is-skeleton" aria-hidden />
              ))}
            </ul>
          ) : reels.isError && pages.length === 0 ? (
            <div className="liked-reels__empty" role="alert">
              <h2>Couldn't load this sound</h2>
              <p>Check your connection and try again.</p>
              <button type="button" onClick={() => void reels.refetch()} className="liked-reels__cta">
                <RefreshCw size={15} /> Retry
              </button>
            </div>
          ) : missing || !sound ? (
            <div className="liked-reels__empty">
              <Music2 size={28} className="opacity-60" />
              <h2>This sound isn't available</h2>
              <p>It may have been removed, or the reel it came from is no longer public.</p>
              <Link href="/reels" className="liked-reels__cta">
                <Clapperboard size={15} /> Watch reels
              </Link>
            </div>
          ) : tiles.length === 0 ? (
            <div className="liked-reels__empty">
              <Music2 size={28} className="opacity-60" />
              <h2>No reels use this sound yet</h2>
              <p>Be the first to make one with it.</p>
            </div>
          ) : (
            <>
              <ul className="liked-reels__grid">
                {tiles.map(({ reel, isOrigin }) => (
                  <li key={reel.id}>
                    <Link
                      href={reelStageHref(reel.id)}
                      className="liked-reels__tile"
                      data-origin={isOrigin ? "" : undefined}
                      aria-label={`${isOrigin ? "Original: " : ""}${reel.title || `Reel by ${reel.authorName}`}, ${formatCount(reel.likeCount)} likes`}
                    >
                      {reel.media.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={reel.media.posterUrl} alt="" loading="lazy" decoding="async" />
                      ) : null}
                      {isOrigin ? <span className="sound-page__badge">Original</span> : null}
                      <span className="liked-reels__tile-meta" aria-hidden>
                        <Heart size={13} className="fill-current" /> {formatCount(reel.likeCount)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {hasNextPage ? (
                <div ref={moreRef} className="sound-page__more">
                  <button type="button" className="liked-reels__link" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
                    {isFetchingNextPage ? "Loading…" : "Show more"}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </VideoShell>
  );
}

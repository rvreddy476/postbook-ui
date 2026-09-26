"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, Clapperboard, Heart, LogIn, RefreshCw } from "lucide-react";

import { TrendingCard, VideoShell } from "@/features/video-shell";
import { useLikedReels } from "@/features/reels/hooks/useLikedReels";
import { formatCount } from "@/features/reels/model";
import { readSessionUserId } from "@/features/reels/session";
import "./reels-screen.css";

const LIMIT = 60;

/*
  /reels/liked — the reels the viewer liked, newest first, as a 3:5 poster
  grid. Ids come from GET /v1/reels/liked (no cursor; post-service returns
  up to `limit`), rows from POST /v1/posts/batch. Each tile opens the stage
  pinned on that reel.
*/
export function LikedReelsScreen() {
  // Signed-in state is read on the client; the server render is neutral.
  const [session, setSession] = useState<"unknown" | "in" | "out">("unknown");
  useEffect(() => {
    setSession(readSessionUserId() ? "in" : "out");
  }, []);

  const liked = useLikedReels(LIMIT, session === "in");
  const items = liked.data ?? [];

  return (
    <VideoShell app="reels" aside={<TrendingCard kind="flick" />}>
      <section className="liked-reels" aria-labelledby="liked-reels-title">
        <header className="liked-reels__head">
          <div>
            <h1 id="liked-reels-title" className="liked-reels__title">Liked reels</h1>
            {session === "in" && liked.isSuccess ? (
              <p className="liked-reels__count">{items.length === 0 ? "No liked reels yet" : `${items.length}${items.length >= LIMIT ? "+" : ""} reel${items.length === 1 ? "" : "s"}`}</p>
            ) : null}
          </div>
          <Link href="/saved" className="liked-reels__link">
            <Bookmark size={15} /> Saved reels
          </Link>
        </header>

        {session === "out" ? (
          <div className="liked-reels__empty">
            <LogIn size={28} className="opacity-60" />
            <h2>Sign in to see the reels you liked</h2>
            <p>Your likes are kept with your account.</p>
            <Link href={`/login?next=${encodeURIComponent("/reels/liked")}`} className="liked-reels__cta">Sign in</Link>
          </div>
        ) : session === "unknown" || liked.isPending ? (
          <ul className="liked-reels__grid" aria-busy="true" aria-label="Loading">
            {Array.from({ length: 12 }).map((_, i) => (
              <li key={i} className="liked-reels__tile is-skeleton" aria-hidden />
            ))}
          </ul>
        ) : liked.isError ? (
          <div className="liked-reels__empty" role="alert">
            <h2>Couldn't load your liked reels</h2>
            <p>Check your connection and try again.</p>
            <button type="button" onClick={() => void liked.refetch()} className="liked-reels__cta">
              <RefreshCw size={15} /> Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="liked-reels__empty">
            <Heart size={28} className="opacity-60" />
            <h2>Reels you like will show up here</h2>
            <p>Tap the heart on any reel to keep it.</p>
            <Link href="/reels" className="liked-reels__cta">
              <Clapperboard size={15} /> Watch reels
            </Link>
          </div>
        ) : (
          <ul className="liked-reels__grid">
            {items.map((reel) => (
              <li key={reel.id}>
                <Link
                  href={`/reels?reelId=${encodeURIComponent(reel.id)}`}
                  className="liked-reels__tile"
                  aria-label={`${reel.title || `Reel by ${reel.authorName}`}, ${formatCount(reel.likeCount)} likes`}
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
    </VideoShell>
  );
}

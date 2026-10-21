"use client";

import Link from "next/link";
import { Heart } from "lucide-react";

import { formatCount, type ReelItem } from "@/features/reels/model";
import { reelStageHref } from "@/features/reels/sounds";
import "./explore.css";

/**
 * The Explore tile grid: 2 / 3 / 5 across by breakpoint. Each tile is the
 * reel's cover (a still — nothing plays here), the creator and the like
 * count, and opens the reels stage pinned on that reel (/reels?reelId=),
 * where it starts muted like every reel.
 */
export function ExploreGrid({ reels }: { reels: readonly ReelItem[] }) {
  return (
    <ul className="explore-grid">
      {reels.map((reel) => (
        <li key={reel.id}>
          <Link
            href={reelStageHref(reel.id)}
            className="explore-tile"
            data-reel={reel.id}
            aria-label={`${reel.title || reel.caption.slice(0, 60) || `Reel by ${reel.authorName}`}, by ${reel.authorName}, ${formatCount(reel.likeCount)} likes`}
          >
            {reel.media.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={reel.media.posterUrl} alt="" loading="lazy" decoding="async" />
            ) : null}
            <span className="explore-tile__meta" aria-hidden>
              <span className="explore-tile__creator">
                {reel.authorAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={reel.authorAvatarUrl} alt="" loading="lazy" decoding="async" />
                ) : null}
                <span>{reel.authorUsername ? `@${reel.authorUsername}` : reel.authorName}</span>
              </span>
              <span className="explore-tile__likes">
                <Heart size={13} className="fill-current" /> {formatCount(reel.likeCount)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ExploreGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <ul className="explore-grid" aria-busy="true" aria-label="Loading reels">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="explore-tile is-skeleton" aria-hidden />
      ))}
    </ul>
  );
}

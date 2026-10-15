import Link from "next/link";
import { Clapperboard, Heart, PlayCircle } from "lucide-react";

import { formatCount } from "@/features/reels/model";
import type { HashtagTile } from "./hashtagPage";

/*
  The hashtag page's grid (audit T-34): the same 3:5 poster tiles as the
  liked-reels and sound pages (liked-reels__tile in reels-screen.css), so a
  tag, a sound and your likes read alike. A post with no picture shows its
  caption on the tile instead of an empty frame. The page imports the CSS.
*/
export function HashtagGrid({ tiles }: { tiles: HashtagTile[] }) {
  return (
    <ul className="liked-reels__grid" data-hashtag-grid>
      {tiles.map((tile) => (
        <li key={tile.id}>
          <Link href={tile.href} className="liked-reels__tile" aria-label={tile.label} data-kind={tile.kind}>
            {tile.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tile.posterUrl} alt="" loading="lazy" decoding="async" />
            ) : (
              <span className="absolute inset-0 flex items-center p-3 text-[13px] font-semibold leading-snug" aria-hidden>
                <span className="line-clamp-6">{tile.text || "Post"}</span>
              </span>
            )}
            {tile.kind !== "post" ? (
              <span className="absolute right-2 top-2" aria-hidden>
                {tile.kind === "reel" ? <Clapperboard size={16} /> : <PlayCircle size={16} />}
              </span>
            ) : null}
            <span className="liked-reels__tile-meta" aria-hidden>
              <Heart size={13} className="fill-current" /> {formatCount(tile.likes)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The loading state: the grid's shape, pulsing. */
export function HashtagGridSkeleton() {
  return (
    <ul className="liked-reels__grid" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 12 }).map((_, i) => (
        <li key={i} className="liked-reels__tile is-skeleton" aria-hidden />
      ))}
    </ul>
  );
}

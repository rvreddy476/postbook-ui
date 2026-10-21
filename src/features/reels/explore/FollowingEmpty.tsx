"use client";

import Link from "next/link";
import { Clapperboard, UserRoundCheck } from "lucide-react";

import { SuggestedCreators } from "@/features/reels/explore/SuggestedCreators";
import "./explore.css";

/**
 * The empty Following feed (TikTok parity T-19): instead of a line of text,
 * creators to follow, each with a Follow that goes to graph-service. A
 * follow calls `onFollowChange`, which refetches the Following feed — once
 * a followed creator has reels, the stage replaces this page by itself.
 * With nobody to suggest it falls back to the one action it always had.
 */
export function FollowingEmpty({ viewerId, onFollowChange }: { viewerId: string; onFollowChange: () => void }) {
  const fallback = (
    <div className="explore-state">
      <UserRoundCheck size={26} className="opacity-60" aria-hidden />
      <h3>Nothing from people you follow yet</h3>
      <p>Reels from creators you follow land here. Until then, For You has plenty.</p>
      <Link href="/reels" className="explore-state__action">
        <Clapperboard size={14} aria-hidden /> Go to For You
      </Link>
    </div>
  );
  return (
    <div className="liked-reels__scroll explore-following">
      <section className="liked-reels" aria-labelledby="following-empty-title" data-following-empty="">
        <header className="liked-reels__head">
          <div>
            <h1 id="following-empty-title" className="liked-reels__title">Follow creators to see their reels</h1>
            <p className="liked-reels__count">Reels from people you follow show up here.</p>
          </div>
          <Link href="/reels" className="liked-reels__link">
            <Clapperboard size={15} aria-hidden /> For You
          </Link>
        </header>
        <SuggestedCreators viewerId={viewerId} variant="grid" limit={12} label="Suggested creators" onFollowChange={onFollowChange} empty={fallback} />
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Clapperboard, Flame, Music2, TrendingUp } from "lucide-react";

import { SoundPreviewButton, type SoundPreviewState } from "@/features/reels/components/SoundPreview";
import type { ReelSound } from "@/features/reels/model";
import { soundReelCount, trendingBadges, type SoundTrending } from "@/features/reels/sounds";
import { trendingSoundsHref } from "@/features/reels/trendingSounds";

export interface SoundPageHeaderProps {
  /** null while it is loading, and when there is no such sound. */
  sound: ReelSound | null;
  loading: boolean;
  /** How many reels play it. */
  reelCount: number;
  /** The creator's profile, when the reel the sound came from can be read. */
  creatorHref?: string | null;
  preview: SoundPreviewState;
  onTogglePreview: () => void;
  /** Where "Use this sound" goes: the studio, or sign-in first. */
  useHref: string;
  /** This week's standing: "#3 trending" / "Rising" when set; nothing when null or absent. */
  trending?: SoundTrending | null;
}

/*
  The head of /reels/sound/[id]: the sound's name, who made it, how many
  reels play it, a preview that plays the sound alone, and "Use this
  sound". While loading it holds its place with the page's name; with no
  sound (missing, or not this viewer's to hear) it shows the name alone and
  the page below says why. A trending sound wears "#3 trending" and/or
  "Rising", each a link to that tab of /reels/sounds/trending.
*/
export function SoundPageHeader({ sound, loading, reelCount, creatorHref, preview, onTogglePreview, useHref, trending = null }: SoundPageHeaderProps) {
  const badges = sound ? trendingBadges(trending) : [];
  return (
    <header className="sound-page__head" data-state={sound ? "ready" : loading ? "loading" : "missing"}>
      <span className="sound-page__disc" aria-hidden>
        <Music2 size={28} />
      </span>
      <div className="sound-page__meta">
        <h1 id="sound-page-title" className="sound-page__title">{sound ? sound.title : "Sound"}</h1>
        {sound?.artist ? (
          <p className="sound-page__creator">
            {creatorHref ? <Link href={creatorHref}>{sound.artist}</Link> : sound.artist}
          </p>
        ) : null}
        {sound ? <p className="sound-page__count">{soundReelCount(reelCount)}</p> : null}
        {badges.length > 0 ? (
          <p className="sound-page__trends" data-trending>
            {badges.map((b) => (
              <Link key={b.kind} href={trendingSoundsHref(b.kind === "rising" ? "rising" : "all")} className="sound-page__trend" data-badge={b.kind}>
                {b.kind === "rising" ? <TrendingUp size={13} aria-hidden /> : <Flame size={13} aria-hidden />}
                {b.label}
              </Link>
            ))}
          </p>
        ) : null}
      </div>
      {sound ? (
        <div className="sound-page__actions">
          <SoundPreviewButton state={preview} onToggle={onTogglePreview} className="sound-page__preview" />
          <Link href={useHref} className="liked-reels__cta sound-page__use" data-action="use-sound">
            <Clapperboard size={15} aria-hidden /> Use this sound
          </Link>
        </div>
      ) : null}
    </header>
  );
}

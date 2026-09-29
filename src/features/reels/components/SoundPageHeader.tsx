"use client";

import Link from "next/link";
import { Clapperboard, Music2 } from "lucide-react";

import { SoundPreviewButton, type SoundPreviewState } from "@/features/reels/components/SoundPreview";
import type { ReelSound } from "@/features/reels/model";
import { soundReelCount } from "@/features/reels/sounds";

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
}

/*
  The head of /reels/sound/[id]: the sound's name, who made it, how many
  reels play it, a preview that plays the sound alone, and "Use this
  sound". While loading it holds its place with the page's name; with no
  sound (missing, or not this viewer's to hear) it shows the name alone and
  the page below says why.
*/
export function SoundPageHeader({ sound, loading, reelCount, creatorHref, preview, onTogglePreview, useHref }: SoundPageHeaderProps) {
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

"use client";

import Link from "next/link";
import { Clapperboard, Music2, TrendingUp } from "lucide-react";

import { SoundPreviewButton, type SoundPreviewState } from "@/features/reels/components/SoundPreview";
import { soundPageHref } from "@/features/reels/sounds";
import { trendingUsesLabel, type TrendingSound } from "@/features/reels/trendingSounds";

/*
  The rows of /reels/sounds/trending: rank, cover (the disc when the sound
  has none), title to the sound's page, the Rising chip, who made it, "42
  reels this week", a preview and "Use this sound". The view only; the
  screen owns the one preview element.
*/


export interface TrendingSoundsListProps {
  entries: readonly TrendingSound[];
  playingId: string | null;
  failedIds: ReadonlySet<string>;
  /** Where "Use this sound" goes for a sound: the studio, or sign-in first. */
  useHref: (soundId: string) => string;
  onTogglePreview: (entry: TrendingSound) => void;
}

export function previewStateOf(soundId: string, playingId: string | null, failedIds: ReadonlySet<string>): SoundPreviewState {
  if (failedIds.has(soundId)) return "failed";
  return playingId === soundId ? "playing" : "idle";
}

export function TrendingSoundsList({ entries, playingId, failedIds, useHref, onTogglePreview }: TrendingSoundsListProps) {
  return (
    <ol className="trending-sounds__list" data-trending-list>
      {entries.map((entry) => {
        const { sound } = entry;
        const uses = trendingUsesLabel(entry.uses7d);
        return (
          <li key={sound.id} className="trending-sounds__row" data-sound-id={sound.id} data-rank={entry.rank}>
            <span className="trending-sounds__rank">
              <span className="sr-only">Number </span>
              {entry.rank}
            </span>
            <span className="trending-sounds__cover" aria-hidden>
              {entry.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={entry.coverUrl} alt="" loading="lazy" decoding="async" />
              ) : (
                <Music2 size={22} />
              )}
            </span>
            <div className="trending-sounds__meta">
              <p className="trending-sounds__title">
                <Link href={soundPageHref(sound.id)}>{sound.title}</Link>
                {entry.rising ? (
                  <span className="trending-sounds__rising" data-rising>
                    <TrendingUp size={11} aria-hidden /> Rising
                  </span>
                ) : null}
              </p>
              {sound.artist ? <p className="trending-sounds__artist">{sound.artist}</p> : null}
              {uses ? <p className="trending-sounds__uses">{uses}</p> : null}
            </div>
            <div className="trending-sounds__actions">
              <SoundPreviewButton
                state={previewStateOf(sound.id, playingId, failedIds)}
                onToggle={() => onTogglePreview(entry)}
                className="sound-page__preview"
                soundTitle={sound.title}
              />
              <Link href={useHref(sound.id)} className="liked-reels__cta" data-action="use-sound" aria-label={`Use ${sound.title}`}>
                <Clapperboard size={15} aria-hidden /> Use this sound
              </Link>
            </div>
          </li>
        );
      })}
    </ol>
  );
}


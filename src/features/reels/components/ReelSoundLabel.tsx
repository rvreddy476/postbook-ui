"use client";

import Link from "next/link";
import { Music2 } from "lucide-react";

import type { ReelItem } from "@/features/reels/model";
import { canUseSound, originalSoundLabel, soundPageHref } from "@/features/reels/sounds";

interface ReelSoundLabelProps {
  reel: Pick<ReelItem, "sound" | "soundReuseAllowed" | "isProcessing" | "authorName">;
  isOwn: boolean;
  /** Runs "use this sound" for a reel that plays only its own audio, then opens the sound's page. */
  onUseOriginal?: () => void;
  /** The request above is in flight. */
  pending?: boolean;
  /** "stage" sits over the video; "card" sits on the theme's surface (the author card). */
  tone?: "stage" | "card";
}

/*
  The sound line: a note and the sound's name, small. A reel that plays an
  added sound links to that sound's page. A reel that plays only its own
  audio reads "Original sound - <author>" and is a button — the sound is
  made on first use — but only when its audio may be reused (the creator
  allows it, or the reel is the viewer's own). Otherwise there is no line.
*/
export function ReelSoundLabel({ reel, isOwn, onUseOriginal, pending = false, tone = "stage" }: ReelSoundLabelProps) {
  const className = `reel-sound-line is-${tone} pointer-events-auto`;
  if (reel.sound) {
    return (
      <Link href={soundPageHref(reel.sound.id)} className={className} data-sound="added" title={reel.sound.title} onClick={(e) => e.stopPropagation()}>
        <Music2 size={13} aria-hidden />
        <span className="reel-sound-line__text">{reel.sound.title}</span>
      </Link>
    );
  }
  if (!onUseOriginal || !canUseSound(reel, isOwn)) return null;
  const label = originalSoundLabel(reel.authorName);
  return (
    <button
      type="button"
      className={className}
      data-sound="original"
      title={label}
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={(e) => {
        e.stopPropagation();
        onUseOriginal();
      }}
    >
      <Music2 size={13} aria-hidden />
      <span className="reel-sound-line__text">{label}</span>
    </button>
  );
}

"use client";

import Link from "next/link";
import { Volume2, VolumeX } from "lucide-react";

import type { ReelItem } from "@/features/reels/model";

interface ReelOverlayProps {
  reel: ReelItem;
  sound: boolean;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onToggleSound: () => void;
}

/*
  What sits on top of the video: the sound control at the top-left (8px
  in, 40px square, the slider on hover), and at the bottom-left over a
  soft gradient — always — the author's name (18/700, a plain link), the
  title (if any) and the hashtags (14/700). Nothing else: the description
  is read through More → Description, never drawn over the video. TikTok's
  block: 12px from the left, 16px from the bottom, at most 381px wide. No
  Follow here: following is the badge on the rail avatar. The More circle
  at the top-right is the screen's. Clicks on any of it stop before
  reaching the stage.
*/
export function ReelOverlay({ reel, sound, volume, onVolumeChange, onToggleSound }: ReelOverlayProps) {
  const profileHref = `/u/${reel.authorUsername || reel.authorId}`;

  return (
    <>
      {/* sound top-left (always visible, slider on hover), settings beside it (hover) */}
      <div className="reel-playback-controls" onClick={(e) => e.stopPropagation()}>
        <div className="reel-volume-control">
          <button type="button" aria-label={sound ? "Mute" : "Unmute"} aria-pressed={!sound} onClick={onToggleSound} className="reel-playback-button">
            {sound && volume > 0 ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <input
            type="range"
            aria-label="Volume"
            min={0}
            max={100}
            step={1}
            value={sound ? Math.round(volume * 100) : 0}
            aria-valuetext={`${sound ? Math.round(volume * 100) : 0}%`}
            onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
          />
        </div>
      </div>

      <div className="reel-overlay-details" onClick={(e) => e.stopPropagation()}>
        <div className="reel-overlay-text">
          <div className="reel-author-row pointer-events-auto" data-author-row>
            <Link href={profileHref} className="reel-author-row__name" onClick={(e) => e.stopPropagation()}>
              {reel.authorName}
            </Link>
          </div>

          {reel.title ? <h2 className="reel-title" title={reel.title}>{reel.title}</h2> : null}

          {reel.hashtags.length > 0 ? (
            <p className="reel-hashtags pointer-events-auto">
              {reel.hashtags.slice(0, 6).map((tag) => (
                <Link key={tag} href={`/hashtag/${encodeURIComponent(tag)}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                  #{tag}
                </Link>
              ))}
            </p>
          ) : null}

        </div>
      </div>
    </>
  );
}

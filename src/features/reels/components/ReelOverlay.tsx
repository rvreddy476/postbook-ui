"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings2, Volume2, VolumeX } from "lucide-react";

import { formatCount, type ReelItem } from "@/features/reels/model";

interface ReelOverlayProps {
  reel: ReelItem;
  sound: boolean;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onToggleSound: () => void;
  onOpenSettings: () => void;
  settingsMenu?: React.ReactNode;
}

/*
  What sits on top of the video: sound and settings at the top right, and
  at the bottom left over a soft gradient — always — the author's name (a
  plain link), the title, the caption (two lines and "more"), the hashtags
  and the view count. No Follow here: as on TikTok, following is the badge
  on the rail avatar. Clicks on any of it stop before reaching the stage.
*/
export function ReelOverlay({ reel, sound, volume, onVolumeChange, onToggleSound, onOpenSettings, settingsMenu }: ReelOverlayProps) {
  const [expanded, setExpanded] = useState(false);
  const profileHref = `/u/${reel.authorUsername || reel.authorId}`;
  const caption = reel.caption.trim();
  const longCaption = caption.length > 120 || caption.split("\n").length > 2;

  return (
    <>
      {/* sound top-left (always visible, slider on hover), settings top-right (hover) */}
      <div className="reel-playback-controls absolute left-3 right-3 top-3 z-30 flex items-center justify-between gap-2 pointer-events-none" onClick={(e) => e.stopPropagation()}>
        <div className="reel-volume-control">
          <button type="button" aria-label={sound ? "Mute" : "Unmute"} aria-pressed={!sound} onClick={onToggleSound} className="reel-playback-button">
            {sound && volume > 0 ? <Volume2 size={15} /> : <VolumeX size={15} />}
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
        <div className="reel-settings-slot relative">
          <button type="button" aria-label="Playback settings" onClick={onOpenSettings} className="reel-playback-button">
            <Settings2 size={15} />
          </button>
          {settingsMenu}
        </div>
      </div>

      <div className="reel-overlay-details pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 pb-6 pt-16 pr-20 lg:pr-4" onClick={(e) => e.stopPropagation()}>
        <div className="reel-author-row pointer-events-auto" data-author-row>
          <Link href={profileHref} className="reel-author-row__name" onClick={(e) => e.stopPropagation()}>
            {reel.authorName}
          </Link>
        </div>

        {reel.title ? <h2 className="reel-title" title={reel.title}>{reel.title}</h2> : null}

        {caption ? (
          <div className="reel-caption-row">
            <p className={`reel-caption ${expanded ? "is-expanded" : ""}`}>{caption}</p>
            {longCaption ? (
              <button
                type="button"
                className="reel-caption__more pointer-events-auto"
                aria-expanded={expanded}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
              >
                {expanded ? "less" : "more"}
              </button>
            ) : null}
          </div>
        ) : null}

        {reel.hashtags.length > 0 ? (
          <p className="reel-hashtags pointer-events-auto">
            {reel.hashtags.slice(0, 6).map((tag) => (
              <Link key={tag} href={`/hashtag/${encodeURIComponent(tag)}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                #{tag}
              </Link>
            ))}
          </p>
        ) : null}

        <p className="reel-view-count">{formatCount(reel.viewCount)} views</p>
      </div>
    </>
  );
}

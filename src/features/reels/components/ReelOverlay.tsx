"use client";

import Link from "next/link";
import { Settings2, Volume2, VolumeX } from "lucide-react";

import { type ReelItem } from "@/features/reels/model";

interface ReelOverlayProps {
  reel: ReelItem;
  isOwn: boolean;
  /** undefined = relationship unknown (no button yet) */
  following: boolean | undefined;
  followPending: boolean;
  onToggleFollow: () => void;
  sound: boolean;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onToggleSound: () => void;
  onOpenSettings: () => void;
  settingsMenu?: React.ReactNode;
}

/*
  What sits on top of the video: sound and settings at the top right, the
  title and hashtags at the bottom left over a gradient. Identity belongs
  in the creator column, not on the video. Clicks on
  any of it stop before reaching the stage.
*/
export function ReelOverlay({
  reel,
  sound,
  volume,
  onVolumeChange,
  onToggleSound,
  onOpenSettings,
  settingsMenu,
}: ReelOverlayProps) {

  return (
    <>
      {/* top-right controls */}
      <div className="reel-playback-controls absolute left-3 right-3 top-3 z-30 flex items-center justify-end gap-2 pointer-events-none" onClick={(e) => e.stopPropagation()}>
        <div className="reel-volume-control">
        <button
          type="button"
          aria-label={sound ? "Mute" : "Unmute"}
          aria-pressed={!sound}
          onClick={onToggleSound}
          className="reel-playback-button"
        >
          {sound && volume > 0 ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>
        <input type="range" aria-label="Volume" min={0} max={100} step={1}
          value={sound ? Math.round(volume * 100) : 0}
          aria-valuetext={`${sound ? Math.round(volume * 100) : 0}%`}
          onChange={event => onVolumeChange(Number(event.target.value) / 100)}/>
        </div>
        <>
          <button
            type="button"
            aria-label="Playback settings"
            onClick={onOpenSettings}
            className="reel-playback-button"
          >
            <Settings2 size={15} />
          </button>
          {settingsMenu}
        </>
      </div>

      {/* Identity lives in the creator column, never duplicated over the video. */}
      {reel.title || reel.hashtags.length ? <div
        className="reel-overlay-details pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 pb-6 pt-16 pr-20 md:pr-4"
        onClick={(e) => e.stopPropagation()}
      >

        {reel.title ? <h2 className="reel-title" title={reel.title}>{reel.title}</h2> : null}

        {reel.hashtags.length > 0 ? (
          <p className="pointer-events-auto mt-1 flex flex-wrap gap-x-2 text-[12px] font-semibold text-white/85">
            {reel.hashtags.slice(0, 6).map((tag) => (
              <Link key={tag} href={`/hashtag/${encodeURIComponent(tag)}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                #{tag}
              </Link>
            ))}
          </p>
        ) : null}

      </div> : null}
    </>
  );
}

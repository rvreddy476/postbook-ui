"use client";

import type { ReactNode, RefObject } from "react";
import { Captions, CaptionsOff, MoreHorizontal, Pause, Play, Volume2, VolumeX } from "lucide-react";

import { ReelScrubber } from "@/features/reels/components/ReelScrubber";
import type { ReelVideoHandle } from "@/features/reels/components/ReelVideo";
import { formatClock } from "@/features/reels/model";
import type { PlayerPrefs } from "@/features/reels/playback/playerPrefs";
import { cycleSpeed, speedLabel } from "@/features/reels/theater";

export interface ReelTheaterBarProps {
  /** The one player on the stage; the bar drives it, it never owns a video. */
  player: RefObject<ReelVideoHandle | null>;
  paused: boolean;
  currentMs: number;
  durationMs: number;
  bufferedMs: number;
  prefs: PlayerPrefs;
  onPrefsChange: (patch: Partial<PlayerPrefs>) => void;
  onVolumeChange: (volume: number) => void;
  onToggleSound: () => void;
  onMore: () => void;
  /** The more-menu popover, rendered by the parent into this slot (grows upward). */
  moreMenu?: ReactNode;
}

/*
  The theater's bottom bar, 56px across the whole canvas: play/pause, the
  clock, the scrubber taking every spare pixel, then auto-scroll, speed,
  captions, volume and More. White on black through --reel-on-stage.
*/
export function ReelTheaterBar({
  player,
  paused,
  currentMs,
  durationMs,
  bufferedMs,
  prefs,
  onPrefsChange,
  onVolumeChange,
  onToggleSound,
  onMore,
  moreMenu,
}: ReelTheaterBarProps) {
  const autoScroll = prefs.onEnd === "next";
  return (
    <div className="reel-theater-bar" role="toolbar" aria-label="Playback" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label={paused ? "Play" : "Pause"} onClick={() => player.current?.togglePlay()} className="reel-theater-bar__button">
        {paused ? <Play size={20} className="ml-0.5 fill-current" /> : <Pause size={20} className="fill-current" />}
      </button>
      <span className="reel-theater-bar__clock" aria-live="off">
        {formatClock(currentMs)} / {formatClock(durationMs)}
      </span>
      <ReelScrubber variant="bar" currentMs={currentMs} durationMs={durationMs} bufferedMs={bufferedMs} onSeek={(ms) => player.current?.seekTo(ms)} />

      <label className="reel-theater-bar__switch">
        <span>Auto scroll</span>
        <button
          type="button"
          role="switch"
          aria-checked={autoScroll}
          aria-label="Auto scroll"
          onClick={() => onPrefsChange({ onEnd: autoScroll ? "loop" : "next" })}
          className={`reel-theater-switch ${autoScroll ? "is-on" : ""}`}
        >
          <span className="reel-theater-switch__knob" />
        </button>
      </label>

      <button type="button" aria-label={`Playback speed ${speedLabel(prefs.speed)}`} onClick={() => onPrefsChange({ speed: cycleSpeed(prefs.speed) })} className="reel-theater-bar__button is-text">
        {speedLabel(prefs.speed)}
      </button>

      <button type="button" aria-label={prefs.captions ? "Captions off" : "Captions on"} aria-pressed={prefs.captions} onClick={() => onPrefsChange({ captions: !prefs.captions })} className="reel-theater-bar__button">
        {prefs.captions ? <Captions size={20} /> : <CaptionsOff size={20} />}
      </button>

      <div className="reel-theater-bar__volume">
        <button type="button" aria-label={prefs.sound ? "Mute" : "Unmute"} aria-pressed={!prefs.sound} onClick={onToggleSound} className="reel-theater-bar__button">
          {prefs.sound && prefs.volume > 0 ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
        <input
          type="range"
          aria-label="Volume"
          min={0}
          max={100}
          step={1}
          value={prefs.sound ? Math.round(prefs.volume * 100) : 0}
          aria-valuetext={`${prefs.sound ? Math.round(prefs.volume * 100) : 0}%`}
          onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
        />
      </div>

      <div className="relative">
        <button type="button" aria-label="More" onClick={onMore} className="reel-theater-bar__button">
          <MoreHorizontal size={20} />
        </button>
        {moreMenu}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { ReelPlayer } from "@/features/reels/components/ReelPlayer";
import { ProductTagOverlay } from "./ProductTagOverlay";
import type { PostTubeVideo } from "../types";

interface VideoStageProps {
  video: PostTubeVideo;
  active?: boolean;
  muted: boolean;
  onToggleMuted: () => void;
  onExpand?: () => void;
}

export function VideoStage({ video, active = true, muted, onToggleMuted, onExpand }: VideoStageProps) {
  const [progress, setProgress] = useState(0);
  // Absolute playhead (ms) — feeds ProductTagOverlay so it knows which
  // tags are currently in-window. Kept separate from `progress` because
  // overlays don't care about percentage and percentage doesn't carry
  // duration info.
  const [currentTimeMs, setCurrentTimeMs] = useState(0);

  return (
    <div className="relative flex h-full items-center justify-center">
      <section className="relative h-full aspect-[9/16] max-w-[480px] overflow-hidden rounded-[18px] bg-black shadow-[0_16px_48px_rgba(0,0,0,0.10),0_0_0_1px_rgba(0,0,0,0.04)]">
        <ReelPlayer
          videoUrl={video.video_url}
          posterUrl={video.thumbnail_url}
          muted={muted}
          active={active}
          onToggleMuted={onToggleMuted}
          onBoost={() => {}}
          onProgressChange={setProgress}
          onTimeUpdateMs={setCurrentTimeMs}
          onExpand={onExpand}
        />

        {/* Affiliate product overlay — renders tappable cards keyed by
            currentTimeMs. Sits between the video element and the
            progress bar so playback controls still receive clicks
            through the overlay's `pointer-events: none` background. */}
        <ProductTagOverlay postId={video.id} currentTimeMs={currentTimeMs} />

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-3 pb-2.5">
          <div className="h-[3px] overflow-hidden rounded-full bg-brand-card/20">
            <div
              className="h-full rounded-full bg-red-500 transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useState } from "react";

import { ReelPlayer } from "@/features/reels/components/ReelPlayer";
import type { Reel } from "@/features/reels/types";

interface ReelStageProps {
  reel: Reel;
  active: boolean;
  muted: boolean;
  /** When true, append `?quality=240p` to the playback URL and
   *  suppress autoplay (data-saver mode, recon §F.2). */
  dataSaver?: boolean;
  onToggleMuted: () => void;
  onBoost: () => void;
  onExpand?: () => void;
}

function withQualityHint(url: string, dataSaver: boolean): string {
  if (!dataSaver || !url) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}quality=240p`;
}

export function ReelStage({
  reel,
  active,
  muted,
  dataSaver = false,
  onToggleMuted,
  onBoost,
  onExpand,
}: ReelStageProps) {
  const [progress, setProgress] = useState(0);

  return (
    <div className="relative flex h-full items-center justify-center">
      <section className="relative h-full aspect-[9/16] max-w-[480px] overflow-hidden rounded-[18px] bg-black shadow-[0_16px_48px_rgba(0,0,0,0.10),0_0_0_1px_rgba(0,0,0,0.04)]">
        <ReelPlayer
          videoUrl={withQualityHint(reel.video_url, dataSaver)}
          posterUrl={reel.thumbnail_url}
          muted={muted}
          active={active}
          suppressAutoplay={dataSaver}
          onToggleMuted={onToggleMuted}
          onBoost={onBoost}
          onProgressChange={setProgress}
          onExpand={onExpand}
        />

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

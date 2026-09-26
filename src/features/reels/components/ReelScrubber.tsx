"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { formatClock } from "@/features/reels/model";

interface ReelScrubberProps {
  currentMs: number;
  durationMs: number;
  bufferedMs: number;
  onSeek: (ms: number) => void;
  onScrubbing?: (scrubbing: boolean) => void;
}

/*
  A thin progress line that becomes a seek bar on hover or touch. Dragging
  shows the target time; the seek is committed continuously so the frame
  under the thumb is what the viewer sees, as on YouTube Shorts.
*/
export function ReelScrubber({ currentMs, durationMs, bufferedMs, onSeek, onScrubbing }: ReelScrubberProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragMs, setDragMs] = useState<number | null>(null);

  const ratioFromEvent = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const el = barRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / Math.max(1, rect.width)));
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (durationMs <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const ms = ratioFromEvent(e) * durationMs;
    setDragMs(ms);
    onScrubbing?.(true);
    onSeek(ms);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragMs === null) return;
    const ms = ratioFromEvent(e) * durationMs;
    setDragMs(ms);
    onSeek(ms);
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragMs === null) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragMs(null);
    onScrubbing?.(false);
  };

  const shown = dragMs ?? currentMs;
  const pct = durationMs > 0 ? Math.min(100, (shown / durationMs) * 100) : 0;
  const bufPct = durationMs > 0 ? Math.min(100, (bufferedMs / durationMs) * 100) : 0;

  return (
    <div
      ref={barRef}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(durationMs / 1000)}
      aria-valuenow={Math.round(shown / 1000)}
      className="group/scrub absolute inset-x-0 bottom-0 z-20 h-6 cursor-pointer touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => e.stopPropagation()}
    >
      {dragMs !== null ? (
        <div
          className="absolute bottom-6 -translate-x-1/2 rounded-md bg-black/80 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white"
          style={{ left: `${pct}%` }}
        >
          {formatClock(shown)} / {formatClock(durationMs)}
        </div>
      ) : null}
      <div
        className={`absolute inset-x-0 bottom-0 bg-white/25 transition-[height] duration-150 ${
          dragMs !== null ? "h-1.5" : "h-[3px] group-hover/scrub:h-1.5"
        }`}
      >
        <div className="absolute inset-y-0 left-0 bg-white/40" style={{ width: `${bufPct}%` }} />
        <div className="absolute inset-y-0 left-0 bg-white" style={{ width: `${pct}%` }} />
        <div
          className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-opacity ${
            dragMs !== null ? "opacity-100" : "opacity-0 group-hover/scrub:opacity-100"
          }`}
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Scissors } from "lucide-react";
import { updateVideoTrim } from "../data/posttubeApi";

interface TrimControlsProps {
  videoId?: string;
  durationSeconds: number;
  initialStartMs?: number;
  initialEndMs?: number;
  onTrimChange?: (startMs: number, endMs: number) => void;
}

function fmtTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const frac = Math.floor((ms % 1000) / 100);
  return `${m}:${String(s).padStart(2, "0")}.${frac}`;
}

export function TrimControls({
  videoId,
  durationSeconds,
  initialStartMs = 0,
  initialEndMs,
  onTrimChange,
}: TrimControlsProps) {
  const maxMs = Math.floor(durationSeconds * 1000);
  const [startMs, setStartMs] = useState(initialStartMs);
  const [endMs, setEndMs] = useState(initialEndMs ?? maxMs);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const effectiveDuration = ((endMs - startMs) / 1000).toFixed(1);

  const debouncedSave = useCallback(
    (start: number, end: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        if (!videoId) return;
        setSaving(true);
        try {
          await updateVideoTrim(videoId, start, end < maxMs ? end : undefined);
        } catch {
          // silently fail — user can retry
        } finally {
          setSaving(false);
        }
      }, 1500);
    },
    [videoId, maxMs],
  );

  useEffect(() => {
    setStartMs(initialStartMs);
  }, [initialStartMs]);

  useEffect(() => {
    setEndMs(initialEndMs ?? maxMs);
  }, [initialEndMs, maxMs]);

  const handleStartChange = useCallback(
    (val: number) => {
      const clamped = Math.min(val, endMs - 1000); // min 1s gap
      setStartMs(Math.max(0, clamped));
      onTrimChange?.(Math.max(0, clamped), endMs);
      debouncedSave(Math.max(0, clamped), endMs);
    },
    [endMs, onTrimChange, debouncedSave],
  );

  const handleEndChange = useCallback(
    (val: number) => {
      const clamped = Math.max(val, startMs + 1000); // min 1s gap
      setEndMs(Math.min(maxMs, clamped));
      onTrimChange?.(startMs, Math.min(maxMs, clamped));
      debouncedSave(startMs, Math.min(maxMs, clamped));
    },
    [startMs, maxMs, onTrimChange, debouncedSave],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="rounded-xl border border-brand-divider bg-brand-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Scissors className="h-4 w-4 text-brand-highlight" />
          <h3 className="text-[14px] font-semibold text-brand-text">Trim Video</h3>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-brand-highlight">
          {saving && <span className="text-brand-text/60">Saving...</span>}
          <span>Duration: {effectiveDuration}s</span>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[12px] text-brand-highlight mb-1 block">
            Start: {fmtTime(startMs)}
          </label>
          <input
            type="range"
            min={0}
            max={maxMs}
            step={100}
            value={startMs}
            onChange={(e) => handleStartChange(Number(e.target.value))}
            className="w-full accent-brand-text"
          />
        </div>

        <div>
          <label className="text-[12px] text-brand-highlight mb-1 block">
            End: {fmtTime(endMs)}
          </label>
          <input
            type="range"
            min={0}
            max={maxMs}
            step={100}
            value={endMs}
            onChange={(e) => handleEndChange(Number(e.target.value))}
            className="w-full accent-brand-text"
          />
        </div>

        {/* Visual timeline bar */}
        <div className="relative h-2 rounded-full bg-brand-secondary overflow-hidden">
          <div
            className="absolute top-0 h-full bg-brand-text/30 rounded-full"
            style={{
              left: `${(startMs / maxMs) * 100}%`,
              width: `${((endMs - startMs) / maxMs) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

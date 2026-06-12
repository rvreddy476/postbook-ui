"use client";

import { useState, useCallback } from "react";
import { Image, Upload, SlidersHorizontal } from "lucide-react";
import { setCoverFrame } from "../data/posttubeApi";
import { extractCoverFrame } from "@/features/reels/data/reelsApi";

type Mode = "auto" | "scrub" | "upload";

interface CoverFrameSelectorProps {
  videoId: string;
  mediaId: string;
  durationSeconds: number;
  currentThumbnailUrl?: string;
  onCoverChange?: (url: string) => void;
}

export function CoverFrameSelector({
  videoId,
  mediaId,
  durationSeconds,
  currentThumbnailUrl,
  onCoverChange,
}: CoverFrameSelectorProps) {
  const [mode, setMode] = useState<Mode>("auto");
  const [previewUrl, setPreviewUrl] = useState(currentThumbnailUrl ?? "");
  const [scrubMs, setScrubMs] = useState(Math.floor(durationSeconds * 250)); // 25% default
  const [saving, setSaving] = useState(false);

  const handleScrubCommit = useCallback(async () => {
    setSaving(true);
    try {
      const result = await extractCoverFrame({
        mediaId,
        timestampMs: scrubMs,
      });
      setPreviewUrl(result.preview_url);
      onCoverChange?.(result.preview_url);

      await setCoverFrame(videoId, {
        cover_media_id: result.cover_media_id,
        thumbnail_url: result.preview_url,
      });
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }, [videoId, mediaId, scrubMs, onCoverChange]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // For now, create a local preview and upload via media service
      const localUrl = URL.createObjectURL(file);
      setPreviewUrl(localUrl);
      onCoverChange?.(localUrl);
    },
    [onCoverChange],
  );

  const maxMs = Math.floor(durationSeconds * 1000);

  return (
    <div className="rounded-xl border border-brand-divider bg-brand-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Image className="h-4 w-4 text-brand-highlight" />
        <h3 className="text-[14px] font-semibold text-brand-text">Cover Frame</h3>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2 mb-4">
        {(["auto", "scrub", "upload"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
              mode === m
                ? "bg-slate-900 text-white"
                : "bg-brand-secondary text-brand-highlight hover:bg-brand-secondary"
            }`}
          >
            {m === "auto" && "Auto"}
            {m === "scrub" && (
              <>
                <SlidersHorizontal className="h-3 w-3" /> Scrub
              </>
            )}
            {m === "upload" && (
              <>
                <Upload className="h-3 w-3" /> Upload
              </>
            )}
          </button>
        ))}
      </div>

      {/* Preview */}
      <div className="mb-3 aspect-video overflow-hidden rounded-lg bg-brand-secondary">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Cover frame preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100">
            <Image className="h-8 w-8 text-brand-text/30" />
          </div>
        )}
      </div>

      {/* Mode-specific controls */}
      {mode === "scrub" && (
        <div className="space-y-2">
          <label className="text-[12px] text-brand-highlight">
            Position: {(scrubMs / 1000).toFixed(1)}s
          </label>
          <input
            type="range"
            min={0}
            max={maxMs}
            step={100}
            value={scrubMs}
            onChange={(e) => setScrubMs(Number(e.target.value))}
            className="w-full accent-brand-text"
          />
          <button
            type="button"
            onClick={handleScrubCommit}
            disabled={saving}
            className="w-full rounded-lg bg-brand-text py-2 text-[13px] font-semibold text-brand-bg transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Extracting..." : "Extract Frame"}
          </button>
        </div>
      )}

      {mode === "upload" && (
        <div>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-brand-divider py-4 text-[13px] text-brand-highlight transition-colors hover:border-brand-text/30 hover:text-brand-highlight">
            <Upload className="h-4 w-4" />
            Choose an image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      )}

      {mode === "auto" && (
        <p className="text-[12px] text-brand-text/60">
          Auto-generated from 25% of the video duration.
        </p>
      )}
    </div>
  );
}

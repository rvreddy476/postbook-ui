"use client";

import { useState, useRef, useCallback } from "react";
import { Play, Pause, Copy, Check, Volume2, Maximize2 } from "lucide-react";
import { CONTENT_TYPE_META, type ContentType, type StepId } from "../tokens";
import type { StudioFormState } from "../types";

interface PreviewPanelProps {
  form: StudioFormState;
  patch: (u: Partial<StudioFormState>) => void;
  contentType: ContentType;
  steps: readonly StepId[];
}


function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtSize(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function PreviewPanel({ form, patch, contentType, steps }: PreviewPanelProps) {
  const config = CONTENT_TYPE_META[contentType];
  const isVertical = contentType === "reel" || contentType === "short";
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
    setPlaying(!playing);
  }, [playing]);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const contentLink = form.publishedPostId
    ? (contentType === "long" || contentType === "podcast")
      ? `${baseUrl}/posttube/watch/${form.publishedPostId}`
      : `${baseUrl}/reels/${form.publishedPostId}`
    : form.draftId
    ? `${baseUrl}/reels/draft/${form.draftId}`
    : "";

  const handleCopy = useCallback(() => {
    if (!contentLink) return;
    navigator.clipboard.writeText(contentLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [contentLink]);

  return (
    <div className="w-[300px] shrink-0 border-l border-[#E8E6E1] bg-[#FAFAF8] overflow-y-auto hidden lg:block">
      <div className="p-5 space-y-5">
        {/* ── Video Player ── */}
        <div className="overflow-hidden rounded-2xl bg-[#1A1A1A] shadow-lg ring-1 ring-black/5">
          <div
            className="relative flex items-center justify-center"
            style={{ aspectRatio: isVertical ? "9/16" : "16/9", maxHeight: isVertical ? "320px" : "200px" }}
          >
            {form.coverPreviewUrl || form.customCoverPreviewUrl ? (
              <img
                src={form.coverSourceType === "custom_image" ? form.customCoverPreviewUrl! : form.coverPreviewUrl!}
                alt="Cover"
                className="h-full w-full object-cover"
              />
            ) : form.videoPreviewUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={form.videoPreviewUrl}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                  onEnded={() => setPlaying(false)}
                />
                <button
                  type="button"
                  onClick={togglePlay}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${
                    playing ? "bg-black/40 opacity-0 hover:opacity-100" : "bg-brand-card/20 backdrop-blur-sm"
                  }`}>
                    {playing ? (
                      <Pause className="h-5 w-5 text-white" fill="white" />
                    ) : (
                      <Play className="h-5 w-5 text-white ml-0.5" fill="white" />
                    )}
                  </div>
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-white/30">
                <div className="h-14 w-14 rounded-2xl bg-brand-card/5 flex items-center justify-center">
                  <Play className="h-6 w-6" />
                </div>
                <span className="text-[11px]">No preview</span>
              </div>
            )}
          </div>

          {/* Controls */}
          {form.videoPreviewUrl && (
            <div className="flex items-center gap-2 bg-[#2A2A2A] px-3 py-2">
              <button type="button" onClick={togglePlay} className="text-white/70 hover:text-white transition-colors">
                {playing ? <Pause className="h-3 w-3" fill="currentColor" /> : <Play className="h-3 w-3" fill="currentColor" />}
              </button>
              <div className="flex-1 h-1 bg-brand-card/10 rounded-full">
                <div className="h-1 bg-[#7C5CFC] rounded-full" style={{ width: "0%" }} />
              </div>
              <span className="text-[10px] text-white/50 font-mono">
                {form.videoDurationSec != null ? fmtDuration(form.videoDurationSec) : "0:00"}
              </span>
            </div>
          )}
        </div>

        {/* ── Content Link ── */}
        <div className="rounded-xl border border-[#E8E6E1] bg-brand-card p-3.5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-semibold text-[#1A1A1A]">Content link</p>
            {contentLink && (
              <button type="button" onClick={handleCopy} className="text-[#9E9E9E] hover:text-[#1A1A1A] transition-colors">
                {copied ? <Check className="h-3.5 w-3.5 text-[#2BB5A0]" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
          {contentLink ? (
            <p className="truncate text-[12px] font-mono text-[#7C5CFC]">{contentLink}</p>
          ) : (
            <p className="text-[12px] text-[#BFBFBF]">Available after upload</p>
          )}
        </div>

        {/* ── File Metadata ── */}
        {form.videoFile && (
          <div className="rounded-xl border border-[#E8E6E1] bg-brand-card p-3.5 shadow-sm">
            <p className="text-[12px] font-semibold text-[#1A1A1A] mb-2">File Info</p>
            <div className="space-y-1.5">
              {[
                { label: "Filename", value: form.videoFile.name },
                { label: "Duration", value: form.videoDurationSec != null ? fmtDuration(form.videoDurationSec) : "..." },
                { label: "Size", value: fmtSize(form.videoFile.size) },
                ...(form.videoWidth && form.videoHeight ? [{ label: "Resolution", value: `${form.videoWidth}x${form.videoHeight}` }] : []),
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-[11px]">
                  <span className="text-[#9E9E9E]">{row.label}</span>
                  <span className="text-[#1A1A1A] font-medium truncate max-w-[140px]">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Publish to Feed ── */}
        <div className="rounded-xl border border-[#E8E6E1] bg-brand-card p-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-[#1A1A1A]">Publish to Feed</p>
              <p className="text-[10px] text-[#9E9E9E] mt-0.5">Cross-post to your feed</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.crossPostPostbook}
              onClick={() => patch({ crossPostPostbook: !form.crossPostPostbook })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
                form.crossPostPostbook ? "bg-[#E8527A]" : "bg-[#D1D1D1]"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-brand-card shadow-sm transition-transform duration-200 ${
                  form.crossPostPostbook ? "translate-x-[22px]" : "translate-x-[3px]"
                }`}
              />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useCallback } from "react";
import { Play, Copy, Check, Volume2, Settings, Maximize2 } from "lucide-react";
import { CONTENT_TYPE_META, type ContentType } from "../tokens";
import type { StudioFormState } from "../types";

interface PreviewPanelProps {
  form: StudioFormState;
  contentType: ContentType;
}

const PLATFORM_LABELS: Record<ContentType, string> = {
  reel: "Postgram",
  short: "Posttube",
  long: "Posttube",
  podcast: "Posttube",
};

const PLATFORM_COLORS: Record<ContentType, string> = {
  reel: "bg-[#E8527A]/10 text-[#E8527A] border-[#E8527A]/20",
  short: "bg-[#F28B6D]/10 text-[#F28B6D] border-[#F28B6D]/20",
  long: "bg-[#7C5CFC]/10 text-[#7C5CFC] border-[#7C5CFC]/20",
  podcast: "bg-[#E5A93D]/10 text-[#E5A93D] border-[#E5A93D]/20",
};

function fmtDuration(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function fmtSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function PreviewPanel({ form, contentType }: PreviewPanelProps) {
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
  // Application URL — same pattern as YouTube (youtube.com/shorts/ID)
  // After publish: /reels/{postId} or /posttube/watch/{postId}
  // Before publish (draft): /reels/draft/{draftId}
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

  const typeBadge = contentType === "reel" || contentType === "short" ? "REEL" : contentType === "podcast" ? "PODCAST" : "VIDEO";
  const checksPass = form.title.trim().length > 0 && (form.uploadPhase === "done" || form.mediaId !== null) && form.caption.length <= 2200;

  return (
    <div className="w-[280px] shrink-0 border-l border-[#E8E6E1] bg-[#FAFAF8] overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* ── Video Player ── */}
        <div className="overflow-hidden rounded-xl bg-[#1A1A1A] shadow-md">
          <div
            className="relative flex items-center justify-center"
            style={{ aspectRatio: isVertical ? "9/16" : "16/9", maxHeight: isVertical ? "300px" : "180px" }}
          >
            {/* Type badge */}
            <div className="absolute left-2 top-2 z-10 rounded bg-[#2BB5A0] px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
              {typeBadge}
            </div>

            {form.coverResult?.preview_url ? (
              <img src={form.coverResult.preview_url} alt="Cover" className="h-full w-full object-cover" />
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
                {/* Play overlay */}
                {!playing && (
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                      <Play className="h-5 w-5 text-white ml-0.5" fill="white" />
                    </div>
                  </button>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-white/40">
                <Play className="h-8 w-8" />
                <span className="text-[10px]">No video</span>
              </div>
            )}
          </div>

          {/* Player controls bar */}
          {form.videoPreviewUrl && (
            <div className="flex items-center gap-2 bg-[#2A2A2A] px-3 py-1.5">
              <button type="button" onClick={togglePlay} className="text-white/70 hover:text-white">
                <Play className="h-3 w-3" fill={playing ? "transparent" : "currentColor"} />
              </button>
              <Volume2 className="h-3 w-3 text-white/50" />
              <span className="text-[10px] text-white/50 font-mono">0:00</span>
              <span className="text-[10px] text-white/30">/</span>
              <span className="text-[10px] text-white/50 font-mono">
                {form.videoDurationSec != null ? fmtDuration(form.videoDurationSec) : "0:00"}
              </span>
              <div className="flex-1" />
              <Settings className="h-3 w-3 text-white/40" />
              <Maximize2 className="h-3 w-3 text-white/40" />
            </div>
          )}
        </div>

        {/* ── Content Link ── */}
        <div className="rounded-xl border border-[#E8E6E1] bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-semibold text-[#1A1A1A]">Content link</p>
            <button type="button" onClick={handleCopy} className="text-[#9E9E9E] hover:text-[#1A1A1A] transition-colors">
              {copied ? <Check className="h-3.5 w-3.5 text-[#2BB5A0]" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          {contentLink ? (
            <a
              href={contentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-[12px] font-mono text-[#2BB5A0] hover:underline"
            >
              {contentLink}
            </a>
          ) : (
            <p className="text-[12px] font-mono text-[#BFBFBF]">Available after upload</p>
          )}
        </div>

        {/* ── File Metadata ── */}
        {form.videoFile && (
          <div className="rounded-xl border border-[#E8E6E1] bg-white p-3">
            <table className="w-full text-[11px]">
              <tbody>
                {[
                  { label: "Filename", value: form.videoFile.name },
                  { label: "Duration", value: form.videoDurationSec != null ? fmtDuration(form.videoDurationSec) : "—" },
                  { label: "Resolution", value: isVertical ? "1080×1920" : "1920×1080" },
                  { label: "Size", value: fmtSize(form.videoFile.size) },
                  { label: "Max", value: `${config.maxDuration}s` },
                ].map((row) => (
                  <tr key={row.label}>
                    <td className="py-1 text-[#9E9E9E] font-medium">{row.label}</td>
                    <td className="py-1 text-right text-[#1A1A1A] font-medium truncate max-w-[120px]">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Publishing To ── */}
        <div className="rounded-xl border border-[#E8E6E1] bg-white p-3">
          <p className="text-[12px] font-semibold text-[#1A1A1A] mb-2">Publishing to</p>
          <div className="flex flex-wrap gap-1.5">
            <span className={`rounded-md border px-2.5 py-1 text-[11px] font-bold ${PLATFORM_COLORS[contentType]}`}>
              {PLATFORM_LABELS[contentType]}
            </span>
            {form.crossPostPostbook && contentType !== "reel" && (
              <span className="rounded-md border border-[#7C5CFC]/20 bg-[#7C5CFC]/10 px-2.5 py-1 text-[11px] font-bold text-[#7C5CFC]">
                Postbook
              </span>
            )}
            {form.crossPostPosttube && contentType === "reel" && (
              <span className="rounded-md border border-[#F28B6D]/20 bg-[#F28B6D]/10 px-2.5 py-1 text-[11px] font-bold text-[#F28B6D]">
                Posttube
              </span>
            )}
          </div>
        </div>

        {/* ── Checks Status ── */}
        <div className={`rounded-xl border p-3 ${checksPass ? "border-[#2BB5A0]/30 bg-[#2BB5A0]/5" : "border-[#E8E6E1] bg-white"}`}>
          <div className="flex items-center gap-2">
            {checksPass ? (
              <Check className="h-4 w-4 text-[#2BB5A0]" strokeWidth={2.5} />
            ) : (
              <div className="h-4 w-4 rounded-full border-2 border-[#E8E6E1]" />
            )}
            <div>
              <p className={`text-[12px] font-semibold ${checksPass ? "text-[#2BB5A0]" : "text-[#9E9E9E]"}`}>
                {checksPass ? "Checks complete" : "Checks pending"}
              </p>
              <p className="text-[10px] text-[#9E9E9E]">
                {checksPass ? "No issues found" : "Complete required fields"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Film,
  Globe,
  Hash,
  Info,
  Loader2,
  Lock,
  MapPin,
  MessageSquare,
  Pencil,
  Send,
  Shield,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  Users,
  X,
  Image as ImageIcon,
  Volume2,
  Eye,
  EyeOff,
} from "lucide-react";

import {
  useCreateReel,
  REEL_LIMITS,
  type WizardStep,
} from "@/features/reels/hooks/useCreateReel";
import { getTopics } from "@/features/reels/data/reelsApi";
import { ChannelGate } from "@/components/ChannelGate";
import type {
  ReelVisibility,
  Topic,
  LicenseType,
  CommentModeration,
  RemixSetting,
  CommentAccess,
} from "@/features/reels/types";

/* ── Default topics (used when backend endpoint is unavailable) */

const DEFAULT_TOPICS: Topic[] = [
  { id: 1, slug: "comedy", label: "Comedy" },
  { id: 2, slug: "education", label: "Education" },
  { id: 3, slug: "tech", label: "Tech" },
  { id: 4, slug: "food", label: "Food" },
  { id: 5, slug: "music", label: "Music" },
  { id: 6, slug: "dance", label: "Dance" },
  { id: 7, slug: "fitness", label: "Fitness" },
  { id: 8, slug: "travel", label: "Travel" },
  { id: 9, slug: "beauty", label: "Beauty" },
  { id: 10, slug: "gaming", label: "Gaming" },
  { id: 11, slug: "news", label: "News" },
  { id: 12, slug: "diy", label: "DIY" },
];

const CATEGORIES = [
  "Film & Animation",
  "Autos & Vehicles",
  "Music",
  "Pets & Animals",
  "Sports",
  "Short Movies",
  "Travel & Events",
  "Gaming",
  "Videoblogging",
  "People & Blogs",
  "Comedy",
  "Entertainment",
  "News & Politics",
  "Howto & Style",
  "Education",
  "Science & Technology",
  "Nonprofits & Activism",
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "te", label: "Telugu" },
  { code: "ta", label: "Tamil" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "pt", label: "Portuguese" },
  { code: "ar", label: "Arabic" },
  { code: "ru", label: "Russian" },
  { code: "it", label: "Italian" },
  { code: "nl", label: "Dutch" },
];

/* ── Step indicator ──────────────────────────────────────── */

const STEP_META: { key: WizardStep; label: string; icon: typeof Upload }[] = [
  { key: "upload", label: "Upload", icon: Upload },
  { key: "edit", label: "Edit", icon: Pencil },
  { key: "details", label: "Details", icon: Hash },
  { key: "review", label: "Publish", icon: Send },
];

function StepIndicator({
  currentStep,
  onStepClick,
}: {
  currentStep: WizardStep;
  onStepClick: (step: WizardStep) => void;
}) {
  const currentIdx = STEP_META.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center gap-1">
      {STEP_META.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        const Icon = step.icon;
        const clickable = done;

        return (
          <div key={step.key} className="flex items-center gap-1">
            {idx > 0 && (
              <div
                className={`h-px w-6 transition-colors ${
                  done ? "bg-slate-900" : "bg-brand-secondary"
                }`}
              />
            )}
            <button
              type="button"
              onClick={() => clickable && onStepClick(step.key)}
              disabled={!clickable}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all ${
                active
                  ? "bg-slate-900 text-white shadow-sm"
                  : done
                    ? "bg-brand-secondary text-brand-text hover:bg-brand-secondary cursor-pointer"
                    : "bg-transparent text-brand-text/30 cursor-default"
              }`}
            >
              {done ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ── Visibility selector ─────────────────────────────────── */

const VISIBILITY_OPTIONS: { value: ReelVisibility; label: string; desc: string; icon: typeof Globe }[] = [
  { value: "public", label: "Public", desc: "Everyone can see this reel", icon: Globe },
  { value: "unlisted", label: "Unlisted", desc: "Anyone with the link can view", icon: EyeOff },
  { value: "followers", label: "Followers", desc: "Only your followers can see", icon: Users },
  { value: "private", label: "Private", desc: "Only you can see this reel", icon: Lock },
];

function VisibilitySelector({
  value,
  onChange,
}: {
  value: ReelVisibility;
  onChange: (v: ReelVisibility) => void;
}) {
  return (
    <div className="space-y-2">
      {VISIBILITY_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition ${
              active
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-[#F5F5F7] text-brand-highlight hover:bg-brand-secondary/70"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <div>
              <p className="text-[13px] font-medium">{opt.label}</p>
              <p className={`text-[11px] ${active ? "text-white/70" : "text-brand-text/60"}`}>
                {opt.desc}
              </p>
            </div>
            {active && <Check className="ml-auto h-4 w-4 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

/* ── Collapsible section ─────────────────────────────────── */

function Section({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
  badge,
}: {
  title: string;
  icon: typeof Info;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-brand-divider last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-0 py-3 text-left"
      >
        <Icon className="h-4 w-4 text-brand-text/60 shrink-0" />
        <span className="flex-1 text-[13px] font-semibold text-brand-text">{title}</span>
        {badge && (
          <span className="rounded-full bg-brand-secondary px-2 py-0.5 text-[10px] font-medium text-brand-highlight">
            {badge}
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 text-brand-text/30 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="pb-4 pl-7">{children}</div>}
    </div>
  );
}

/* ── Tag input ───────────────────────────────────────────── */

function TagInput({
  tags,
  onChange,
  placeholder,
  max,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
  max: number;
}) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const trimmed = input.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < max) {
      onChange([...tags, trimmed]);
      setInput("");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-brand-secondary px-2.5 py-1 text-[12px] font-medium text-brand-highlight"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="ml-0.5 text-brand-text/60 hover:text-brand-highlight"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      {tags.length < max && (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder={placeholder}
            className="flex-1 rounded-lg border border-brand-divider bg-[#F9FAFB] px-3 py-2 text-[13px] text-brand-text placeholder:text-brand-text/30 outline-none focus:border-brand-text/30 focus:ring-2 focus:ring-brand-secondary"
          />
        </div>
      )}
      <p className="mt-1 text-[11px] text-brand-text/30">{tags.length}/{max} tags — press Enter or comma to add</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STEP 1: UPLOAD
   ═══════════════════════════════════════════════════════════ */

function StepUpload({
  state,
  selectFile,
  clearFile,
  onUpload,
  isPending,
}: {
  state: ReturnType<typeof useCreateReel>["state"];
  selectFile: (f: File) => void;
  clearFile: () => void;
  onUpload: () => void;
  isPending: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      // Block new file selection while upload is in progress
      if (state.uploadPhase === "uploading" || state.uploadPhase === "creating_draft") return;
      const file = e.dataTransfer.files?.[0];
      if (file) selectFile(file);
    },
    [selectFile, state.uploadPhase]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) selectFile(file);
    },
    [selectFile]
  );

  return (
    <div className="flex flex-1 min-h-0 justify-center gap-10 px-10 py-8">
      <div className="flex flex-col items-center gap-4">
        <div
          ref={dropRef}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative aspect-[9/16] w-[320px] overflow-hidden rounded-[20px] shadow-[0_8px_30px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)] transition-colors ${
            isDragging ? "bg-brand-secondary ring-2 ring-slate-400" : "bg-brand-secondary"
          }`}
        >
          {state.videoPreviewUrl ? (
            <>
              <video
                src={state.videoPreviewUrl}
                className="h-full w-full object-cover"
                muted
                loop
                autoPlay
                playsInline
              />
              {state.uploadPhase === "uploading" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="mb-3 h-20 w-20 rounded-full border-4 border-white/20 relative">
                    <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
                      <circle
                        cx="40"
                        cy="40"
                        r="36"
                        fill="none"
                        stroke="white"
                        strokeWidth="4"
                        strokeDasharray={`${(state.uploadProgress / 100) * 226} 226`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[16px] font-bold text-white">
                      {state.uploadProgress}%
                    </span>
                  </div>
                  <p className="text-[13px] font-medium text-white/80">Uploading video...</p>
                </div>
              )}
              {state.uploadPhase === "creating_draft" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-white mb-3" />
                  <p className="text-[13px] font-medium text-white/80">Preparing draft...</p>
                </div>
              )}
              {state.uploadPhase === "idle" && (
                <button
                  type="button"
                  onClick={clearFile}
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-full w-full flex-col items-center justify-center gap-3 transition hover:bg-brand-secondary/60"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-secondary">
                <Upload className="h-7 w-7 text-brand-text/60" />
              </div>
              <div className="text-center">
                <p className="text-[14px] font-semibold text-brand-text">
                  Drag & drop or click to upload
                </p>
                <p className="mt-1 text-[12px] text-brand-text/60">
                  MP4, MOV, WebM — max {REEL_LIMITS.MAX_FILE_SIZE / (1024 * 1024)} MB
                </p>
                <p className="text-[12px] text-brand-text/60">
                  {REEL_LIMITS.MIN_DURATION_SEC}–{REEL_LIMITS.MAX_DURATION_SEC} seconds
                </p>
              </div>
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={handleFileChange}
          className="hidden"
        />

        {state.uploadError && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-[13px] text-red-600 max-w-[320px] text-center">
            {state.uploadError}
          </div>
        )}

        {!state.videoPreviewUrl && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-text"
          >
            <Film className="h-4 w-4" />
            Select Video
          </button>
        )}

        {state.videoPreviewUrl && state.uploadPhase === "idle" && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={clearFile}
              className="flex items-center gap-2 rounded-full bg-[#F5F5F7] px-4 py-2.5 text-[13px] font-medium text-brand-highlight transition hover:bg-brand-secondary/70"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={onUpload}
              disabled={isPending}
              className="flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-brand-text disabled:opacity-40"
            >
              <Upload className="h-4 w-4" />
              Upload & Continue
            </motion.button>
          </div>
        )}

        {state.uploadPhase === "done" && (
          <div className="flex items-center gap-2 text-[13px] font-medium text-green-600">
            <Check className="h-4 w-4" />
            Upload complete
          </div>
        )}

        {state.videoFile && (
          <div className="flex items-center gap-4 text-[11px] text-brand-text/60">
            <span>{state.videoFile.name}</span>
            <span>{(state.videoFile.size / (1024 * 1024)).toFixed(1)} MB</span>
            {state.videoDurationSec && <span>{state.videoDurationSec}s</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STEP 2: EDIT (cover, audio levels)
   ═══════════════════════════════════════════════════════════ */

function StepEdit({
  state,
  patch,
  onExtractCover,
  extractCoverPending,
}: {
  state: ReturnType<typeof useCreateReel>["state"];
  patch: (u: Partial<ReturnType<typeof useCreateReel>["state"]>) => void;
  onExtractCover: (ms: number) => void;
  extractCoverPending: boolean;
}) {
  return (
    <div className="flex flex-1 min-h-0 justify-center gap-10 px-10 py-8">
      <div className="flex flex-col items-center gap-4">
        <div className="relative aspect-[9/16] w-[280px] overflow-hidden rounded-[20px] bg-brand-secondary shadow-[0_8px_30px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)]">
          {state.videoPreviewUrl && (
            <video
              src={state.videoPreviewUrl}
              className="h-full w-full object-cover"
              muted
              loop
              autoPlay
              playsInline
            />
          )}
        </div>
      </div>

      <div className="flex w-[400px] flex-col gap-6 overflow-y-auto">
        {/* Cover frame */}
        <div>
          <label className="mb-2 block text-[13px] font-semibold text-brand-text">
            <ImageIcon className="mr-1.5 inline h-3.5 w-3.5" />
            Cover Frame
          </label>
          <p className="mb-3 text-[12px] text-brand-text/60">
            Select a timestamp for the cover image shown in feeds
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={(state.videoDurationSec ?? 30) * 1000}
              step={100}
              value={state.coverTimestampMs ?? 0}
              onChange={(e) => patch({ coverTimestampMs: Number(e.target.value) })}
              className="flex-1 accent-slate-900"
            />
            <button
              type="button"
              onClick={() => onExtractCover(state.coverTimestampMs ?? 0)}
              disabled={extractCoverPending}
              className="flex items-center gap-1.5 rounded-lg bg-brand-secondary px-3 py-1.5 text-[12px] font-medium text-brand-highlight transition hover:bg-brand-secondary disabled:opacity-40"
            >
              {extractCoverPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ImageIcon className="h-3 w-3" />
              )}
              Extract
            </button>
          </div>
          {/* Precise minute:second input */}
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[11px] text-brand-text/60">Jump to</span>
            <input
              type="number"
              min={0}
              max={Math.floor((state.videoDurationSec ?? 0) / 60)}
              value={Math.floor((state.coverTimestampMs ?? 0) / 60000)}
              onChange={(e) => {
                const mins = Math.max(0, parseInt(e.target.value) || 0);
                const currentSecs = Math.floor(((state.coverTimestampMs ?? 0) % 60000) / 1000);
                const totalMs = Math.min(
                  (mins * 60 + currentSecs) * 1000,
                  (state.videoDurationSec ?? 30) * 1000
                );
                patch({ coverTimestampMs: totalMs });
              }}
              className="w-10 rounded border border-brand-divider bg-brand-card px-1.5 py-1 text-center text-[12px] font-mono text-brand-text outline-none focus:border-slate-400"
              aria-label="Minutes"
            />
            <span className="text-[12px] font-bold text-brand-text/60">:</span>
            <input
              type="number"
              min={0}
              max={59}
              value={Math.floor(((state.coverTimestampMs ?? 0) % 60000) / 1000)}
              onChange={(e) => {
                const secs = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                const currentMins = Math.floor((state.coverTimestampMs ?? 0) / 60000);
                const totalMs = Math.min(
                  (currentMins * 60 + secs) * 1000,
                  (state.videoDurationSec ?? 30) * 1000
                );
                patch({ coverTimestampMs: totalMs });
              }}
              className="w-10 rounded border border-brand-divider bg-brand-card px-1.5 py-1 text-center text-[12px] font-mono text-brand-text outline-none focus:border-slate-400"
              aria-label="Seconds"
            />
            <span className="text-[11px] text-brand-text/60">
              / {Math.floor((state.videoDurationSec ?? 0) / 60)}:{String(Math.floor((state.videoDurationSec ?? 0) % 60)).padStart(2, "0")}
            </span>
          </div>
          {state.coverResult && (
            <div className="mt-2 flex items-center gap-2">
              {state.coverResult.preview_url && (
                <img
                  src={state.coverResult.preview_url}
                  alt="Cover preview"
                  className="h-16 w-9 rounded object-cover"
                />
              )}
              <div className="flex items-center gap-1.5 text-[11px] text-green-600">
                <Check className="h-3 w-3" />
                Cover frame saved
              </div>
            </div>
          )}
        </div>

        {/* Audio levels */}
        <div>
          <label className="mb-2 block text-[13px] font-semibold text-brand-text">
            <Volume2 className="mr-1.5 inline h-3.5 w-3.5" />
            Audio Levels
          </label>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-brand-highlight w-24">Original</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={state.originalAudioVolume}
                onChange={(e) => patch({ originalAudioVolume: Number(e.target.value) })}
                className="flex-1 accent-slate-900"
              />
              <span className="text-[12px] font-mono text-brand-highlight w-10 text-right">
                {Math.round(state.originalAudioVolume * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-brand-highlight w-24">Overlay</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={state.overlayAudioVolume}
                onChange={(e) => patch({ overlayAudioVolume: Number(e.target.value) })}
                className="flex-1 accent-slate-900"
              />
              <span className="text-[12px] font-mono text-brand-highlight w-10 text-right">
                {Math.round(state.overlayAudioVolume * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STEP 3: DETAILS (YouTube-style comprehensive settings)
   ═══════════════════════════════════════════════════════════ */

function StepDetails({
  state,
  patch,
}: {
  state: ReturnType<typeof useCreateReel>["state"];
  patch: (u: Partial<ReturnType<typeof useCreateReel>["state"]>) => void;
}) {
  const topicsQuery = useQuery({
    queryKey: ["reel-topics"],
    queryFn: getTopics,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const topics: Topic[] = topicsQuery.data ?? DEFAULT_TOPICS;
  const captionHashtags = state.caption.match(/#\w+/g) ?? [];

  return (
    <div className="flex flex-1 min-h-0 justify-center gap-10 px-10 py-8">
      {/* Left — Video preview (small) */}
      <div className="flex flex-col items-center gap-3 shrink-0">
        <div className="relative aspect-[9/16] w-[200px] overflow-hidden rounded-[16px] bg-brand-secondary shadow-[0_8px_30px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)]">
          {state.videoPreviewUrl && (
            <video
              src={state.videoPreviewUrl}
              className="h-full w-full object-cover"
              muted
              loop
              autoPlay
              playsInline
            />
          )}
        </div>
        {state.videoDurationSec && (
          <span className="text-[11px] text-brand-text/60">{state.videoDurationSec}s</span>
        )}

        {/* Copyright checks card */}
        <div className="w-[200px] rounded-xl border border-brand-divider bg-[#F9FAFB] p-3">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-brand-text/60" />
            <span className="text-[12px] font-semibold text-brand-highlight">Checks</span>
          </div>
          {state.copyrightCheck ? (
            <div className="space-y-1.5">
              {state.copyrightCheck.status === "checking" && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Checking copyright...
                </div>
              )}
              {state.copyrightCheck.status === "none_found" && (
                <div className="flex items-center gap-1.5 text-[11px] text-green-600">
                  <Check className="h-3 w-3" />
                  No issues found
                </div>
              )}
              {state.copyrightCheck.status === "claim_found" && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    Copyright claim(s)
                  </div>
                  {state.copyrightCheck.claims?.map((claim) => (
                    <div key={claim.id} className="rounded-lg bg-red-50 px-2 py-1.5 text-[10px] text-red-600">
                      <p className="font-medium">{claim.asset}</p>
                      <p className="text-red-400">by {claim.claimant} — {claim.policy}</p>
                    </div>
                  ))}
                </div>
              )}
              {state.copyrightCheck.status === "error" && (
                <div className="flex items-center gap-1.5 text-[11px] text-brand-text/60">
                  <Info className="h-3 w-3" />
                  Could not check
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-brand-text/60">
              Checks will run after processing
            </p>
          )}
        </div>
      </div>

      {/* Right — Details form */}
      <div className="flex w-[480px] flex-col gap-0 overflow-y-auto pr-2">
        {/* ── Title (required) ── */}
        <div className="pb-4 border-b border-brand-divider">
          <label htmlFor="reel-title" className="mb-2 block text-[13px] font-semibold text-brand-text">
            Title <span className="text-red-400">*</span>
          </label>
          <input
            id="reel-title"
            type="text"
            value={state.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Add a title that describes your reel"
            maxLength={100}
            className="w-full rounded-xl border border-brand-divider bg-[#F9FAFB] px-4 py-2.5 text-[14px] text-brand-text placeholder:text-brand-text/30 outline-none transition focus:border-brand-text/30 focus:ring-2 focus:ring-brand-secondary"
          />
          <p className="mt-1 text-right text-[11px] text-brand-text/30">{state.title.length}/100</p>
        </div>

        {/* ── Description / Caption ── */}
        <div className="py-4 border-b border-brand-divider">
          <label htmlFor="caption" className="mb-2 block text-[13px] font-semibold text-brand-text">
            Description
          </label>
          <textarea
            id="caption"
            value={state.caption}
            onChange={(e) => patch({ caption: e.target.value })}
            placeholder="Tell viewers about your reel. Use #hashtags and @mentions."
            maxLength={REEL_LIMITS.MAX_CAPTION_LENGTH}
            rows={4}
            className="w-full resize-none rounded-xl border border-brand-divider bg-[#F9FAFB] px-4 py-3 text-[14px] text-brand-text placeholder:text-brand-text/30 outline-none transition focus:border-brand-text/30 focus:ring-2 focus:ring-brand-secondary"
          />
          <div className="mt-1.5 flex items-center justify-between px-1">
            <span className="text-[11px] text-brand-text/30">
              {state.caption.length} / {REEL_LIMITS.MAX_CAPTION_LENGTH.toLocaleString()}
            </span>
            {captionHashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {captionHashtags.slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-0.5 rounded-full bg-brand-secondary px-2 py-0.5 text-[11px] font-medium text-brand-highlight"
                  >
                    <Hash className="h-2.5 w-2.5" />
                    {tag.slice(1)}
                  </span>
                ))}
                {captionHashtags.length > 5 && (
                  <span className="text-[11px] text-brand-text/30">
                    +{captionHashtags.length - 5} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Audience / COPPA ── */}
        <div className="py-4 border-b border-brand-divider">
          <label className="mb-2 block text-[13px] font-semibold text-brand-text">Audience</label>
          <p className="mb-3 text-[12px] text-brand-text/60">
            Is this reel made for kids? (Required by COPPA)
          </p>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#F9FAFB] px-4 py-3 transition hover:bg-brand-secondary">
              <input
                type="radio"
                name="audience-kids"
                checked={!state.isMadeForKids}
                onChange={() => patch({ isMadeForKids: false })}
                className="h-4 w-4 accent-slate-900"
              />
              <div>
                <span className="text-[13px] font-medium text-brand-text">No, it&apos;s not made for kids</span>
              </div>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#F9FAFB] px-4 py-3 transition hover:bg-brand-secondary">
              <input
                type="radio"
                name="audience-kids"
                checked={state.isMadeForKids}
                onChange={() => patch({ isMadeForKids: true })}
                className="h-4 w-4 accent-slate-900"
              />
              <div>
                <span className="text-[13px] font-medium text-brand-text">Yes, it&apos;s made for kids</span>
                <p className="text-[11px] text-brand-text/60">Features like comments and personalized ads will be restricted</p>
              </div>
            </label>
          </div>
        </div>

        {/* ── Collapsible advanced sections ── */}

        {/* Paid promotion */}
        <Section title="Paid promotion" icon={Tag} badge={state.paidPromotion ? "ON" : undefined}>
          <p className="mb-3 text-[12px] text-brand-text/60">
            Let viewers know if your reel contains paid promotion, sponsorship, or product placement.
          </p>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#F9FAFB] px-4 py-3 transition hover:bg-brand-secondary">
            <input
              type="checkbox"
              checked={state.paidPromotion}
              onChange={(e) => patch({ paidPromotion: e.target.checked })}
              className="h-4 w-4 rounded border-brand-text/30 accent-slate-900"
            />
            <div>
              <span className="text-[13px] font-medium text-brand-text">This reel contains paid promotion</span>
              <p className="text-[11px] text-brand-text/60">A &quot;Includes paid promotion&quot; label will be shown</p>
            </div>
          </label>
        </Section>

        {/* Altered content / AI disclosure */}
        <Section title="Altered content" icon={Sparkles} badge={state.alteredContent ? "ON" : undefined}>
          <p className="mb-3 text-[12px] text-brand-text/60">
            Disclose if your reel uses AI-generated or significantly altered content that could be mistaken as real.
          </p>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#F9FAFB] px-4 py-3 transition hover:bg-brand-secondary">
            <input
              type="checkbox"
              checked={state.alteredContent}
              onChange={(e) => patch({ alteredContent: e.target.checked })}
              className="h-4 w-4 rounded border-brand-text/30 accent-slate-900"
            />
            <div>
              <span className="text-[13px] font-medium text-brand-text">This reel uses altered or synthetic content</span>
              <p className="text-[11px] text-brand-text/60">Content that looks realistic but is AI-generated or digitally altered</p>
            </div>
          </label>
        </Section>

        {/* Smart features: chapters, places, concepts */}
        <Section title="Automatic features" icon={Sparkles} defaultOpen>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center justify-between rounded-xl bg-[#F9FAFB] px-4 py-3 transition hover:bg-brand-secondary">
              <div>
                <span className="text-[13px] font-medium text-brand-text">Automatic chapters</span>
                <p className="text-[11px] text-brand-text/60">Auto-generate chapters based on your content</p>
              </div>
              <input
                type="checkbox"
                checked={state.autoChapters}
                onChange={(e) => patch({ autoChapters: e.target.checked })}
                className="h-4 w-4 rounded border-brand-text/30 accent-slate-900"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded-xl bg-[#F9FAFB] px-4 py-3 transition hover:bg-brand-secondary">
              <div>
                <span className="text-[13px] font-medium text-brand-text">Featured places</span>
                <p className="text-[11px] text-brand-text/60">Allow automatic detection and tagging of locations</p>
              </div>
              <input
                type="checkbox"
                checked={state.featuredPlaces}
                onChange={(e) => patch({ featuredPlaces: e.target.checked })}
                className="h-4 w-4 rounded border-brand-text/30 accent-slate-900"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded-xl bg-[#F9FAFB] px-4 py-3 transition hover:bg-brand-secondary">
              <div>
                <span className="text-[13px] font-medium text-brand-text">Automatic concepts</span>
                <p className="text-[11px] text-brand-text/60">Auto-tag concepts and topics from your content</p>
              </div>
              <input
                type="checkbox"
                checked={state.autoConcepts}
                onChange={(e) => patch({ autoConcepts: e.target.checked })}
                className="h-4 w-4 rounded border-brand-text/30 accent-slate-900"
              />
            </label>
          </div>
        </Section>

        {/* Tags */}
        <Section title="Tags" icon={Tag} badge={state.tags.length > 0 ? `${state.tags.length}` : undefined}>
          <p className="mb-3 text-[12px] text-brand-text/60">
            Tags help with search discovery. Add keywords that describe your content.
          </p>
          <TagInput
            tags={state.tags}
            onChange={(tags) => patch({ tags })}
            placeholder="Add a tag..."
            max={500}
          />
        </Section>

        {/* Category & Topic */}
        <Section title="Category & Topic" icon={Film} defaultOpen>
          <div className="space-y-4">
            <div>
              <label htmlFor="category" className="mb-1.5 block text-[12px] font-medium text-brand-highlight">Category</label>
              <select
                id="category"
                value={state.category}
                onChange={(e) => patch({ category: e.target.value })}
                className="w-full rounded-xl border border-brand-divider bg-[#F9FAFB] px-4 py-2.5 text-[13px] text-brand-text outline-none transition focus:border-brand-text/30 focus:ring-2 focus:ring-brand-secondary"
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-brand-highlight">Topic</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => patch({ topicId: null })}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                    state.topicId === null
                      ? "bg-slate-900 text-white"
                      : "bg-[#F5F5F7] text-brand-highlight hover:bg-brand-secondary/70"
                  }`}
                >
                  None
                </button>
                {topics.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => patch({ topicId: topic.id })}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                      state.topicId === topic.id
                        ? "bg-slate-900 text-white"
                        : "bg-[#F5F5F7] text-brand-highlight hover:bg-brand-secondary/70"
                    }`}
                  >
                    {topic.icon ? `${topic.icon} ` : ""}{topic.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Language & captions */}
        <Section title="Language & captions certification" icon={Globe}>
          <div className="space-y-4">
            <div>
              <label htmlFor="language" className="mb-1.5 block text-[12px] font-medium text-brand-highlight">
                Video language
              </label>
              <select
                id="language"
                value={state.language}
                onChange={(e) => patch({ language: e.target.value })}
                className="w-full rounded-xl border border-brand-divider bg-[#F9FAFB] px-4 py-2.5 text-[13px] text-brand-text outline-none transition focus:border-brand-text/30 focus:ring-2 focus:ring-brand-secondary"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>{lang.label}</option>
                ))}
              </select>
            </div>
            <div className="rounded-xl bg-brand-secondary px-4 py-3">
              <p className="text-[12px] text-brand-highlight">
                Captions certification: This reel has never aired on television in the U.S.
              </p>
            </div>
          </div>
        </Section>

        {/* Recording date & location */}
        <Section title="Recording date & location" icon={MapPin}>
          <div className="space-y-4">
            <div>
              <label htmlFor="recording-date" className="mb-1.5 block text-[12px] font-medium text-brand-highlight">
                Recording date
              </label>
              <input
                id="recording-date"
                type="date"
                value={state.recordingDate}
                onChange={(e) => patch({ recordingDate: e.target.value })}
                className="w-full rounded-xl border border-brand-divider bg-[#F9FAFB] px-4 py-2.5 text-[13px] text-brand-text outline-none transition focus:border-brand-text/30 focus:ring-2 focus:ring-brand-secondary"
              />
            </div>
            <div>
              <label htmlFor="recording-location" className="mb-1.5 block text-[12px] font-medium text-brand-highlight">
                Video location
              </label>
              <input
                id="recording-location"
                type="text"
                value={state.recordingLocation}
                onChange={(e) => patch({ recordingLocation: e.target.value })}
                placeholder="Search for a location..."
                className="w-full rounded-xl border border-brand-divider bg-[#F9FAFB] px-4 py-2.5 text-[13px] text-brand-text placeholder:text-brand-text/30 outline-none transition focus:border-brand-text/30 focus:ring-2 focus:ring-brand-secondary"
              />
            </div>
          </div>
        </Section>

        {/* License & distribution */}
        <Section title="License & distribution" icon={Shield}>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-brand-highlight">License</label>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#F9FAFB] px-4 py-3 transition hover:bg-brand-secondary">
                  <input
                    type="radio"
                    name="license"
                    checked={state.license === "standard"}
                    onChange={() => patch({ license: "standard" })}
                    className="h-4 w-4 accent-slate-900"
                  />
                  <span className="text-[13px] font-medium text-brand-text">Standard VChat License</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#F9FAFB] px-4 py-3 transition hover:bg-brand-secondary">
                  <input
                    type="radio"
                    name="license"
                    checked={state.license === "creative_commons"}
                    onChange={() => patch({ license: "creative_commons" })}
                    className="h-4 w-4 accent-slate-900"
                  />
                  <span className="text-[13px] font-medium text-brand-text">Creative Commons — Attribution</span>
                </label>
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-xl bg-[#F9FAFB] px-4 py-3 transition hover:bg-brand-secondary">
              <div>
                <span className="text-[13px] font-medium text-brand-text">Allow embedding</span>
                <p className="text-[11px] text-brand-text/60">Allow others to embed this reel on their websites</p>
              </div>
              <input
                type="checkbox"
                checked={state.allowEmbedding}
                onChange={(e) => patch({ allowEmbedding: e.target.checked })}
                className="h-4 w-4 rounded border-brand-text/30 accent-slate-900"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between rounded-xl bg-[#F9FAFB] px-4 py-3 transition hover:bg-brand-secondary">
              <div>
                <span className="text-[13px] font-medium text-brand-text">Publish to subscriptions feed</span>
                <p className="text-[11px] text-brand-text/60">Notify subscribers and show in their feed</p>
              </div>
              <input
                type="checkbox"
                checked={state.publishToFeed}
                onChange={(e) => patch({ publishToFeed: e.target.checked })}
                className="h-4 w-4 rounded border-brand-text/30 accent-slate-900"
              />
            </label>
          </div>
        </Section>

        {/* Remixing */}
        <Section title="Reels remixing" icon={Film}>
          <p className="mb-3 text-[12px] text-brand-text/60">
            Choose how others can remix your content.
          </p>
          <div className="space-y-2">
            {(
              [
                { value: "allow", label: "Allow remixing", desc: "Others can create remixes using your reel" },
                { value: "allow_audio_only", label: "Audio only", desc: "Others can use your audio but not video" },
                { value: "disallow", label: "Don't allow remixing", desc: "Nobody can remix this reel" },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#F9FAFB] px-4 py-3 transition hover:bg-brand-secondary"
              >
                <input
                  type="radio"
                  name="remix"
                  checked={state.remixSetting === opt.value}
                  onChange={() => patch({ remixSetting: opt.value })}
                  className="h-4 w-4 accent-slate-900"
                />
                <div>
                  <span className="text-[13px] font-medium text-brand-text">{opt.label}</span>
                  <p className="text-[11px] text-brand-text/60">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </Section>

        {/* Comments & moderation */}
        <Section title="Comments & ratings" icon={MessageSquare} defaultOpen>
          <div className="space-y-4">
            {/* Likes toggle */}
            <div className="flex items-center justify-between rounded-xl bg-[#F9FAFB] px-4 py-3">
              <div>
                <span className="text-[13px] font-medium text-brand-text">Show likes</span>
                <p className="text-[11px] text-brand-text/60">Allow viewers to see like count and react</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={state.likesEnabled}
                onClick={() => patch({ likesEnabled: !state.likesEnabled })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 ${
                  state.likesEnabled ? "bg-slate-900" : "bg-brand-secondary"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-brand-card shadow ring-0 transition duration-200 ease-in-out ${
                    state.likesEnabled ? "translate-x-[22px]" : "translate-x-[2px]"
                  } mt-[2px]`}
                />
              </button>
            </div>

            {/* Comments toggle */}
            <div className="flex items-center justify-between rounded-xl bg-[#F9FAFB] px-4 py-3">
              <div>
                <span className="text-[13px] font-medium text-brand-text">Enable comments</span>
                <p className="text-[11px] text-brand-text/60">Allow viewers to post comments on this reel</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={state.commentsEnabled}
                onClick={() => patch({ commentsEnabled: !state.commentsEnabled })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 ${
                  state.commentsEnabled ? "bg-slate-900" : "bg-brand-secondary"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-brand-card shadow ring-0 transition duration-200 ease-in-out ${
                    state.commentsEnabled ? "translate-x-[22px]" : "translate-x-[2px]"
                  } mt-[2px]`}
                />
              </button>
            </div>

            {state.commentsEnabled && (
              <>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-brand-highlight">
                    Who can comment
                  </label>
                  <select
                    value={state.commentAccess}
                    onChange={(e) => patch({ commentAccess: e.target.value as CommentAccess })}
                    className="w-full rounded-xl border border-brand-divider bg-[#F9FAFB] px-4 py-2.5 text-[13px] text-brand-text outline-none transition focus:border-brand-text/30 focus:ring-2 focus:ring-brand-secondary"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="followers">Followers only</option>
                    <option value="nobody">Nobody</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-brand-highlight">
                    Comment moderation
                  </label>
                  <select
                    value={state.commentModeration}
                    onChange={(e) => patch({ commentModeration: e.target.value as CommentModeration })}
                    className="w-full rounded-xl border border-brand-divider bg-[#F9FAFB] px-4 py-2.5 text-[13px] text-brand-text outline-none transition focus:border-brand-text/30 focus:ring-2 focus:ring-brand-secondary"
                  >
                    <option value="none">None</option>
                    <option value="basic">Basic — hold potentially inappropriate comments</option>
                    <option value="strict">Strict — hold all comments with links or keywords</option>
                    <option value="hold_all">Hold all comments for review</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Cross-post */}
        <Section title="Cross-post" icon={Send} defaultOpen>
          <div className="flex items-center justify-between rounded-xl bg-[#F9FAFB] px-4 py-3">
            <div>
              <span className="text-[13px] font-medium text-brand-text">Publish to Feed</span>
              <p className="text-[11px] text-brand-text/60">Share as a post on your Feed</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={state.crossPostPostbook}
              onClick={() => patch({ crossPostPostbook: !state.crossPostPostbook })}
              className={`relative inline-flex h-7 w-[52px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
                state.crossPostPostbook ? "bg-[#E8527A]" : "bg-[#D1D1D1]"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-brand-card shadow-md transition-transform duration-200 ${
                  state.crossPostPostbook ? "translate-x-[26px]" : "translate-x-[3px]"
                }`}
              />
            </button>
          </div>
        </Section>

        {/* SEO Title */}
        <Section title="SEO & metadata" icon={Code2}>
          <div>
            <label htmlFor="seo-title" className="mb-1.5 block text-[12px] font-medium text-brand-highlight">
              SEO Title
            </label>
            <input
              id="seo-title"
              type="text"
              value={state.seoTitle}
              onChange={(e) => patch({ seoTitle: e.target.value })}
              placeholder="Custom title for search engines"
              maxLength={120}
              className="w-full rounded-xl border border-brand-divider bg-[#F9FAFB] px-4 py-2.5 text-[13px] text-brand-text placeholder:text-brand-text/30 outline-none transition focus:border-brand-text/30 focus:ring-2 focus:ring-brand-secondary"
            />
            <p className="mt-1 text-right text-[11px] text-brand-text/30">{state.seoTitle.length}/120</p>
          </div>
        </Section>

        {/* Spacer */}
        <div className="h-6" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STEP 4: REVIEW & PUBLISH (with visibility + scheduling)
   ═══════════════════════════════════════════════════════════ */

function StepReview({
  state,
  patch,
  onPublish,
  onSaveDraft,
  publishPending,
  saveDraftPending,
  publishError,
}: {
  state: ReturnType<typeof useCreateReel>["state"];
  patch: (u: Partial<ReturnType<typeof useCreateReel>["state"]>) => void;
  onPublish: () => void;
  onSaveDraft: () => void;
  publishPending: boolean;
  saveDraftPending: boolean;
  publishError: boolean;
}) {
  const captionHashtags = state.caption.match(/#\w+/g) ?? [];
  const [showSchedule, setShowSchedule] = useState(!!state.scheduleAt);

  return (
    <div className="flex flex-1 min-h-0 justify-center gap-10 px-10 py-8">
      {/* Left — Video preview */}
      <div className="flex flex-col items-center gap-3 shrink-0">
        <div className="relative aspect-[9/16] w-[280px] overflow-hidden rounded-[20px] bg-brand-secondary shadow-[0_8px_30px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)]">
          {state.videoPreviewUrl && (
            <video
              src={state.videoPreviewUrl}
              className="h-full w-full object-cover"
              muted
              loop
              autoPlay
              playsInline
            />
          )}
          {state.caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-10">
              <p className="text-[13px] text-white line-clamp-3">{state.caption}</p>
            </div>
          )}
        </div>
      </div>

      {/* Right — Visibility + Summary */}
      <div className="flex w-[420px] flex-col gap-5 overflow-y-auto pr-2">
        <h2 className="text-[18px] font-bold text-brand-text">Visibility</h2>

        {/* Visibility selector */}
        <VisibilitySelector
          value={state.visibility}
          onChange={(v) => patch({ visibility: v })}
        />

        {/* Schedule toggle */}
        <div className="rounded-2xl border border-brand-divider bg-[#F9FAFB] p-4 space-y-3">
          <label className="flex cursor-pointer items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-brand-text/60" />
              <span className="text-[13px] font-semibold text-brand-text">Schedule</span>
            </div>
            <input
              type="checkbox"
              checked={showSchedule}
              onChange={(e) => {
                setShowSchedule(e.target.checked);
                if (!e.target.checked) patch({ scheduleAt: null });
              }}
              className="h-4 w-4 rounded border-brand-text/30 accent-slate-900"
            />
          </label>
          {showSchedule && (
            <div className="space-y-3 pt-1">
              <p className="text-[12px] text-brand-text/60">
                Set a date and time for this reel to go live automatically.
              </p>
              <input
                type="datetime-local"
                value={state.scheduleAt ?? ""}
                onChange={(e) => patch({ scheduleAt: e.target.value || null })}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full rounded-xl border border-brand-divider bg-brand-card px-4 py-2.5 text-[13px] text-brand-text outline-none transition focus:border-brand-text/30 focus:ring-2 focus:ring-brand-secondary"
              />
            </div>
          )}
        </div>

        {/* Summary card */}
        <div className="rounded-2xl border border-brand-divider bg-[#F9FAFB] p-5 space-y-4">
          <h3 className="text-[14px] font-bold text-brand-text">Summary</h3>

          {/* Title */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/30 mb-0.5">Title</p>
            <p className="text-[13px] text-brand-text">
              {state.title || <span className="italic text-brand-text/30">No title</span>}
            </p>
          </div>

          {/* Caption preview */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/30 mb-0.5">Description</p>
            <p className="text-[13px] text-brand-text line-clamp-2">
              {state.caption || <span className="italic text-brand-text/30">No description</span>}
            </p>
          </div>

          {/* Hashtags */}
          {captionHashtags.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/30 mb-1">Hashtags</p>
              <div className="flex flex-wrap gap-1">
                {captionHashtags.map((tag) => (
                  <span key={tag} className="rounded-full bg-brand-secondary px-2 py-0.5 text-[11px] font-medium text-brand-highlight">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {state.tags.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/30 mb-1">Tags</p>
              <div className="flex flex-wrap gap-1">
                {state.tags.slice(0, 10).map((tag) => (
                  <span key={tag} className="rounded-full bg-brand-secondary px-2 py-0.5 text-[11px] font-medium text-brand-highlight">
                    {tag}
                  </span>
                ))}
                {state.tags.length > 10 && (
                  <span className="text-[11px] text-brand-text/30">+{state.tags.length - 10} more</span>
                )}
              </div>
            </div>
          )}

          {/* Settings grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/30 mb-0.5">Visibility</p>
              <p className="text-[13px] font-medium text-brand-text capitalize">{state.visibility}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/30 mb-0.5">Language</p>
              <p className="text-[13px] font-medium text-brand-text uppercase">{state.language}</p>
            </div>
            {state.category && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/30 mb-0.5">Category</p>
                <p className="text-[13px] font-medium text-brand-text">{state.category}</p>
              </div>
            )}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/30 mb-0.5">License</p>
              <p className="text-[13px] font-medium text-brand-text">
                {state.license === "creative_commons" ? "CC-BY" : "Standard"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/30 mb-0.5">Likes</p>
              <p className="text-[13px] font-medium text-brand-text">{state.likesEnabled ? "On" : "Off"}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/30 mb-0.5">Comments</p>
              <p className="text-[13px] font-medium text-brand-text">
                {state.commentsEnabled ? `On (${state.commentModeration})` : "Off"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/30 mb-0.5">Embedding</p>
              <p className="text-[13px] font-medium text-brand-text">{state.allowEmbedding ? "Allowed" : "Blocked"}</p>
            </div>
          </div>

          {/* Disclosure badges */}
          {(state.paidPromotion || state.alteredContent || state.isMadeForKids) && (
            <div className="flex flex-wrap gap-2">
              {state.paidPromotion && (
                <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
                  Paid promotion
                </span>
              )}
              {state.alteredContent && (
                <span className="rounded-full bg-brand-card border border-brand-divider px-2.5 py-0.5 text-[11px] font-medium text-brand-text">
                  Altered content
                </span>
              )}
              {state.isMadeForKids && (
                <span className="rounded-full bg-brand-card border border-brand-divider px-2.5 py-0.5 text-[11px] font-medium text-brand-text">
                  Made for kids
                </span>
              )}
            </div>
          )}

          {/* Cross-post */}
          {state.crossPostPostbook && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/30 mb-1">Cross-post</p>
              <span className="rounded-full bg-[#E8527A]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#E8527A]">
                Feed
              </span>
            </div>
          )}

          {/* Schedule */}
          {state.scheduleAt && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/30 mb-0.5">Scheduled for</p>
              <p className="text-[13px] font-medium text-brand-text">
                {new Date(state.scheduleAt).toLocaleString()}
              </p>
            </div>
          )}

          {/* Processing status */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/30 mb-1">Processing</p>
            <div className="flex items-center gap-2">
              {state.processingReady ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-[12px] text-green-600">Video ready</span>
                </>
              ) : (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                  <span className="text-[12px] text-amber-600">
                    Processing — you can publish now, it will go live when ready
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {publishError && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">
            Failed to publish. Please try again.
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={saveDraftPending}
            className="flex items-center gap-2 rounded-full bg-[#F5F5F7] px-5 py-3 text-[13px] font-semibold text-brand-highlight transition hover:bg-brand-secondary/70 disabled:opacity-40"
          >
            {saveDraftPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            Save Draft
          </button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={onPublish}
            disabled={publishPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-[14px] font-bold text-white shadow-sm transition hover:bg-brand-text disabled:opacity-40"
          >
            {publishPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {state.scheduleAt ? "Scheduling..." : "Publishing..."}
              </>
            ) : (
              <>
                {state.scheduleAt ? (
                  <Calendar className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {state.scheduleAt ? "Schedule Reel" : "Publish Reel"}
              </>
            )}
          </motion.button>
        </div>

        <p className="text-[12px] leading-relaxed text-brand-text/30">
          {state.scheduleAt
            ? "Your reel will be published at the scheduled time. You can edit or cancel from drafts."
            : "Your reel will appear in the Reels feed after processing. Video processing may take a few moments depending on length and quality."}
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════ */

export function CreateReelPage() {
  return (
    <ChannelGate>
      {(_channel) => <CreateReelWizard />}
    </ChannelGate>
  );
}

function CreateReelWizard() {
  const {
    state,
    patch,
    selectFile,
    clearFile,
    uploadMutation,
    extractCoverMutation,
    saveDraftMutation,
    publishMutation,
    goToStep,
    canGoNext,
    nextStep,
    prevStep,
  } = useCreateReel();

  const stepIndex = STEP_META.findIndex((s) => s.key === state.step);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-brand-card">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-brand-divider px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/reels"
            className="flex items-center gap-2 text-[13px] font-medium text-brand-highlight transition hover:text-brand-text"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="h-5 w-px bg-brand-secondary" />
          <h1 className="text-[15px] font-bold text-brand-text">Create Reel</h1>
        </div>

        <StepIndicator currentStep={state.step} onStepClick={goToStep} />

        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={prevStep}
              className="flex items-center gap-1.5 rounded-full bg-[#F5F5F7] px-4 py-2 text-[12px] font-medium text-brand-highlight transition hover:bg-brand-secondary/70"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}
          {stepIndex < STEP_META.length - 1 && (
            <button
              type="button"
              onClick={nextStep}
              disabled={!canGoNext()}
              className="flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-[12px] font-bold text-white shadow-sm transition hover:bg-brand-text disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={state.step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="flex flex-1 min-h-0"
        >
          {state.step === "upload" && (
            <StepUpload
              state={state}
              selectFile={selectFile}
              clearFile={clearFile}
              onUpload={() => uploadMutation.mutate()}
              isPending={uploadMutation.isPending}
            />
          )}

          {state.step === "edit" && (
            <StepEdit
              state={state}
              patch={patch}
              onExtractCover={(ms) => extractCoverMutation.mutate(ms)}
              extractCoverPending={extractCoverMutation.isPending}
            />
          )}

          {state.step === "details" && (
            <StepDetails state={state} patch={patch} />
          )}

          {state.step === "review" && (
            <StepReview
              state={state}
              patch={patch}
              onPublish={() => publishMutation.mutate(
                state.scheduleAt ? { scheduleAt: state.scheduleAt } : undefined
              )}
              onSaveDraft={() => saveDraftMutation.mutate()}
              publishPending={publishMutation.isPending}
              saveDraftPending={saveDraftMutation.isPending}
              publishError={publishMutation.isError}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

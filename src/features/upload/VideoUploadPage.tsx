"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Upload,
  Film,
  Clapperboard,
  Mic,
  Sparkles,
  X,
  FileVideo,
  Loader2,
  Check,
  ChevronDown,
  Globe,
  Lock,
  Users,
  EyeOff,
  Image as ImageIcon,
} from "lucide-react";
import { AppShell } from "@/features/reels/components/AppShell";

/* ── Upload type config ─────────────────────────────────── */

export type UploadType = "long" | "short" | "reel" | "podcast";

const TYPE_CONFIG: Record<
  UploadType,
  { title: string; section: string; icon: typeof Film; acceptHint: string; accept: string; aspect: string }
> = {
  long:    { title: "Upload Video",        section: "Upload",  icon: Film,         acceptHint: "MP4, MOV, or WebM up to 10 GB",       accept: "video/*",                              aspect: "16/9" },
  short:   { title: "Upload Flick / Clip", section: "Upload",  icon: Clapperboard, acceptHint: "Vertical MP4 or MOV, up to 3 min",    accept: "video/*",                              aspect: "9/16" },
  reel:    { title: "Create Flick",        section: "Flicks",  icon: Sparkles,     acceptHint: "MP4, WebM, MOV — max 500 MB, 3 min",  accept: "video/mp4,video/webm,video/quicktime", aspect: "9/16" },
  podcast: { title: "Upload Podcast",      section: "Podcast", icon: Mic,          acceptHint: "MP3, M4A, WAV, or MP4 up to 2 GB",    accept: "video/*,audio/*",                      aspect: "1/1" },
};

const CATEGORIES = [
  "Film & Animation", "Music", "Gaming", "Entertainment", "Comedy",
  "Education", "Science & Technology", "Sports", "Travel & Events",
  "People & Blogs", "Howto & Style", "News & Politics", "Pets & Animals",
  "Nonprofits & Activism", "Other",
];

const VISIBILITY_OPTIONS = [
  { value: "public",    label: "Public",    icon: Globe },
  { value: "unlisted",  label: "Unlisted",  icon: EyeOff },
  { value: "followers", label: "Followers", icon: Users },
  { value: "private",   label: "Private",   icon: Lock },
];

/* ── Client-side poster frame extraction ────────────────── */

function extractFrameClientSide(videoUrl: string, timestampMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.onloadedmetadata = () => { video.currentTime = timestampMs / 1000; };
    video.onseeked = () => {
      requestAnimationFrame(() => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Canvas not supported")); return; }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          video.removeAttribute("src");
          video.load();
          resolve(dataUrl);
        } catch (err) { reject(err); }
      });
    };
    video.onerror = () => reject(new Error("Failed to load video"));
    video.src = videoUrl;
  });
}

/* ── Helpers ─────────────────────────────────────────────── */

function fmtMs(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
}

function StepDot({ done }: { done: boolean }) {
  return done ? (
    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 shrink-0">
      <Check className="h-3 w-3 text-white" strokeWidth={3} />
    </div>
  ) : (
    <div className="h-5 w-5 rounded-full border-2 border-brand-divider shrink-0" />
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export function VideoUploadPage({ type }: { type: UploadType }) {
  const config = TYPE_CONFIG[type];
  const isPodcast = type === "podcast";
  const isVertical = type === "short" || type === "reel";
  const thumbAspect = isVertical ? "9/16" : config.aspect;

  const fileRef = useRef<HTMLInputElement>(null);
  const posterRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [posterTs, setPosterTs] = useState<number | null>(null);
  const [extracting, setExtracting] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState("public");

  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  /* ── file handling ── */
  const pickFile = useCallback((f: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPosterPreview(null);
    setPosterTs(null);
    setDuration(null);
    if (f.type.startsWith("video/")) {
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
      const vid = document.createElement("video");
      vid.preload = "metadata";
      vid.src = url;
      vid.onloadedmetadata = () => {
        setDuration(Math.round(vid.duration));
        setPosterTs(Math.round((vid.duration / 2) * 1000));
        vid.removeAttribute("src");
        vid.load();
      };
    } else {
      setPreviewUrl(null);
    }
  }, [previewUrl]);

  const clearFile = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null); setPreviewUrl(null); setDuration(null);
    setPosterPreview(null); setPosterTs(null);
  }, [previewUrl]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }, [pickFile]);

  /* ── poster ── */
  const onPosterFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (posterPreview?.startsWith("blob:")) URL.revokeObjectURL(posterPreview);
    setPosterPreview(URL.createObjectURL(f));
  }, [posterPreview]);

  const extractPoster = useCallback(async () => {
    if (!previewUrl || posterTs == null) return;
    setExtracting(true);
    try {
      setPosterPreview(await extractFrameClientSide(previewUrl, posterTs));
    } catch {
      posterRef.current?.click();
    } finally {
      setExtracting(false);
    }
  }, [previewUrl, posterTs]);

  /* ── publish ── */
  const handlePublish = useCallback(async () => {
    if (!file || !title.trim()) return;
    setPublishing(true);
    await new Promise((r) => setTimeout(r, 2000));
    setPublishing(false);
    setPublished(true);
  }, [file, title]);

  const canPublish = !!file && !!title.trim();

  const reset = useCallback(() => {
    clearFile(); setPublished(false);
    setTitle(""); setDescription(""); setTags(""); setCategory("");
  }, [clearFile]);

  const visIcon = VISIBILITY_OPTIONS.find((v) => v.value === visibility)?.icon ?? Globe;
  const VisIcon = visIcon;

  return (
    <AppShell sectionLabel={config.section}>
      <div className="mx-auto max-w-[960px] px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D8103F]/5">
              <config.icon className="h-5 w-5 text-[#D8103F]" />
            </div>
            <div>
              <h1 className="text-[17px] font-bold text-brand-text">{config.title}</h1>
              <p className="text-[12px] text-brand-text/60">Fill in the details below and publish</p>
            </div>
          </div>
          {file && !published && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || !canPublish}
              className="flex items-center gap-2 rounded-xl bg-[#D8103F] px-6 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-[#b80d35] disabled:opacity-40 transition-all"
            >
              {publishing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Publishing...</> : "Publish"}
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Success ── */}
          {published ? (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
                <Check className="h-7 w-7 text-emerald-600" />
              </div>
              <h2 className="mt-5 text-xl font-bold text-brand-text">Published!</h2>
              <p className="mt-2 text-[13px] text-brand-highlight">Your content is being processed and will appear shortly.</p>
              <div className="mt-6 flex gap-3">
                <Link href="/reels" className="rounded-xl bg-slate-100 px-5 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-200">Back to Feed</Link>
                <button type="button" onClick={reset} className="rounded-xl bg-[#D8103F] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#b80d35]">Upload Another</button>
              </div>
            </motion.div>

          ) : !file ? (
            /* ── Dropzone ── */
            <motion.div key="drop" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-divider bg-brand-secondary/50 py-24 transition-colors hover:border-[#D8103F]/30 hover:bg-[#D8103F]/30"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 group-hover:bg-[#D8103F]/10 transition-colors">
                  <Upload className="h-7 w-7 text-brand-text/60 group-hover:text-[#D8103F]/50" />
                </div>
                <p className="mt-5 text-[15px] font-semibold text-slate-700">Drag & drop your file here</p>
                <p className="mt-1.5 text-[13px] text-brand-text/60">or click to browse</p>
                <p className="mt-4 text-[11px] text-slate-300">{config.acceptHint}</p>
                <input ref={fileRef} type="file" accept={config.accept} onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }} className="hidden" />
              </div>
            </motion.div>

          ) : (
            /* ── Form ── */
            <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-[1fr_280px] gap-8">

              {/* ─── LEFT: Details form ─── */}
              <div className="space-y-6">
                {/* Section 1: File */}
                <section className="rounded-2xl border border-brand-divider/60 bg-brand-card p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <StepDot done={true} />
                    <h2 className="text-[13px] font-bold text-slate-800">File</h2>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-brand-secondary px-4 py-3">
                    <FileVideo className="h-4 w-4 shrink-0 text-[#D8103F]/50" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-slate-800">{file.name}</p>
                      <p className="text-[11px] text-brand-text/60">
                        {(file.size / (1024 * 1024)).toFixed(1)} MB
                        {duration != null && <> · {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}</>}
                      </p>
                    </div>
                    <button type="button" onClick={() => { fileRef.current?.click(); }} className="text-[11px] font-semibold text-[#D8103F] hover:text-[#b80d35]">Change</button>
                    <button type="button" onClick={clearFile} className="flex h-6 w-6 items-center justify-center rounded-full text-brand-text/60 hover:bg-slate-200 hover:text-brand-highlight">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input ref={fileRef} type="file" accept={config.accept} onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }} className="hidden" />
                </section>

                {/* Section 2: Details */}
                <section className="rounded-2xl border border-brand-divider/60 bg-brand-card p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-5">
                    <StepDot done={!!(title.trim() && category)} />
                    <h2 className="text-[13px] font-bold text-slate-800">Details</h2>
                    <span className="text-[11px] text-brand-text/60">— required fields marked with *</span>
                  </div>

                  <div className="space-y-5">
                    {/* Title */}
                    <div>
                      <label className="mb-1.5 flex items-center justify-between">
                        <span className="text-[12px] font-semibold text-slate-700">Title <span className="text-rose-400">*</span></span>
                        <span className="text-[11px] text-slate-300">{title.length}/100</span>
                      </label>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={100}
                        autoFocus
                        className="h-11 w-full rounded-xl border border-brand-divider bg-brand-secondary px-4 text-[14px] text-slate-800 placeholder:text-slate-300 outline-none focus:border-[#D8103F]/30 focus:bg-brand-card focus:ring-2 focus:ring-[#D8103F]/10 transition-all"
                        placeholder="Add a title that describes your content"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="mb-1.5 flex items-center justify-between">
                        <span className="text-[12px] font-semibold text-slate-700">Description</span>
                        <span className="text-[11px] text-slate-300">{description.length}/5000</span>
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        maxLength={5000}
                        rows={4}
                        className="w-full rounded-xl border border-brand-divider bg-brand-secondary px-4 py-3 text-[13px] text-slate-800 placeholder:text-slate-300 outline-none focus:border-[#D8103F]/30 focus:bg-brand-card focus:ring-2 focus:ring-[#D8103F]/10 resize-none transition-all"
                        placeholder="Tell viewers about your content. Use #hashtags and @mentions."
                      />
                    </div>

                    {/* Category + Visibility in a row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-[12px] font-semibold text-slate-700">Category <span className="text-rose-400">*</span></label>
                        <div className="relative">
                          <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="h-11 w-full appearance-none rounded-xl border border-brand-divider bg-brand-secondary px-4 pr-9 text-[13px] text-slate-800 outline-none focus:border-[#D8103F]/30 focus:bg-brand-card focus:ring-2 focus:ring-[#D8103F]/10 transition-all"
                          >
                            <option value="">Select category</option>
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text/60" />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[12px] font-semibold text-slate-700">Visibility</label>
                        <div className="relative">
                          <select
                            value={visibility}
                            onChange={(e) => setVisibility(e.target.value)}
                            className="h-11 w-full appearance-none rounded-xl border border-brand-divider bg-brand-secondary px-4 pr-9 text-[13px] text-slate-800 outline-none focus:border-[#D8103F]/30 focus:bg-brand-card focus:ring-2 focus:ring-[#D8103F]/10 transition-all"
                          >
                            {VISIBILITY_OPTIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                          </select>
                          <VisIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text/60" />
                        </div>
                      </div>
                    </div>

                    {/* Tags */}
                    <div>
                      <label className="mb-1.5 block text-[12px] font-semibold text-slate-700">Tags</label>
                      <input
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        className="h-11 w-full rounded-xl border border-brand-divider bg-brand-secondary px-4 text-[13px] text-slate-800 placeholder:text-slate-300 outline-none focus:border-[#D8103F]/30 focus:bg-brand-card focus:ring-2 focus:ring-[#D8103F]/10 transition-all"
                        placeholder="tech, tutorial, vlog (comma-separated)"
                      />
                    </div>
                  </div>
                </section>
              </div>

              {/* ─── RIGHT: Preview + Poster ─── */}
              <div className="space-y-5">
                {/* Preview card */}
                <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-4 shadow-sm">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-brand-text/60">Preview</p>
                  <div className="overflow-hidden rounded-xl border border-brand-divider bg-brand-card shadow-sm">
                    <div
                      className="flex items-center justify-center bg-slate-100"
                      style={{ aspectRatio: isVertical ? "9/16" : "16/9", maxHeight: isVertical ? "180px" : "140px" }}
                    >
                      {posterPreview ? (
                        <img src={posterPreview} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-300">
                          <Film className="h-5 w-5" />
                          <span className="text-[10px]">No poster yet</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="truncate text-[12px] font-semibold text-slate-800">{title || "Untitled"}</p>
                      <p className="mt-0.5 text-[11px] text-brand-text/60">
                        {category || "No category"} · {VISIBILITY_OPTIONS.find((v) => v.value === visibility)?.label ?? "Public"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Poster */}
                <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <StepDot done={!!posterPreview} />
                    <p className="text-[11px] font-bold uppercase tracking-widest text-brand-text/60">Poster</p>
                  </div>

                  <div
                    onClick={() => posterRef.current?.click()}
                    className="group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-brand-divider bg-brand-secondary transition-colors hover:border-[#D8103F]/30 hover:bg-[#D8103F]/30"
                    style={{ aspectRatio: isVertical ? "9/16" : "16/9", maxHeight: isVertical ? "180px" : "140px" }}
                  >
                    {posterPreview ? (
                      <>
                        <img src={posterPreview} alt="Poster" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPosterPreview(null); }}
                          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <ImageIcon className="h-5 w-5 text-slate-300" />
                        <span className="text-[11px] font-medium text-brand-text/60">Click to upload poster</span>
                      </div>
                    )}
                    <input ref={posterRef} type="file" accept="image/*" onChange={onPosterFile} className="hidden" />
                  </div>

                  {/* Extract poster from video */}
                  {previewUrl && !isPodcast && (
                    <div className="mt-3 rounded-xl bg-brand-secondary p-3">
                      <p className="mb-2 text-[11px] font-semibold text-brand-highlight">Extract from video</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="range" min={0} max={(duration ?? 30) * 1000} step={100}
                          value={posterTs ?? 0} onChange={(e) => setPosterTs(Number(e.target.value))}
                          className="flex-1 accent-[#D8103F]"
                        />
                        <span className="text-[11px] font-mono text-brand-highlight w-9 text-right">{fmtMs(posterTs ?? 0)}</span>
                      </div>
                      <button
                        type="button" onClick={extractPoster} disabled={extracting}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#D8103F] px-3 py-2 text-[11px] font-semibold text-white hover:bg-[#b80d35] disabled:opacity-40 transition-all"
                      >
                        {extracting ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
                        Extract Poster
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  PenSquare,
  ImagePlus,
  X,
  MapPin,
  Hash,
  Globe,
  Lock,
  Users,
  Loader2,
  Check,
  Sparkles,
} from "lucide-react";
import { Avatar } from "@/components/LetterAvatar";
import { useMyProfile } from "@/hooks/useEditProfile";
import { AppShell } from "@/features/reels/components/AppShell";
import api from "@/lib/api";

const VISIBILITY = [
  { value: "public", label: "Public", icon: Globe },
  { value: "friends", label: "Friends", icon: Users },
  { value: "private", label: "Only me", icon: Lock },
];

export default function CreatePostPage() {
  const { data: profile } = useMyProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState("");
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [visibility, setVisibility] = useState("public");
  const [location, setLocation] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  // AI suggestions state
  const [captionLoading, setCaptionLoading] = useState(false);
  const [captionSuggestions, setCaptionSuggestions] = useState<string[]>([]);
  const [hashtagLoading, setHashtagLoading] = useState(false);
  const [hashtagSuggestions, setHashtagSuggestions] = useState<string[]>([]);

  const displayName = profile?.display_name || "User";
  const avatarUrl = profile?.avatar_media_id
    ? `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/v1/media/${profile.avatar_media_id}/serve`
    : undefined;

  const handleImages = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages = files.slice(0, 4 - images.length).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setImages((prev) => [...prev, ...newImages].slice(0, 4));
  }, [images.length]);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handlePublish = useCallback(async () => {
    if (!content.trim() && images.length === 0) return;
    setPublishing(true);
    await new Promise((r) => setTimeout(r, 1500));
    setPublishing(false);
    setPublished(true);
  }, [content, images.length]);

  const handleCaptionSuggestions = useCallback(async () => {
    if (captionLoading) return;
    setCaptionLoading(true);
    setCaptionSuggestions([]);
    try {
      const res = await api.post("/v1/ai/caption-suggestions", {
        ref_id: "new",
        ref_type: "post",
        context_text: content,
      });
      const captions: string[] = res.data?.data?.captions ?? res.data?.captions ?? [];
      setCaptionSuggestions(captions);
    } catch {
      setCaptionSuggestions([]);
    } finally {
      setCaptionLoading(false);
    }
  }, [content, captionLoading]);

  const handleHashtagSuggestions = useCallback(async () => {
    if (hashtagLoading) return;
    setHashtagLoading(true);
    setHashtagSuggestions([]);
    try {
      const res = await api.post("/v1/ai/hashtag-suggestions", {
        ref_id: "new",
        ref_type: "post",
        context_text: content,
      });
      const tags: string[] = res.data?.data?.hashtags ?? res.data?.hashtags ?? [];
      setHashtagSuggestions(tags);
    } catch {
      setHashtagSuggestions([]);
    } finally {
      setHashtagLoading(false);
    }
  }, [content, hashtagLoading]);

  const visibilityOption = VISIBILITY.find((v) => v.value === visibility) || VISIBILITY[0];
  const VisIcon = visibilityOption.icon;

  return (
    <AppShell sectionLabel="Post">
      <div className="mx-auto max-w-[680px] px-6 py-8">
        {/* Page title + post button */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <PenSquare className="h-5 w-5 text-blue-500" />
            </div>
            <h1 className="text-[18px] font-bold text-brand-text">Create Post</h1>
          </div>
          {!published ? (
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || (!content.trim() && images.length === 0)}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-40"
            >
              {publishing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Posting...</> : "Post"}
            </button>
          ) : null}
        </div>

        <AnimatePresence mode="wait">
          {published ? (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
                <Check className="h-7 w-7 text-emerald-600" />
              </div>
              <h2 className="mt-5 text-xl font-bold text-brand-text">Posted!</h2>
              <p className="mt-2 text-[13px] text-brand-highlight">Your post is now live on your feed.</p>
              <div className="mt-6 flex gap-3">
                <Link href="/" className="rounded-xl bg-slate-100 px-5 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-200">Go to Feed</Link>
                <button type="button" onClick={() => { setPublished(false); setContent(""); setImages([]); }} className="rounded-xl bg-blue-600 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-700">Create Another</button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-6 shadow-sm">
                {/* Author row */}
                <div className="flex items-center gap-3 mb-4">
                  <Avatar src={avatarUrl} name={displayName} seed={profile?.id} size="md" className="border-2 border-white shadow-sm" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-brand-text">{displayName}</p>
                    <button
                      type="button"
                      onClick={() => {
                        const idx = VISIBILITY.findIndex((v) => v.value === visibility);
                        setVisibility(VISIBILITY[(idx + 1) % VISIBILITY.length].value);
                      }}
                      className="flex items-center gap-1 rounded-full bg-brand-secondary px-2 py-0.5 text-[10px] font-semibold text-brand-highlight hover:bg-slate-100"
                    >
                      <VisIcon className="h-3 w-3" />
                      {visibilityOption.label}
                    </button>
                  </div>
                </div>

                {/* Text */}
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={2000}
                  rows={6}
                  autoFocus
                  className="w-full resize-none border-0 bg-transparent text-[15px] leading-relaxed text-slate-800 placeholder:text-slate-300 outline-none"
                  placeholder="What's on your mind?"
                />

                {/* AI Suggestions */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCaptionSuggestions}
                      disabled={captionLoading}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold border border-violet-200 text-violet-600 bg-violet-50 hover:bg-violet-100 disabled:opacity-50 transition-colors"
                    >
                      {captionLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      AI Captions
                    </button>
                    <button
                      type="button"
                      onClick={handleHashtagSuggestions}
                      disabled={hashtagLoading}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                    >
                      {hashtagLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Hash className="h-3.5 w-3.5" />
                      )}
                      # Hashtags
                    </button>
                    {(captionSuggestions.length > 0 || hashtagSuggestions.length > 0) && (
                      <button
                        type="button"
                        onClick={() => { setCaptionSuggestions([]); setHashtagSuggestions([]); }}
                        className="ml-auto text-[11px] text-brand-text/60 hover:text-brand-highlight flex items-center gap-1"
                      >
                        <X className="h-3 w-3" /> Clear
                      </button>
                    )}
                  </div>

                  {/* Caption suggestions panel */}
                  {captionSuggestions.length > 0 && (
                    <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Suggested Captions</p>
                      {captionSuggestions.map((caption, i) => (
                        <div key={i} className="flex items-start gap-2 bg-brand-card rounded-lg p-2.5 border border-violet-100">
                          <p className="flex-1 text-[13px] text-slate-700 leading-relaxed">{caption}</p>
                          <button
                            type="button"
                            onClick={() => { setContent(caption); setCaptionSuggestions([]); }}
                            className="shrink-0 px-2.5 py-1 rounded-md bg-violet-600 text-white text-[11px] font-bold hover:bg-violet-700 transition-colors"
                          >
                            Use
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Hashtag suggestions panel */}
                  {hashtagSuggestions.length > 0 && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Suggested Hashtags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {hashtagSuggestions.map((tag, i) => {
                          const normalized = tag.startsWith("#") ? tag : `#${tag}`;
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setContent((prev) => `${prev} ${normalized}`.trimStart())}
                              className="px-2.5 py-1 rounded-full bg-brand-card border border-blue-200 text-blue-600 text-[12px] font-semibold hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all"
                            >
                              {normalized}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Images */}
                {images.length > 0 ? (
                  <div className={`mt-4 grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                    {images.map((img, i) => (
                      <div key={i} className="relative overflow-hidden rounded-xl">
                        <img src={img.preview} alt="" className="h-48 w-full object-cover" />
                        <button type="button" onClick={() => removeImage(i)} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Actions */}
                <div className="mt-4 flex items-center gap-1 border-t border-brand-divider pt-4">
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={images.length >= 4} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-brand-highlight hover:bg-brand-secondary disabled:opacity-40">
                    <ImagePlus className="h-4 w-4 text-emerald-500" /> Photo
                  </button>
                  <button type="button" onClick={() => { const loc = prompt("Enter location:"); if (loc) setLocation(loc); }} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-brand-highlight hover:bg-brand-secondary">
                    <MapPin className="h-4 w-4 text-rose-500" /> Location
                  </button>
                  <button type="button" onClick={() => setContent((prev) => prev + " #")} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-brand-highlight hover:bg-brand-secondary">
                    <Hash className="h-4 w-4 text-blue-500" /> Tag
                  </button>
                  <div className="flex-1" />
                  <span className="text-[11px] text-slate-300">{content.length}/2000</span>
                </div>

                {location ? (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-brand-text/60">
                    <MapPin className="h-3 w-3" />
                    {location}
                    <button type="button" onClick={() => setLocation("")} className="text-slate-300 hover:text-brand-highlight"><X className="h-3 w-3" /></button>
                  </div>
                ) : null}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImages} className="hidden" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3 as ChartBarIcon,
  ChevronDown,
  Globe,
  Hash,
  ImagePlus,
  Loader2,
  Lock,
  MapPin,
  Radio as BroadcastIcon,
  Send,
  ShieldCheck,
  Smile,
  Sparkles,
  Users,
  X,
  Plus,
  Trash2,
  Clock,
  Check,
  Undo2,
  Heart,
  MessageSquare,
  Share2,
} from "lucide-react";

import AppShell from "@/components/AppShell";
import TrendingHashtagStrip from "@/components/composer/TrendingHashtagStrip";
import { Avatar } from "@/components/LetterAvatar";
import { useMyProfile } from "@/hooks/useEditProfile";
import { useCreatePost } from "@/hooks/useFeedPosts";
import { formatPostCount, useHashtagSearch } from "@/hooks/useHashtags";
import api from "@/lib/api";
import { uploadMedia } from "@/lib/mediaUpload";
import { POST_CONTENT_TYPES } from "@/types/profile";
import emojiData from "@emoji-mart/data";

const EmojiPicker = lazy(() => import("@emoji-mart/react"));

const VISIBILITY = [
  { value: "public", label: "Everyone", icon: Globe },
  { value: "followers", label: "Followers", icon: Users },
  { value: "trusted", label: "Trusted", icon: ShieldCheck },
  { value: "private", label: "Only me", icon: Lock },
] as const;

type Visibility = (typeof VISIBILITY)[number]["value"];

const SOLID_BACKGROUNDS = [
  { value: null, label: "No background" },
  { value: "#378ADD", label: "Blue", dark: true },
  { value: "#D4537E", label: "Pink", dark: true },
  { value: "#85B7EB", label: "Light blue" },
  { value: "#1D9E75", label: "Green", dark: true },
  { value: "#ED93B1", label: "Coral" },
  { value: "#AFA9EC", label: "Purple" },
  { value: "#EF9F27", label: "Amber" },
  { value: "#F4C0D1", label: "Pink soft" },
  { value: "#185FA5", label: "Deep blue", dark: true },
  { value: "#111111", label: "Black", dark: true },
  { value: "#3C3489", label: "Indigo", dark: true },
  { value: "#0F6E56", label: "Deep green", dark: true },
  { value: "#993C1D", label: "Brown", dark: true },
];

const PRESET_GRADIENTS = [
  { value: "linear-gradient(135deg, #FF512F 0%, #DD2476 100%)", label: "Sunset Glow", dark: true },
  { value: "linear-gradient(135deg, #4776E6 0%, #8E54E9 100%)", label: "Deep Space", dark: true },
  { value: "linear-gradient(135deg, #00B4DB 0%, #0083B0 100%)", label: "Ocean Breeze", dark: true },
  { value: "linear-gradient(135deg, #8A2387 0%, #E94057 50%, #F27121 100%)", label: "Cosmic Fusion", dark: true },
  { value: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)", label: "Emerald Aura", dark: true },
  { value: "linear-gradient(135deg, #F12711 0%, #F5AF19 100%)", label: "Amber Glow", dark: true },
  { value: "linear-gradient(135deg, #7F00FF 0%, #FF007F 100%)", label: "Violet Mist", dark: true },
  { value: "linear-gradient(135deg, #141E30 0%, #243B55 100%)", label: "Charcoal Dusk", dark: true },
];

function messageFromError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { error?: { message?: string } } } })
      .response?.data?.error?.message === "string"
  ) {
    return (error as { response: { data: { error: { message: string } } } })
      .response.data.error.message;
  }
  return "Failed to create post. Try again.";
}

export default function CreatePostPage() {
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const createPost = useCreatePost();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Core state
  const [content, setContent] = useState("");
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [location, setLocation] = useState("");
  const [background, setBackground] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tab state for style customizers
  const [styleTab, setStyleTab] = useState<"solids" | "gradients" | "custom">("solids");

  // Custom gradient builder state
  const [customGrad1, setCustomGrad1] = useState("#8b5cf6");
  const [customGrad2, setCustomGrad2] = useState("#ec4899");
  const [customGradAngle, setCustomGradAngle] = useState(135);

  // Poll state
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollMultiple, setPollMultiple] = useState(false);
  const [pollDurationHours, setPollDurationHours] = useState(24);

  // Popover state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");

  // AI Helpers
  const [captionLoading, setCaptionLoading] = useState(false);
  const [captionSuggestions, setCaptionSuggestions] = useState<string[]>([]);
  const [hashtagLoading, setHashtagLoading] = useState(false);
  const [hashtagSuggestions, setHashtagSuggestions] = useState<string[]>([]);

  // Hashtag Auto-complete Search Hook
  const [hashtagQuery, setHashtagQuery] = useState("");
  const [hashtagRange, setHashtagRange] = useState<{ start: number; end: number } | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(hashtagQuery), 500);
    return () => window.clearTimeout(t);
  }, [hashtagQuery]);

  const { data: hashtagAuto = [], isLoading: hashtagAutoLoading } = useHashtagSearch(
    debouncedQuery,
    8,
  );

  // Parse hashtags
  const usedHashtags = useMemo(() => {
    const out = new Set<string>();
    for (const match of content.toLowerCase().matchAll(/(#[\p{L}\p{M}\p{N}_]{2,50})/gu)) {
      out.add(`#${match[1]}`);
    }
    return out;
  }, [content]);

  const activeHashtags = useMemo(() => Array.from(usedHashtags).slice(0, 6), [usedHashtags]);

  // Profile fields
  const displayName = profile?.display_name || "User";
  const handleName = profile?.username ? `@${profile.username}` : "@you";
  const firstName = displayName.split(" ")[0] || "you";
  const avatarUrl = profile?.avatar_media_id
    ? `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/v1/media/${profile.avatar_media_id}/serve`
    : undefined;

  // Swatch styling
  const isPresetGrad = PRESET_GRADIENTS.some((g) => g.value === background);
  const isCustomGrad = background?.startsWith("linear-gradient");
  const bgSwatch = SOLID_BACKGROUNDS.find((b) => b.value === background) ||
                   PRESET_GRADIENTS.find((g) => g.value === background);
  const onDark = bgSwatch ? !!bgSwatch.dark : (isCustomGrad || isPresetGrad);

  // Close Popovers on Click Outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const detectActiveHashtag = useCallback(
    (text: string, caret: number): { query: string; start: number; end: number } | null => {
      if (caret <= 0 || caret > text.length) return null;
      let i = caret - 1;
      while (i >= 0) {
        const ch = text[i];
        if (ch === "#") {
          const prev = i === 0 ? "" : text[i - 1];
          const atBoundary = i === 0 || prev === " " || prev === "\n" || prev === "\t";
          if (!atBoundary) return null;
          const query = text.slice(i + 1, caret);
          if (/\s/.test(query)) return null;
          return { query, start: i, end: caret };
        }
        if (ch === " " || ch === "\n" || ch === "\t") return null;
        i -= 1;
      }
      return null;
    },
    [],
  );

  const handleTextareaChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value;
      setContent(next);
      const caret = event.target.selectionStart ?? next.length;
      const token = detectActiveHashtag(next, caret);
      if (token) {
        setHashtagQuery(token.query);
        setHashtagRange({ start: token.start, end: token.end });
      } else {
        setHashtagQuery("");
        setHashtagRange(null);
      }
    },
    [detectActiveHashtag],
  );

  const insertHashtag = useCallback(
    (chip: string) => {
      const tag = chip.startsWith("#") ? chip : `#${chip}`;
      const lower = tag.toLowerCase();
      const replacement = `${tag} `;
      setContent((current) => {
        const ta = textareaRef.current;
        const caret = ta?.selectionStart ?? current.length;
        if (hashtagRange) {
          const before = current.slice(0, hashtagRange.start);
          const after = current.slice(hashtagRange.end);
          const next = `${before}${replacement}${after}`;
          window.setTimeout(() => {
            if (ta) {
              const pos = before.length + replacement.length;
              ta.setSelectionRange(pos, pos);
              ta.focus();
            }
          }, 0);
          return next;
        }
        if (current.toLowerCase().includes(lower)) return current;
        const before = current.slice(0, caret);
        const after = current.slice(caret);
        const pad =
          before.length === 0 || before.endsWith(" ") || before.endsWith("\n") ? "" : " ";
        const next = `${before}${pad}${replacement}${after}`;
        window.setTimeout(() => {
          if (ta) {
            const pos = before.length + pad.length + replacement.length;
            ta.setSelectionRange(pos, pos);
            ta.focus();
          }
        }, 0);
        return next;
      });
      setHashtagQuery("");
      setHashtagRange(null);
    },
    [hashtagRange],
  );

  const handleImages = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      const newImages = files.slice(0, Math.max(0, 4 - images.length)).map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));
      setImages((current) => [...current, ...newImages].slice(0, 4));
      event.target.value = "";
    },
    [images.length],
  );

  const removeImage = useCallback((index: number) => {
    setImages((current) => {
      const removed = current[index];
      if (removed) URL.revokeObjectURL(removed.preview);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }, []);

  const handleEmojiSelect = (emoji: { native: string }) => {
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart ?? content.length;
      const end = ta.selectionEnd ?? content.length;
      const next = content.substring(0, start) + emoji.native + content.substring(end);
      setContent(next);
      const newPos = start + emoji.native.length;
      window.setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(newPos, newPos);
      }, 0);
    } else {
      setContent((c) => c + emoji.native);
    }
    setShowEmojiPicker(false);
  };

  // Curated Suggested Locations
  const SUGGESTED_LOCATIONS = [
    "San Francisco, CA",
    "New York, NY",
    "London, UK",
    "Tokyo, Japan",
    "Paris, France",
    "Berlin, Germany",
    "Sydney, Australia",
  ];

  const handleAddLocation = (locName: string) => {
    if (locName.trim()) {
      setLocation(locName.trim());
      setShowLocationPicker(false);
      setLocationQuery("");
    }
  };

  // Poll option actions
  const handleAddPollOption = () => {
    if (pollOptions.length < 4) {
      setPollOptions([...pollOptions, ""]);
    }
  };

  const handleRemovePollOption = (idx: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== idx));
    }
  };

  const handlePollOptionChange = (idx: number, val: string) => {
    const updated = [...pollOptions];
    updated[idx] = val;
    setPollOptions(updated);
  };

  // AI suggestions
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
  }, [captionLoading, content]);

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

  // Custom gradient generator hook
  useEffect(() => {
    if (styleTab === "custom") {
      setBackground(`linear-gradient(${customGradAngle}deg, ${customGrad1} 0%, ${customGrad2} 100%)`);
    }
  }, [customGrad1, customGrad2, customGradAngle, styleTab]);

  const handlePublish = useCallback(async () => {
    if (publishing || (!content.trim() && images.length === 0 && !pollQuestion.trim())) return;
    setPublishing(true);
    setError(null);
    try {
      const mediaIds =
        images.length > 0
          ? await Promise.all(images.map(({ file }) => uploadMedia(file, "image", "general")))
          : undefined;

      // Construct poll if valid
      const hasValidPoll = showPoll && pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2;
      const pollPayload = hasValidPoll
        ? {
            question: pollQuestion.trim(),
            options: pollOptions.filter(o => o.trim()),
            allows_multiple: pollMultiple,
            duration_hours: pollDurationHours,
          }
        : null;

      const created = await createPost.mutateAsync({
        text: content.trim(),
        visibility,
        content_type: POST_CONTENT_TYPES.POST,
        media_ids: mediaIds,
        location: location.trim() || null,
        poll: pollPayload,
        rich_text: background
          ? { background, text_color: onDark ? "#ffffff" : "#111111" }
          : null,
      });

      images.forEach((image) => URL.revokeObjectURL(image.preview));
      setImages([]);
      setContent("");
      setLocation("");
      setBackground(null);
      setShowPoll(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      router.push(`/post/${created.id}`);
    } catch (publishError) {
      setError(messageFromError(publishError));
    } finally {
      setPublishing(false);
    }
  }, [
    background,
    content,
    createPost,
    images,
    location,
    onDark,
    publishing,
    router,
    visibility,
    showPoll,
    pollQuestion,
    pollOptions,
    pollMultiple,
    pollDurationHours,
  ]);

  // Character limit circle stats
  const charPercentage = Math.min((content.length / 2000) * 100, 100);
  const dashOffset = 251.2 - (251.2 * charPercentage) / 100;
  const isNearLimit = content.length >= 1800;

  const visibilityOption =
    VISIBILITY.find((item) => item.value === visibility) ?? VISIBILITY[0];
  const VisibilityIcon = visibilityOption.icon;

  // Hashtag formatter for real-time preview
  const formatHashtags = (text: string) => {
    if (!text) return "What's on your mind?";
    const tokens = text.split(/(\s+)/);
    return tokens.map((token, idx) => {
      if (token.startsWith("#") && token.length > 1) {
        return (
          <span key={idx} className="font-bold text-[#3B82F6] hover:underline cursor-pointer">
            {token}
          </span>
        );
      }
      return token;
    });
  };

  return (
    <AppShell activeTab="Home">
      {/* Sleek, deep neon glassmorphism layout, immersive workspace */}
      <div className="flex min-h-[calc(100vh-80px)] w-full items-start justify-center bg-gradient-to-b from-slate-900 via-[#0B0F19] to-black px-4 py-8 sm:py-12">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: THE WORKSPACE COMPOSER */}
          <div className="lg:col-span-7 w-full flex flex-col gap-6">
            
            {/* The main composer card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full overflow-hidden rounded-[32px] bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-2xl relative"
            >
              {/* Outer decorative ambient glows */}
              <div className="absolute -top-32 -left-32 w-64 h-64 rounded-full bg-violet-600/10 blur-[80px] pointer-events-none" />
              <div className="absolute -bottom-32 -right-32 w-64 h-64 rounded-full bg-blue-600/10 blur-[80px] pointer-events-none" />

              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-800/50">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-400">
                    Creative Studio
                  </div>
                  <div className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    COMPOSER <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">WORKSPACE</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => router.back()}
                  aria-label="Close"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/60 text-slate-300 hover:text-white transition-all hover:bg-slate-700/80 active:scale-95 border border-slate-700/40"
                >
                  <X className="h-[18px] w-[18px]" />
                </button>
              </div>

              {/* User row & Visibility Settings */}
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-slate-900/40 border-b border-slate-800/20">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={avatarUrl}
                    name={displayName}
                    seed={profile?.id}
                    size="md"
                    className="border border-violet-500/20 shadow-md ring-2 ring-violet-500/10"
                  />
                  <div className="min-w-0 leading-tight">
                    <div className="truncate text-[14px] font-semibold text-white">
                      {displayName}
                    </div>
                    <div className="text-[11px] text-slate-400 font-medium">{handleName}</div>
                  </div>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setVisibilityOpen((v) => !v)}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 px-4 py-2 text-[12px] font-medium text-slate-200 border border-slate-700/40 transition shadow-sm"
                  >
                    <VisibilityIcon className="h-4 w-4 text-violet-400" />
                    {visibilityOption.label}
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 transition-transform duration-200" />
                  </button>
                  <AnimatePresence>
                    {visibilityOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-xl"
                      >
                        {VISIBILITY.map((opt) => {
                          const Icon = opt.icon;
                          const active = opt.value === visibility;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setVisibility(opt.value);
                                setVisibilityOpen(false);
                              }}
                              className={`flex w-full items-center gap-2.5 px-4 py-3 text-left text-[12.5px] font-medium transition-colors ${
                                active ? "bg-violet-600/20 text-violet-300" : "text-slate-300 hover:bg-slate-800"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                              {opt.label}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Composition card */}
              <div className="px-6 pt-5">
                <div
                  className="relative rounded-3xl p-5 border border-white/5 transition-all duration-500 shadow-inner overflow-hidden"
                  style={{
                    background: background ?? "rgba(15, 23, 42, 0.4)",
                    color: onDark ? "#ffffff" : "#1e293b",
                  }}
                >
                  {/* Subtle glass shimmer over custom color backgrounds */}
                  {background && (
                    <div className="absolute inset-0 bg-white/[0.04] backdrop-blur-[1px] pointer-events-none" />
                  )}

                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={handleTextareaChange}
                    onSelect={(event) => {
                      const ta = event.target as HTMLTextAreaElement;
                      const caret = ta.selectionStart ?? ta.value.length;
                      const token = detectActiveHashtag(ta.value, caret);
                      if (token) {
                        setHashtagQuery(token.query);
                        setHashtagRange({ start: token.start, end: token.end });
                      } else {
                        setHashtagQuery("");
                        setHashtagRange(null);
                      }
                    }}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setHashtagQuery("");
                        setHashtagRange(null);
                      }, 180);
                    }}
                    maxLength={2000}
                    rows={6}
                    autoFocus
                    placeholder={`What's on your mind, ${firstName}?`}
                    className={`w-full resize-none bg-transparent text-[17px] leading-[1.6] outline-none relative z-10 transition-colors ${
                      background
                        ? onDark
                          ? "text-white placeholder:text-white/50"
                          : "text-slate-900 placeholder:text-slate-900/40 font-semibold"
                        : "text-white placeholder:text-slate-500"
                    }`}
                  />

                  {/* Active hashtag chips inline visual */}
                  {activeHashtags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5 relative z-10">
                      {activeHashtags.map((tag) => (
                        <span
                          key={tag}
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold border transition ${
                            background
                              ? onDark
                                ? "bg-white/10 text-white border-white/10"
                                : "bg-black/10 text-black border-black/10"
                              : "bg-violet-500/10 text-violet-300 border-violet-500/20"
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Attachment Media Previews */}
                  {images.length > 0 && (
                    <div
                      className={`mt-4 grid gap-3 relative z-10 ${
                        images.length === 1 ? "grid-cols-1" : "grid-cols-2"
                      }`}
                    >
                      {images.map((image, index) => (
                        <div
                          key={image.preview}
                          className="group relative overflow-hidden rounded-2xl border border-slate-700/40 shadow-lg"
                        >
                          <img
                            src={image.preview}
                            alt=""
                            className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/80 hover:bg-red-600 text-white transition-all transform hover:scale-110 active:scale-95 shadow-md"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Hashtag autocomplete dropdown panel */}
                  <AnimatePresence>
                    {hashtagRange && (hashtagAutoLoading || hashtagAuto.length > 0) && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute left-4 right-4 top-full z-40 mt-2 max-h-56 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl scrollbar-hide"
                      >
                        {hashtagAutoLoading ? (
                          <div className="flex items-center gap-2 p-3 text-[12.5px] text-slate-400">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                            Searching tags…
                          </div>
                        ) : (
                          hashtagAuto.map((tag) => {
                            const rawName = (tag.display_name || tag.normalized_name || '').replace(/^#/, '');
                            return (
                              <button
                                key={tag.normalized_name || rawName}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => insertHashtag(`#${rawName.toLowerCase()}`)}
                                className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left transition-colors hover:bg-slate-800/80 border border-transparent hover:border-slate-700/50"
                              >
                                <Hash
                                  className={`h-4 w-4 ${
                                    tag.is_trending ? "text-violet-400" : "text-slate-500"
                                  }`}
                                />
                                <span className="flex-1 truncate text-[13px] font-semibold text-slate-200">
                                  #{rawName}
                                </span>
                                <span className="text-[11px] text-slate-400 flex items-center gap-1 font-semibold">
                                  {tag.is_trending ? "🔥 " : ""}
                                  {formatPostCount(tag.post_count)} posts
                                </span>
                              </button>
                            );
                          })
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Trending tag bar */}
              <div className="px-6 pt-4">
                <TrendingHashtagStrip onTagSelected={insertHashtag} excluded={usedHashtags} label="TRENDING CHIPS" />
              </div>

              {/* Dynamic Poll builder if enabled */}
              <AnimatePresence>
                {showPoll && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden px-6 pt-4"
                  >
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 relative">
                      <button
                        type="button"
                        onClick={() => setShowPoll(false)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-violet-400 mb-3 flex items-center gap-1.5">
                        <ChartBarIcon className="h-3.5 w-3.5" /> Post Poll Creator
                      </div>
                      
                      {/* Poll Question field */}
                      <input
                        type="text"
                        value={pollQuestion}
                        onChange={(e) => setPollQuestion(e.target.value)}
                        placeholder="What's your poll question?"
                        className="w-full bg-slate-950/60 text-[14px] text-white border border-slate-800/80 rounded-xl px-4 py-2.5 placeholder:text-slate-500 outline-none focus:border-violet-500/40 mb-3"
                      />

                      {/* Poll Options fields */}
                      <div className="space-y-2 mb-4">
                        {pollOptions.map((opt, oIdx) => (
                          <div key={oIdx} className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-500 w-6">
                              #{oIdx + 1}
                            </span>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => handlePollOptionChange(oIdx, e.target.value)}
                              placeholder={`Option ${oIdx + 1} ${oIdx >= 2 ? '(Optional)' : '(Required)'}`}
                              className="flex-1 bg-slate-950/40 text-[13px] text-white border border-slate-800 rounded-lg px-3.5 py-2 outline-none focus:border-violet-500/30"
                            />
                            {pollOptions.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemovePollOption(oIdx)}
                                className="text-slate-500 hover:text-red-400 p-1"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        {pollOptions.length < 4 && (
                          <button
                            type="button"
                            onClick={handleAddPollOption}
                            className="flex items-center gap-1.5 text-[11px] font-bold text-violet-400 hover:text-violet-300 mt-2 px-1"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add another option
                          </button>
                        )}
                      </div>

                      {/* Settings */}
                      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-800/50">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={pollMultiple}
                            onChange={(e) => setPollMultiple(e.target.checked)}
                            className="rounded border-slate-700 bg-slate-950 text-violet-600 focus:ring-violet-500 h-4 w-4"
                          />
                          <span className="text-[12px] font-semibold text-slate-300">
                            Allow Multiple Choices
                          </span>
                        </label>

                        <div className="flex items-center gap-2 text-slate-300">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-[12px] font-semibold">Duration:</span>
                          <select
                            value={pollDurationHours}
                            onChange={(e) => setPollDurationHours(Number(e.target.value))}
                            className="bg-slate-950/80 text-[11px] font-semibold border border-slate-800 rounded-lg px-2.5 py-1 text-violet-300 outline-none"
                          >
                            <option value={1}>1 Hour</option>
                            <option value={6}>6 Hours</option>
                            <option value={24}>1 Day</option>
                            <option value={72}>3 Days</option>
                            <option value={168}>1 Week</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Styled background panel workspace */}
              <div className="px-6 pt-4">
                <div className="rounded-2xl bg-slate-900/60 border border-slate-800/50 p-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                    <div className="flex gap-4">
                      {/* Tabs */}
                      <button
                        type="button"
                        onClick={() => setStyleTab("solids")}
                        className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${
                          styleTab === "solids" ? "text-violet-400" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Solids
                      </button>
                      <button
                        type="button"
                        onClick={() => setStyleTab("gradients")}
                        className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${
                          styleTab === "gradients" ? "text-violet-400" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Gradients
                      </button>
                      <button
                        type="button"
                        onClick={() => setStyleTab("custom")}
                        className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${
                          styleTab === "custom" ? "text-violet-400" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Custom Canvas
                      </button>
                    </div>

                    {background && (
                      <button
                        type="button"
                        onClick={() => setBackground(null)}
                        className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-red-400 flex items-center gap-1 transition"
                      >
                        <Undo2 className="h-3 w-3" /> Reset background
                      </button>
                    )}
                  </div>

                  {/* Solids view */}
                  {styleTab === "solids" && (
                    <div className="flex flex-wrap items-center gap-2 max-h-24 overflow-y-auto scrollbar-hide py-1">
                      {SOLID_BACKGROUNDS.map((swatch, idx) => {
                        const selected = swatch.value === background;
                        const isNone = swatch.value === null;
                        return (
                          <button
                            key={idx}
                            type="button"
                            aria-label={swatch.label}
                            onClick={() => setBackground(swatch.value)}
                            className="h-[28px] w-[28px] cursor-pointer rounded-full border border-slate-700/50 transition-all transform hover:scale-110 active:scale-95 flex items-center justify-center relative shadow"
                            style={{
                              background: isNone
                                ? "repeating-conic-gradient(#334155 0% 25%, #1e293b 0% 50%) 50% / 8px 8px"
                                : swatch.value!,
                            }}
                          >
                            {selected && (
                              <Check className={`h-3 w-3 ${swatch.dark ? 'text-white' : 'text-slate-900'}`} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Preset Gradients view */}
                  {styleTab === "gradients" && (
                    <div className="flex flex-wrap items-center gap-2 max-h-24 overflow-y-auto scrollbar-hide py-1">
                      {PRESET_GRADIENTS.map((swatch, idx) => {
                        const selected = swatch.value === background;
                        return (
                          <button
                            key={idx}
                            type="button"
                            aria-label={swatch.label}
                            onClick={() => setBackground(swatch.value)}
                            className="h-[28px] w-[28px] cursor-pointer rounded-full border border-slate-700/50 transition-all transform hover:scale-110 active:scale-95 flex items-center justify-center relative shadow"
                            style={{
                              background: swatch.value,
                            }}
                            title={swatch.label}
                          >
                            {selected && <Check className="h-3 w-3 text-white" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Custom gradients dashboard */}
                  {styleTab === "custom" && (
                    <div className="flex flex-wrap items-center gap-4 py-1.5 text-slate-300">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold">Start:</span>
                        <input
                          type="color"
                          value={customGrad1}
                          onChange={(e) => setCustomGrad1(e.target.value)}
                          className="h-6 w-10 cursor-pointer rounded bg-transparent border-0"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold">End:</span>
                        <input
                          type="color"
                          value={customGrad2}
                          onChange={(e) => setCustomGrad2(e.target.value)}
                          className="h-6 w-10 cursor-pointer rounded bg-transparent border-0"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                        <span className="text-[11px] font-semibold">Angle ({customGradAngle}°):</span>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          value={customGradAngle}
                          onChange={(e) => setCustomGradAngle(Number(e.target.value))}
                          className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick popover attachments: Location and Emojis */}
              {location && (
                <div className="px-6 pt-4 flex">
                  <div className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600/10 border border-violet-500/20 px-3 py-1.5 text-[12px] font-semibold text-violet-300 shadow-sm animate-fadeIn">
                    <MapPin className="h-3.5 w-3.5 text-violet-400" />
                    {location}
                    <button
                      type="button"
                      onClick={() => setLocation("")}
                      className="text-violet-500 hover:text-red-400 p-0.5 ml-1 transition"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Error messages */}
              {error && (
                <div className="px-6 pt-4">
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] font-medium text-red-400 animate-pulse">
                    {error}
                  </div>
                </div>
              )}

              {/* BOTTOM ACTIONS AND PUBLISH BUTTON */}
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-t border-slate-800/50 mt-4 bg-slate-900/20">
                <div className="flex items-center gap-1 bg-slate-950/60 p-1.5 rounded-2xl border border-slate-800/60 relative">
                  
                  {/* Image input trigger */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={images.length >= 4}
                    aria-label="Add Photo"
                    title="Add Photo"
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-sky-400 hover:bg-sky-400/10 hover:scale-105 transition-all disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <ImagePlus className="h-[18px] w-[18px]" />
                  </button>

                  {/* Poll Toggle trigger */}
                  <button
                    type="button"
                    onClick={() => setShowPoll(!showPoll)}
                    aria-label="Add Poll"
                    title="Add Poll"
                    className={`flex h-9 w-9 items-center justify-center rounded-xl hover:scale-105 transition-all ${
                      showPoll ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-amber-400 hover:bg-amber-400/10'
                    }`}
                  >
                    <ChartBarIcon className="h-[18px] w-[18px]" />
                  </button>

                  {/* Emoji Trigger */}
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    aria-label="Add Emoji"
                    title="Add Emoji"
                    className={`flex h-9 w-9 items-center justify-center rounded-xl hover:scale-105 transition-all ${
                      showEmojiPicker ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : 'text-pink-400 hover:bg-pink-400/10'
                    }`}
                  >
                    <Smile className="h-[18px] w-[18px]" />
                  </button>

                  {/* Location picker Trigger */}
                  <button
                    type="button"
                    onClick={() => setShowLocationPicker(!showLocationPicker)}
                    aria-label="Add Location"
                    title="Add Location"
                    className={`flex h-9 w-9 items-center justify-center rounded-xl hover:scale-105 transition-all ${
                      showLocationPicker ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-emerald-400 hover:bg-emerald-400/10'
                    }`}
                  >
                    <MapPin className="h-[18px] w-[18px]" />
                  </button>

                  {/* Quick hashtag append */}
                  <button
                    type="button"
                    onClick={() => {
                      setContent((c) => `${c} #`.trimStart());
                      window.setTimeout(() => textareaRef.current?.focus(), 50);
                    }}
                    aria-label="Add Tag"
                    title="Add Tag"
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-blue-400 hover:bg-blue-400/10 hover:scale-105 transition-all"
                  >
                    <Hash className="h-[18px] w-[18px]" />
                  </button>

                  {/* Host livestream route link */}
                  <button
                    type="button"
                    onClick={() => router.push("/live/start")}
                    aria-label="Go Live"
                    title="Go Live"
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-red-500 hover:bg-red-500/10 hover:scale-105 transition-all"
                  >
                    <BroadcastIcon className="h-[18px] w-[18px]" />
                  </button>

                  {/* LAZY LOADED EMOJI MART FLOATING DOCK */}
                  <AnimatePresence>
                    {showEmojiPicker && (
                      <motion.div
                        ref={emojiPickerRef}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 15 }}
                        className="absolute bottom-12 left-0 z-50 shadow-2xl rounded-2xl border border-slate-700/80 bg-slate-900 overflow-hidden"
                      >
                        <Suspense fallback={
                          <div className="flex h-40 w-60 items-center justify-center bg-slate-900 text-xs text-slate-400">
                            <Loader2 className="h-5 w-5 animate-spin text-violet-400 mr-2" />
                            Loading Emojis...
                          </div>
                        }>
                          <EmojiPicker
                            data={emojiData}
                            onEmojiSelect={handleEmojiSelect}
                            theme="dark"
                          />
                        </Suspense>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* LOCATION SELECTION FLOATING DIALOG */}
                  <AnimatePresence>
                    {showLocationPicker && (
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 15 }}
                        className="absolute bottom-12 left-0 z-50 w-72 rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            Choose Location
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowLocationPicker(false)}
                            className="text-slate-400 hover:text-slate-200"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Search inputs */}
                        <div className="flex gap-1.5 mb-3">
                          <input
                            type="text"
                            value={locationQuery}
                            onChange={(e) => setLocationQuery(e.target.value)}
                            placeholder="Type custom location..."
                            className="flex-1 bg-slate-950 text-xs text-white border border-slate-800 rounded-lg px-2.5 py-1.5 outline-none focus:border-violet-500/40"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddLocation(locationQuery)}
                            className="bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-3 text-[11px] font-bold transition"
                          >
                            Add
                          </button>
                        </div>

                        {/* Curated suggestions grid */}
                        <div className="space-y-1 max-h-36 overflow-y-auto scrollbar-hide border-t border-slate-800/60 pt-2">
                          {SUGGESTED_LOCATIONS.map((loc) => (
                            <button
                              key={loc}
                              type="button"
                              onClick={() => handleAddLocation(loc)}
                              className="w-full text-left text-xs text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg px-2 py-1.5 transition flex items-center gap-1.5"
                            >
                              <MapPin className="h-3 w-3 text-emerald-400" />
                              {loc}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>

                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={publishing || (!content.trim() && images.length === 0 && !pollQuestion.trim())}
                  className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition transform hover:scale-[1.02] active:scale-98 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                    {publishing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                  </span>
                  {publishing ? "Publishing" : "Publish Post"}
                </button>
              </div>

              {/* Status footer bar */}
              <div className="flex items-center justify-between bg-slate-950/40 px-6 py-3.5 border-t border-slate-800/20 text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  {publishing ? "SECURE POST..." : "DRAFT AUTO-SAVED"}
                </div>
                
                {/* Gauge character count indicator */}
                <div className="flex items-center gap-2">
                  <div className="relative h-6 w-6">
                    <svg className="h-full w-full -rotate-90">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        className="stroke-slate-800"
                        strokeWidth="2"
                        fill="transparent"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        className={`transition-all duration-300 ${
                          isNearLimit ? "stroke-red-500" : charPercentage > 80 ? "stroke-amber-500" : "stroke-violet-500"
                        }`}
                        strokeWidth="2.5"
                        fill="transparent"
                        strokeDasharray="62.8"
                        strokeDashoffset={25.12 - (25.12 * charPercentage) / 100}
                      />
                    </svg>
                  </div>
                  <span className={isNearLimit ? "text-red-400" : "text-slate-300"}>
                    {content.length.toLocaleString()} / 2,000
                  </span>
                </div>
              </div>

              {/* Input media file hidden anchor */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImages}
                className="hidden"
              />
            </motion.div>

          </div>
          
          {/* RIGHT COLUMN: INTERACTIVE LIVE PREVIEW & AI PANEL */}
          <div className="lg:col-span-5 w-full flex flex-col gap-6">
            
            {/* 1. REAL-TIME LIVE POST PREVIEW */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="w-full rounded-[32px] bg-slate-900/40 border border-slate-800/80 backdrop-blur-xl p-6 shadow-2xl relative"
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-400 mb-3">
                Live Rendering
              </div>
              <div className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-slate-800/50 pb-2">
                Real-Time Post Preview
              </div>

              {/* The mock post card */}
              <div className="rounded-2xl bg-[#1e293b]/30 border border-slate-800/60 p-4 shadow overflow-hidden relative">
                
                {/* Header elements */}
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={avatarUrl}
                      name={displayName}
                      seed={profile?.id}
                      size="sm"
                      className="border border-white/10"
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-white leading-none truncate">
                        {displayName}
                      </div>
                      <div className="text-[10px] text-slate-400 leading-none mt-1">
                        {handleName}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 rounded-full bg-slate-800/40 px-2 py-1 text-[10px] text-slate-300 font-semibold border border-slate-700/20">
                    <VisibilityIcon className="h-3 w-3 text-violet-400" />
                    <span>{visibilityOption.label}</span>
                  </div>
                </div>

                {/* Text editor body rendered */}
                <div
                  className="rounded-xl p-4 min-h-[100px] flex flex-col justify-between mb-4 border border-white/5"
                  style={{
                    background: background ?? "rgba(15, 23, 42, 0.4)",
                    color: onDark ? "#ffffff" : "#1e293b",
                  }}
                >
                  {/* Subtle glass shimmer over custom color backgrounds */}
                  {background && (
                    <div className="absolute inset-0 bg-white/[0.04] pointer-events-none" />
                  )}

                  <p className={`text-[15px] leading-relaxed break-words font-medium relative z-10 ${
                    background
                      ? onDark
                        ? "text-white"
                        : "text-slate-900 font-semibold"
                      : "text-slate-300"
                  }`}>
                    {formatHashtags(content)}
                  </p>

                  {/* Render location chip in preview */}
                  {location && (
                    <div className="mt-3 flex relative z-10">
                      <div className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                        background
                          ? onDark
                            ? "text-white/80"
                            : "text-slate-900/80"
                          : "text-violet-400"
                      }`}>
                        <MapPin className="h-3 w-3" />
                        {location}
                      </div>
                    </div>
                  )}
                </div>

                {/* Poll Mock Rendering inside Preview */}
                {showPoll && (pollQuestion.trim() || pollOptions.some(o => o.trim())) && (
                  <div className="rounded-xl bg-slate-950/40 border border-slate-800 p-4 mb-4">
                    <div className="text-[12px] font-bold text-white mb-3">
                      📊 {pollQuestion.trim() || "What is your question?"}
                    </div>
                    <div className="space-y-2 mb-3">
                      {pollOptions.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className="flex items-center justify-between rounded-lg bg-slate-900/50 border border-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-300"
                        >
                          <span>{opt.trim() || `Option ${oIdx + 1}`}</span>
                          <span className="text-[10px] text-slate-500">0%</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span>{pollMultiple ? "Multi-Choice" : "Single Choice"}</span>
                      <span>Expires in {pollDurationHours}h</span>
                    </div>
                  </div>
                )}

                {/* Grid layout images in preview */}
                {images.length > 0 && (
                  <div className={`grid gap-2 mb-4 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                    {images.map((image) => (
                      <div key={image.preview} className="rounded-xl overflow-hidden border border-slate-800">
                        <img src={image.preview} alt="" className="h-32 w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer interactive overlays */}
                <div className="flex items-center justify-between border-t border-slate-800/60 pt-3 text-slate-400 text-xs">
                  <div className="flex items-center gap-1 hover:text-slate-300 transition cursor-pointer">
                    <Heart className="h-4 w-4" />
                    <span>0</span>
                  </div>
                  <div className="flex items-center gap-1 hover:text-slate-300 transition cursor-pointer">
                    <MessageSquare className="h-4 w-4" />
                    <span>0</span>
                  </div>
                  <div className="flex items-center gap-1 hover:text-slate-300 transition cursor-pointer">
                    <Share2 className="h-4 w-4" />
                    <span>0</span>
                  </div>
                </div>

              </div>
            </motion.div>

            {/* 2. AI SUGGESTION workspace */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className="w-full rounded-[32px] bg-gradient-to-br from-violet-950/30 to-fuchsia-950/30 border border-violet-800/20 backdrop-blur-xl p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-fuchsia-500/10 blur-[40px] pointer-events-none" />
              
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-fuchsia-400 mb-3">
                Co-Pilot Assistant
              </div>
              <div className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-white/5 pb-2 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-fuchsia-400 animate-pulse" />
                AI Creation Engine
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  type="button"
                  onClick={handleCaptionSuggestions}
                  disabled={captionLoading || !content.trim()}
                  className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-violet-500/40 text-slate-300 hover:text-white px-4 py-3 text-xs font-bold transition disabled:opacity-40 disabled:pointer-events-none"
                >
                  {captionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-fuchsia-400" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-fuchsia-400" />
                  )}
                  AI CAPTIONS
                </button>

                <button
                  type="button"
                  onClick={handleHashtagSuggestions}
                  disabled={hashtagLoading || !content.trim()}
                  className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-violet-500/40 text-slate-300 hover:text-white px-4 py-3 text-xs font-bold transition disabled:opacity-40 disabled:pointer-events-none"
                >
                  {hashtagLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  ) : (
                    <Hash className="h-4 w-4 text-blue-400" />
                  )}
                  AUTO HASHTAGS
                </button>
              </div>

              {/* Captions suggestion render lists */}
              {captionSuggestions.length > 0 && (
                <div className="space-y-2 mb-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Suggested Captions
                    </span>
                    <button
                      type="button"
                      onClick={() => setCaptionSuggestions([])}
                      className="text-[10px] text-slate-500 hover:text-white font-bold"
                    >
                      Clear
                    </button>
                  </div>
                  
                  {captionSuggestions.map((caption, index) => (
                    <div
                      key={index}
                      className="group flex items-start gap-3 rounded-xl bg-slate-950/40 border border-slate-800 p-3 hover:border-violet-500/20 transition duration-300"
                    >
                      <p className="flex-1 text-[13px] leading-relaxed text-slate-300">
                        "{caption}"
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setContent(caption);
                          setCaptionSuggestions([]);
                        }}
                        className="shrink-0 rounded-lg bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 text-[11px] font-bold transition shadow"
                      >
                        Apply
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Hashtag suggestions list */}
              {hashtagSuggestions.length > 0 && (
                <div className="space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Recommended Tags
                    </span>
                    <button
                      type="button"
                      onClick={() => setHashtagSuggestions([])}
                      className="text-[10px] text-slate-500 hover:text-white font-bold"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 rounded-xl bg-slate-950/40 border border-slate-800 p-3">
                    {hashtagSuggestions.map((tag, index) => {
                      const normalized = tag.startsWith("#") ? tag : `#${tag}`;
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setContent((current) => `${current} ${normalized}`.trimStart());
                            window.setTimeout(() => textareaRef.current?.focus(), 50);
                          }}
                          className="rounded-full bg-slate-900 border border-slate-800/80 hover:border-violet-500/20 px-3 py-1.5 text-[11.5px] font-semibold text-slate-300 hover:text-white hover:bg-violet-600 transition duration-200"
                        >
                          {normalized}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!content.trim() && (
                <div className="text-center py-6 text-slate-500 text-xs font-semibold">
                  Type something in your post to unlock AI Caption and Hashtag suggestions!
                </div>
              )}

            </motion.div>

          </div>

        </div>
      </div>
    </AppShell>
  );
}

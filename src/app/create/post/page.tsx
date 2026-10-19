"use client";

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  BarChart3,
  Check,
  Clock,
  FileText,
  Hash,
  Heart,
  ImagePlus,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  Radio,
  Share2,
  Smile,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import emojiData from "@emoji-mart/data";

import AppShell from "@/components/AppShell";
import TrendingHashtagStrip from "@/components/composer/TrendingHashtagStrip";
import { Avatar } from "@/components/LetterAvatar";
import type { PostRichText } from "@/components/studio/postStyle";
import { useGlobalToast } from "@/contexts/ToastContext";
import { useMyProfile } from "@/hooks/useEditProfile";
import { formatPostCount, useHashtagSearch } from "@/hooks/useHashtags";
import api from "@/lib/api";
import { serverCode, serverMessage } from "@/features/post-compose/api";
import { ComposeActions } from "@/features/post-compose/components/ComposeActions";
import { MediaStrip } from "@/features/post-compose/components/MediaStrip";
import { CaptionHelpers, DetailRows, TitleField, type DetailsPatch } from "@/features/post-compose/components/PostDetailsFields";
import { usePostDraft, usePostDrafts, useComposeSubmit } from "@/features/post-compose/hooks";
import {
  AUDIENCE_OPTIONS,
  captionTags,
  coverAfterRemove,
  detailsProblem,
  draftBlockReason,
  draftToCompose,
  emptyDetails,
  insertHashMark,
  insertMention,
  MAX_PHOTOS,
  refusalCopy,
  type CaretEdit,
  type ComposeExtras,
  type PostDetailsForm,
} from "@/features/post-compose/model";
import { useComposeMedia } from "@/features/post-compose/useComposeMedia";

const EmojiPicker = lazy(() => import("@emoji-mart/react"));

/*
  The full-page post composer (/create/post), and the draft editor
  (/create/post?draft=<id>).

  The details — photos with their cover, title, "# Hashtags" / "@ Mention",
  Location, Add link, who can view and More options — are the shared form in
  src/features/post-compose, the same one the modal composer uses. Drafts
  saves a server draft; a draft opened here saves over itself and posts by
  saving its edits and then publishing it.
*/

// Stored card backgrounds (existing data: rich_text.background carries the value as is).
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

// The words' colour on a styled card, as the post stores it (rich_text.text_color).
const CARD_TEXT = { onDark: "#ffffff", onLight: "#111111" } as const;
const CUSTOM_START = "#8b5cf6";
const CUSTOM_END = "#ec4899";

const MAX_CHARS = 2000;

const panel = "rounded-[24px] border border-brand-divider bg-brand-card shadow-sm";
const tool =
  "flex h-9 w-9 items-center justify-center rounded-xl text-brand-text/80 transition hover:bg-brand-secondary hover:text-brand-text disabled:pointer-events-none disabled:opacity-30";

export default function CreatePostPage() {
  return (
    <Suspense fallback={null}>
      <CreatePostScreen />
    </Suspense>
  );
}

function CreatePostScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const draftId = params.get("draft");
  const toast = useGlobalToast();
  const { data: profile } = useMyProfile();
  const draft = usePostDraft(draftId);
  const drafts = usePostDrafts(!draftId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Core state
  const [content, setContent] = useState("");
  const photos = useComposeMedia(MAX_PHOTOS);
  const [details, setDetails] = useState<PostDetailsForm>(() => emptyDetails());
  const patchDetails = useCallback((patch: DetailsPatch) => setDetails((d) => ({ ...d, ...patch })), []);
  const [background, setBackground] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // What a draft carried that this page has no control for (a mood from the
  // modal composer, other card styling): kept as it was and sent back.
  const [carried, setCarried] = useState<Pick<ComposeExtras, "feeling" | "activity" | "activityDetail" | "richText">>({});
  const compose = useComposeSubmit(photos.markUploaded);

  // Tab state for style customizers
  const [styleTab, setStyleTab] = useState<"solids" | "gradients" | "custom">("solids");
  const [customGrad1, setCustomGrad1] = useState<string>(CUSTOM_START);
  const [customGrad2, setCustomGrad2] = useState<string>(CUSTOM_END);
  const [customGradAngle, setCustomGradAngle] = useState(135);

  // Poll state
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollMultiple, setPollMultiple] = useState(false);
  const [pollDurationHours, setPollDurationHours] = useState(24);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // AI helpers
  const [captionLoading, setCaptionLoading] = useState(false);
  const [captionSuggestions, setCaptionSuggestions] = useState<string[]>([]);
  const [hashtagLoading, setHashtagLoading] = useState(false);
  const [hashtagSuggestions, setHashtagSuggestions] = useState<string[]>([]);

  // Hashtag autocomplete
  const [hashtagQuery, setHashtagQuery] = useState("");
  const [hashtagRange, setHashtagRange] = useState<{ start: number; end: number } | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(hashtagQuery), 500);
    return () => window.clearTimeout(t);
  }, [hashtagQuery]);
  const { data: hashtagAuto = [], isLoading: hashtagAutoLoading } = useHashtagSearch(debouncedQuery, 8);

  /* Open a draft into the form, once per draft. */
  const hydratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!draftId || !draft.data || hydratedFor.current === draftId) return;
    hydratedFor.current = draftId;
    const state = draftToCompose(draft.data);
    setContent(state.text);
    setDetails(state.details);
    photos.replace(state.media);
    const rich = state.extras.richText ?? null;
    setBackground(typeof rich?.background === "string" ? rich.background : null);
    setCarried({
      feeling: state.extras.feeling,
      activity: state.extras.activity,
      activityDetail: state.extras.activityDetail,
      richText: rich,
    });
    const poll = state.extras.poll;
    if (poll) {
      setShowPoll(true);
      setPollQuestion(poll.question);
      setPollOptions(poll.options.length >= 2 ? poll.options : [...poll.options, "", ""].slice(0, 2));
      setPollMultiple(Boolean(poll.allows_multiple));
      if (poll.duration_hours) setPollDurationHours(poll.duration_hours);
    }
  }, [draft.data, draftId, photos]);

  // The caption's own tags, for the strip's "already used" filter.
  const usedHashtags = useMemo(() => new Set(captionTags(content).hashtags.map((t) => `#${t}`)), [content]);
  const activeHashtags = useMemo(() => Array.from(usedHashtags).slice(0, 6), [usedHashtags]);

  const displayName = profile?.display_name || "User";
  const handleName = profile?.username ? `@${profile.username}` : "@you";
  const firstName = displayName.split(" ")[0] || "you";
  const avatarUrl = profile?.avatar_media_id
    ? `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/v1/media/${profile.avatar_media_id}/serve`
    : undefined;

  const isCustomGrad = background?.startsWith("linear-gradient") ?? false;
  const bgSwatch = SOLID_BACKGROUNDS.find((b) => b.value === background) || PRESET_GRADIENTS.find((g) => g.value === background);
  const onDark = bgSwatch ? Boolean(bgSwatch.dark) : isCustomGrad;
  const cardText = onDark ? CARD_TEXT.onDark : CARD_TEXT.onLight;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) setShowEmojiPicker(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (styleTab === "custom") setBackground(`linear-gradient(${customGradAngle}deg, ${customGrad1} 0%, ${customGrad2} 100%)`);
  }, [customGrad1, customGrad2, customGradAngle, styleTab]);

  const detectActiveHashtag = useCallback((text: string, caret: number): { query: string; start: number; end: number } | null => {
    if (caret <= 0 || caret > text.length) return null;
    let i = caret - 1;
    while (i >= 0) {
      const ch = text[i];
      if (ch === "#") {
        const prev = i === 0 ? "" : text[i - 1];
        if (!(i === 0 || /\s/.test(prev))) return null;
        const query = text.slice(i + 1, caret);
        if (/\s/.test(query)) return null;
        return { query, start: i, end: caret };
      }
      if (/\s/.test(ch)) return null;
      i -= 1;
    }
    return null;
  }, []);

  const trackHashtag = useCallback(
    (text: string, caret: number) => {
      const token = detectActiveHashtag(text, caret);
      setHashtagQuery(token ? token.query : "");
      setHashtagRange(token ? { start: token.start, end: token.end } : null);
    },
    [detectActiveHashtag],
  );

  /** Every edit to the caption from a chip or a suggestion goes through here, caret and all. */
  const editCaption = useCallback(
    (change: (current: string, caret: number) => CaretEdit) => {
      const ta = textareaRef.current;
      const next = change(content, ta?.selectionStart ?? content.length);
      setContent(next.text);
      window.requestAnimationFrame(() => {
        ta?.focus();
        ta?.setSelectionRange(next.caret, next.caret);
      });
    },
    [content],
  );

  const insertHashtag = useCallback(
    (chip: string) => {
      const tag = (chip.startsWith("#") ? chip : `#${chip}`).toLowerCase();
      editCaption((current, caret) => {
        if (hashtagRange) {
          const before = current.slice(0, hashtagRange.start);
          const after = current.slice(hashtagRange.end);
          return { text: `${before}${tag} ${after}`, caret: before.length + tag.length + 1 };
        }
        if (captionTags(current).hashtags.includes(tag.slice(1))) return { text: current, caret };
        const before = current.slice(0, caret);
        const pad = before.length === 0 || /\s$/.test(before) ? "" : " ";
        return { text: `${before}${pad}${tag} ${current.slice(caret)}`, caret: before.length + pad.length + tag.length + 1 };
      });
      setHashtagQuery("");
      setHashtagRange(null);
    },
    [editCaption, hashtagRange],
  );

  const handleImages = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      photos.addFiles(Array.from(event.target.files || []));
      event.target.value = "";
    },
    [photos],
  );

  const removePhoto = useCallback(
    (index: number) => {
      photos.removeAt(index);
      setDetails((d) => ({ ...d, coverIndex: coverAfterRemove(d.coverIndex, index) }));
    },
    [photos],
  );

  const handleEmojiSelect = (emoji: { native: string }) => {
    editCaption((current, caret) => {
      const ta = textareaRef.current;
      const end = ta?.selectionEnd ?? caret;
      return { text: current.slice(0, caret) + emoji.native + current.slice(end), caret: caret + emoji.native.length };
    });
    setShowEmojiPicker(false);
  };

  const handleCaptionSuggestions = useCallback(async () => {
    if (captionLoading) return;
    setCaptionLoading(true);
    setCaptionSuggestions([]);
    try {
      const res = await api.post("/v1/ai/caption-suggestions", { ref_id: "new", ref_type: "post", context_text: content });
      setCaptionSuggestions(res.data?.data?.captions ?? res.data?.captions ?? []);
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
      const res = await api.post("/v1/ai/hashtag-suggestions", { ref_id: "new", ref_type: "post", context_text: content });
      setHashtagSuggestions(res.data?.data?.hashtags ?? res.data?.hashtags ?? []);
    } catch {
      setHashtagSuggestions([]);
    } finally {
      setHashtagLoading(false);
    }
  }, [content, hashtagLoading]);

  /* ─── Post and Drafts ─────────────────────────────────────────── */

  const validPollOptions = pollOptions.filter((o) => o.trim());
  const pollReady = showPoll && Boolean(pollQuestion.trim()) && validPollOptions.length >= 2;
  const pollHalfDone = showPoll && !pollReady && (Boolean(pollQuestion.trim()) || validPollOptions.length > 0);
  const detailsIssue = detailsProblem(details);
  const hasSomething = Boolean(content.trim()) || photos.media.length > 0 || pollReady;
  const canPost = hasSomething && !detailsIssue && !pollHalfDone;
  const draftBlocked = draftBlockReason(photos.media);

  const extras = (): ComposeExtras => {
    const richText: PostRichText | null = (() => {
      const base: PostRichText = { ...(carried.richText ?? {}) };
      delete base.background;
      delete base.text_color;
      if (background) {
        base.background = background;
        base.text_color = cardText;
      }
      return Object.keys(base).length > 0 ? base : null;
    })();
    return {
      contentType: pollReady ? "poll" : "post",
      feeling: carried.feeling ?? null,
      activity: carried.activity ?? null,
      activityDetail: carried.activityDetail ?? null,
      poll: pollReady
        ? { question: pollQuestion.trim(), options: validPollOptions.map((o) => o.trim()), allows_multiple: pollMultiple, duration_hours: pollDurationHours }
        : null,
      richText,
    };
  };

  const submission = () => ({ text: content.trim(), details, media: photos.media, extras: extras(), draftId });

  const handlePublish = async () => {
    if (!canPost || compose.posting || compose.savingDraft) return;
    setError(null);
    try {
      const created = await compose.publish(submission());
      router.push(`/post/${created.id}`);
    } catch (publishError) {
      setError(refusalCopy(serverCode(publishError), serverMessage(publishError), "Failed to create post. Try again."));
    }
  };

  const handleSaveDraft = async () => {
    if (!canPost || draftBlocked || compose.posting || compose.savingDraft) return;
    setError(null);
    try {
      await compose.saveDraft(submission());
      toast({ type: "success", title: draftId ? "Draft saved" : "Saved to drafts" });
      router.push("/create/drafts");
    } catch (saveError) {
      setError(refusalCopy(serverCode(saveError), serverMessage(saveError), "The draft couldn't be saved. Try again."));
    }
  };

  const busy = compose.posting || compose.savingDraft;
  const charPercentage = Math.min((content.length / MAX_CHARS) * 100, 100);
  const isNearLimit = content.length >= MAX_CHARS * 0.9;
  const audience = AUDIENCE_OPTIONS.find((o) => o.value === details.visibility) ?? AUDIENCE_OPTIONS[0];
  const draftCount = drafts.data?.length ?? 0;

  const formatHashtags = (text: string) => {
    if (!text) return <span className="opacity-60">What&apos;s on your mind?</span>;
    return text.split(/(\s+)/).map((token, idx) =>
      /^[#@][\p{L}\p{N}_.]+/u.test(token) ? (
        <span key={idx} className="font-semibold underline-offset-2 hover:underline">
          {token}
        </span>
      ) : (
        token
      ),
    );
  };

  if (draftId && draft.isPending) {
    return (
      <AppShell activeTab="Home">
        <div className="flex min-h-[60vh] items-center justify-center gap-2 text-[14px] text-brand-text/70">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Opening draft…
        </div>
      </AppShell>
    );
  }
  if (draftId && draft.isError) {
    return (
      <AppShell activeTab="Home">
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
          <AlertCircle className="h-8 w-8 text-danger" aria-hidden="true" />
          <p className="text-[15px] font-semibold text-brand-text">This draft couldn&apos;t be opened.</p>
          <p className="text-[13px] text-brand-text/60">It may have been posted or deleted.</p>
          <Link href="/create/drafts" className="rounded-full bg-brand-secondary px-4 py-2 text-[13px] font-semibold text-brand-text hover:bg-brand-text/10">
            Back to drafts
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab="Home">
      <div className="flex min-h-[calc(100vh-80px)] w-full items-start justify-center bg-brand-bg px-4 py-6 sm:py-10">
        <div className="grid w-full max-w-6xl grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* LEFT: the composer and its details */}
          <div className="flex w-full flex-col gap-6 lg:col-span-7">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={`${panel} relative w-full overflow-hidden`}>
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-brand-divider px-6 pb-4 pt-5">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar src={avatarUrl} name={displayName} seed={profile?.id} size="md" className="border border-brand-divider" />
                  <div className="min-w-0 leading-tight">
                    <h1 className="text-[19px] font-semibold text-brand-text">{draftId ? "Edit draft" : "Create post"}</h1>
                    <div className="mt-0.5 truncate text-[12px] text-brand-text/60">
                      Posting as {displayName} · {handleName}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href="/create/drafts"
                    aria-label={draftCount > 0 ? `Your drafts, ${draftCount}` : "Your drafts"}
                    className="flex items-center gap-1.5 rounded-full border border-brand-divider bg-brand-secondary px-3.5 py-2 text-[12px] font-medium text-brand-text transition hover:bg-brand-text/10"
                  >
                    <FileText className="h-3.5 w-3.5 text-primary-ink" aria-hidden="true" />
                    Drafts
                    {!draftId && draftCount > 0 ? <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground">{draftCount}</span> : null}
                  </Link>
                  <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Close"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-divider bg-brand-secondary text-brand-text transition hover:bg-brand-text/10"
                  >
                    <X className="h-[18px] w-[18px]" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Photos */}
              {photos.media.length > 0 ? (
                <div className="px-6 pt-5">
                  <MediaStrip
                    media={photos.media}
                    coverIndex={details.coverIndex}
                    onCover={(coverIndex) => patchDetails({ coverIndex })}
                    onRemove={removePhoto}
                    onAdd={() => fileInputRef.current?.click()}
                    disabled={busy}
                  />
                </div>
              ) : null}

              {/* Title and description */}
              <div className="px-6 pt-5">
                <div className="mb-3 border-b border-brand-divider pb-2">
                  <TitleField value={details.title} onChange={(title) => patchDetails({ title })} disabled={busy} />
                </div>
                <div
                  className={`relative overflow-visible rounded-3xl p-5 transition-all duration-300 ${background ? "" : "border border-brand-divider bg-brand-secondary"}`}
                  style={background ? { background, color: cardText } : undefined}
                >
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(event) => {
                      setContent(event.target.value);
                      trackHashtag(event.target.value, event.target.selectionStart ?? event.target.value.length);
                    }}
                    onSelect={(event) => {
                      const ta = event.target as HTMLTextAreaElement;
                      trackHashtag(ta.value, ta.selectionStart ?? ta.value.length);
                    }}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setHashtagQuery("");
                        setHashtagRange(null);
                      }, 180);
                    }}
                    maxLength={MAX_CHARS}
                    rows={6}
                    autoFocus={!draftId}
                    aria-label="Description"
                    placeholder={`What's on your mind, ${firstName}?`}
                    className={`relative z-10 w-full resize-none bg-transparent text-[17px] leading-[1.6] outline-hidden ${
                      background ? "font-semibold placeholder:text-current placeholder:opacity-60" : "text-brand-text placeholder:text-brand-text/45"
                    }`}
                  />

                  {activeHashtags.length > 0 ? (
                    <div className="relative z-10 mt-3 flex flex-wrap gap-1.5">
                      {activeHashtags.map((tag) => (
                        <span key={tag} className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${background ? "border-current/20 bg-current/10" : "border-brand-divider bg-brand-card text-primary-ink"}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <AnimatePresence>
                    {hashtagRange && (hashtagAutoLoading || hashtagAuto.length > 0) ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="absolute left-4 right-4 top-full z-40 mt-2 max-h-56 overflow-y-auto rounded-2xl border border-brand-divider bg-brand-card p-1.5 text-brand-text shadow-xl"
                        role="listbox"
                        aria-label="Hashtag suggestions"
                      >
                        {hashtagAutoLoading ? (
                          <div className="flex items-center gap-2 p-3 text-[12.5px] text-brand-text/60">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Searching tags…
                          </div>
                        ) : (
                          hashtagAuto.map((tag) => {
                            const rawName = (tag.display_name || tag.normalized_name || "").replace(/^#/, "");
                            return (
                              <button
                                key={tag.normalized_name || rawName}
                                type="button"
                                role="option"
                                aria-selected={false}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => insertHashtag(`#${rawName.toLowerCase()}`)}
                                className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left transition-colors hover:bg-brand-secondary"
                              >
                                <Hash className={`h-4 w-4 ${tag.is_trending ? "text-primary-ink" : "text-brand-text/50"}`} aria-hidden="true" />
                                <span className="flex-1 truncate text-[13px] font-semibold">#{rawName}</span>
                                <span className="text-[11px] font-semibold text-brand-text/60">{formatPostCount(tag.post_count)} posts</span>
                              </button>
                            );
                          })
                        )}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
                <div className={`mt-2 text-right text-[11px] tabular-nums ${isNearLimit ? "font-semibold text-danger" : "text-brand-text/45"}`}>
                  {content.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </div>
              </div>

              <div className="space-y-3 px-6 pt-2">
                <CaptionHelpers
                  disabled={busy}
                  onInsertHashtag={() => editCaption((current, caret) => insertHashMark(current, caret))}
                  onPickMention={(username) => editCaption((current, caret) => insertMention(current, username, caret))}
                  extraHashtags={details.extraHashtags}
                  onRemoveExtraHashtag={(tag) => patchDetails({ extraHashtags: details.extraHashtags.filter((t) => t !== tag) })}
                  extraMentions={details.extraMentions}
                  onRemoveExtraMention={(name) => patchDetails({ extraMentions: details.extraMentions.filter((n) => n !== name) })}
                />
                <TrendingHashtagStrip onTagSelected={insertHashtag} excluded={usedHashtags} label="Trending" />
              </div>

              {/* Poll builder */}
              <AnimatePresence>
                {showPoll ? (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden px-6 pt-4">
                    <div className="relative rounded-2xl border border-brand-divider bg-brand-secondary p-5">
                      <button type="button" onClick={() => setShowPoll(false)} aria-label="Remove poll" className="absolute right-3 top-3 text-brand-text/50 hover:text-brand-text">
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <div className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold text-primary-ink">
                        <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" /> Poll
                      </div>
                      <input
                        type="text"
                        value={pollQuestion}
                        onChange={(e) => setPollQuestion(e.target.value)}
                        placeholder="What's your poll question?"
                        aria-label="Poll question"
                        className="mb-3 w-full rounded-xl border border-brand-divider bg-brand-card px-4 py-2.5 text-[14px] text-brand-text outline-hidden placeholder:text-brand-text/45 focus:border-primary-outline"
                      />
                      <div className="mb-4 space-y-2">
                        {pollOptions.map((opt, oIdx) => (
                          <div key={oIdx} className="flex items-center gap-2">
                            <span className="w-6 text-[11px] font-semibold text-brand-text/50">{oIdx + 1}</span>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => setPollOptions((list) => list.map((o, i) => (i === oIdx ? e.target.value : o)))}
                              placeholder={`Option ${oIdx + 1}${oIdx >= 2 ? " (optional)" : ""}`}
                              aria-label={`Poll option ${oIdx + 1}`}
                              className="flex-1 rounded-lg border border-brand-divider bg-brand-card px-3.5 py-2 text-[13px] text-brand-text outline-hidden focus:border-primary-outline"
                            />
                            {pollOptions.length > 2 ? (
                              <button
                                type="button"
                                onClick={() => setPollOptions((list) => list.filter((_, i) => i !== oIdx))}
                                aria-label={`Remove option ${oIdx + 1}`}
                                className="p-1 text-brand-text/50 hover:text-danger"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            ) : null}
                          </div>
                        ))}
                        {pollOptions.length < 4 ? (
                          <button
                            type="button"
                            onClick={() => setPollOptions((list) => [...list, ""])}
                            className="mt-2 flex items-center gap-1.5 px-1 text-[12px] font-semibold text-primary-ink hover:text-primary-hover"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add another option
                          </button>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-brand-divider pt-3">
                        <label className="flex cursor-pointer select-none items-center gap-2">
                          <input type="checkbox" checked={pollMultiple} onChange={(e) => setPollMultiple(e.target.checked)} className="h-4 w-4 accent-primary" />
                          <span className="text-[12px] font-semibold text-brand-text">Allow more than one choice</span>
                        </label>
                        <label className="flex items-center gap-2 text-brand-text">
                          <Clock className="h-3.5 w-3.5 text-brand-text/60" aria-hidden="true" />
                          <span className="text-[12px] font-semibold">Runs for</span>
                          <select
                            value={pollDurationHours}
                            onChange={(e) => setPollDurationHours(Number(e.target.value))}
                            className="rounded-lg border border-brand-divider bg-brand-card px-2.5 py-1 text-[12px] font-semibold text-brand-text outline-hidden"
                          >
                            <option value={1}>1 hour</option>
                            <option value={6}>6 hours</option>
                            <option value={24}>1 day</option>
                            <option value={72}>3 days</option>
                            <option value={168}>1 week</option>
                          </select>
                        </label>
                      </div>
                      {pollHalfDone ? <p className="mt-3 text-[12px] text-danger">Add the question and at least two options, or remove the poll.</p> : null}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* Card background */}
              <div className="px-6 pt-4">
                <div className="rounded-2xl border border-brand-divider bg-brand-secondary p-4">
                  <div className="mb-3 flex items-center justify-between border-b border-brand-divider pb-3">
                    <div className="flex gap-4" role="tablist" aria-label="Background style">
                      {(["solids", "gradients", "custom"] as const).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          role="tab"
                          aria-selected={styleTab === tab}
                          onClick={() => setStyleTab(tab)}
                          className={`text-[12px] font-semibold transition-colors ${styleTab === tab ? "text-primary-ink" : "text-brand-text/60 hover:text-brand-text"}`}
                        >
                          {tab === "solids" ? "Colours" : tab === "gradients" ? "Gradients" : "Make your own"}
                        </button>
                      ))}
                    </div>
                    {background ? (
                      <button type="button" onClick={() => setBackground(null)} className="flex items-center gap-1 text-[11px] font-semibold text-brand-text/60 transition hover:text-danger">
                        <Undo2 className="h-3 w-3" aria-hidden="true" /> Remove background
                      </button>
                    ) : null}
                  </div>

                  {styleTab === "solids" ? (
                    <div className="flex max-h-24 flex-wrap items-center gap-2 overflow-y-auto py-1">
                      {SOLID_BACKGROUNDS.map((swatch) => (
                        <button
                          key={swatch.label}
                          type="button"
                          aria-label={swatch.label}
                          aria-pressed={swatch.value === background}
                          onClick={() => setBackground(swatch.value)}
                          className="relative flex h-7 w-7 items-center justify-center rounded-full border border-brand-divider shadow-sm transition hover:scale-110"
                          style={{ background: swatch.value ?? "repeating-conic-gradient(var(--brand-divider) 0% 25%, transparent 0% 50%) 50% / 8px 8px" }}
                        >
                          {swatch.value === background ? <Check className="h-3 w-3" style={{ color: swatch.dark ? CARD_TEXT.onDark : CARD_TEXT.onLight }} aria-hidden="true" /> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {styleTab === "gradients" ? (
                    <div className="flex max-h-24 flex-wrap items-center gap-2 overflow-y-auto py-1">
                      {PRESET_GRADIENTS.map((swatch) => (
                        <button
                          key={swatch.label}
                          type="button"
                          aria-label={swatch.label}
                          aria-pressed={swatch.value === background}
                          title={swatch.label}
                          onClick={() => setBackground(swatch.value)}
                          className="relative flex h-7 w-7 items-center justify-center rounded-full border border-brand-divider shadow-sm transition hover:scale-110"
                          style={{ background: swatch.value }}
                        >
                          {swatch.value === background ? <Check className="h-3 w-3" style={{ color: CARD_TEXT.onDark }} aria-hidden="true" /> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {styleTab === "custom" ? (
                    <div className="flex flex-wrap items-center gap-4 py-1.5 text-brand-text">
                      <label className="flex items-center gap-2">
                        <span className="text-[12px] font-semibold">Start</span>
                        <input type="color" value={customGrad1} onChange={(e) => setCustomGrad1(e.target.value)} className="h-6 w-10 cursor-pointer rounded-sm border-0 bg-transparent" />
                      </label>
                      <label className="flex items-center gap-2">
                        <span className="text-[12px] font-semibold">End</span>
                        <input type="color" value={customGrad2} onChange={(e) => setCustomGrad2(e.target.value)} className="h-6 w-10 cursor-pointer rounded-sm border-0 bg-transparent" />
                      </label>
                      <label className="flex min-w-[120px] flex-1 items-center gap-2">
                        <span className="text-[12px] font-semibold">Angle ({customGradAngle}°)</span>
                        <input type="range" min="0" max="360" value={customGradAngle} onChange={(e) => setCustomGradAngle(Number(e.target.value))} className="h-1.5 flex-1 cursor-pointer accent-primary" />
                      </label>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* The details rows */}
              <div className="px-6 pt-4" data-compose="details">
                <DetailRows details={details} onDetails={patchDetails} media={photos.media} onAltText={photos.setAltText} disabled={busy} />
              </div>

              {error ? (
                <div className="px-6 pt-4">
                  <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] font-medium text-danger">
                    <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                    {error}
                  </div>
                </div>
              ) : null}

              {/* Tools, then Drafts and Post */}
              <div className="mt-4 flex flex-col gap-4 border-t border-brand-divider px-6 py-5">
                <div className="relative flex items-center gap-1 self-start rounded-2xl border border-brand-divider bg-brand-secondary p-1.5">
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={photos.media.length >= MAX_PHOTOS || busy} aria-label="Add photos" title="Add photos" className={tool}>
                    <ImagePlus className="h-[18px] w-[18px]" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => setShowPoll((v) => !v)} aria-label="Add a poll" aria-pressed={showPoll} title="Add a poll" className={`${tool} ${showPoll ? "bg-brand-card text-primary-ink" : ""}`}>
                    <BarChart3 className="h-[18px] w-[18px]" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => setShowEmojiPicker((v) => !v)} aria-label="Add an emoji" aria-expanded={showEmojiPicker} title="Add an emoji" className={`${tool} ${showEmojiPicker ? "bg-brand-card text-primary-ink" : ""}`}>
                    <Smile className="h-[18px] w-[18px]" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => router.push("/live/new")} aria-label="Go live" title="Go live" className={tool}>
                    <Radio className="h-[18px] w-[18px]" aria-hidden="true" />
                  </button>

                  <AnimatePresence>
                    {showEmojiPicker ? (
                      <motion.div
                        ref={emojiPickerRef}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        className="absolute bottom-12 left-0 z-50 overflow-hidden rounded-2xl border border-brand-divider bg-brand-card shadow-2xl"
                      >
                        <Suspense
                          fallback={
                            <div className="flex h-40 w-60 items-center justify-center text-xs text-brand-text/60">
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" /> Loading emoji…
                            </div>
                          }
                        >
                          <EmojiPicker data={emojiData} onEmojiSelect={handleEmojiSelect} theme="auto" />
                        </Suspense>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                <ComposeActions
                  onDrafts={handleSaveDraft}
                  onPost={handlePublish}
                  canPost={canPost}
                  posting={compose.posting}
                  savingDraft={compose.savingDraft}
                  draftBlocked={draftBlocked}
                  draftsLabel={draftId ? "Save" : "Drafts"}
                />
              </div>

              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImages} className="hidden" aria-hidden="true" tabIndex={-1} />
            </motion.div>
          </div>

          {/* RIGHT: preview and suggestions */}
          <div className="flex w-full flex-col gap-6 lg:col-span-5">
            <motion.section
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className={`${panel} w-full p-6`}
              aria-label="Preview"
            >
              <h2 className="mb-4 border-b border-brand-divider pb-2 text-[14px] font-semibold text-brand-text">Preview</h2>
              <div className="relative overflow-hidden rounded-2xl border border-brand-divider bg-brand-bg p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar src={avatarUrl} name={displayName} seed={profile?.id} size="sm" className="border border-brand-divider" />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold leading-none text-brand-text">{displayName}</div>
                      <div className="mt-1 text-[11px] leading-none text-brand-text/60">{handleName}</div>
                    </div>
                  </div>
                  <span className="rounded-full border border-brand-divider bg-brand-secondary px-2 py-1 text-[11px] font-semibold text-brand-text">{audience.label}</span>
                </div>

                {details.title.trim() ? <p className="mb-2 text-[15px] font-semibold text-brand-text">{details.title.trim()}</p> : null}

                <div
                  className={`mb-4 flex min-h-[100px] flex-col justify-between rounded-xl p-4 ${background ? "" : "border border-brand-divider bg-brand-secondary text-brand-text"}`}
                  style={background ? { background, color: cardText } : undefined}
                >
                  <p className="wrap-break-word text-[15px] font-medium leading-relaxed">{formatHashtags(content)}</p>
                  {details.locationName.trim() ? (
                    <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold opacity-80">
                      <MapPin className="h-3 w-3" aria-hidden="true" />
                      {details.locationName.trim()}
                    </div>
                  ) : null}
                </div>

                {pollReady || (showPoll && pollQuestion.trim()) ? (
                  <div className="mb-4 rounded-xl border border-brand-divider bg-brand-secondary p-4">
                    <div className="mb-3 text-[12px] font-semibold text-brand-text">{pollQuestion.trim() || "What is your question?"}</div>
                    <div className="mb-3 space-y-2">
                      {pollOptions.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center justify-between rounded-lg border border-brand-divider bg-brand-card px-3 py-2 text-xs font-semibold text-brand-text">
                          <span>{opt.trim() || `Option ${oIdx + 1}`}</span>
                          <span className="text-[11px] text-brand-text/50">0%</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-brand-text/60">
                      <span>{pollMultiple ? "More than one choice" : "One choice"}</span>
                      <span>Ends in {pollDurationHours} h</span>
                    </div>
                  </div>
                ) : null}

                {photos.media.length > 0 ? (
                  <div className={`mb-4 grid gap-2 ${photos.media.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                    {photos.media.slice(0, 4).map((item) => (
                      <div key={item.key} className="overflow-hidden rounded-xl border border-brand-divider">
                        <img src={item.previewUrl} alt={item.altText} className="h-32 w-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="flex items-center justify-between border-t border-brand-divider pt-3 text-xs text-brand-text/60">
                  <span className="flex items-center gap-1"><Heart className="h-4 w-4" aria-hidden="true" /> 0</span>
                  <span className="flex items-center gap-1"><MessageSquare className="h-4 w-4" aria-hidden="true" /> 0</span>
                  <span className="flex items-center gap-1"><Share2 className="h-4 w-4" aria-hidden="true" /> 0</span>
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className={`${panel} w-full p-6`}
              aria-label="Suggestions"
            >
              <h2 className="mb-4 flex items-center gap-1.5 border-b border-brand-divider pb-2 text-[14px] font-semibold text-brand-text">
                <Sparkles className="h-4 w-4 text-primary-ink" aria-hidden="true" /> Suggestions
              </h2>
              <div className="mb-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleCaptionSuggestions}
                  disabled={captionLoading || !content.trim()}
                  className="flex items-center justify-center gap-2 rounded-xl border border-brand-divider bg-brand-secondary px-4 py-3 text-xs font-semibold text-brand-text transition hover:bg-brand-text/10 disabled:pointer-events-none disabled:opacity-40"
                >
                  {captionLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4 text-primary-ink" aria-hidden="true" />}
                  Suggest captions
                </button>
                <button
                  type="button"
                  onClick={handleHashtagSuggestions}
                  disabled={hashtagLoading || !content.trim()}
                  className="flex items-center justify-center gap-2 rounded-xl border border-brand-divider bg-brand-secondary px-4 py-3 text-xs font-semibold text-brand-text transition hover:bg-brand-text/10 disabled:pointer-events-none disabled:opacity-40"
                >
                  {hashtagLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Hash className="h-4 w-4 text-primary-ink" aria-hidden="true" />}
                  Suggest hashtags
                </button>
              </div>

              {captionSuggestions.length > 0 ? (
                <div className="mb-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-brand-text/60">Suggested captions</span>
                    <button type="button" onClick={() => setCaptionSuggestions([])} className="text-[11px] font-semibold text-brand-text/60 hover:text-brand-text">Clear</button>
                  </div>
                  {captionSuggestions.map((caption, index) => (
                    <div key={index} className="flex items-start gap-3 rounded-xl border border-brand-divider bg-brand-secondary p-3">
                      <p className="flex-1 text-[13px] leading-relaxed text-brand-text">{caption}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setContent(caption);
                          setCaptionSuggestions([]);
                        }}
                        className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground transition hover:bg-primary-hover"
                      >
                        Use this
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {hashtagSuggestions.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-brand-text/60">Suggested hashtags</span>
                    <button type="button" onClick={() => setHashtagSuggestions([])} className="text-[11px] font-semibold text-brand-text/60 hover:text-brand-text">Clear</button>
                  </div>
                  <div className="flex flex-wrap gap-2 rounded-xl border border-brand-divider bg-brand-secondary p-3">
                    {hashtagSuggestions.map((tag, index) => {
                      const normalized = tag.startsWith("#") ? tag : `#${tag}`;
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => insertHashtag(normalized)}
                          className="rounded-full border border-brand-divider bg-brand-card px-3 py-1.5 text-[12px] font-semibold text-brand-text transition hover:bg-brand-text/10"
                        >
                          {normalized}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {!content.trim() ? <p className="py-6 text-center text-xs font-semibold text-brand-text/55">Write something first and suggestions can help with the caption and hashtags.</p> : null}
            </motion.section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

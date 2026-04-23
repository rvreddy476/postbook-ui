"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Globe,
  Hash,
  ImagePlus,
  Loader2,
  Lock,
  MapPin,
  PenSquare,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import AppShell from "@/components/AppShell";
import { Avatar } from "@/components/LetterAvatar";
import { useMyProfile } from "@/hooks/useEditProfile";
import { useCreatePost } from "@/hooks/useFeedPosts";
import api from "@/lib/api";
import { uploadMedia } from "@/lib/mediaUpload";
import { POST_CONTENT_TYPES } from "@/types/profile";

const VISIBILITY = [
  { value: "public", label: "Public", icon: Globe },
  { value: "followers", label: "Followers", icon: Users },
  { value: "private", label: "Only me", icon: Lock },
] as const;

function messageFromError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
      ?.message === "string"
  ) {
    return (error as { response: { data: { error: { message: string } } } }).response.data.error.message;
  }

  return "Failed to create post. Try again.";
}

export default function CreatePostPage() {
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const createPost = useCreatePost();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState("");
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [visibility, setVisibility] =
    useState<(typeof VISIBILITY)[number]["value"]>("public");
  const [location, setLocation] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [captionLoading, setCaptionLoading] = useState(false);
  const [captionSuggestions, setCaptionSuggestions] = useState<string[]>([]);
  const [hashtagLoading, setHashtagLoading] = useState(false);
  const [hashtagSuggestions, setHashtagSuggestions] = useState<string[]>([]);

  const displayName = profile?.display_name || "User";
  const avatarUrl = profile?.avatar_media_id
    ? `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/v1/media/${profile.avatar_media_id}/serve`
    : undefined;

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
      if (removed) {
        URL.revokeObjectURL(removed.preview);
      }
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }, []);

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

  const handlePublish = useCallback(async () => {
    if (publishing || (!content.trim() && images.length === 0)) {
      return;
    }

    setPublishing(true);
    setError(null);

    try {
      const mediaIds =
        images.length > 0
          ? await Promise.all(images.map(({ file }) => uploadMedia(file, "image", "general")))
          : undefined;

      const created = await createPost.mutateAsync({
        text: content.trim(),
        visibility,
        content_type: POST_CONTENT_TYPES.POST,
        media_ids: mediaIds,
        location: location.trim() || null,
      });

      images.forEach((image) => URL.revokeObjectURL(image.preview));
      setImages([]);
      setContent("");
      setLocation("");
      router.push(`/post/${created.id}`);
    } catch (publishError) {
      setError(messageFromError(publishError));
    } finally {
      setPublishing(false);
    }
  }, [content, createPost, images, location, publishing, router, visibility]);

  const visibilityOption = VISIBILITY.find((item) => item.value === visibility) ?? VISIBILITY[0];
  const VisibilityIcon = visibilityOption.icon;

  return (
    <AppShell activeTab="Home">
      <div className="mx-auto max-w-[760px] px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50">
              <PenSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-[22px] font-bold text-brand-text">Create Post</h1>
              <p className="text-[12px] text-brand-text/60">
                This page now publishes through the same real post mutation used in the composer.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-xl border border-brand-divider px-4 py-2 text-[12px] font-semibold text-brand-highlight transition-colors hover:bg-brand-secondary"
            >
              Back to feed
            </Link>
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || (!content.trim() && images.length === 0)}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-40"
            >
              {publishing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Posting...
                </>
              ) : (
                "Post"
              )}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-700">
            {error}
          </div>
        ) : null}

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="rounded-[28px] border border-brand-divider/70 bg-brand-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <Avatar
                src={avatarUrl}
                name={displayName}
                seed={profile?.id}
                size="md"
                className="border-2 border-white shadow-sm"
              />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-brand-text">{displayName}</p>
                <button
                  type="button"
                  onClick={() => {
                    const index = VISIBILITY.findIndex((item) => item.value === visibility);
                    setVisibility(VISIBILITY[(index + 1) % VISIBILITY.length].value);
                  }}
                  className="flex items-center gap-1 rounded-full bg-brand-secondary px-2 py-0.5 text-[10px] font-semibold text-brand-highlight transition-colors hover:bg-brand-secondary/80"
                >
                  <VisibilityIcon className="h-3 w-3" />
                  {visibilityOption.label}
                </button>
              </div>
            </div>

            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={2000}
              rows={6}
              autoFocus
              className="w-full resize-none border-0 bg-transparent text-[15px] leading-relaxed text-brand-text placeholder:text-brand-text/30 outline-none"
              placeholder="What's on your mind?"
            />

            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCaptionSuggestions}
                  disabled={captionLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[12px] font-semibold text-violet-600 transition-colors hover:bg-violet-100 disabled:opacity-50"
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
                  className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[12px] font-semibold text-blue-600 transition-colors hover:bg-blue-100 disabled:opacity-50"
                >
                  {hashtagLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Hash className="h-3.5 w-3.5" />
                  )}
                  Hashtags
                </button>
                {(captionSuggestions.length > 0 || hashtagSuggestions.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCaptionSuggestions([]);
                      setHashtagSuggestions([]);
                    }}
                    className="ml-auto flex items-center gap-1 text-[11px] text-brand-text/60 transition-colors hover:text-brand-highlight"
                  >
                    <X className="h-3 w-3" />
                    Clear
                  </button>
                )}
              </div>

              {captionSuggestions.length > 0 && (
                <div className="space-y-2 rounded-xl border border-violet-100 bg-violet-50/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
                    Suggested Captions
                  </p>
                  {captionSuggestions.map((caption, index) => (
                    <div
                      key={`${caption}-${index}`}
                      className="flex items-start gap-2 rounded-lg border border-violet-100 bg-brand-card p-2.5"
                    >
                      <p className="flex-1 text-[13px] leading-relaxed text-brand-text">{caption}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setContent(caption);
                          setCaptionSuggestions([]);
                        }}
                        className="shrink-0 rounded-md bg-violet-600 px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-violet-700"
                      >
                        Use
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {hashtagSuggestions.length > 0 && (
                <div className="space-y-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                    Suggested Hashtags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {hashtagSuggestions.map((tag, index) => {
                      const normalized = tag.startsWith("#") ? tag : `#${tag}`;
                      return (
                        <button
                          key={`${normalized}-${index}`}
                          type="button"
                          onClick={() => setContent((current) => `${current} ${normalized}`.trimStart())}
                          className="rounded-full border border-blue-200 bg-brand-card px-2.5 py-1 text-[12px] font-semibold text-blue-600 transition-all hover:border-blue-600 hover:bg-blue-600 hover:text-white"
                        >
                          {normalized}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {images.length > 0 ? (
              <div className={`mt-4 grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                {images.map((image, index) => (
                  <div key={image.preview} className="relative overflow-hidden rounded-xl">
                    <img src={image.preview} alt="" className="h-48 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-4 flex items-center gap-1 border-t border-brand-divider pt-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={images.length >= 4}
                className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-brand-highlight transition-colors hover:bg-brand-secondary disabled:opacity-40"
              >
                <ImagePlus className="h-4 w-4 text-emerald-500" />
                Photo
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextLocation = prompt("Enter location:");
                  if (nextLocation) {
                    setLocation(nextLocation);
                  }
                }}
                className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-brand-highlight transition-colors hover:bg-brand-secondary"
              >
                <MapPin className="h-4 w-4 text-rose-500" />
                Location
              </button>
              <button
                type="button"
                onClick={() => setContent((current) => `${current} #`.trimStart())}
                className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-brand-highlight transition-colors hover:bg-brand-secondary"
              >
                <Hash className="h-4 w-4 text-blue-500" />
                Tag
              </button>
              <div className="flex-1" />
              <span className="text-[11px] text-brand-text/30">{content.length}/2000</span>
            </div>

            {location ? (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-brand-text/60">
                <MapPin className="h-3 w-3" />
                {location}
                <button
                  type="button"
                  onClick={() => setLocation("")}
                  className="text-brand-text/30 transition-colors hover:text-brand-highlight"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : null}
          </div>
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
    </AppShell>
  );
}

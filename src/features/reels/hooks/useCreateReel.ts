"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import {
  uploadMedia,
  createDraft,
  updateDraft,
  publishDraft,
  createReel,
  extractCoverFrame,
  getProcessingStatus,
} from "@/features/reels/data/reelsApi";
import type {
  ReelVisibility,
  CoverFrameResult,
  LicenseType,
  CommentModeration,
  RemixSetting,
  CommentAccess,
  CopyrightCheck,
} from "@/features/reels/types";

/* ── Constants (from spec) ───────────────────────────────── */

export const REEL_LIMITS = {
  MAX_FILE_SIZE: 500 * 1024 * 1024,
  MAX_DURATION_SEC: 180,
  MIN_DURATION_SEC: 3,
  MAX_CAPTION_LENGTH: 2200,
  MAX_HASHTAGS: 30,
  ACCEPTED_TYPES: ["video/mp4", "video/webm", "video/quicktime"],
} as const;

/* ── Wizard steps ────────────────────────────────────────── */

export type WizardStep = "upload" | "edit" | "details" | "review";
const STEPS: WizardStep[] = ["upload", "edit", "details", "review"];

/* ── State shape ─────────────────────────────────────────── */

export interface CreateReelState {
  step: WizardStep;
  videoFile: File | null;
  videoPreviewUrl: string | null;
  videoDurationSec: number | null;
  mediaId: string | null;
  draftId: string | null;
  uploadProgress: number;
  uploadPhase: "idle" | "uploading" | "confirming" | "creating_draft" | "done" | "error";
  uploadError: string | null;
  /* ── Content ──────────────────────── */
  title: string;
  caption: string;
  hashtags: string[];
  tags: string[];
  /* ── Distribution ─────────────────── */
  visibility: ReelVisibility;
  topicId: number | null;
  category: string;
  language: string;
  seoTitle: string;
  crossPostPostbook: boolean;
  crossPostPosttube: boolean;
  publishToFeed: boolean;
  /* ── Compliance / Disclosure ──────── */
  isMadeForKids: boolean;
  paidPromotion: boolean;
  alteredContent: boolean;
  /* ── Smart features ───────────────── */
  autoChapters: boolean;
  featuredPlaces: boolean;
  autoConcepts: boolean;
  /* ── Rights / Permissions ─────────── */
  license: LicenseType;
  allowEmbedding: boolean;
  remixSetting: RemixSetting;
  /* ── Comments & Ratings ─────────────── */
  likesEnabled: boolean;
  commentsEnabled: boolean;
  commentModeration: CommentModeration;
  commentAccess: CommentAccess;
  /* ── Recording metadata ───────────── */
  recordingDate: string;
  recordingLocation: string;
  /* ── Scheduling ───────────────────── */
  scheduleAt: string | null;
  /* ── Audio ─────────────────────────── */
  originalAudioVolume: number;
  overlayAudioVolume: number;
  /* ── Cover ─────────────────────────── */
  coverTimestampMs: number | null;
  coverResult: CoverFrameResult | null;
  /* ── Processing / Checks ──────────── */
  processingReady: boolean;
  copyrightCheck: CopyrightCheck | null;
}

const INITIAL_STATE: CreateReelState = {
  step: "upload",
  videoFile: null,
  videoPreviewUrl: null,
  videoDurationSec: null,
  mediaId: null,
  draftId: null,
  uploadProgress: 0,
  uploadPhase: "idle",
  uploadError: null,
  title: "",
  caption: "",
  hashtags: [],
  tags: [],
  visibility: "public",
  topicId: null,
  category: "",
  language: "en",
  seoTitle: "",
  crossPostPostbook: true,
  crossPostPosttube: false,
  publishToFeed: true,
  isMadeForKids: false,
  paidPromotion: false,
  alteredContent: false,
  autoChapters: true,
  featuredPlaces: true,
  autoConcepts: true,
  license: "standard",
  allowEmbedding: true,
  remixSetting: "allow",
  likesEnabled: true,
  commentsEnabled: true,
  commentModeration: "basic",
  commentAccess: "everyone",
  recordingDate: "",
  recordingLocation: "",
  scheduleAt: null,
  originalAudioVolume: 1.0,
  overlayAudioVolume: 1.0,
  coverTimestampMs: null,
  coverResult: null,
  processingReady: false,
  copyrightCheck: null,
};

/* ── Validation ──────────────────────────────────────────── */

export function validateVideoFile(file: File): string | null {
  if (!(REEL_LIMITS.ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return "Unsupported format. Use MP4, WebM, or MOV.";
  }
  if (file.size > REEL_LIMITS.MAX_FILE_SIZE) {
    return `File too large. Maximum ${REEL_LIMITS.MAX_FILE_SIZE / (1024 * 1024)} MB.`;
  }
  return null;
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#\w+/g) ?? [];
  return [...new Set(matches.map((t) => t.toLowerCase()))].slice(0, REEL_LIMITS.MAX_HASHTAGS);
}

/* ── Client-side cover frame extraction (fallback) ───────── */

function extractFrameClientSide(
  videoUrl: string,
  timestampMs: number
): Promise<CoverFrameResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;

    // Wait for metadata before seeking — ensures videoWidth/Height are available
    video.onloadedmetadata = () => {
      video.currentTime = timestampMs / 1000;
    };

    video.onseeked = () => {
      // Wait one frame for the browser to actually decode the video frame
      requestAnimationFrame(() => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 360;
          canvas.height = video.videoHeight || 640;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Canvas not supported")); return; }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          // Clean up
          video.removeAttribute("src");
          video.load();
          resolve({
            cover_media_id: `local-cover-${timestampMs}`,
            object_key: "",
            preview_url: dataUrl,
          });
        } catch (err) {
          reject(err);
        }
      });
    };

    video.onerror = () => reject(new Error("Failed to load video for frame extraction"));
    video.src = videoUrl;
  });
}

/* ── Hook ────────────────────────────────────────────────── */

export function useCreateReel() {
  const router = useRouter();
  const [state, setState] = useState<CreateReelState>(INITIAL_STATE);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const patch = useCallback(
    (updates: Partial<CreateReelState>) => setState((prev) => ({ ...prev, ...updates })),
    []
  );

  /* ── File selection ──────────────────────────────── */

  const selectFile = useCallback(
    (file: File) => {
      const error = validateVideoFile(file);
      if (error) {
        patch({ uploadError: error });
        return;
      }

      // Revoke previous blob URL and reset upload-related state
      setState((prev) => {
        if (prev.videoPreviewUrl) URL.revokeObjectURL(prev.videoPreviewUrl);
        return {
          ...INITIAL_STATE,
          step: prev.step, // keep current wizard step
        };
      });

      const previewUrl = URL.createObjectURL(file);

      // Extract duration from video metadata
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = previewUrl;
      video.onloadedmetadata = () => {
        const dur = video.duration;
        // Clean up the metadata-extraction video element
        video.removeAttribute("src");
        video.load();

        if (dur < REEL_LIMITS.MIN_DURATION_SEC) {
          patch({
            uploadError: `Video too short. Minimum ${REEL_LIMITS.MIN_DURATION_SEC} seconds.`,
          });
          URL.revokeObjectURL(previewUrl);
          return;
        }
        if (dur > REEL_LIMITS.MAX_DURATION_SEC) {
          patch({
            uploadError: `Video too long. Maximum ${REEL_LIMITS.MAX_DURATION_SEC} seconds.`,
          });
          URL.revokeObjectURL(previewUrl);
          return;
        }
        patch({
          videoFile: file,
          videoPreviewUrl: previewUrl,
          videoDurationSec: Math.round(dur),
          uploadError: null,
          coverTimestampMs: Math.round((dur / 2) * 1000),
        });
      };
      video.onerror = () => {
        URL.revokeObjectURL(previewUrl);
        patch({ uploadError: "Could not read video file." });
      };
    },
    [patch]
  );

  const clearFile = useCallback(() => {
    setState((prev) => {
      if (prev.videoPreviewUrl) URL.revokeObjectURL(prev.videoPreviewUrl);
      return INITIAL_STATE;
    });
  }, []);

  /* ── Upload + draft creation ─────────────────────── */

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!state.videoFile) throw new Error("No video selected");

      patch({ uploadPhase: "uploading", uploadProgress: 0, uploadError: null });
      const mediaId = await uploadMedia(state.videoFile, (pct) => {
        patch({ uploadProgress: pct });
      });

      patch({ uploadPhase: "creating_draft", mediaId });

      // Try to create a draft via the reels drafts API; fall back gracefully
      // if the endpoint doesn't exist yet (404).
      let draftId: string | null = null;
      try {
        const draft = await createDraft({ media_id: mediaId, visibility: state.visibility });
        draftId = draft.id;
      } catch {
        // Draft endpoint not available — continue without draft
      }

      patch({
        uploadPhase: "done",
        draftId,
        step: "edit",
      });
      return { mediaId, draftId };
    },
    onError: (err: Error) => {
      patch({
        uploadPhase: "error",
        uploadError: err.message || "Upload failed. Please try again.",
      });
    },
  });

  /* ── Processing status polling ───────────────────── */

  useEffect(() => {
    // Clear any stale interval first
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (!state.mediaId || state.processingReady) return;
    if (state.step === "upload") return;

    const mediaId = state.mediaId;
    let cancelled = false;

    pollingRef.current = setInterval(async () => {
      if (cancelled) return;
      try {
        const status = await getProcessingStatus(mediaId);
        if (cancelled) return;
        if (status.all_ready) {
          patch({ processingReady: true });
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);

    return () => {
      cancelled = true;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [state.mediaId, state.processingReady, state.step, patch]);

  /* ── Cover frame extraction ──────────────────────── */

  const extractCoverMutation = useMutation({
    mutationFn: async (timestampMs: number) => {
      // Prefer client-side canvas extraction (instant, no server dependency like ffmpeg)
      if (state.videoPreviewUrl) {
        try {
          return await extractFrameClientSide(state.videoPreviewUrl, timestampMs);
        } catch {
          // Canvas extraction failed — fall through to server
        }
      }

      // Server-side fallback (requires ffmpeg on backend)
      if (state.mediaId) {
        return await extractCoverFrame({ mediaId: state.mediaId, timestampMs });
      }

      throw new Error("No video preview available");
    },
    onSuccess: (result) => {
      patch({ coverResult: result });
    },
  });

  /* ── Save draft (auto-save on step change) ───────── */

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!state.draftId) return; // no draft endpoint — skip silently
      const hashtags = extractHashtags(state.caption);
      patch({ hashtags });
      try {
        await updateDraft(state.draftId, {
          title: state.title || undefined,
          caption: state.caption,
          hashtags,
          tags: state.tags.length > 0 ? state.tags : undefined,
          visibility: state.visibility,
          topic_id: state.topicId ?? undefined,
          category: state.category || undefined,
          language: state.language,
          seo_title: state.seoTitle || undefined,
          original_audio_volume: state.originalAudioVolume,
          overlay_audio_volume: state.overlayAudioVolume,
          cover_media_id: state.coverResult?.cover_media_id,
          cross_post_postbook: state.crossPostPostbook,
          cross_post_posttube: state.crossPostPosttube,
          publish_to_feed: state.publishToFeed,
          is_made_for_kids: state.isMadeForKids,
          paid_promotion: state.paidPromotion,
          altered_content: state.alteredContent,
          auto_chapters: state.autoChapters,
          featured_places: state.featuredPlaces,
          auto_concepts: state.autoConcepts,
          license: state.license,
          allow_embedding: state.allowEmbedding,
          remix_setting: state.remixSetting,
          likes_enabled: state.likesEnabled,
          comments_enabled: state.commentsEnabled,
          comment_moderation: state.commentModeration,
          comment_access: state.commentAccess,
          recording_date: state.recordingDate || undefined,
          recording_location: state.recordingLocation || undefined,
          schedule_at: state.scheduleAt ?? undefined,
        });
      } catch {
        // Draft update failed (endpoint may not exist) — continue silently
      }
    },
  });

  /* ── Publish ─────────────────────────────────────── */

  const publishMutation = useMutation({
    mutationFn: async (params?: { scheduleAt?: string }) => {
      if (!state.mediaId) throw new Error("No media uploaded");

      // If we have a draft, try the draft publish flow
      if (state.draftId) {
        try {
          await saveDraftMutation.mutateAsync();
          return await publishDraft(
            state.draftId,
            params?.scheduleAt ? { schedule_at: params.scheduleAt } : undefined
          );
        } catch {
          // Draft publish failed — fall through to direct create
        }
      }

      // Fallback: publish directly via POST /v1/posts
      const hashtags = extractHashtags(state.caption);
      return createReel({
        text: state.caption,
        mediaIds: [state.mediaId],
        visibility: state.visibility,
        hashtags,
      });
    },
    onSuccess: (reel) => {
      router.push(`/reels?reelId=${reel.reel_id}`);
    },
  });

  /* ── Navigation ──────────────────────────────────── */

  const goToStep = useCallback(
    (step: WizardStep) => {
      // Auto-save draft when leaving details
      if (state.step === "details" && state.draftId) {
        void saveDraftMutation.mutateAsync();
      }
      patch({ step });
    },
    [state.step, state.draftId, patch, saveDraftMutation]
  );

  const canGoNext = useCallback(() => {
    switch (state.step) {
      case "upload":
        return state.uploadPhase === "done";
      case "edit":
        return true;
      case "details":
        return (
          state.title.length > 0 &&
          state.caption.length <= REEL_LIMITS.MAX_CAPTION_LENGTH
        );
      case "review":
        return true;
      default:
        return false;
    }
  }, [state.step, state.uploadPhase, state.title, state.caption]);

  const nextStep = useCallback(() => {
    const currentIdx = STEPS.indexOf(state.step);
    if (currentIdx < STEPS.length - 1 && canGoNext()) {
      goToStep(STEPS[currentIdx + 1]);
    }
  }, [state.step, canGoNext, goToStep]);

  const prevStep = useCallback(() => {
    const currentIdx = STEPS.indexOf(state.step);
    if (currentIdx > 0) {
      goToStep(STEPS[currentIdx - 1]);
    }
  }, [state.step, goToStep]);

  /* ── Cleanup preview URL on unmount ──────────────── */

  const videoPreviewUrlRef = useRef(state.videoPreviewUrl);
  videoPreviewUrlRef.current = state.videoPreviewUrl;

  useEffect(() => {
    return () => {
      if (videoPreviewUrlRef.current) URL.revokeObjectURL(videoPreviewUrlRef.current);
    };
  }, []);

  return {
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
  } as const;
}

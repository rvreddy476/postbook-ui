"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import {
  uploadMedia,
  createDraft,
  updateDraft,
  publishDraft,
  createReel,
  extractCoverFrame,
  getProcessingStatus,
} from "@/features/reels/data/reelsApi";
import type { CoverFrameResult } from "@/features/reels/types";

import { STEP_SCHEMAS, type ContentType, type StepId } from "./tokens";
import { type StudioFormState, INITIAL_FORM_STATE } from "./types";

/* ── Constants ─────────────────────────────────────────── */

const MAX_CAPTION = 2200;
const MAX_HASHTAGS = 30;
const ACCEPTED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_FILE_SIZE_DEFAULT = 500 * 1024 * 1024;

/* ── Helpers ───────────────────────────────────────────── */

function extractHashtags(text: string): string[] {
  const matches = text.match(/#\w+/g) ?? [];
  return [...new Set(matches.map((t) => t.toLowerCase()))].slice(0, MAX_HASHTAGS);
}

function extractFrameClientSide(videoUrl: string, timestampMs: number): Promise<CoverFrameResult> {
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
          canvas.width = video.videoWidth || 360;
          canvas.height = video.videoHeight || 640;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Canvas not supported")); return; }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          video.removeAttribute("src");
          video.load();
          resolve({ cover_media_id: `local-cover-${timestampMs}`, object_key: "", preview_url: dataUrl });
        } catch (err) { reject(err); }
      });
    };
    video.onerror = () => reject(new Error("Failed to load video for frame extraction"));
    video.src = videoUrl;
  });
}

/* ── Hook ──────────────────────────────────────────────── */

export function useUploadStudio(contentType: ContentType) {
  const [form, setForm] = useState<StudioFormState>({ ...INITIAL_FORM_STATE, contentType, currentStep: "video" });
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const steps = STEP_SCHEMAS[contentType];

  const patch = useCallback(
    (updates: Partial<StudioFormState>) => setForm((prev) => ({ ...prev, ...updates })),
    [],
  );

  /* ── File selection ──────────────────────────────── */

  const selectFile = useCallback(
    (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type) && !file.type.startsWith("audio/")) {
        patch({ uploadError: "Unsupported format. Use MP4, WebM, or MOV." });
        return;
      }
      if (file.size > MAX_FILE_SIZE_DEFAULT) {
        patch({ uploadError: `File too large. Maximum ${MAX_FILE_SIZE_DEFAULT / (1024 * 1024)} MB.` });
        return;
      }

      setForm((prev) => {
        if (prev.videoPreviewUrl) URL.revokeObjectURL(prev.videoPreviewUrl);
        return { ...INITIAL_FORM_STATE, contentType, currentStep: prev.currentStep };
      });

      const previewUrl = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = previewUrl;
      video.onloadedmetadata = () => {
        const dur = video.duration;
        video.removeAttribute("src");
        video.load();
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
    [contentType, patch],
  );

  const clearFile = useCallback(() => {
    setForm((prev) => {
      if (prev.videoPreviewUrl) URL.revokeObjectURL(prev.videoPreviewUrl);
      return { ...INITIAL_FORM_STATE, contentType, currentStep: "video" };
    });
  }, [contentType]);

  /* ── Upload + draft creation ─────────────────────── */

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!form.videoFile) throw new Error("No video selected");
      patch({ uploadPhase: "uploading", uploadProgress: 0, uploadError: null });

      const mediaId = await uploadMedia(form.videoFile, (pct) => patch({ uploadProgress: pct }));
      patch({ uploadPhase: "creating_draft", mediaId });

      let draftId: string | null = null;
      try {
        const draft = await createDraft({ media_id: mediaId, visibility: form.visibility });
        draftId = draft.id;
      } catch {
        // Draft endpoint not available
      }

      patch({ uploadPhase: "done", draftId });
      return { mediaId, draftId };
    },
    onError: (err: Error) => {
      patch({ uploadPhase: "error", uploadError: err.message || "Upload failed." });
    },
  });

  /* ── Auto-upload when a file is selected ─────────── */

  const uploadTriggeredRef = useRef<string | null>(null);
  useEffect(() => {
    if (form.videoFile && form.uploadPhase === "idle") {
      const fileKey = form.videoFile.name + form.videoFile.size;
      if (uploadTriggeredRef.current !== fileKey) {
        uploadTriggeredRef.current = fileKey;
        uploadMutation.mutate();
      }
    }
  }, [form.videoFile, form.uploadPhase, uploadMutation]);

  /* ── Processing status polling ───────────────────── */

  useEffect(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    if (!form.mediaId || form.processingReady) return;

    const mediaId = form.mediaId;
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
      } catch { /* ignore */ }
    }, 3000);

    return () => {
      cancelled = true;
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [form.mediaId, form.processingReady, patch]);

  /* ── Cover frame extraction ──────────────────────── */

  const extractCoverMutation = useMutation({
    mutationFn: async (timestampMs: number) => {
      if (form.videoPreviewUrl) {
        try { return await extractFrameClientSide(form.videoPreviewUrl, timestampMs); } catch { /* fall through */ }
      }
      if (form.mediaId) {
        return await extractCoverFrame({ mediaId: form.mediaId, timestampMs });
      }
      throw new Error("No video available");
    },
    onSuccess: (result) => patch({ coverResult: result }),
  });

  /* ── Save draft ──────────────────────────────────── */

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!form.draftId) return;
      const hashtags = extractHashtags(form.caption);
      patch({ hashtags });
      try {
        await updateDraft(form.draftId, {
          title: form.title || undefined,
          caption: form.caption,
          hashtags,
          tags: form.tags.length > 0 ? form.tags : undefined,
          visibility: form.visibility,
          category: form.category || undefined,
          language: form.language,
          original_audio_volume: form.originalAudioVolume,
          overlay_audio_volume: form.overlayAudioVolume,
          cover_media_id: form.coverResult?.cover_media_id,
          cross_post_postbook: form.crossPostPostbook,
          cross_post_posttube: form.crossPostPosttube,
          publish_to_feed: form.publishToFeed,
          is_made_for_kids: form.isMadeForKids,
          paid_promotion: form.paidPromotion,
          altered_content: form.alteredContent,
          auto_chapters: form.autoChapters,
          featured_places: form.featuredPlaces,
          auto_concepts: form.autoConcepts,
          license: form.license,
          allow_embedding: form.allowEmbedding,
          remix_setting: form.remixSetting,
          likes_enabled: form.likesEnabled,
          comments_enabled: form.commentsEnabled,
          comment_moderation: form.commentModeration,
          comment_access: form.commentAccess,
          recording_date: form.recordingDate || undefined,
          recording_location: form.recordingLocation || undefined,
          schedule_at: form.scheduleAt ?? undefined,
        });
      } catch { /* silently continue */ }
    },
  });

  /* ── Publish ─────────────────────────────────────── */

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!form.mediaId) throw new Error("No media uploaded");

      if (form.draftId) {
        try {
          await saveDraftMutation.mutateAsync();
          return await publishDraft(
            form.draftId,
            form.scheduleAt ? { schedule_at: form.scheduleAt } : undefined,
          );
        } catch { /* fall through */ }
      }

      const hashtags = extractHashtags(form.caption);
      return createReel({
        text: form.caption,
        mediaIds: [form.mediaId],
        visibility: form.visibility,
        hashtags,
      });
    },
    onSuccess: (reel) => {
      patch({ publishedPostId: reel.reel_id, publishSuccess: true });
    },
  });

  /* ── Step navigation ─────────────────────────────── */

  const currentStepIndex = steps.indexOf(form.currentStep);

  const goToStep = useCallback(
    (step: StepId) => {
      if (form.currentStep === "details" && form.draftId) {
        void saveDraftMutation.mutateAsync();
      }
      patch({ currentStep: step });
    },
    [form.currentStep, form.draftId, patch, saveDraftMutation],
  );

  const nextStep = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      goToStep(steps[currentStepIndex + 1]);
    }
  }, [currentStepIndex, steps, goToStep]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      goToStep(steps[currentStepIndex - 1]);
    }
  }, [currentStepIndex, steps, goToStep]);

  const canGoNext = form.videoFile !== null && form.title.length > 0 && form.caption.length <= MAX_CAPTION;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  /* ── Cleanup on unmount ──────────────────────────── */

  const previewUrlRef = useRef(form.videoPreviewUrl);
  previewUrlRef.current = form.videoPreviewUrl;
  useEffect(() => {
    return () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); };
  }, []);

  return {
    form,
    patch,
    steps,
    currentStepIndex,
    selectFile,
    clearFile,
    uploadMutation,
    extractCoverMutation,
    saveDraftMutation,
    publishMutation,
    goToStep,
    nextStep,
    prevStep,
    canGoNext,
    isFirstStep,
    isLastStep,
  } as const;
}

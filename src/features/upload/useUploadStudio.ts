"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  uploadMedia,
  uploadMediaResumable,
  RESUMABLE_UPLOAD_THRESHOLD,
  createDraft,
  updateDraft,
  publishDraft,
  createReel,
  getProcessingStatus,
  uploadCoverDataUrl,
} from "@/features/reels/data/reelsApi";
import {
  createSubtitleTrack,
  getSubtitleTracks,
  overrideVideoCategory,
  setCoverFrame,
  updateVideoTrim,
} from "@/features/posttube/data/posttubeApi";

import { STEP_SCHEMAS, CONTENT_TYPE_META, type ContentType, type StepId } from "./tokens";
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

/**
 * Combines user-entered chip hashtags with hashtags inline in the caption.
 * Returns a deduplicated, lowercased list capped at MAX_HASHTAGS — chips first
 * (user-explicit), then any inline ones not already present.
 */
function mergeHashtags(chips: string[], caption: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...chips, ...extractHashtags(caption)]) {
    const norm = raw.toLowerCase().startsWith("#")
      ? raw.toLowerCase()
      : `#${raw.toLowerCase()}`;
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
      if (out.length >= MAX_HASHTAGS) break;
    }
  }
  return out;
}

/**
 * Classify video per spec v2.1:
 * - Flick: duration ≤ 180s AND (portrait OR square)
 * - LongVideo: duration > 180s (any orientation) OR landscape (any duration)
 */
export function classifyVideo(
  durationSec: number | null,
  width: number | null,
  height: number | null,
): "flick" | "long_video" {
  if (durationSec == null) return "long_video";
  const isLandscape = (width ?? 0) > (height ?? 0);
  if (durationSec <= 180 && !isLandscape) return "flick";
  return "long_video";
}

/** Extract a single frame from a local video as a JPEG data URL. Client-side only. */
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
          canvas.width = video.videoWidth || 360;
          canvas.height = video.videoHeight || 640;
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
    video.onerror = () => reject(new Error("Failed to load video for frame extraction"));
    video.src = videoUrl;
  });
}

/* ── Hook ──────────────────────────────────────────────── */

export function useUploadStudio(contentType: ContentType) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<StudioFormState>({ ...INITIAL_FORM_STATE, contentType, currentStep: "video" });
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subtitleUploadKeyRef = useRef<string | null>(null);
  const steps = STEP_SCHEMAS[contentType];
  const isLongStudio = contentType === "long" || contentType === "podcast";

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

      subtitleUploadKeyRef.current = null;
      uploadTriggeredRef.current = null;

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
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        video.removeAttribute("src");
        video.load();

        // Enforce max duration (12 hours for long, 3 min for flicks)
        const meta = CONTENT_TYPE_META[contentType];
        const maxDur = meta.maxDuration;

        if (Math.round(dur) > maxDur) {
          URL.revokeObjectURL(previewUrl);
          const maxMin = Math.floor(maxDur / 60);
          const isFlick = contentType === "reel" || contentType === "short";
          patch({
            uploadError: isFlick
              ? `Reels must be ${maxMin} minutes or less. This video is ${Math.ceil(dur / 60)} minutes. Upload it as a Video instead.`
              : `Maximum duration is ${maxMin} minutes for ${meta.label}.`,
          });
          return;
        }

        const computedCategory = classifyVideo(Math.round(dur), vw || null, vh || null);

        patch({
          videoFile: file,
          videoPreviewUrl: previewUrl,
          videoDurationSec: Math.round(dur),
          videoWidth: vw || null,
          videoHeight: vh || null,
          uploadError: null,
          coverTimestampMs: Math.round((dur / 2) * 1000),
          trimStartMs: 0,
          trimEndMs: null,
          computedVideoCategory: computedCategory,
          finalVideoCategory: computedCategory,
          subtitleTracks: [],
          subtitleUploadState: "idle",
          subtitleUploadError: null,
          processingReady: false,
          processingStatus: "idle",
          processingError: null,
          publishWarning: null,
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
    subtitleUploadKeyRef.current = null;
    uploadTriggeredRef.current = null;
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

      // Large videos take the resumable (chunked) path so a dropped
      // connection costs one 5 MB part, not the whole upload.
      const upload =
        form.videoFile.size >= RESUMABLE_UPLOAD_THRESHOLD
          ? uploadMediaResumable
          : uploadMedia;
      const mediaId = await upload(form.videoFile, (pct) => patch({ uploadProgress: pct }));
      patch({ uploadPhase: "creating_draft", mediaId });

      let draftId: string | null = null;
      try {
        const draft = await createDraft({ media_id: mediaId, visibility: form.visibility });
        draftId = draft.id;
      } catch {
        // Draft endpoint not available
      }

      patch({
        uploadPhase: "done",
        draftId,
        processingReady: false,
        processingStatus: "processing",
        processingError: null,
      });
      return { mediaId, draftId };
    },
    onError: (err: Error) => {
      patch({ uploadPhase: "error", uploadError: err.message || "Upload failed." });
    },
  });

  /* ── Deferred upload ─────────────────────────────────
   * The file is NOT uploaded on selection — we keep only a local reference and
   * a blob preview (no API calls, no orphaned objects in storage). The actual
   * upload + DB record + transcode all happen on Publish (and on explicit Save
   * Draft). This ref tracks the no-longer-used auto-upload key.
   */
  const uploadTriggeredRef = useRef<string | null>(null);

  /* ── Processing status polling ───────────────────── */

  useEffect(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    if (!form.mediaId || form.processingReady || form.processingStatus === "failed") return;

    const mediaId = form.mediaId;
    let cancelled = false;

    pollingRef.current = setInterval(async () => {
      if (cancelled) return;
      try {
        const status = await getProcessingStatus(mediaId);
        if (cancelled) return;
        if (status.all_ready) {
          patch({ processingReady: true, processingStatus: "ready", processingError: null });
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          return;
        }
        const hasFailedRendition = status.status === "failed" || status.renditions?.some((rendition) => rendition.status === "failed");
        if (hasFailedRendition) {
          patch({
            processingReady: false,
            processingStatus: "failed",
            processingError: "Processing failed for this upload. Replace the file or check again if renditions recover.",
          });
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          return;
        }
        patch({ processingReady: false, processingStatus: "processing", processingError: null });
      } catch { /* ignore */ }
    }, 3000);

    return () => {
      cancelled = true;
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [form.mediaId, form.processingReady, form.processingStatus, patch]);

  /* ── Cover poster — local-only preview extraction ── */

  const retryProcessingCheck = useCallback(async () => {
    if (!form.mediaId) return;

    patch({
      processingReady: false,
      processingStatus: "processing",
      processingError: null,
    });

    try {
      const status = await getProcessingStatus(form.mediaId);
      if (status.all_ready) {
        patch({ processingReady: true, processingStatus: "ready", processingError: null });
        return;
      }

      const hasFailedRendition = status.status === "failed" || status.renditions?.some((rendition) => rendition.status === "failed");
      if (hasFailedRendition) {
        patch({
          processingReady: false,
          processingStatus: "failed",
          processingError: "Processing failed for this upload. Replace the file or check again if renditions recover.",
        });
        return;
      }

      patch({ processingReady: false, processingStatus: "processing", processingError: null });
    } catch {
      patch({
        processingReady: false,
        processingStatus: "failed",
        processingError: "Processing status could not be confirmed. Try checking again.",
      });
    }
  }, [form.mediaId, patch]);

  useEffect(() => {
    if (!form.mediaId) {
      subtitleUploadKeyRef.current = null;
      patch({
        subtitleTracks: [],
        subtitleUploadState: "idle",
        subtitleUploadError: null,
      });
      return;
    }

    const mediaId = form.mediaId;
    let cancelled = false;

    void getSubtitleTracks(mediaId)
      .then((tracks) => {
        if (cancelled) return;
        setForm((prev) => {
          if (prev.mediaId !== mediaId) return prev;
          if (tracks.length === 0 && prev.subtitleTracks.length > 0) return prev;
          return { ...prev, subtitleTracks: tracks };
        });
      })
      .catch(() => {
        if (cancelled) return;
        setForm((prev) => (prev.mediaId === mediaId ? { ...prev, subtitleTracks: prev.subtitleTracks } : prev));
      });

    return () => {
      cancelled = true;
    };
  }, [form.mediaId, patch]);

  useEffect(() => {
    if (!form.mediaId || !form.subtitlesFile) {
      subtitleUploadKeyRef.current = null;
      if (!form.subtitlesFile) {
        patch({
          subtitleUploadState: "idle",
          subtitleUploadError: null,
        });
      }
      return;
    }

    const uploadKey = `${form.mediaId}:${form.subtitlesFile.name}:${form.subtitlesFile.size}:${form.language}`;
    if (subtitleUploadKeyRef.current === uploadKey || form.subtitleUploadState === "uploading") {
      return;
    }

    subtitleUploadKeyRef.current = uploadKey;
    patch({ subtitleUploadState: "uploading", subtitleUploadError: null });

    let cancelled = false;

    void createSubtitleTrack(form.mediaId, {
      language: form.language,
      file: form.subtitlesFile,
    })
      .then((track) => {
        if (cancelled) return;
        setForm((prev) => {
          const dedupedTracks = prev.subtitleTracks.filter((item) => item.id !== track.id);
          return {
            ...prev,
            subtitleTracks: [...dedupedTracks, track],
            subtitleUploadState: "done",
            subtitleUploadError: null,
          };
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        subtitleUploadKeyRef.current = null;
        patch({
          subtitleUploadState: "error",
          subtitleUploadError: error instanceof Error ? error.message : "Subtitle upload failed.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [form.language, form.mediaId, form.subtitleUploadState, form.subtitlesFile, patch]);

  const extractCoverPreview = useMutation({
    mutationFn: async (timestampMs: number) => {
      if (!form.videoPreviewUrl) throw new Error("No video available");
      return extractFrameClientSide(form.videoPreviewUrl, timestampMs);
    },
    onSuccess: (dataUrl) => patch({ coverPreviewUrl: dataUrl, coverResult: null }),
  });

  /* ── Custom cover image selection (local-only) ──── */

  const selectCustomCover = useCallback(
    (file: File) => {
      const allowed = ["image/jpeg", "image/png", "image/webp"];
      if (!allowed.includes(file.type)) {
        patch({ uploadError: "Cover image must be JPEG, PNG, or WebP." });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        patch({ uploadError: "Cover image must be under 10 MB." });
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      patch({
        coverSourceType: "custom_image",
        customCoverFile: file,
        customCoverPreviewUrl: previewUrl,
        coverPreviewUrl: null,
        coverResult: null,
        uploadError: null,
      });
    },
    [patch],
  );

  /* ── Save draft ──────────────────────────────────── */

  /** Save draft. Optional coverMediaIdOverride is used at publish time
   *  when the cover was just uploaded and form state hasn't caught up yet. */
  const saveDraftWithCover = useCallback(async (coverMediaIdOverride?: string, draftIdOverride?: string) => {
    const draftId = draftIdOverride ?? form.draftId;
    if (!draftId) return;
    // Merge: chip-entered hashtags survive even if the user hasn't typed them
    // in the caption. Earlier code overwrote form.hashtags with caption-only
    // extraction, silently wiping the chip input.
    const hashtags = mergeHashtags(form.hashtags, form.caption);
    patch({ hashtags });
    const classified = classifyVideo(form.videoDurationSec, form.videoWidth, form.videoHeight);
    try {
      await updateDraft(draftId, {
        title: form.title || undefined,
        caption: form.caption,
        hashtags,
        tags: form.tags.length > 0 ? form.tags : undefined,
        visibility: form.visibility,
        category: form.category || undefined,
        language: form.language,
        content_type: classified,
        original_audio_volume: form.originalAudioVolume,
        overlay_audio_volume: form.overlayAudioVolume,
        cover_media_id: coverMediaIdOverride ?? form.coverResult?.cover_media_id,
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
  }, [form, patch]);

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!form.videoFile) return;
      // Saving a draft is an explicit commit, so we upload the video now (if it
      // hasn't been uploaded already) and create the draft record.
      let mediaId = form.mediaId;
      if (!mediaId) {
        patch({ uploadPhase: "uploading", uploadProgress: 0, uploadError: null });
        const upload =
          form.videoFile.size >= RESUMABLE_UPLOAD_THRESHOLD ? uploadMediaResumable : uploadMedia;
        mediaId = await upload(form.videoFile, (pct) => patch({ uploadProgress: pct }));
        patch({ uploadPhase: "done", mediaId, processingStatus: "processing" });
      }
      let draftId = form.draftId;
      if (!draftId) {
        const draft = await createDraft({ media_id: mediaId, visibility: form.visibility });
        draftId = draft.id;
        patch({ draftId });
      }
      await saveDraftWithCover(undefined, draftId);
    },
  });

  /* ── Publish ─────────────────────────────────────── */

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!form.videoFile && !form.mediaId) throw new Error("No video selected");

      // 1. Upload the video NOW (deferred from selection). This is the only
      //    point at which bytes hit storage — abandoned drafts cost nothing.
      let mediaId = form.mediaId;
      if (!mediaId) {
        if (!form.videoFile) throw new Error("No video selected");
        patch({ uploadPhase: "uploading", uploadProgress: 0, uploadError: null });
        const upload =
          form.videoFile.size >= RESUMABLE_UPLOAD_THRESHOLD ? uploadMediaResumable : uploadMedia;
        mediaId = await upload(form.videoFile, (pct) => patch({ uploadProgress: pct }));
        patch({ uploadPhase: "done", mediaId, processingStatus: "processing" });
      }

      // 2. Upload the cover (frame or custom image), if chosen.
      let coverMediaId: string | undefined;
      if (form.coverSourceType === "custom_image" && form.customCoverFile) {
        coverMediaId = await uploadMedia(form.customCoverFile);
      } else if (form.coverSourceType === "video_frame" && form.coverPreviewUrl) {
        coverMediaId = await uploadCoverDataUrl(form.coverPreviewUrl);
      }

      // 3. Upload subtitles, if provided and not already uploaded.
      if (form.subtitlesFile && form.subtitleTracks.length === 0) {
        const uploadKey = `${mediaId}:${form.subtitlesFile.name}:${form.subtitlesFile.size}:${form.language}`;
        subtitleUploadKeyRef.current = uploadKey; // stop the auto-effect re-uploading
        try {
          await createSubtitleTrack(mediaId, { language: form.language, file: form.subtitlesFile });
        } catch {
          /* non-fatal — caption track can be added later */
        }
      }

      // 4. Save to the database. Server-side transcoding runs asynchronously;
      //    the post becomes visible to viewers once renditions are ready.
      if (form.draftId) {
        try {
          await saveDraftWithCover(coverMediaId);
          const reel = await publishDraft(
            form.draftId,
            form.scheduleAt ? { schedule_at: form.scheduleAt } : undefined,
          );
          return { reel, coverMediaId };
        } catch { /* fall through to direct create */ }
      }

      const hashtags = mergeHashtags(form.hashtags, form.caption);
      const classified = classifyVideo(form.videoDurationSec, form.videoWidth, form.videoHeight);
      const reel = await createReel({
        text: form.caption,
        mediaIds: [mediaId],
        visibility: form.visibility,
        hashtags,
        cover_media_id: coverMediaId,
        content_type: classified,
        publish_to_feed: form.publishToFeed,
      });
      return { reel, coverMediaId };
    },
    onSuccess: async ({ reel, coverMediaId }) => {
      const postId = reel.reel_id;
      const warnings: string[] = [];

      if (isLongStudio && !form.scheduleAt) {
        if (form.trimStartMs > 0 || form.trimEndMs != null) {
          try {
            await updateVideoTrim(postId, form.trimStartMs, form.trimEndMs ?? undefined);
          } catch {
            warnings.push("Trim settings could not be saved.");
          }
        }

        if (form.finalVideoCategory && form.computedVideoCategory && form.finalVideoCategory !== form.computedVideoCategory) {
          try {
            await overrideVideoCategory(postId, form.finalVideoCategory);
          } catch {
            warnings.push("Video category override could not be saved.");
          }
        }

        if (coverMediaId || form.coverTimestampMs != null) {
          try {
            await setCoverFrame(postId, {
              cover_media_id: coverMediaId,
              timestamp_ms: form.coverSourceType === "video_frame" ? (form.coverTimestampMs ?? undefined) : undefined,
            });
          } catch {
            warnings.push("Cover selection could not be saved.");
          }
        }
      }

      patch({
        publishedPostId: postId,
        publishSuccess: true,
        publishWarning: warnings.length > 0 ? warnings.join(" ") : null,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["feed"] }),
        queryClient.invalidateQueries({ queryKey: ["my-uploads"] }),
        queryClient.invalidateQueries({ queryKey: ["posttube"] }),
      ]);
    },
    onError: () => {
      // Reset the upload overlay so the user can retry; the error message is
      // surfaced via publishMutation.error in the studio UI.
      patch({ uploadPhase: "idle" });
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
    extractCoverPreview,
    selectCustomCover,
    saveDraftMutation,
    publishMutation,
    retryProcessingCheck,
    goToStep,
    nextStep,
    prevStep,
    canGoNext,
    isFirstStep,
    isLastStep,
  } as const;
}

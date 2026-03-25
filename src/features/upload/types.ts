import type { ContentType, StepId } from "./tokens";
import type {
  ReelVisibility,
  LicenseType,
  CommentModeration,
  RemixSetting,
  CommentAccess,
  CoverFrameResult,
  CopyrightCheck,
  AudioTrack,
} from "@/features/reels/types";
import type { MediaSubtitleTrack } from "@/features/posttube/types";

export type { ContentType, StepId };

/** Form state for the Upload Studio */
export interface StudioFormState {
  /* ── Meta ────────────────────────── */
  contentType: ContentType;
  currentStep: StepId;

  /* ── File ────────────────────────── */
  videoFile: File | null;
  videoPreviewUrl: string | null;
  videoDurationSec: number | null;
  videoWidth: number | null;
  videoHeight: number | null;

  /* ── Upload progress ────────────── */
  mediaId: string | null;
  draftId: string | null;
  uploadProgress: number;
  uploadPhase: "idle" | "uploading" | "confirming" | "creating_draft" | "done" | "error";
  uploadError: string | null;

  /* ── Content step ───────────────── */
  title: string;
  caption: string;
  hashtags: string[];
  tags: string[];
  hashtagInput: string;

  /* ── Cover Poster ────────────────── */
  coverSourceType: "video_frame" | "custom_image";
  coverTimestampMs: number | null;
  coverPreviewUrl: string | null;
  customCoverFile: File | null;
  customCoverPreviewUrl: string | null;
  /** @deprecated kept for backward compat during transition; not used for new uploads */
  coverResult: CoverFrameResult | null;

  /* ── Audio ──────────────────────── */
  audioTrack: AudioTrack | null;
  audioStartMs: number;
  originalAudioVolume: number;
  overlayAudioVolume: number;

  /* ── Audience step ──────────────── */
  isMadeForKids: boolean;
  ageRestricted: boolean;
  paidPromotion: boolean;
  alteredContent: boolean;

  /* ── Engage step ────────────────── */
  commentsEnabled: boolean;
  commentAccess: CommentAccess;
  commentModeration: CommentModeration;
  likesEnabled: boolean;
  remixSetting: RemixSetting;

  /* ── Enrich step (long/podcast) ── */
  autoChapters: boolean;
  featuredPlaces: boolean;
  autoConcepts: boolean;
  language: string;
  subtitlesFile: File | null;
  subtitleTracks: MediaSubtitleTrack[];
  subtitleUploadState: "idle" | "uploading" | "done" | "error";
  subtitleUploadError: string | null;
  recordingDate: string;
  recordingLocation: string;
  license: LicenseType;
  allowEmbedding: boolean;

  /* ── Publish step ───────────────── */
  visibility: ReelVisibility;
  scheduleAt: string | null;
  category: string;
  crossPostPostbook: boolean;
  crossPostPosttube: boolean;
  publishToFeed: boolean;

  /* ── Processing ─────────────────── */
  processingReady: boolean;
  processingStatus: "idle" | "processing" | "ready" | "failed";
  processingError: string | null;
  copyrightCheck: CopyrightCheck | null;

  /* ── Post (after publish) ───────── */
  publishedPostId: string | null;
  publishSuccess: boolean;
  publishWarning: string | null;
  trimStartMs: number;
  trimEndMs: number | null;
  computedVideoCategory: "flick" | "long_video" | null;
  finalVideoCategory: "flick" | "long_video" | null;
}

export const INITIAL_FORM_STATE: StudioFormState = {
  contentType: "reel",
  currentStep: "video",
  videoFile: null,
  videoPreviewUrl: null,
  videoDurationSec: null,
  videoWidth: null,
  videoHeight: null,
  mediaId: null,
  draftId: null,
  uploadProgress: 0,
  uploadPhase: "idle",
  uploadError: null,
  title: "",
  caption: "",
  hashtags: [],
  tags: [],
  hashtagInput: "",
  coverSourceType: "video_frame",
  coverTimestampMs: null,
  coverPreviewUrl: null,
  customCoverFile: null,
  customCoverPreviewUrl: null,
  coverResult: null,
  audioTrack: null,
  audioStartMs: 0,
  originalAudioVolume: 1.0,
  overlayAudioVolume: 1.0,
  isMadeForKids: false,
  ageRestricted: false,
  paidPromotion: false,
  alteredContent: false,
  commentsEnabled: true,
  commentAccess: "everyone",
  commentModeration: "basic",
  likesEnabled: true,
  remixSetting: "allow",
  autoChapters: true,
  featuredPlaces: true,
  autoConcepts: true,
  language: "en",
  subtitlesFile: null,
  subtitleTracks: [],
  subtitleUploadState: "idle",
  subtitleUploadError: null,
  recordingDate: "",
  recordingLocation: "",
  license: "standard",
  allowEmbedding: true,
  visibility: "public",
  scheduleAt: null,
  category: "",
  crossPostPostbook: false,
  crossPostPosttube: false,
  publishToFeed: true,
  processingReady: false,
  processingStatus: "idle",
  processingError: null,
  copyrightCheck: null,
  publishedPostId: null,
  publishSuccess: false,
  publishWarning: null,
  trimStartMs: 0,
  trimEndMs: null,
  computedVideoCategory: null,
  finalVideoCategory: null,
};

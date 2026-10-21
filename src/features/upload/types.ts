import type { ContentType, StepId } from "./tokens";
import type {
  ReelVisibility,
  RemixSetting,
  CommentAccess,
  CopyrightCheck,
  AudioTrack,
} from "@/features/reels/types";
import type { MediaSubtitleTrack } from "@/features/posttube/types";
import type { ChapterDraft } from "@/features/posttube/hub/chaptersModel";
import type { SeriesChoice } from "./studioApi";

export type { ContentType, StepId, ChapterDraft, SeriesChoice };

/** What ran after publish and did not stick; the post itself stays published. */
export type FollowUpFailure = "series" | "chapters";

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
  /** The "made with AI" label (post ai_generated), separate from altered content. */
  aiGenerated: boolean;

  /* ── Engage step ────────────────── */
  commentsEnabled: boolean;
  commentAccess: CommentAccess;
  likesEnabled: boolean;
  remixSetting: RemixSetting;

  /* ── Extras step (long/podcast) ── */
  language: string;
  subtitlesFile: File | null;
  subtitleTracks: MediaSubtitleTrack[];
  subtitleUploadState: "idle" | "uploading" | "done" | "error";
  subtitleUploadError: string | null;
  /** The place shown on the post (location_name); placeId set when picked from search. */
  locationName: string;
  locationPlaceId: string | null;

  /* ── Publish step ───────────────── */
  visibility: ReelVisibility;
  scheduleAt: string | null;
  category: string;
  /**
   * share_to_postbook on the post: whether the video may also appear in the
   * home Feed. The server's default is true; an explicit false keeps it out
   * of the Feed (post-service handler.go createPost + distribution.go).
   */
  crossPostPostbook: boolean;
  publishToFeed: boolean;

  /* ── Series + chapters (long videos; applied after publish) ── */
  seriesChoice: SeriesChoice;
  /** null = the default (one past the series' highest episode). */
  seriesEpisodeNum: number | null;
  chapterRows: ChapterDraft[];

  /* ── Processing ─────────────────── */
  processingReady: boolean;
  processingStatus: "idle" | "processing" | "ready" | "failed";
  processingError: string | null;
  copyrightCheck: CopyrightCheck | null;

  /* ── Post (after publish) ───────── */
  publishedPostId: string | null;
  publishSuccess: boolean;
  publishWarning: string | null;
  followUpFailures: FollowUpFailure[];
  /** The episode the post became, when a series was chosen and the add worked. */
  publishedEpisodeNum: number | null;
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
  audioTrack: null,
  audioStartMs: 0,
  originalAudioVolume: 1.0,
  overlayAudioVolume: 1.0,
  isMadeForKids: false,
  ageRestricted: false,
  paidPromotion: false,
  alteredContent: false,
  aiGenerated: false,
  commentsEnabled: true,
  commentAccess: "everyone",
  likesEnabled: true,
  remixSetting: "allow",
  language: "en",
  subtitlesFile: null,
  subtitleTracks: [],
  subtitleUploadState: "idle",
  subtitleUploadError: null,
  locationName: "",
  locationPlaceId: null,
  visibility: "public",
  scheduleAt: null,
  category: "",
  crossPostPostbook: true,
  publishToFeed: true,
  seriesChoice: { kind: "none" },
  seriesEpisodeNum: null,
  chapterRows: [],
  processingReady: false,
  processingStatus: "idle",
  processingError: null,
  copyrightCheck: null,
  publishedPostId: null,
  publishSuccess: false,
  publishWarning: null,
  followUpFailures: [],
  publishedEpisodeNum: null,
  trimStartMs: 0,
  trimEndMs: null,
  computedVideoCategory: null,
  finalVideoCategory: null,
};

import { useMutation } from "@tanstack/react-query";
import api from "@/lib/api";
import { COPYRIGHT_REPORT_REASONS } from "@/features/copyright/model";

/** "user" reports an account (a profile); the id is the account's user id. */
export type ReportTargetType = "post" | "comment" | "reel" | "video" | "user";

/** The reasons every report sheet offers (REPORT_REASONS). */
export type GeneralReportReason =
  | "spam"
  | "harassment"
  | "hate_speech"
  | "violence"
  | "nudity"
  | "misinformation"
  /** A fake job or a scam behind a post's or a profile's Action button (trust-safety, 23 Oct 2026). */
  | "scam_link"
  | "other";

/** Copyright, on videos and reels only (trust-safety migration 018, 24 Oct 2026): VIDEO_REPORT_REASONS. */
export type CopyrightReportReason = (typeof COPYRIGHT_REPORT_REASONS)[number]["value"];

export type ReportReason = GeneralReportReason | CopyrightReportReason;

export interface SubmitReportParams {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description?: string;
}

/** Where a report goes: trust-safety-service, through the gateway. */
export const REPORTS_PATH = "/v1/reports";

/**
 * The body `POST /v1/reports` (trust-safety-service) takes: entity_type /
 * entity_id / details (NOT target_type / description), and entity_type is
 * one of user, post, comment. Reels and videos are posts, so they normalize
 * to "post"; a profile report is entity_type "user". Pure, so the wire
 * shape is pinned by a test.
 */
export function reportRequestBody(params: SubmitReportParams) {
  const entityType =
    params.targetType === "reel" || params.targetType === "video"
      ? "post"
      : params.targetType;
  return {
    entity_type: entityType,
    entity_id: params.targetId,
    reason: params.reason,
    details: params.description ?? "",
  };
}

export function useSubmitReport() {
  return useMutation({
    mutationFn: async (params: SubmitReportParams) => {
      const res = await api.post(REPORTS_PATH, reportRequestBody(params));
      return res.data;
    },
  });
}

export const REPORT_REASONS: { value: GeneralReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate_speech", label: "Hate speech" },
  { value: "violence", label: "Violence or threats" },
  { value: "nudity", label: "Nudity or sexual content" },
  { value: "misinformation", label: "Misinformation" },
  { value: "scam_link", label: "Fake job or scam link" },
  { value: "other", label: "Other" },
];

/**
 * Comments have no Action button, so their menu leaves "Fake job or scam
 * link" out; posts (reels and videos too) and profiles use REPORT_REASONS.
 */
export const COMMENT_REPORT_REASONS = REPORT_REASONS.filter((r) => r.value !== "scam_link");

/**
 * Videos and reels add the two copyright reasons ("Copyright: this is my
 * content", "Copyright: film, TV or music"), before "Other". trust-safety
 * takes them on posts only (videos and reels are posts), so profiles,
 * comments and plain posts keep REPORT_REASONS.
 */
export const VIDEO_REPORT_REASONS: { value: ReportReason; label: string }[] = [
  ...REPORT_REASONS.filter((r) => r.value !== "other"),
  ...COPYRIGHT_REPORT_REASONS.map((r) => ({ value: r.value, label: r.label })),
  ...REPORT_REASONS.filter((r) => r.value === "other"),
];

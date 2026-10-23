import { useMutation } from "@tanstack/react-query";
import api from "@/lib/api";

/** "user" reports an account (a profile); the id is the account's user id. */
export type ReportTargetType = "post" | "comment" | "reel" | "video" | "user";

export type ReportReason =
  | "spam"
  | "harassment"
  | "hate_speech"
  | "violence"
  | "nudity"
  | "misinformation"
  /** A fake job or a scam behind a post's or a profile's Action button (trust-safety, 23 Oct 2026). */
  | "scam_link"
  | "other";

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

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
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

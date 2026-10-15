import { useMutation } from "@tanstack/react-query";
import api from "@/lib/api";

export type ReportTargetType = "post" | "comment" | "reel" | "video";

export type ReportReason =
  | "spam"
  | "harassment"
  | "hate_speech"
  | "violence"
  | "nudity"
  | "misinformation"
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
 * to "post". Pure, so the wire shape is pinned by a test.
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
  { value: "other", label: "Other" },
];

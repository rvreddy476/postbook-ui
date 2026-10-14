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
  | "other";

export interface SubmitReportParams {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description?: string;
}

/**
 * The POST /v1/reports body. trust-safety-service expects
 * entity_type/entity_id/details (NOT target_type/description), and
 * entity_type ∈ {user, post, comment}. Reels/videos are posts, so they
 * normalise to "post"; a profile report is entity_type "user".
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
      const res = await api.post("/v1/reports", reportRequestBody(params));
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

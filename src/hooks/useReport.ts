import { useMutation } from "@tanstack/react-query";
import api from "@/lib/api";

type ReportTargetType = "post" | "comment" | "reel" | "video";

type ReportReason =
  | "spam"
  | "harassment"
  | "hate_speech"
  | "violence"
  | "nudity"
  | "misinformation"
  | "other";

interface SubmitReportParams {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description?: string;
}

export function useSubmitReport() {
  return useMutation({
    mutationFn: async (params: SubmitReportParams) => {
      // /v1/reports → trust-safety-service, which expects entity_type/entity_id/details
      // (NOT target_type/description), and entity_type ∈ {user, post, comment}.
      // Reels/videos are posts, so normalize to "post".
      const entityType =
        params.targetType === "reel" || params.targetType === "video"
          ? "post"
          : params.targetType;
      const res = await api.post("/v1/reports", {
        entity_type: entityType,
        entity_id: params.targetId,
        reason: params.reason,
        details: params.description ?? "",
      });
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

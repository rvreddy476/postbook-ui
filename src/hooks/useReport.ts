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
      const res = await api.post("/v1/reports", {
        target_type: params.targetType,
        target_id: params.targetId,
        reason: params.reason,
        description: params.description ?? "",
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

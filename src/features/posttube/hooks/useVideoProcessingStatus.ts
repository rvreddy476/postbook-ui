import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

interface ProcessingStatus {
  status: string;
  transcoding_jobs?: { quality: string; status: string }[];
}

interface ApiResponse<T> {
  data: T;
}

/**
 * Polls media processing status every 3s while status is not "ready" or "failed".
 * Returns the current processing status.
 */
export function useVideoProcessingStatus(mediaId: string | undefined) {
  const query = useQuery({
    queryKey: ["media", "status", mediaId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ProcessingStatus>>(
        `/v1/media/${mediaId}`,
      );
      return res.data.data;
    },
    enabled: !!mediaId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "ready" || status === "failed") return false;
      return 3000; // poll every 3s
    },
    staleTime: 1000,
  });

  return {
    ...query,
    status: query.data?.status ?? "pending",
    isReady: query.data?.status === "ready",
    isFailed: query.data?.status === "failed",
    isProcessing:
      query.data?.status === "processing" ||
      query.data?.status === "pending",
  };
}

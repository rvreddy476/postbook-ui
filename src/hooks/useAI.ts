import { useMutation, useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import type { CaptionSuggestion, HashtagSuggestion, SmartReply, ModerationResult } from "@/types/ai"

interface SuggestionBody {
    ref_id: string
    ref_type: string
    context_text?: string
}

export function useCaptionSuggestions() {
    return useMutation({
        mutationFn: async (body: SuggestionBody) => {
            const res = await api.post<{ data: CaptionSuggestion }>("/v1/ai/caption-suggestions", body)
            return res.data?.data ?? res.data
        },
    })
}

export function useHashtagSuggestions() {
    return useMutation({
        mutationFn: async (body: SuggestionBody) => {
            const res = await api.post<{ data: HashtagSuggestion }>("/v1/ai/hashtag-suggestions", body)
            return res.data?.data ?? res.data
        },
    })
}

export function useSmartReplies() {
    return useMutation({
        mutationFn: async (body: SuggestionBody) => {
            const res = await api.post<{ data: SmartReply }>("/v1/ai/smart-replies", body)
            return res.data?.data ?? res.data
        },
    })
}

export function useModerationResult(refType: string, refId: string, enabled: boolean = true) {
    return useQuery({
        queryKey: ["moderation", refType, refId],
        queryFn: async () => {
            const res = await api.get<{ data: ModerationResult }>(`/v1/ai/moderation/${refType}/${refId}`)
            return res.data?.data ?? res.data
        },
        enabled: enabled && !!refType && !!refId,
    })
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"

interface ContentAppeal { id: string; content_type: string; content_id: string; action_taken: string; appeal_reason: string; status: string; created_at: string }
interface VerificationRequest { id: string; user_id: string; type: string; status: string; created_at: string }

export function useSubmitAppeal() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (body: { content_type: string; content_id: string; action_taken: string; appeal_reason: string }) => {
            const res = await api.post<{ data: ContentAppeal }>("/v1/trust/appeals", body)
            return res.data?.data ?? res.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["appeals"] })
        },
    })
}

export function useMyAppeals() {
    return useQuery({
        queryKey: ["appeals"],
        queryFn: async () => {
            const res = await api.get<{ data: ContentAppeal[] }>("/v1/trust/appeals", {
                params: { my: true },
            })
            return res.data?.data ?? res.data
        },
    })
}

export function useVerificationRequest() {
    return useQuery({
        queryKey: ["verification"],
        queryFn: async () => {
            const res = await api.get<{ data: VerificationRequest | null }>("/v1/trust/verification")
            return res.data?.data ?? res.data
        },
    })
}

export function useSubmitVerification() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (body: { type: string; docs: unknown }) => {
            const res = await api.post<{ data: VerificationRequest }>("/v1/trust/verification", body)
            return res.data?.data ?? res.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["verification"] })
        },
    })
}

"use client"

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type {
  CallSession,
  CallHistoryItem,
  JoinResponse,
  CreateCallRequest,
  InviteParticipantsRequest,
} from "@/types/call"

interface CallResponse { data: CallSession }
interface JoinCallResponse { data: JoinResponse }
interface HistoryResponse { data: CallHistoryItem[]; meta?: { next_cursor?: string } }

export function useCallDetails(callId: string | undefined) {
  return useQuery({
    queryKey: ["call", callId],
    queryFn: async () => {
      const res = await api.get<CallResponse>(`/v1/calls/${callId}`)
      return res.data.data
    },
    enabled: !!callId,
    staleTime: 5_000,
  })
}

export function useCallHistory(limit = 20) {
  return useInfiniteQuery({
    queryKey: ["call-history"],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string | number> = { limit }
      if (pageParam) params.cursor = pageParam
      const res = await api.get<HistoryResponse>("/v1/calls/history", { params })
      return res.data
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor,
  })
}

export function useCreateCall() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: CreateCallRequest) => {
      const res = await api.post<CallResponse>("/v1/calls", req)
      return res.data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["call-history"] })
    },
  })
}

export function useJoinCall() {
  return useMutation({
    mutationFn: async (callId: string) => {
      const res = await api.post<JoinCallResponse>(`/v1/calls/${callId}/join`)
      return res.data.data
    },
  })
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: async ({ callId, inviteId }: { callId: string; inviteId: string }) => {
      const res = await api.post<CallResponse>(`/v1/calls/${callId}/invites/${inviteId}/accept`)
      return res.data.data
    },
  })
}

export function useDeclineInvite() {
  return useMutation({
    mutationFn: async ({ callId, inviteId }: { callId: string; inviteId: string }) => {
      const res = await api.post<CallResponse>(`/v1/calls/${callId}/invites/${inviteId}/decline`)
      return res.data.data
    },
  })
}

export function useLeaveCall() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (callId: string) => {
      await api.post(`/v1/calls/${callId}/leave`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["call-history"] })
    },
  })
}

export function useEndCall() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (callId: string) => {
      await api.post(`/v1/calls/${callId}/end`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["call-history"] })
    },
  })
}

export function useInviteParticipants() {
  return useMutation({
    mutationFn: async ({ callId, req }: { callId: string; req: InviteParticipantsRequest }) => {
      await api.post(`/v1/calls/${callId}/participants/invite`, req)
    },
  })
}

export function useMuteParticipant() {
  return useMutation({
    mutationFn: async ({ callId, userId }: { callId: string; userId: string }) => {
      await api.post(`/v1/calls/${callId}/participants/${userId}/mute`)
    },
  })
}

export function useRemoveParticipant() {
  return useMutation({
    mutationFn: async ({ callId, userId }: { callId: string; userId: string }) => {
      await api.post(`/v1/calls/${callId}/participants/${userId}/remove`)
    },
  })
}

export function useUpgradeCall() {
  return useMutation({
    mutationFn: async (callId: string) => {
      const res = await api.patch<CallResponse>(`/v1/calls/${callId}/upgrade`)
      return res.data.data
    },
  })
}

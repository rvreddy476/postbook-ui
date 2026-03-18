"use client"

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { Group, GroupMember, GroupInvite, GroupPost, GroupJoinRequest, GroupRule } from "@/types/groups"

interface GroupsResponse { data: Group[] }
interface GroupResponse { data: Group }
interface MembersResponse { data: GroupMember[] }
interface InvitesResponse { data: GroupInvite[] }
interface GroupPostsResponse { data: GroupPost[] }
interface JoinRequestsResponse { data: GroupJoinRequest[] }
interface JoinRequestResponse { data: GroupJoinRequest }
interface RulesResponse { data: GroupRule[] }
interface HandleCheckResponse { data: { handle: string; available: boolean } }

// === QUERIES ===

export function useMyGroups() {
  return useQuery({
    queryKey: ["my-groups"],
    queryFn: async () => {
      const res = await api.get<GroupsResponse>("/v1/groups/my")
      return res.data.data
    },
  })
}

export function useGroupDetails(groupId: string | undefined) {
  return useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const res = await api.get<GroupResponse>(`/v1/groups/${groupId}`)
      return res.data.data
    },
    enabled: !!groupId,
    staleTime: 60_000,
  })
}

export function useGroupByHandle(handle: string | undefined) {
  return useQuery({
    queryKey: ["group-by-handle", handle],
    queryFn: async () => {
      const res = await api.get<GroupResponse>(`/v1/groups/by-handle/${handle}`)
      return res.data.data
    },
    enabled: !!handle,
    staleTime: 60_000,
  })
}

export function useGroupMembers(groupId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ["group-members", groupId],
    queryFn: async () => {
      const res = await api.get<MembersResponse>(`/v1/groups/${groupId}/members`, { params: { limit } })
      return res.data.data
    },
    enabled: !!groupId,
  })
}

export function useGroupFeed(groupId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["group-feed", groupId],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await api.get<GroupPostsResponse>(`/v1/groups/${groupId}/feed`, {
        params: { limit: 20, offset: pageParam },
      })
      return { data: res.data.data, offset: pageParam as number }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (lastPage.data.length < 20) return undefined
      return (lastPage.offset as number) + 20
    },
    enabled: !!groupId,
  })
}

export function useDiscoverGroups() {
  return useQuery({
    queryKey: ["discover-groups"],
    queryFn: async () => {
      const res = await api.get<GroupsResponse>("/v1/groups/discover")
      return res.data.data
    },
  })
}

export function useGroupSearch(query: string) {
  return useQuery({
    queryKey: ["group-search", query],
    queryFn: async () => {
      const res = await api.get<GroupsResponse>("/v1/groups/search", { params: { q: query } })
      return res.data.data
    },
    enabled: query.length >= 2,
  })
}

export function useGroupInvites(groupId: string | undefined) {
  return useQuery({
    queryKey: ["group-invites", groupId],
    queryFn: async () => {
      const res = await api.get<InvitesResponse>(`/v1/groups/${groupId}/invites`)
      return res.data.data
    },
    enabled: !!groupId,
  })
}

export function useJoinRequests(groupId: string | undefined) {
  return useQuery({
    queryKey: ["group-join-requests", groupId],
    queryFn: async () => {
      const res = await api.get<JoinRequestsResponse>(`/v1/groups/${groupId}/join-requests`)
      return res.data.data
    },
    enabled: !!groupId,
  })
}

export function useGroupRules(groupId: string | undefined) {
  return useQuery({
    queryKey: ["group-rules", groupId],
    queryFn: async () => {
      const res = await api.get<RulesResponse>(`/v1/groups/${groupId}/rules`)
      return res.data.data
    },
    enabled: !!groupId,
  })
}

export function useCheckHandle(handle: string) {
  return useQuery({
    queryKey: ["handle-check", handle],
    queryFn: async () => {
      const res = await api.post<HandleCheckResponse>("/v1/groups/handle/check", { handle })
      return res.data.data
    },
    enabled: handle.length >= 3,
    staleTime: 5_000,
  })
}

// === MUTATIONS ===

export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      name: string
      description: string
      visibility?: 'public' | 'private'
      avatar_media_id?: string
      cover_media_id?: string
      handle?: string
      category?: string
      privacy_level?: string
      join_mode?: string
      who_can_post?: string
      who_can_invite?: string
      location?: string
      language?: string
      idempotency_key?: string
    }) => {
      const res = await api.post<GroupResponse>("/v1/groups", payload)
      return res.data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-groups"] })
      qc.invalidateQueries({ queryKey: ["discover-groups"] })
    },
  })
}

export function useUpdateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, ...payload }: { groupId: string; name?: string; description?: string; visibility?: string; avatar_media_id?: string; cover_media_id?: string }) => {
      const res = await api.put(`/v1/groups/${groupId}`, payload)
      return res.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["group", vars.groupId] })
      qc.invalidateQueries({ queryKey: ["group-by-handle"] })
      qc.invalidateQueries({ queryKey: ["my-groups"] })
      qc.invalidateQueries({ queryKey: ["discover-groups"] })
    },
  })
}

export function useDeleteGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string) => {
      await api.delete(`/v1/groups/${groupId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-groups"] })
      qc.invalidateQueries({ queryKey: ["discover-groups"] })
    },
  })
}

export function useArchiveGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string) => {
      await api.post(`/v1/groups/${groupId}/archive`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-groups"] })
      qc.invalidateQueries({ queryKey: ["discover-groups"] })
    },
  })
}

export function useJoinGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string) => {
      const res = await api.post<{ data: { status: string } }>(`/v1/groups/${groupId}/join`)
      return res.data.data
    },
    onSuccess: (_, groupId) => {
      qc.invalidateQueries({ queryKey: ["group", groupId] })
      qc.invalidateQueries({ queryKey: ["my-groups"] })
      qc.invalidateQueries({ queryKey: ["group-members", groupId] })
    },
  })
}

export function useLeaveGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string) => {
      const res = await api.post(`/v1/groups/${groupId}/leave`)
      return res.data
    },
    onSuccess: (_, groupId) => {
      qc.invalidateQueries({ queryKey: ["group", groupId] })
      qc.invalidateQueries({ queryKey: ["my-groups"] })
      qc.invalidateQueries({ queryKey: ["group-members", groupId] })
    },
  })
}

export function useInviteToGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      const res = await api.post(`/v1/groups/${groupId}/invite`, { user_id: userId })
      return res.data
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-invites", groupId] })
    },
  })
}

export function useAcceptInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await api.post(`/v1/groups/invites/${inviteId}/accept`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-groups"] })
    },
  })
}

export function useRejectInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await api.post(`/v1/groups/invites/${inviteId}/reject`)
      return res.data
    },
  })
}

export function useUpdateMemberRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, userId, role }: { groupId: string; userId: string; role: string }) => {
      const res = await api.put(`/v1/groups/${groupId}/members/${userId}/role`, { role })
      return res.data
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-members", groupId] })
    },
  })
}

export function useRemoveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      await api.delete(`/v1/groups/${groupId}/members/${userId}`)
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group", groupId] })
      qc.invalidateQueries({ queryKey: ["group-members", groupId] })
    },
  })
}

export function useBanMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, userId, reason }: { groupId: string; userId: string; reason?: string }) => {
      await api.post(`/v1/groups/${groupId}/members/${userId}/ban`, { reason })
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group", groupId] })
      qc.invalidateQueries({ queryKey: ["group-members", groupId] })
    },
  })
}

export function useCreateGroupPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, ...postData }: { groupId: string; [key: string]: unknown }) => {
      const res = await api.post(`/v1/groups/${groupId}/posts`, postData)
      return res.data
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-feed", groupId as string] })
      qc.invalidateQueries({ queryKey: ["group", groupId as string] })
    },
  })
}

export function useCreateJoinRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string) => {
      const res = await api.post<JoinRequestResponse>(`/v1/groups/${groupId}/join-requests`)
      return res.data.data
    },
    onSuccess: (_, groupId) => {
      qc.invalidateQueries({ queryKey: ["group-join-requests", groupId] })
    },
  })
}

export function useApproveJoinRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, requestId }: { groupId: string; requestId: string }) => {
      await api.post(`/v1/groups/${groupId}/join-requests/${requestId}/approve`)
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-join-requests", groupId] })
      qc.invalidateQueries({ queryKey: ["group-members", groupId] })
      qc.invalidateQueries({ queryKey: ["group", groupId] })
    },
  })
}

export function useRejectJoinRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, requestId }: { groupId: string; requestId: string }) => {
      await api.post(`/v1/groups/${groupId}/join-requests/${requestId}/reject`)
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-join-requests", groupId] })
    },
  })
}

export function useUpdateGroupRules() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, rules }: { groupId: string; rules: { title: string; description: string }[] }) => {
      await api.put(`/v1/groups/${groupId}/rules`, { rules })
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-rules", groupId] })
    },
  })
}

export function useGroupMedia(groupId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["group-media", groupId],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await api.get<GroupPostsResponse>(`/v1/groups/${groupId}/media`, {
        params: { limit: 30, offset: pageParam },
      })
      return { data: res.data.data, offset: pageParam as number }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (lastPage.data.length < 30) return undefined
      return (lastPage.offset as number) + 30
    },
    enabled: !!groupId,
  })
}

export function useDeleteGroupPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, postId }: { groupId: string; postId: string }) => {
      await api.delete(`/v1/groups/${groupId}/posts/${postId}`)
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-feed", groupId] })
      qc.invalidateQueries({ queryKey: ["group", groupId] })
    },
  })
}

export function usePinPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, postId }: { groupId: string; postId: string }) => {
      await api.put(`/v1/groups/${groupId}/posts/${postId}/pin`)
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-feed", groupId] })
    },
  })
}

export function useUnpinPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, postId }: { groupId: string; postId: string }) => {
      await api.delete(`/v1/groups/${groupId}/posts/${postId}/pin`)
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-feed", groupId] })
    },
  })
}

export function useUnbanMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      await api.delete(`/v1/groups/${groupId}/members/${userId}/ban`)
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group", groupId] })
      qc.invalidateQueries({ queryKey: ["group-members", groupId] })
    },
  })
}

export function useBannedMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: ["group-banned", groupId],
    queryFn: async () => {
      const res = await api.get<MembersResponse>(`/v1/groups/${groupId}/members/banned`)
      return res.data.data
    },
    enabled: !!groupId,
  })
}

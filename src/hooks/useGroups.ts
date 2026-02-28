"use client"

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { Group, GroupMember, GroupInvite, GroupPost } from "@/types/groups"

interface GroupsResponse { data: Group[] }
interface GroupResponse { data: Group }
interface MembersResponse { data: GroupMember[] }
interface InvitesResponse { data: GroupInvite[] }
interface GroupPostsResponse { data: GroupPost[] }

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

// === MUTATIONS ===

export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; description: string; visibility: 'public' | 'private'; avatar_media_id?: string }) => {
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
    mutationFn: async ({ groupId, ...payload }: { groupId: string; name?: string; description?: string; visibility?: string; avatar_media_id?: string }) => {
      const res = await api.put(`/v1/groups/${groupId}`, payload)
      return res.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["group", vars.groupId] })
      qc.invalidateQueries({ queryKey: ["my-groups"] })
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

export function useJoinGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string) => {
      const res = await api.post(`/v1/groups/${groupId}/join`)
      return res.data
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

"use client"

import axios from "axios"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { Community, CommunityMember, CommunitySpace, CommunityEvent, CommunityAnnouncement } from "@/types/communities"

interface CommunitiesResponse { data: Community[] }
interface CommunityResponse { data: Community }
interface MembersResponse { data: CommunityMember[] }
interface SpacesResponse { data: CommunitySpace[] }
interface EventsResponse { data: CommunityEvent[] }
interface AnnouncementsResponse { data: CommunityAnnouncement[] }

// === QUERIES ===

export function useMyCommunities() {
  return useQuery({
    queryKey: ["my-communities"],
    queryFn: async () => {
      const res = await api.get<CommunitiesResponse>("/v1/communities/my")
      return res.data.data
    },
  })
}

export function useDiscoverCommunities() {
  return useQuery({
    queryKey: ["discover-communities"],
    queryFn: async () => {
      const res = await api.get<CommunitiesResponse>("/v1/communities/discover")
      return res.data.data
    },
  })
}

export function useCommunity(communityId: string | undefined) {
  return useQuery({
    queryKey: ["community", communityId],
    queryFn: async () => {
      const res = await api.get<CommunityResponse>(`/v1/communities/${communityId}`)
      return res.data.data
    },
    enabled: !!communityId,
    staleTime: 60_000,
  })
}

export function useCommunityMembers(communityId: string | undefined) {
  return useQuery({
    queryKey: ["community-members", communityId],
    queryFn: async () => {
      const res = await api.get<MembersResponse>(`/v1/communities/${communityId}/members`)
      return res.data.data
    },
    enabled: !!communityId,
  })
}

export function useCommunitySpaces(communityId: string | undefined) {
  return useQuery({
    queryKey: ["community-spaces", communityId],
    queryFn: async () => {
      const res = await api.get<SpacesResponse>(`/v1/communities/${communityId}/spaces`)
      return res.data.data
    },
    enabled: !!communityId,
  })
}

export function useCommunityEvents(communityId: string | undefined) {
  return useQuery({
    queryKey: ["community-events", communityId],
    queryFn: async () => {
      try {
        const res = await api.get<EventsResponse>(`/v1/communities/${communityId}/events`)
        return res.data.data
      } catch (error) {
        if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 501)) {
          return []
        }
        throw error
      }
    },
    enabled: !!communityId,
  })
}

export function useCommunityAnnouncements(communityId: string | undefined) {
  return useQuery({
    queryKey: ["community-announcements", communityId],
    queryFn: async () => {
      try {
        const res = await api.get<AnnouncementsResponse>(`/v1/communities/${communityId}/announcements`)
        return res.data.data
      } catch (error) {
        if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 501)) {
          return []
        }
        throw error
      }
    },
    enabled: !!communityId,
  })
}

export function useNearbyCommunities() {
  return useQuery({
    queryKey: ["nearby-communities"],
    queryFn: async () => {
      const res = await api.get<CommunitiesResponse>("/v1/communities/nearby")
      return res.data.data
    },
  })
}

export function useSuggestedCommunities() {
  return useQuery({
    queryKey: ["suggested-communities"],
    queryFn: async () => {
      const res = await api.get<CommunitiesResponse>("/v1/communities/suggested")
      return res.data.data
    },
  })
}

// === MUTATIONS ===

export function useCreateCommunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      name: string
      handle: string
      description: string
      community_type: string
      category?: string
      join_mode?: string
      avatar_media_id?: string
      banner_media_id?: string
      rules?: string[]
    }) => {
      const res = await api.post<CommunityResponse>("/v1/communities", payload)
      return res.data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-communities"] })
      qc.invalidateQueries({ queryKey: ["discover-communities"] })
    },
  })
}

export function useUpdateCommunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ communityId, ...payload }: {
      communityId: string
      name?: string
      description?: string
      community_type?: string
      category?: string
      join_mode?: string
      avatar_media_id?: string
      banner_media_id?: string
      rules?: string[]
    }) => {
      const res = await api.put<CommunityResponse>(`/v1/communities/${communityId}`, payload)
      return res.data.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["community", vars.communityId] })
      qc.invalidateQueries({ queryKey: ["my-communities"] })
      qc.invalidateQueries({ queryKey: ["discover-communities"] })
      qc.invalidateQueries({ queryKey: ["nearby-communities"] })
      qc.invalidateQueries({ queryKey: ["suggested-communities"] })
    },
  })
}

export function useJoinCommunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (communityId: string) => {
      const res = await api.post(`/v1/communities/${communityId}/join`)
      return res.data
    },
    onSuccess: (_, communityId) => {
      qc.invalidateQueries({ queryKey: ["community", communityId] })
      qc.invalidateQueries({ queryKey: ["my-communities"] })
      qc.invalidateQueries({ queryKey: ["community-members", communityId] })
    },
  })
}

export function useLeaveCommunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (communityId: string) => {
      await api.post(`/v1/communities/${communityId}/leave`)
    },
    onSuccess: (_, communityId) => {
      qc.invalidateQueries({ queryKey: ["community", communityId] })
      qc.invalidateQueries({ queryKey: ["my-communities"] })
      qc.invalidateQueries({ queryKey: ["community-members", communityId] })
    },
  })
}

export function useCreateSpace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      community_id: string
      name: string
      description: string
      space_type: string
      linked_group_id?: string
      linked_channel_id?: string
    }) => {
      const res = await api.post(`/v1/communities/${payload.community_id}/spaces`, payload)
      return res.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["community-spaces", vars.community_id] })
      qc.invalidateQueries({ queryKey: ["community", vars.community_id] })
    },
  })
}

export function useDeleteSpace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ communityId, spaceId }: { communityId: string; spaceId: string }) => {
      await api.delete(`/v1/communities/${communityId}/spaces/${spaceId}`)
    },
    onSuccess: (_, { communityId }) => {
      qc.invalidateQueries({ queryKey: ["community-spaces", communityId] })
      qc.invalidateQueries({ queryKey: ["community", communityId] })
    },
  })
}

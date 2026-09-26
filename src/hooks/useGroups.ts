"use client"

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { loadMyGroups } from "@/lib/groupMemberships"
import { useAuthUser } from "@/store/auth"
import type { AddPeopleResult } from "@/components/messenger/groupComposition"
import { parseAddPeopleResult } from "@/components/groups/groupPeople"
import { interpretCreateGroupPostResponse, type CreateGroupPostOutcome, type GroupTypePayload } from "@/components/groups/groupComposer"
import { groupPostSearchKey, MIN_GROUP_SEARCH_LENGTH } from "@/components/groups/patchGroupFeed"
import type { Group, GroupMember, GroupInvite, GroupInviteDetail, GroupPost, GroupPostV2, GroupPostComment, GroupJoinRequest, GroupRule } from "@/types/groups"

interface GroupsResponse { data: Group[] }
interface GroupResponse { data: Group }
interface MembersResponse { data: GroupMember[] }
interface InvitesResponse { data: GroupInvite[] }
interface GroupPostsResponse { data: GroupPost[] }
interface GroupPostsV2Response { data: GroupPostV2[] }
interface JoinRequestsResponse { data: GroupJoinRequest[] }
interface JoinRequestResponse { data: GroupJoinRequest }
interface RulesResponse { data: GroupRule[] }
interface HandleCheckResponse { data: { handle: string; available: boolean } }

// === QUERIES ===

export function useMyGroups(enabled = true) {
  const user = useAuthUser()
  return useQuery({
    queryKey: ["my-groups", user?.id],
    enabled: enabled && !!user?.id,
    queryFn: ({ signal }) => loadMyGroups(async (offset, limit) => {
      const res = await api.get<GroupsResponse>("/v1/groups/my", { params: { offset, limit }, signal })
      return res.data
    }),
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

export function useGroupFeedV2(groupId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["group-feed-v2", groupId],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await api.get<GroupPostsV2Response>(`/v1/groups/${groupId}/feed/v2`, {
        params: { limit: 20, offset: pageParam },
      })
      return { data: res.data.data ?? [], offset: pageParam as number }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (lastPage.data.length < 20) return undefined
      return (lastPage.offset as number) + 20
    },
    enabled: !!groupId,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })
}

/**
 * Search posts inside one group.
 *
 * Page-shaped like useGroupFeedV2 on purpose: the cards, the optimistic
 * engagement patch and the pagination are then the same code for both,
 * rather than a second rendering path that drifts from the feed.
 *
 * Gated on MIN_GROUP_SEARCH_LENGTH because the server answers a blank q
 * with a 400 — one request per keystroke would be spent being told off.
 */
export function useGroupPostSearch(groupId: string | undefined, query: string) {
  const trimmed = query.trim()
  return useInfiniteQuery({
    queryKey: groupPostSearchKey(groupId ?? "", trimmed),
    queryFn: async ({ pageParam = 0 }) => {
      const res = await api.get<GroupPostsV2Response>(
        `/v1/groups/${groupId}/posts/v2/search`,
        { params: { q: trimmed, limit: 20, offset: pageParam } },
      )
      return { data: res.data.data ?? [], offset: pageParam as number }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (lastPage.data.length < 20) return undefined
      return (lastPage.offset as number) + 20
    },
    enabled: !!groupId && trimmed.length >= MIN_GROUP_SEARCH_LENGTH,
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
      idempotency_key: string
      is_mature?: boolean
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

/**
 * Put several people in a group at once.
 *
 * Each person gets their own answer, decided by THEIR privacy setting, not the
 * group's: a permitted connection is added, an approval-eligible person is
 * invited, and a denied target is skipped (not automatically invited). So
 * the reply is three counts rather than a success flag — the caller cannot
 * assume the number of people it picked is the number that went in.
 *
 * Counts, never names. group-service withholds the names on purpose: returning
 * them would let the caller work out who refused by subtracting, which is the
 * one thing a block is supposed to hide. Who is actually in the group is read
 * from the member list, where an invited person and a blocked one look the
 * same until one accepts.
 */
export function useAddPeopleToGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, userIds }: { groupId: string; userIds: string[] }): Promise<AddPeopleResult> => {
      const res = await api.post<{ data: AddPeopleResult }>(`/v1/groups/${groupId}/invite`, { user_ids: userIds })
      return parseAddPeopleResult(res.data, userIds.length)
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-invites", groupId] })
      qc.invalidateQueries({ queryKey: ["group-members", groupId] })
      qc.invalidateQueries({ queryKey: ["group", groupId] })
      qc.invalidateQueries({ queryKey: ["group-by-handle"] })
      qc.invalidateQueries({ queryKey: ["my-groups"] })
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
      qc.invalidateQueries({ queryKey: ["my-invites"] })
      qc.invalidateQueries({ queryKey: ["myspace-feed"] })
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-invites"] })
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
      // The settings page's banned list reads this. Without it, banning
      // someone from the Members tab left that list showing the state from
      // before the ban until a reload.
      qc.invalidateQueries({ queryKey: ["group-bans", groupId] })
    },
  })
}

/**
 * What POST /v1/groups/:groupId/posts/v2 accepts, as group-service binds it.
 *
 * Named fields rather than `[key: string]: unknown`: the old signature took
 * anything and forwarded four things, so the composer's place, feeling,
 * activity and hashtags were accepted here and dropped on the way out — with a
 * success toast over the top. A typed body is what makes that impossible to
 * repeat silently.
 */
export interface CreateGroupPostInput {
  groupId: string
  body: string
  title?: string
  content_type?: string
  channel_id?: string
  /** Opaque to the server; built by buildGroupTypePayload. Omitted when empty. */
  type_payload?: GroupTypePayload
  /** Media ids. Stored as raw JSON and served back as a string array. */
  attachments?: string[]
  is_announcement?: boolean
  /** Refused unless the group set allow_anonymous_posts. */
  is_anonymous?: boolean
  /** Extra groups. NON-EMPTY CHANGES THE RESPONSE SHAPE — see below. */
  also_post_to?: string[]
  /**
   * Stable across retries of the SAME composer action, and REQUIRED once
   * also_post_to is non-empty (400 IDEMPOTENCY_KEY_REQUIRED otherwise).
   *
   * The axios interceptor stamps a fresh uuid HEADER per attempt, so a retry
   * carrying only the header looks like a new intent and would post again to
   * every group that already succeeded. This body field is the client's promise
   * that it is the same press of the button.
   */
  idempotency_key?: string
}

export function useCreateGroupPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId,
      also_post_to,
      ...post
    }: CreateGroupPostInput): Promise<CreateGroupPostOutcome> => {
      /*
        THE COMPATIBILITY HINGE.

        With also_post_to absent or empty the server answers with the bare post,
        exactly as it always has — the shape the mobile app reads. Only a
        request that names extra groups gets the batch result. So the key is
        sent, and the answer is read, according to what was SENT: the count goes
        to interpretCreateGroupPostResponse rather than the response being
        sniffed for a `targets` field.
      */
      const targets = also_post_to ?? []
      const body: Record<string, unknown> = { ...post }
      if (targets.length > 0) {
        body.also_post_to = targets
      } else {
        // Not even an empty array: an empty also_post_to is what keeps the
        // single-post response shape, and omitting the key says it plainly.
        delete body.also_post_to
      }
      const res = await api.post(`/v1/groups/${groupId}/posts/v2`, body)
      return interpretCreateGroupPostResponse(targets.length, res.data?.data ?? res.data)
    },
    onSuccess: (outcome, { groupId, also_post_to }) => {
      qc.invalidateQueries({ queryKey: ["group-feed", groupId] })
      qc.invalidateQueries({ queryKey: ["group-feed-v2", groupId] })
      qc.invalidateQueries({ queryKey: ["group", groupId] })
      // A cross-post wrote rows in other groups' feeds too, and the aggregated
      // MySpace feed spans all of them.
      qc.invalidateQueries({ queryKey: ["myspace-feed"] })
      for (const target of also_post_to ?? []) {
        qc.invalidateQueries({ queryKey: ["group-feed-v2", target] })
        qc.invalidateQueries({ queryKey: ["group", target] })
      }
      void outcome
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

export interface GroupMediaItem {
  post_id: string
  author_id: string
  content_type: string
  attachments: string[]
  created_at: string
}

export function useGroupMedia(groupId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["group-media", groupId],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await api.get<{ data: GroupMediaItem[] }>(`/v1/groups/${groupId}/media`, {
        params: { limit: 30, offset: pageParam },
      })
      return { data: res.data.data ?? [], offset: pageParam as number }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (lastPage.data.length < 30) return undefined
      return (lastPage.offset as number) + 30
    },
    enabled: !!groupId,
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

// === V2 ENGAGEMENT HOOKS (matching channel pattern) ===

export function useSparkGroupPostV2() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, postId, isSupernova }: { groupId: string; postId: string; isSupernova?: boolean }) => {
      await api.post(`/v1/groups/${groupId}/posts/v2/${postId}/spark`, { is_supernova: isSupernova ?? false })
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-feed-v2", groupId] })
    },
  })
}

export function useUnsparkGroupPostV2() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, postId }: { groupId: string; postId: string }) => {
      await api.delete(`/v1/groups/${groupId}/posts/v2/${postId}/spark`)
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-feed-v2", groupId] })
    },
  })
}

export function useStashGroupPostV2() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, postId }: { groupId: string; postId: string }) => {
      await api.post(`/v1/groups/${groupId}/posts/v2/${postId}/stash`)
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-feed-v2", groupId] })
    },
  })
}

export function useUnstashGroupPostV2() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, postId }: { groupId: string; postId: string }) => {
      await api.delete(`/v1/groups/${groupId}/posts/v2/${postId}/stash`)
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-feed-v2", groupId] })
    },
  })
}

export function useRecordGroupPostView() {
  return useMutation({
    mutationFn: async ({ groupId, postId }: { groupId: string; postId: string }) => {
      await api.post(`/v1/groups/${groupId}/posts/v2/${postId}/view`)
    },
    retry: false,
  })
}

export function useEchoGroupPostV2() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, postId, echoType }: { groupId: string; postId: string; echoType?: string }) => {
      await api.post(`/v1/groups/${groupId}/posts/v2/${postId}/echo`, { echo_type: echoType ?? 'share' })
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-feed-v2", groupId] })
    },
  })
}

export function useUnechoGroupPostV2() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, postId }: { groupId: string; postId: string }) => {
      await api.delete(`/v1/groups/${groupId}/posts/v2/${postId}/echo`)
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-feed-v2", groupId] })
    },
  })
}

export function useGroupPostComments(groupId: string | undefined, postId: string | undefined) {
  return useQuery({
    queryKey: ["group-post-comments", groupId, postId],
    queryFn: async () => {
      const res = await api.get<{ data: GroupPostComment[] }>(`/v1/groups/${groupId}/posts/v2/${postId}/comments`, {
        params: { limit: 50 },
      })
      return res.data.data ?? []
    },
    enabled: !!groupId && !!postId,
  })
}

export function useAddGroupPostComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, postId, body, parentId }: { groupId: string; postId: string; body: string; parentId?: string }) => {
      const res = await api.post<{ data: GroupPostComment }>(`/v1/groups/${groupId}/posts/v2/${postId}/comments`, {
        body,
        parent_id: parentId,
      })
      return res.data.data
    },
    onSuccess: (_, { groupId, postId }) => {
      qc.invalidateQueries({ queryKey: ["group-post-comments", groupId, postId] })
      qc.invalidateQueries({ queryKey: ["group-feed-v2", groupId] })
    },
  })
}

export function useDeleteGroupPostComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, postId, commentId }: { groupId: string; postId: string; commentId: string }) => {
      await api.delete(`/v1/groups/${groupId}/posts/v2/${postId}/comments/${commentId}`)
    },
    onSuccess: (_, { groupId, postId }) => {
      qc.invalidateQueries({ queryKey: ["group-post-comments", groupId, postId] })
      qc.invalidateQueries({ queryKey: ["group-feed-v2", groupId] })
    },
  })
}

export function useDeleteGroupPostV2() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, postId }: { groupId: string; postId: string }) => {
      await api.delete(`/v1/groups/${groupId}/posts/v2/${postId}`)
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-feed-v2", groupId] })
      qc.invalidateQueries({ queryKey: ["group", groupId] })
    },
  })
}

// === MYSPACE AGGREGATED FEED ===

export type MySpaceFeedPost = GroupPostV2 & { group: Group }

// Aggregated reverse-chronological feed across every group the viewer has
// joined — served by GET /v1/groups/feed (group-service joins on the
// viewer's memberships) with limit/offset pagination.
export function useMySpacesFeed() {
  return useInfiniteQuery({
    queryKey: ["myspace-feed"],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await api.get<GroupPostsV2Response>(`/v1/groups/feed`, {
        params: { limit: 20, offset: pageParam },
      })
      return { data: res.data.data ?? [], offset: pageParam as number }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (lastPage.data.length < 20) return undefined
      return (lastPage.offset as number) + 20
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
}

// === MY INVITES ===

interface MyInvitesResponse { data: GroupInviteDetail[] }

export function useMyInvites() {
  return useQuery({
    queryKey: ["my-invites"],
    queryFn: async () => {
      const res = await api.get<MyInvitesResponse>(`/v1/groups/invites/my`)
      return res.data.data ?? []
    },
  })
}

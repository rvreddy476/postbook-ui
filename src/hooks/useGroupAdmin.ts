import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface GroupChannelV2 {
  id: string; group_id: string; name: string; type: string; description: string;
  who_can_post: string; is_default: boolean; is_archived: boolean; sort_order: number; post_count: number;
}

export function useGroupChannels(groupId: string) {
  return useQuery({
    queryKey: ['group-channels', groupId],
    queryFn: async () => {
      const res = await api.get<{ data: { items: GroupChannelV2[] } }>(`/v1/groups/${groupId}/channels`)
      return res.data.data?.items ?? []
    },
    enabled: !!groupId,
  })
}

export function useCreateGroupChannel(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; type: string; description?: string; who_can_post?: string }) => {
      const res = await api.post(`/v1/groups/${groupId}/channels`, payload)
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group-channels', groupId] }),
  })
}

/*
  The approval queue, pointed at the route that actually exists.

  This asked for `/posts?status=pending_approval`, and group-service has no
  `GET /:groupId/posts` at all — only `/posts/v2/...`. So the request 404'd,
  react-query swallowed it, `data` stayed undefined, and the settings page
  rendered "No posts waiting for approval." A dead endpoint reported as good
  news is the worst shape this bug takes: nothing looks broken.

  It also unwrapped `data.items`, but the handler returns the array directly
  (`api.JSON(w, 200, posts, nil)`), so even against the right route every
  post would have been dropped.
*/
export function usePendingGroupPosts(groupId: string) {
  return useQuery({
    queryKey: ['group-pending-posts', groupId],
    queryFn: async () => {
      const res = await api.get(`/v1/groups/${groupId}/posts/v2/pending`)
      return res.data.data ?? []
    },
    enabled: !!groupId,
  })
}

export function useApproveGroupPost(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    // /posts/v2/ — the route is `POST /:groupId/posts/v2/:postId/approve`.
    // Without the v2 segment this 404'd, so the button reported success and
    // the post stayed pending for ever.
    mutationFn: async (postId: string) => { await api.post(`/v1/groups/${groupId}/posts/v2/${postId}/approve`) },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-pending-posts', groupId] })
      // 'group-posts' matched no live query — every group feed reads
      // 'group-feed-v2' — so an approved post did not appear until a reload.
      qc.invalidateQueries({ queryKey: ['group-feed-v2', groupId] })
    },
  })
}

export function useRejectGroupPost(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (postId: string) => { await api.post(`/v1/groups/${groupId}/posts/v2/${postId}/reject`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group-pending-posts', groupId] }),
  })
}

/*
  The banned list. This asked for `GET /:groupId/bans`, which group-service
  does not have — the route is `GET /:groupId/members/banned` — and it
  unwrapped `data.items` where the handler returns the array directly. Two
  independent reasons for the list to be empty, so fixing either alone would
  have left it looking broken.

  Unban is not here: the settings page already calls
  `DELETE /:groupId/members/:userId/ban`, which is correct.
*/
export function useGroupBans(groupId: string) {
  return useQuery({
    queryKey: ['group-bans', groupId],
    queryFn: async () => {
      const res = await api.get(`/v1/groups/${groupId}/members/banned`)
      return res.data.data ?? []
    },
    enabled: !!groupId,
  })
}

/*
  Deleted from here: useBanGroupUser, useGroupJoinRequests and
  useApproveJoinRequest.

  All three were duplicates of working hooks in useGroups.ts, and each
  duplicate was the broken copy:

  - useBanGroupUser posted to `/:groupId/bans` (no such route) and had no
    callers at all. The members tab uses useGroups' useBanMember, which
    posts to `/:groupId/members/:userId/ban` and works.
  - useGroupJoinRequests shared the react-query key
    ['group-join-requests', groupId] with useGroups' useJoinRequests while
    unwrapping data.items instead of data. Two queryFns under one key is
    resolved by whichever registers first, so the settings page's request
    count depended on mount order — and read 0, which meant the working
    GroupJoinRequestsPanel behind that gate never rendered and nobody could
    approve a join request from the web.
  - useApproveJoinRequest had no callers and collided by name with the
    working one in useGroups.

  A duplicate under a shared cache key is worse than either copy alone, so
  these go rather than get fixed twice.
*/

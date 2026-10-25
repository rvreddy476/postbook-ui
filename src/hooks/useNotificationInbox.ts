import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthUser } from '@/store/auth'
import { decodeNotificationPage, type InboxNotification } from '@/lib/notificationInbox'
import { INBOX_TAB_CATEGORY, loadInboxWindows, markAllNotificationsRead, markInboxDataRead, type InboxLoad, type InboxTab } from '@/lib/activityInbox'

export type NotificationCategory = 'all' | 'activity' | 'likes' | 'comments' | 'mentions' | 'followers' | 'groups' | 'channels' | 'communities' | 'system' | 'qa'

export function useNotificationInbox(category: NotificationCategory = 'all', cursor: string | null = null) {
  const user = useAuthUser()
  return useQuery({
    queryKey: ['notification-inbox', user?.id, category, cursor],
    enabled: !!user?.id,
    queryFn: async () => {
      const params = new URLSearchParams({ category, limit: '30' })
      if (cursor) params.set('cursor', cursor)
      const res = await api.get<unknown>(`/v1/notifications?${params}`)
      return decodeNotificationPage(res.data)
    },
    refetchInterval: 30_000,
  })
}

/**
 * The Activity page's list for one tab, as an infinite list. Each page is
 * one load (loadInboxWindows): it walks past empty filtered windows by
 * itself, up to the per-load cap. Requests is not a notification list, so
 * the query stays off for it.
 */
export function useActivityInbox(tab: InboxTab) {
  const user = useAuthUser()
  const category = INBOX_TAB_CATEGORY[tab]
  return useInfiniteQuery({
    queryKey: ['notification-inbox', user?.id, 'tab', tab],
    enabled: !!user?.id && category !== null,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }): Promise<InboxLoad> =>
      loadInboxWindows(async (path) => (await api.get<unknown>(path)).data, category ?? '', pageParam),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    // Refetching an infinite list replays every page; poll only the first.
    refetchInterval: (query) => ((query.state.data?.pages.length ?? 0) <= 1 ? 30_000 : false),
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (notifications: Pick<InboxNotification, 'bucket' | 'ts'>[]) => {
      await Promise.all(notifications.map(({ bucket, ts }) => api.post('/v1/notifications/read', { bucket, ts })))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notification-inbox'] })
      qc.invalidateQueries({ queryKey: ['activity-notifications'] })
      qc.invalidateQueries({ queryKey: ['unread-count'] })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => markAllNotificationsRead(api),
    // Show the result at once; the server stays the authority on settle.
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['notification-inbox'] })
      await qc.cancelQueries({ queryKey: ['unread-count'] })
      const inbox = qc.getQueriesData({ queryKey: ['notification-inbox'] })
      const count = qc.getQueryData(['unread-count'])
      qc.setQueriesData({ queryKey: ['notification-inbox'] }, (old: unknown) => markInboxDataRead(old))
      if (count !== undefined) qc.setQueryData(['unread-count'], { count: 0 })
      return { inbox, count }
    },
    onError: (_error, _vars, context) => {
      for (const [key, data] of context?.inbox ?? []) qc.setQueryData(key, data)
      if (context?.count !== undefined) qc.setQueryData(['unread-count'], context.count)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notification-inbox'] })
      qc.invalidateQueries({ queryKey: ['activity-notifications'] })
      qc.invalidateQueries({ queryKey: ['unread-count'] })
    },
  })
}

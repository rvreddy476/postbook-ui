import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthUser } from '@/store/auth'
import { decodeNotificationPage, type InboxNotification } from '@/lib/notificationInbox'

export type NotificationCategory = 'all' | 'activity' | 'mentions' | 'groups' | 'channels' | 'communities' | 'system' | 'qa'

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
    mutationFn: async () => {
      await api.patch('/v1/notifications/read-all')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notification-inbox'] })
      qc.invalidateQueries({ queryKey: ['activity-notifications'] })
      qc.invalidateQueries({ queryKey: ['unread-count'] })
    },
  })
}

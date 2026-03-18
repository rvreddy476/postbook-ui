import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export type NotificationCategory = 'all' | 'activity' | 'mentions' | 'groups' | 'channels' | 'communities' | 'system'

interface Notification {
  id: string
  type: string
  title: string
  body?: string
  deep_link?: string
  priority: string
  is_read: boolean
  created_at: string
  actor_name?: string
  actor_avatar?: string
}

export function useNotificationInbox(category: NotificationCategory = 'all') {
  return useQuery({
    queryKey: ['notification-inbox', category],
    queryFn: async () => {
      const params = new URLSearchParams({ category, limit: '30' })
      const res = await api.get<{ data: { notifications: Notification[]; unread_count: number } }>(`/v1/notifications?${params}`)
      return res.data.data
    },
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (notificationIds: string[]) => {
      await api.post('/v1/notifications/mark-seen', { notification_ids: notificationIds })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-inbox'] })
      qc.invalidateQueries({ queryKey: ['unread-count'] })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (category?: string) => {
      await api.post('/v1/notifications/mark-all-read', { category: category ?? null })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-inbox'] })
      qc.invalidateQueries({ queryKey: ['unread-count'] })
    },
  })
}

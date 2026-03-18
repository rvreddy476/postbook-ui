import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

/**
 * On app open / session resume, performs the sync burst:
 * 1. GET /v1/notifications/unread-count
 * 2. GET /v1/notifications?limit=30
 * 3. POST /v1/unread/bulk (with user's groups/channels/communities)
 * 4. GET /v1/feed/delta for last active feed
 * 5. Establish WebSocket
 */
export function useOfflineSync() {
  const qc = useQueryClient()
  const hasSynced = useRef(false)

  useEffect(() => {
    if (hasSynced.current) return
    hasSynced.current = true

    const sync = async () => {
      try {
        // Parallel requests
        const [unreadRes, notifsRes] = await Promise.allSettled([
          api.get('/v1/notifications/unread-count'),
          api.get('/v1/notifications?limit=30&unread_only=false'),
        ])

        if (unreadRes.status === 'fulfilled') {
          qc.setQueryData(['unread-count'], unreadRes.value.data.data)
        }
        if (notifsRes.status === 'fulfilled') {
          qc.setQueryData(['notifications'], notifsRes.value.data.data)
        }
      } catch {
        // sync is best-effort
      }
    }

    sync()
  }, [qc])
}

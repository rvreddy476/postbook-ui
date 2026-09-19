import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

/**
 * On app open / session resume, performs the sync burst.
 *
 * What this hook actually does, both best-effort:
 *   1. GET /v1/notifications/unread-count
 *   2. GET /v1/notifications?limit=30&unread_only=false
 *
 * What the docstring used to also claim, and what is true of each:
 *   3. POST /v1/unread/bulk — never implemented here, and NOT REACHABLE.
 *      notification-service registers the handler
 *      (r.POST("/v1/unread/bulk", h.BulkUnread) in
 *      notification-service/internal/http/handler.go) but the api-gateway's
 *      prefix table has no `/v1/unread` entry, so a call would 404 at the
 *      edge. This is a backend gap; do not add the call until the gateway
 *      routes the prefix.
 *   4. GET /v1/feed/delta — never implemented here. `/v1/feed` IS routed, so
 *      this one is only unfinished UI work, not a gap.
 *   5. WebSocket — established elsewhere (see lib/notificationSocket).
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

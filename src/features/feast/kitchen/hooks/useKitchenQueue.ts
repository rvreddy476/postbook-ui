"use client"

/*
  The live order board for one restaurant.

  Transport: a restaurant-scoped realtime token
  (POST /v1/food/realtime/token {scope:"restaurant", id}) opens an SSE stream
  on notification-service's /v1/realtime/sse. Every frame on the
  restaurant's topics triggers a refetch — the frames are hints, the REST
  answers are the truth. The token lives five minutes and is checked only at
  connect, so every (re)connect fetches a fresh one.

  Polling is always there: every 15 s while the stream is not open (token
  refused, realtime not configured, the stream dropped, or the /v1 hop
  buffers), and a 60 s safety refetch while it is.
*/

import { useCallback, useEffect, useRef, useState } from "react"

import { fetchOrders, fetchQueue, issueRestaurantToken, sseUrl } from "../api/client"
import { toFailure, type ApiFailure } from "../model/errors"
import { ACTIVE_STATUSES } from "../model/orders"
import type { PartnerOrder, QueueOrder } from "../model/wire"

export const POLL_MS = 15_000
export const LIVE_SAFETY_MS = 60_000
const RECONNECT_MS = [5_000, 15_000, 30_000, 60_000]

export type Transport = "connecting" | "live" | "polling"

export interface KitchenBoard {
  queue: QueueOrder[]
  /** Device time the queue response arrived: the countdown's anchor. */
  fetchedAt: number
  active: PartnerOrder[]
  loaded: boolean
  error: ApiFailure | null
  transport: Transport
  refresh: () => Promise<void>
}

export function useKitchenQueue(restaurantId: string): KitchenBoard {
  const [queue, setQueue] = useState<QueueOrder[]>([])
  const [fetchedAt, setFetchedAt] = useState(0)
  const [active, setActive] = useState<PartnerOrder[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<ApiFailure | null>(null)
  const [transport, setTransport] = useState<Transport>("connecting")
  const inflight = useRef<Promise<void> | null>(null)

  const refresh = useCallback(async () => {
    if (inflight.current) return inflight.current
    const run = (async () => {
      try {
        const [q, orders] = await Promise.all([fetchQueue(restaurantId), fetchOrders(restaurantId)])
        setQueue(q)
        setFetchedAt(Date.now())
        setActive(orders.filter((o) => ACTIVE_STATUSES.has(o.status)))
        setError(null)
      } catch (e) {
        setError(toFailure(e))
      } finally {
        setLoaded(true)
        inflight.current = null
      }
    })()
    inflight.current = run
    return run
  }, [restaurantId])

  // SSE with reconnect.
  useEffect(() => {
    let cancelled = false
    let source: EventSource | null = null
    let attempt = 0
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = async () => {
      if (cancelled || typeof EventSource === "undefined") {
        setTransport("polling")
        return
      }
      setTransport((t) => (t === "live" ? t : "connecting"))
      try {
        const token = await issueRestaurantToken(restaurantId)
        const topics = token.topics.filter((t) => t.startsWith(`food.restaurant.${restaurantId}`))
        if (cancelled) return
        if (topics.length === 0) {
          setTransport("polling")
          return
        }
        source = new EventSource(sseUrl(token.token, topics))
        source.onopen = () => {
          attempt = 0
          setTransport("live")
        }
        const onFrame = () => void refresh()
        source.onmessage = onFrame
        for (const t of topics) source.addEventListener(t, onFrame)
        source.onerror = () => {
          source?.close()
          source = null
          setTransport("polling")
          schedule()
        }
      } catch (e) {
        const f = toFailure(e)
        setTransport("polling")
        // 404 (not this owner's restaurant) and 503 (not configured) will not change by retrying soon.
        if (f.status !== 404) schedule(f.status === 503 ? 4 : undefined)
      }
    }

    const schedule = (minStep?: number) => {
      if (cancelled) return
      const step = Math.min(Math.max(attempt, minStep ?? 0), RECONNECT_MS.length - 1)
      attempt += 1
      reconnectTimer = setTimeout(() => void connect(), RECONNECT_MS[step])
    }

    void connect()
    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      source?.close()
    }
  }, [restaurantId, refresh])

  // Polling: 15 s unless live, then a 60 s safety net. Refetch on tab focus.
  useEffect(() => {
    void refresh()
    const every = transport === "live" ? LIVE_SAFETY_MS : POLL_MS
    const timer = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") void refresh()
    }, every)
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [refresh, transport])

  return { queue, fetchedAt, active, loaded, error, transport, refresh }
}

/** A clock that ticks once a second, for countdowns. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

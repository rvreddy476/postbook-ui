"use client"

/*
  Live order updates: a scoped realtime token (POST /v1/food/realtime/token
  {scope: "order", id}) and the SSE gateway (/v1/realtime/sse?token&topics),
  reached through the same `/v1` rewrite and proxy as every other call. The
  token lives five minutes and is checked only when a connection opens, so
  every (re)connect asks for a fresh one.

  Each frame is `{topic, event_type, data, emitted_at}` under the topic's
  event name. A `rider.location` frame carries a fix; anything else means
  "the order moved", and the caller refetches.

  Polling is the floor, not an afterthought: `connected` is false until the
  stream opens and again after any error, and the caller polls every 10 s
  while it is false (and slowly while it is true, in case a proxy buffers).
*/

import { useEffect, useRef, useState } from "react"

import { issueOrderRealtimeToken } from "../api/client"
import type { Point } from "../model/wire"

export interface LiveHandlers {
  onChange: () => void
  onFix: (fix: Point) => void
}

const MAX_RECONNECTS = 5

export function parseFrame(raw: string): { eventType: string; fix: Point | null } | null {
  try {
    const env = JSON.parse(raw) as { event_type?: unknown; data?: unknown }
    const eventType = typeof env.event_type === "string" ? env.event_type : ""
    let fix: Point | null = null
    if (eventType === "rider.location" && env.data && typeof env.data === "object") {
      const d = env.data as Record<string, unknown>
      const lat = d.latitude ?? d.lat
      const lng = d.longitude ?? d.lng
      if (typeof lat === "number" && typeof lng === "number") {
        fix = {
          latitude: lat,
          longitude: lng,
          recordedAt: typeof d.recorded_at === "string" ? d.recorded_at : null,
          addressLine1: null,
          city: null,
        }
      }
    }
    return { eventType, fix }
  } catch {
    return null
  }
}

export function useLiveOrder(orderId: string, active: boolean, handlers: LiveHandlers): { connected: boolean } {
  const [connected, setConnected] = useState(false)
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    if (!active || !orderId || typeof EventSource === "undefined") return
    let cancelled = false
    let source: EventSource | null = null
    let retry: ReturnType<typeof setTimeout> | null = null
    let attempts = 0

    const open = async () => {
      if (cancelled) return
      attempts++
      try {
        const { token, topics } = await issueOrderRealtimeToken(orderId)
        const topic = `food.order.${orderId}`
        if (cancelled || !token || !topics.includes(topic)) return
        const base = process.env.NEXT_PUBLIC_API_BASE_URL || ""
        const url = `${base}/v1/realtime/sse?token=${encodeURIComponent(token)}&topics=${encodeURIComponent(topic)}`
        source = new EventSource(url, { withCredentials: true })
        source.addEventListener("connected", () => {
          attempts = 0
          setConnected(true)
        })
        source.addEventListener(topic, (e: MessageEvent) => {
          const frame = parseFrame(String(e.data))
          if (!frame) return
          if (frame.fix) ref.current.onFix(frame.fix)
          else ref.current.onChange()
        })
        source.onerror = () => {
          setConnected(false)
          source?.close()
          source = null
          if (!cancelled && attempts < MAX_RECONNECTS) retry = setTimeout(open, Math.min(30_000, 2_000 * 2 ** attempts))
        }
      } catch {
        // 503 FOOD_REALTIME_NOT_CONFIGURED, 404, offline: polling carries on.
        setConnected(false)
      }
    }
    void open()

    return () => {
      cancelled = true
      if (retry) clearTimeout(retry)
      source?.close()
      setConnected(false)
    }
  }, [orderId, active])

  return { connected }
}

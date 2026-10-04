"use client"

/*
  Live booking updates: a scoped realtime token (POST /v1/doorstep/realtime/token
  {booking_id}) for the topic doorstep.booking.<id>, and the SSE gateway
  (/v1/realtime/sse?token&topics) through the same `/v1` proxy as every
  other call. The token is checked only when a connection opens, so every
  (re)connect asks for a fresh one.

  Frames are `{event_type, data, at}` under the topic's event name
  (contracts/doorstep/asyncapi.yaml). A `pro_location` frame carries the
  professional's fix and ETA while en route; anything else means "the
  booking moved", and the caller refetches.

  Polling is the floor: `connected` is false until the stream opens and
  again after any error, and the caller polls every 10 s while it is false
  (and slowly while it is true, in case a proxy buffers).
*/

import { useEffect, useRef, useState } from "react"

import { issueBookingRealtimeToken } from "../api/client"
import type { ProFix } from "../model/booking"

export const LIVE_POLL_MS = 10_000
export const SLOW_POLL_MS = 30_000

export interface LiveHandlers {
  onChange: (eventType: string) => void
  onFix: (fix: ProFix) => void
}

const MAX_RECONNECTS = 5

export function bookingTopic(bookingId: string): string {
  return `doorstep.booking.${bookingId}`
}

export function parseFrame(raw: string): { eventType: string; fix: ProFix | null } | null {
  try {
    const env = JSON.parse(raw) as { event_type?: unknown; data?: unknown; at?: unknown }
    const eventType = typeof env.event_type === "string" ? env.event_type : ""
    let fix: ProFix | null = null
    if (eventType === "pro_location" && env.data && typeof env.data === "object") {
      const d = env.data as Record<string, unknown>
      const at = typeof d.at === "string" ? d.at : typeof env.at === "string" ? env.at : ""
      if (typeof d.lat === "number" && typeof d.lng === "number" && at) {
        fix = { lat: d.lat, lng: d.lng, etaMinutes: typeof d.eta_minutes === "number" ? d.eta_minutes : null, at }
      }
    }
    return { eventType, fix }
  } catch {
    return null
  }
}

export function useLiveBooking(bookingId: string, active: boolean, handlers: LiveHandlers): { connected: boolean } {
  const [connected, setConnected] = useState(false)
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    if (!active || !bookingId || typeof EventSource === "undefined") return
    let cancelled = false
    let source: EventSource | null = null
    let retry: ReturnType<typeof setTimeout> | null = null
    let attempts = 0

    const open = async () => {
      if (cancelled) return
      attempts++
      try {
        const { token, topics } = await issueBookingRealtimeToken(bookingId)
        const topic = bookingTopic(bookingId)
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
          else ref.current.onChange(frame.eventType)
        })
        source.onerror = () => {
          setConnected(false)
          source?.close()
          source = null
          if (!cancelled && attempts < MAX_RECONNECTS) retry = setTimeout(open, Math.min(30_000, 2_000 * 2 ** attempts))
        }
      } catch {
        // Not configured, not ours, offline: polling carries on.
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
  }, [bookingId, active])

  return { connected }
}

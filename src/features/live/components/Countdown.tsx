"use client"

import { useEffect, useState } from "react"

import { formatCountdown, msUntil } from "../discovery"
import "../surfaces.css"

/** The clock, re-read every `intervalMs` while mounted. 0 until the first effect (server render). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(0)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

/** "2d 4h" … "5m 09s" … "Starting soon", ticking each second. Nothing until the clock is known. */
export function Countdown({ to }: { to: string }) {
  const now = useNow(1000)
  const ms = now ? msUntil(to, now) : null
  if (ms === null) return null
  return <span className="live-countdown" role="timer" aria-live="off">{formatCountdown(ms)}</span>
}

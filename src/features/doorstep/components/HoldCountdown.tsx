"use client"

/* The 10-minute hold, counted down from the server's hold_expires_at. */

import { Timer } from "lucide-react"
import { useEffect, useState } from "react"

import { formatCountdown, holdRemainingMs } from "../model/slots"

export function useNow(everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(t)
  }, [everyMs])
  return now
}

export function HoldCountdown({ holdExpiresAt, now }: { holdExpiresAt: string | null; now: number }) {
  const left = holdRemainingMs(holdExpiresAt, now)
  if (left === 0) {
    return (
      <p className="ds-alert" role="alert">
        Your hold on this slot lapsed. Pick a slot again.
      </p>
    )
  }
  return (
    <div className={left < 120_000 ? "ds-hold is-low" : "ds-hold"} role="timer" aria-live="off">
      <Timer size={14} aria-hidden="true" />
      <span className="ds-grow">Slot held for you</span>
      <span>{formatCountdown(left)}</span>
    </div>
  )
}

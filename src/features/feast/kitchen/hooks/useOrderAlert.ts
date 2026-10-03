"use client"

/*
  The new-order sound. Browsers refuse audio before a user gesture, and a
  sound that silently fails to play is worse than none, so:

  - Nothing plays until the partner presses "Turn on order sound" (that click
    creates and resumes the AudioContext — the gesture the browser needs).
  - Then a two-tone chime LOOPS every few seconds while any new order is
    unacknowledged. Accepting, rejecting, the deadline passing or "Silence"
    acknowledges it; a new order starts it again.
  - Mute is a toggle remembered on this device.

  The chime is synthesised (no audio file to ship or fetch).
*/

import { useCallback, useEffect, useRef, useState } from "react"

const MUTE_KEY = "feast.kitchen.mute"
export const CHIME_EVERY_MS = 3_000

/** Pure: should the loop be sounding right now? */
export function shouldRing(s: { unlocked: boolean; muted: boolean; unacknowledged: number }): boolean {
  return s.unlocked && !s.muted && s.unacknowledged > 0
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1"
  } catch {
    return false
  }
}

function playChime(ctx: AudioContext) {
  const t0 = ctx.currentTime
  for (const [i, freq] of [880, 1320].entries()) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = freq
    const start = t0 + i * 0.22
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + 0.22)
  }
}

export interface OrderAlert {
  unlocked: boolean
  muted: boolean
  ringing: boolean
  /** Call from a click handler: the user gesture that allows audio. */
  unlock: () => void
  toggleMute: () => void
}

export function useOrderAlert(unacknowledged: number): OrderAlert {
  const ctxRef = useRef<AudioContext | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [muted, setMuted] = useState(false)

  useEffect(() => setMuted(readMuted()), [])

  const unlock = useCallback(() => {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      const ctx = ctxRef.current ?? new Ctor()
      ctxRef.current = ctx
      void ctx.resume().then(() => {
        setUnlocked(ctx.state === "running")
        if (ctx.state === "running") playChime(ctx) // audible confirmation the sound works
      })
    } catch {
      setUnlocked(false)
    }
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m
      try {
        localStorage.setItem(MUTE_KEY, next ? "1" : "0")
      } catch {
        // Storage blocked: the toggle still works for this visit.
      }
      return next
    })
  }, [])

  const ringing = shouldRing({ unlocked, muted, unacknowledged })

  useEffect(() => {
    const ctx = ctxRef.current
    if (!ringing || !ctx) return
    playChime(ctx)
    const t = setInterval(() => playChime(ctx), CHIME_EVERY_MS)
    return () => clearInterval(t)
  }, [ringing])

  useEffect(() => () => void ctxRef.current?.close().catch(() => undefined), [])

  return { unlocked, muted, ringing, unlock, toggleMute }
}

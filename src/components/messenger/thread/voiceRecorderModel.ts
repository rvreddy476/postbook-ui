/*
  The voice recorder's rules, kept out of the component so they can be
  tested without a microphone.

  Two ways to record with the one mic button:
  - press and hold: recording runs while the button is held; letting go sends,
    dragging the pointer well away (or Escape) throws it away;
  - a quick tap (shorter than TAP_MAX_MS) switches to "tap to record, tap to
    send": recording carries on with a timer, a cancel and a send button.
  Either way recording stops on its own at VOICE_MAX_MS and sends what it has.
*/

import { VOICE_MAX_MS } from '@/lib/chat/contract'
import { VOICE_MIN_MS } from '@/lib/chat/voice'

/** A press shorter than this is a tap, which locks recording on. */
export const TAP_MAX_MS = 250

/** Dragging this far from where the press started cancels a held recording. */
export const CANCEL_DISTANCE_PX = 80

export type RecorderPhase =
  /** Nothing happening. */
  | 'idle'
  /** Pointer is down and recording; release decides hold-send or tap-lock. */
  | 'pressing'
  /** Tap mode: recording with its own cancel and send controls. */
  | 'locked'

export interface RecorderState {
  phase: RecorderPhase
  /** When the pointer went down (ms, same clock as the events). */
  pressedAt: number
}

export const IDLE: RecorderState = { phase: 'idle', pressedAt: 0 }

export type RecorderEvent =
  | { type: 'press'; at: number }
  | { type: 'release'; at: number }
  /** Pointer moved; `far` = beyond CANCEL_DISTANCE_PX from the press origin. */
  | { type: 'move'; far: boolean }
  | { type: 'escape' }
  | { type: 'cancel' }
  | { type: 'send' }
  /** The clock ticked; `elapsedMs` is how long the recorder has been running. */
  | { type: 'tick'; elapsedMs: number }
  /** The recorder could not start (no permission, no device). */
  | { type: 'failed' }

/** What the component must do after a transition. */
export type RecorderEffect = 'start' | 'send' | 'cancel' | null

export interface Transition {
  state: RecorderState
  effect: RecorderEffect
}

const stay = (state: RecorderState): Transition => ({ state, effect: null })

export function recorderReducer(state: RecorderState, event: RecorderEvent): Transition {
  switch (event.type) {
    case 'press':
      // A press while locked is not a new recording: the locked controls own it.
      if (state.phase !== 'idle') return stay(state)
      return { state: { phase: 'pressing', pressedAt: event.at }, effect: 'start' }

    case 'release':
      if (state.phase !== 'pressing') return stay(state)
      if (event.at - state.pressedAt < TAP_MAX_MS) return stay({ phase: 'locked', pressedAt: state.pressedAt })
      return { state: IDLE, effect: 'send' }

    case 'move':
      if (state.phase === 'pressing' && event.far) return { state: IDLE, effect: 'cancel' }
      return stay(state)

    case 'escape':
    case 'cancel':
      if (state.phase === 'idle') return stay(state)
      return { state: IDLE, effect: 'cancel' }

    case 'send':
      if (state.phase !== 'locked') return stay(state)
      return { state: IDLE, effect: 'send' }

    case 'tick':
      if (state.phase === 'idle') return stay(state)
      if (shouldAutoStop(event.elapsedMs)) return { state: IDLE, effect: 'send' }
      return stay(state)

    case 'failed':
      return stay(IDLE)
  }
}

/** True once the recording has reached the server's cap. */
export function shouldAutoStop(elapsedMs: number, maxMs = VOICE_MAX_MS): boolean {
  return elapsedMs >= maxMs
}

/** A recording shorter than VOICE_MIN_MS is an accidental tap, not a message. */
export function isLongEnough(elapsedMs: number): boolean {
  return Number.isFinite(elapsedMs) && elapsedMs >= VOICE_MIN_MS
}

/** Elapsed recording time; never negative, zero before the recorder started. */
export function elapsedSince(startedAt: number | null, now: number): number {
  if (startedAt === null || !Number.isFinite(startedAt)) return 0
  return Math.max(0, now - startedAt)
}

export function isFarFrom(origin: { x: number; y: number }, point: { x: number; y: number }, threshold = CANCEL_DISTANCE_PX): boolean {
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  return dx * dx + dy * dy > threshold * threshold
}

/**
 * RMS level 0..1 of one AnalyserNode.getByteTimeDomainData frame, where 128
 * is silence. An empty frame is silent.
 */
export function levelFromTimeDomain(frame: ArrayLike<number>): number {
  const n = frame.length
  if (n === 0) return 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    const raw = Number(frame[i])
    const v = ((Number.isFinite(raw) ? raw : 128) - 128) / 128
    sum += v * v
  }
  return Math.max(0, Math.min(1, Math.sqrt(sum / n)))
}

/**
 * How wide the live level bar is (0..1). Speech RMS sits around 0.05..0.3,
 * so the raw level would barely move the bar; a square-root curve with a
 * gain makes normal speech fill most of it.
 */
export function displayLevel(level: number): number {
  if (!(level > 0)) return 0
  return Math.min(1, Math.sqrt(level) * 1.6)
}

/** Most level samples kept for the fallback waveform (50 ms each → 5 min). */
export const MAX_LEVEL_SAMPLES = 6000

/** Append a level sample, dropping the newest when full (the cap is the 5-minute limit anyway). */
export function pushLevel(samples: number[], level: number, max = MAX_LEVEL_SAMPLES): void {
  if (samples.length >= max) return
  samples.push(Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0)
}

/** "audio/webm;codecs=opus" → "audio/webm": the upload's declared type carries no codec parameters. */
export function baseMime(mime: string): string {
  const base = mime.split(';')[0].trim().toLowerCase()
  return base || 'audio/webm'
}

/** voice-<ts>.webm / .ogg / .m4a, matching the recorded container. */
export function voiceFileName(mime: string, ts: number): string {
  const base = baseMime(mime)
  const ext = base.includes('ogg') ? 'ogg' : base.includes('mp4') || base.includes('aac') || base.includes('m4a') ? 'm4a' : 'webm'
  return `voice-${Math.floor(ts)}.${ext}`
}

/** The words for a microphone failure. */
export function micErrorText(err: unknown): string {
  const name = typeof err === 'object' && err !== null && 'name' in err ? String((err as { name: unknown }).name) : ''
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone found.'
  if (name === 'NotReadableError') return 'Your microphone is being used by another app.'
  return 'Allow microphone access to record a voice message.'
}

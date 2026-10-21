/*
  Voice messages (CONTRACT §2.1 type "voice"): the waveform and duration are
  computed in the browser from the recording and sent with the message —
  `waveform` is ≤64 ints 0..255, `duration_ms` is 1..300000.
*/

import { VOICE_MAX_MS, WAVEFORM_MAX_BARS } from './contract'

/**
 * Peak-normalised RMS per bucket. `samples` is one channel of PCM in -1..1
 * (AudioBuffer.getChannelData). A silent or empty recording is all zeros, so
 * the bubble draws flat bars rather than inventing a shape.
 */
export function buildWaveform(samples: ArrayLike<number>, bars = WAVEFORM_MAX_BARS): number[] {
  const n = Math.max(1, Math.min(WAVEFORM_MAX_BARS, Math.floor(bars)))
  const len = samples.length
  if (len === 0) return new Array(n).fill(0)
  const count = Math.min(n, len)
  const rms: number[] = []
  for (let b = 0; b < count; b++) {
    const start = Math.floor((b * len) / count)
    const end = Math.max(start + 1, Math.floor(((b + 1) * len) / count))
    let sum = 0
    for (let i = start; i < end; i++) {
      const v = Number(samples[i]) || 0
      sum += v * v
    }
    rms.push(Math.sqrt(sum / (end - start)))
  }
  const peak = Math.max(...rms)
  if (!(peak > 0)) return new Array(count).fill(0)
  return rms.map((v) => Math.max(0, Math.min(255, Math.round((v / peak) * 255))))
}

/** Clamp to what the server accepts (1 ms .. 5 min). */
export function clampVoiceDuration(ms: number): number {
  if (!Number.isFinite(ms)) return 1
  return Math.max(1, Math.min(VOICE_MAX_MS, Math.round(ms)))
}

/** Too short to be worth sending (an accidental tap on the mic). */
export const VOICE_MIN_MS = 700

const MIME_PREFERENCE = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4']

/** The first recorder format this browser supports, or "" for the default. */
export function pickRecorderMime(isSupported: (mime: string) => boolean): string {
  for (const m of MIME_PREFERENCE) {
    try {
      if (isSupported(m)) return m
    } catch {
      /* some browsers throw for unknown types */
    }
  }
  return ''
}

/** 0:07, 1:32, 5:00. */
export function formatVoiceDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Bars for drawing, resampled to `count` (a 64-bar waveform on a narrow bubble). */
export function resampleBars(waveform: readonly number[], count: number): number[] {
  if (count <= 0) return []
  if (waveform.length === 0) return new Array(count).fill(0)
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    const idx = Math.min(waveform.length - 1, Math.floor((i * waveform.length) / count))
    out.push(waveform[idx])
  }
  return out
}

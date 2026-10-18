import { describe, expect, test } from 'bun:test'
import { VOICE_MAX_MS, WAVEFORM_MAX_BARS } from '../contract'
import {
  VOICE_MIN_MS,
  buildWaveform,
  clampVoiceDuration,
  formatVoiceDuration,
  pickRecorderMime,
  resampleBars,
} from '../voice'

/** A sine whose amplitude ramps up across the buffer (a shape, not a flat line). */
function ramp(len: number): Float32Array {
  const out = new Float32Array(len)
  for (let i = 0; i < len; i++) out[i] = Math.sin(i / 3) * (i / len)
  return out
}

describe('buildWaveform', () => {
  test('an empty recording is all zeros at the requested width', () => {
    expect(buildWaveform([])).toEqual(new Array(WAVEFORM_MAX_BARS).fill(0))
    expect(buildWaveform([], 10)).toEqual(new Array(10).fill(0))
  })

  test('silence is all zeros, never a made-up shape', () => {
    const w = buildWaveform(new Float32Array(48_000))
    expect(w).toHaveLength(WAVEFORM_MAX_BARS)
    expect(w.every((v) => v === 0)).toBe(true)
  })

  test('never more than 64 bars, even when more are asked for', () => {
    expect(buildWaveform(ramp(10_000), 500)).toHaveLength(WAVEFORM_MAX_BARS)
    expect(buildWaveform(ramp(10_000))).toHaveLength(64)
    expect(buildWaveform(ramp(10_000), 16)).toHaveLength(16)
    expect(buildWaveform(ramp(10_000), 0)).toHaveLength(1)
  })

  test('peak-normalised: the loudest bar is exactly 255', () => {
    const w = buildWaveform(ramp(10_000))
    expect(Math.max(...w)).toBe(255)
    // Quiet start, loud end.
    expect(w[0]).toBeLessThan(w[w.length - 1])
  })

  test('every value is an integer in 0..255, even with out-of-range samples', () => {
    const wild = Float32Array.from({ length: 4096 }, (_, i) => (i % 7 === 0 ? 9 : -3) * Math.sin(i))
    for (const w of [buildWaveform(ramp(9_999)), buildWaveform(wild), buildWaveform([Number.NaN, 0.5, Number.NaN, 0.1])]) {
      for (const v of w) {
        expect(Number.isInteger(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(255)
      }
    }
  })

  test('fewer samples than bars gives one bar per sample', () => {
    const w = buildWaveform([0.5, -1, 0.25])
    expect(w).toEqual([128, 255, 64])
  })
})

describe('clampVoiceDuration', () => {
  test('keeps it within what the server accepts', () => {
    expect(clampVoiceDuration(0)).toBe(1)
    expect(clampVoiceDuration(-50)).toBe(1)
    expect(clampVoiceDuration(1234.6)).toBe(1235)
    expect(clampVoiceDuration(VOICE_MAX_MS + 1)).toBe(VOICE_MAX_MS)
    expect(clampVoiceDuration(Number.NaN)).toBe(1)
    expect(clampVoiceDuration(Number.POSITIVE_INFINITY)).toBe(1)
  })

  test('the minimum worth sending is below the cap and above zero', () => {
    expect(VOICE_MIN_MS).toBeGreaterThan(0)
    expect(VOICE_MIN_MS).toBeLessThan(VOICE_MAX_MS)
  })
})

describe('pickRecorderMime', () => {
  test('prefers Opus in WebM, then Opus in Ogg, then WebM, then MP4', () => {
    expect(pickRecorderMime(() => true)).toBe('audio/webm;codecs=opus')
    expect(pickRecorderMime((m) => m !== 'audio/webm;codecs=opus')).toBe('audio/ogg;codecs=opus')
    expect(pickRecorderMime((m) => m === 'audio/webm' || m === 'audio/mp4')).toBe('audio/webm')
    expect(pickRecorderMime((m) => m === 'audio/mp4')).toBe('audio/mp4')
  })

  test('nothing supported means the browser default ("")', () => {
    expect(pickRecorderMime(() => false)).toBe('')
  })

  test('a support check that throws is skipped, not fatal', () => {
    const asked: string[] = []
    const mime = pickRecorderMime((m) => {
      asked.push(m)
      if (m.includes('webm')) throw new Error('unknown type')
      return m === 'audio/mp4'
    })
    expect(mime).toBe('audio/mp4')
    expect(asked).toEqual(['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'])
    expect(pickRecorderMime(() => { throw new Error('x') })).toBe('')
  })
})

describe('formatVoiceDuration', () => {
  test('minutes and zero-padded seconds', () => {
    expect(formatVoiceDuration(0)).toBe('0:00')
    expect(formatVoiceDuration(7_000)).toBe('0:07')
    expect(formatVoiceDuration(92_000)).toBe('1:32')
    expect(formatVoiceDuration(VOICE_MAX_MS)).toBe('5:00')
    expect(formatVoiceDuration(-500)).toBe('0:00')
    expect(formatVoiceDuration(1_499)).toBe('0:01')
  })
})

describe('resampleBars', () => {
  test('stretches and squeezes to the drawn width', () => {
    expect(resampleBars([10, 20], 4)).toEqual([10, 10, 20, 20])
    expect(resampleBars([1, 2, 3, 4, 5, 6, 7, 8], 4)).toEqual([1, 3, 5, 7])
    expect(resampleBars(new Array(64).fill(9), 32)).toHaveLength(32)
  })

  test('empty waveform draws flat bars; zero or negative width draws none', () => {
    expect(resampleBars([], 3)).toEqual([0, 0, 0])
    expect(resampleBars([5], 0)).toEqual([])
    expect(resampleBars([5], -2)).toEqual([])
  })
})

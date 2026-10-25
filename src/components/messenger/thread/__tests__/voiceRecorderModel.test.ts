import { describe, expect, test } from 'bun:test'
import { VOICE_MAX_MS } from '@/lib/chat/contract'
import { VOICE_MIN_MS } from '@/lib/chat/voice'
import {
  CANCEL_DISTANCE_PX,
  IDLE,
  MAX_LEVEL_SAMPLES,
  TAP_MAX_MS,
  baseMime,
  displayLevel,
  elapsedSince,
  isFarFrom,
  isLongEnough,
  levelFromTimeDomain,
  micErrorText,
  pushLevel,
  recorderReducer,
  shouldAutoStop,
  voiceFileName,
  type RecorderEvent,
  type RecorderState,
} from '../voiceRecorderModel'

function run(events: RecorderEvent[], from: RecorderState = IDLE) {
  let state = from
  const effects: (string | null)[] = []
  for (const e of events) {
    const t = recorderReducer(state, e)
    state = t.state
    effects.push(t.effect)
  }
  return { state, effects }
}

describe('recorderReducer — press and hold', () => {
  test('a press starts recording', () => {
    const { state, effects } = run([{ type: 'press', at: 1000 }])
    expect(state).toEqual({ phase: 'pressing', pressedAt: 1000 })
    expect(effects).toEqual(['start'])
  })

  test('letting go after holding sends', () => {
    const { state, effects } = run([{ type: 'press', at: 1000 }, { type: 'release', at: 1000 + TAP_MAX_MS }])
    expect(state.phase).toBe('idle')
    expect(effects).toEqual(['start', 'send'])
  })

  test('dragging far away while holding cancels; a small wobble does not', () => {
    const wobble = run([{ type: 'press', at: 0 }, { type: 'move', far: false }])
    expect(wobble.state.phase).toBe('pressing')
    expect(wobble.effects).toEqual(['start', null])

    const away = run([{ type: 'press', at: 0 }, { type: 'move', far: true }, { type: 'release', at: 2000 }])
    expect(away.state.phase).toBe('idle')
    // The release after a cancel must not send what was thrown away.
    expect(away.effects).toEqual(['start', 'cancel', null])
  })

  test('Escape while holding cancels', () => {
    const { state, effects } = run([{ type: 'press', at: 0 }, { type: 'escape' }])
    expect(state.phase).toBe('idle')
    expect(effects).toEqual(['start', 'cancel'])
  })
})

describe('recorderReducer — tap to record, tap to send', () => {
  test('a quick tap locks recording on instead of sending', () => {
    const { state, effects } = run([{ type: 'press', at: 1000 }, { type: 'release', at: 1000 + TAP_MAX_MS - 1 }])
    expect(state.phase).toBe('locked')
    expect(effects).toEqual(['start', null])
  })

  test('send in locked mode sends; cancel and Escape discard', () => {
    const locked: RecorderState = { phase: 'locked', pressedAt: 0 }
    expect(recorderReducer(locked, { type: 'send' })).toEqual({ state: IDLE, effect: 'send' })
    expect(recorderReducer(locked, { type: 'cancel' })).toEqual({ state: IDLE, effect: 'cancel' })
    expect(recorderReducer(locked, { type: 'escape' })).toEqual({ state: IDLE, effect: 'cancel' })
  })

  test('moving the pointer around in locked mode does nothing', () => {
    const locked: RecorderState = { phase: 'locked', pressedAt: 0 }
    expect(recorderReducer(locked, { type: 'move', far: true })).toEqual({ state: locked, effect: null })
  })

  test('another press or release while locked does not start a second recording', () => {
    const locked: RecorderState = { phase: 'locked', pressedAt: 0 }
    expect(recorderReducer(locked, { type: 'press', at: 5 }).effect).toBeNull()
    expect(recorderReducer(locked, { type: 'release', at: 5 })).toEqual({ state: locked, effect: null })
  })
})

describe('recorderReducer — auto-stop, failures and idle noise', () => {
  test('the clock reaching the cap sends, in both modes', () => {
    for (const phase of ['pressing', 'locked'] as const) {
      const s: RecorderState = { phase, pressedAt: 0 }
      expect(recorderReducer(s, { type: 'tick', elapsedMs: VOICE_MAX_MS - 1 })).toEqual({ state: s, effect: null })
      expect(recorderReducer(s, { type: 'tick', elapsedMs: VOICE_MAX_MS })).toEqual({ state: IDLE, effect: 'send' })
    }
  })

  test('a recorder that failed to start returns to idle without an effect', () => {
    expect(recorderReducer({ phase: 'pressing', pressedAt: 0 }, { type: 'failed' })).toEqual({ state: IDLE, effect: null })
  })

  test('idle ignores everything but a press', () => {
    const noise: RecorderEvent[] = [
      { type: 'release', at: 9 }, { type: 'move', far: true }, { type: 'escape' }, { type: 'cancel' },
      { type: 'send' }, { type: 'tick', elapsedMs: VOICE_MAX_MS * 2 },
    ]
    for (const e of noise) expect(recorderReducer(IDLE, e)).toEqual({ state: IDLE, effect: null })
  })

  test('send only applies in locked mode (a hold sends by releasing)', () => {
    const pressing: RecorderState = { phase: 'pressing', pressedAt: 0 }
    expect(recorderReducer(pressing, { type: 'send' })).toEqual({ state: pressing, effect: null })
  })
})

describe('timing', () => {
  test('shouldAutoStop is inclusive at the cap', () => {
    expect(shouldAutoStop(VOICE_MAX_MS - 1)).toBe(false)
    expect(shouldAutoStop(VOICE_MAX_MS)).toBe(true)
    expect(shouldAutoStop(10, 10)).toBe(true)
  })

  test('isLongEnough drops accidental taps', () => {
    expect(isLongEnough(VOICE_MIN_MS - 1)).toBe(false)
    expect(isLongEnough(VOICE_MIN_MS)).toBe(true)
    expect(isLongEnough(Number.NaN)).toBe(false)
  })

  test('elapsedSince is zero before start and never negative', () => {
    expect(elapsedSince(null, 5000)).toBe(0)
    expect(elapsedSince(6000, 5000)).toBe(0)
    expect(elapsedSince(1000, 3500)).toBe(2500)
  })
})

describe('isFarFrom', () => {
  test('uses straight-line distance against the threshold', () => {
    const o = { x: 100, y: 100 }
    expect(isFarFrom(o, { x: 100 + CANCEL_DISTANCE_PX, y: 100 })).toBe(false)
    expect(isFarFrom(o, { x: 100 + CANCEL_DISTANCE_PX + 1, y: 100 })).toBe(true)
    expect(isFarFrom(o, { x: 160, y: 160 })).toBe(true) // ~85 px on the diagonal
    expect(isFarFrom(o, { x: 150, y: 150 })).toBe(false) // ~71 px
  })
})

describe('levels', () => {
  test('a silent analyser frame (all 128) is level 0; an empty frame too', () => {
    expect(levelFromTimeDomain(new Uint8Array(64).fill(128))).toBe(0)
    expect(levelFromTimeDomain([])).toBe(0)
  })

  test('full-scale square wave is level 1; a byte of 0 counts as full negative swing, not silence', () => {
    const sq = new Uint8Array(64).map((_, i) => (i % 2 ? 0 : 256 - 1))
    expect(levelFromTimeDomain(sq)).toBeGreaterThan(0.99)
    expect(levelFromTimeDomain([0, 0, 0, 0])).toBe(1)
  })

  test('displayLevel stays in 0..1 and lifts quiet speech', () => {
    expect(displayLevel(0)).toBe(0)
    expect(displayLevel(Number.NaN)).toBe(0)
    expect(displayLevel(-1)).toBe(0)
    expect(displayLevel(1)).toBe(1)
    expect(displayLevel(0.1)).toBeGreaterThan(0.4)
  })

  test('pushLevel clamps samples and stops at the cap', () => {
    const s: number[] = []
    pushLevel(s, 2)
    pushLevel(s, -1)
    pushLevel(s, Number.NaN)
    pushLevel(s, 0.5)
    expect(s).toEqual([1, 0, 0, 0.5])
    const full = new Array(3).fill(0.2)
    pushLevel(full, 0.9, 3)
    expect(full).toEqual([0.2, 0.2, 0.2])
    expect(MAX_LEVEL_SAMPLES * 50).toBe(VOICE_MAX_MS)
  })
})

describe('files', () => {
  test('baseMime drops codec parameters and defaults to webm', () => {
    expect(baseMime('audio/webm;codecs=opus')).toBe('audio/webm')
    expect(baseMime('Audio/OGG; codecs=opus')).toBe('audio/ogg')
    expect(baseMime('')).toBe('audio/webm')
  })

  test('voiceFileName picks the extension from the container', () => {
    expect(voiceFileName('audio/webm;codecs=opus', 1700000000000)).toBe('voice-1700000000000.webm')
    expect(voiceFileName('audio/ogg;codecs=opus', 1)).toBe('voice-1.ogg')
    expect(voiceFileName('audio/mp4', 2)).toBe('voice-2.m4a')
    expect(voiceFileName('audio/aac', 3)).toBe('voice-3.m4a')
    expect(voiceFileName('', 4)).toBe('voice-4.webm')
  })
})

describe('micErrorText', () => {
  test('permission denied asks for microphone access', () => {
    const text = 'Allow microphone access to record a voice message.'
    expect(micErrorText({ name: 'NotAllowedError' })).toBe(text)
    expect(micErrorText({ name: 'SecurityError' })).toBe(text)
    expect(micErrorText(new Error('boom'))).toBe(text)
    expect(micErrorText(null)).toBe(text)
  })

  test('missing or busy microphones say so', () => {
    expect(micErrorText({ name: 'NotFoundError' })).toBe('No microphone found.')
    expect(micErrorText({ name: 'NotReadableError' })).toBe('Your microphone is being used by another app.')
  })
})

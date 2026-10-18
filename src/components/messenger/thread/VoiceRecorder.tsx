'use client'

/*
  The composer's mic. Hold to record and let go to send (drag away or press
  Escape to throw it away), or tap once to record hands-free and tap send.
  The finished recording is handed to the composer as a File plus the
  duration and waveform the voice message carries (CONTRACT §2.1); uploading
  and sending are the composer's job.
*/

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { JSX, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Mic, Send, Trash2 } from 'lucide-react'
import { buildWaveform, clampVoiceDuration, formatVoiceDuration, pickRecorderMime } from '@/lib/chat/voice'
import {
  IDLE,
  baseMime,
  displayLevel,
  elapsedSince,
  isFarFrom,
  isLongEnough,
  levelFromTimeDomain,
  micErrorText,
  pushLevel,
  recorderReducer,
  voiceFileName,
  type RecorderEvent,
  type RecorderPhase,
  type RecorderState,
} from './voiceRecorderModel'

export interface VoiceRecording {
  file: File
  durationMs: number
  waveform: number[]
}

export interface VoiceRecorderProps {
  disabled?: boolean
  onRecorded(r: VoiceRecording): void
  onError(message: string): void
  onRecordingChange?(recording: boolean): void
}

/** How often the timer, the level bar and the level samples update. */
const TICK_MS = 50

type AudioContextCtor = typeof AudioContext

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

function recordingSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const hasRecorder = typeof (window as { MediaRecorder?: unknown }).MediaRecorder === 'function'
  const hasMic = typeof navigator.mediaDevices?.getUserMedia === 'function'
  return hasRecorder && hasMic
}

const noSubscribe = () => () => {}

/** Waveform from the recording itself; null when the browser cannot decode it. */
async function decodeWaveform(blob: Blob): Promise<number[] | null> {
  const Ctor = audioContextCtor()
  if (!Ctor) return null
  let ctx: AudioContext | null = null
  try {
    ctx = new Ctor()
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer())
    if (buf.numberOfChannels < 1 || buf.length === 0) return null
    return buildWaveform(buf.getChannelData(0))
  } catch {
    return null
  } finally {
    try { void ctx?.close() } catch { /* already closed */ }
  }
}

/** One recording, from the mic prompt to the finished file. */
interface Take {
  stream: MediaStream | null
  recorder: MediaRecorder | null
  chunks: Blob[]
  /** Live level samples (0..1): the waveform when decoding fails. */
  levels: number[]
  mime: string
  startedAt: number | null
  elapsedAtStop: number
  outcome: 'send' | 'cancel'
  meter: AudioContext | null
  tick: ReturnType<typeof setInterval> | null
  released: boolean
}

function stopMeter(take: Take): void {
  if (take.tick !== null) {
    clearInterval(take.tick)
    take.tick = null
  }
  const ctx = take.meter
  take.meter = null
  if (ctx) {
    try { void ctx.close() } catch { /* already closed */ }
  }
}

/** Timer, analyser and every mic track off, so the browser's recording light goes out. */
function releaseTake(take: Take): void {
  stopMeter(take)
  if (take.released || !take.stream) return
  take.released = true
  take.stream.getTracks().forEach((t) => {
    try { t.stop() } catch { /* already stopped */ }
  })
}

export function VoiceRecorder({ disabled, onRecorded, onError, onRecordingChange }: VoiceRecorderProps): JSX.Element | null {
  // false on the server and on the first client render, so hydration matches.
  const supported = useSyncExternalStore(noSubscribe, recordingSupported, () => false)

  const [phase, setPhase] = useState<RecorderPhase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [level, setLevel] = useState(0)
  const [processing, setProcessing] = useState(false)

  const stateRef = useRef<RecorderState>(IDLE)
  const mountedRef = useRef(true)
  /**
   * The recording in progress. Each take owns its stream, recorder, chunks
   * and outcome, so a quick second press while the last take is still being
   * finished cannot drop or mix it up; async work for a take that is no
   * longer current only cleans up after itself.
   */
  const takeRef = useRef<Take | null>(null)
  const originRef = useRef({ x: 0, y: 0 })

  // Latest callbacks without re-binding the recorder handlers.
  const cbRef = useRef({ onRecorded, onError, onRecordingChange })
  useEffect(() => { cbRef.current = { onRecorded, onError, onRecordingChange } })

  const finish = useCallback(async (take: Take) => {
    releaseTake(take)
    if (take.outcome !== 'send' || !mountedRef.current) return
    if (!isLongEnough(take.elapsedAtStop)) return
    const type = take.recorder?.mimeType || take.mime || 'audio/webm'
    const blob = new Blob(take.chunks, { type })
    take.chunks = []
    if (blob.size === 0) return
    setProcessing(true)
    try {
      const waveform = (await decodeWaveform(blob)) ?? buildWaveform(take.levels)
      const file = new File([blob], voiceFileName(type, Date.now()), { type: baseMime(type) })
      if (mountedRef.current) cbRef.current.onRecorded({ file, durationMs: clampVoiceDuration(take.elapsedAtStop), waveform })
    } finally {
      if (mountedRef.current) setProcessing(false)
    }
  }, [])

  /** Stop the current take; `send` decides whether finish() hands it on. */
  const stopRecording = useCallback((outcome: 'send' | 'cancel') => {
    const take = takeRef.current
    takeRef.current = null
    if (!take) return
    take.outcome = outcome
    take.elapsedAtStop = elapsedSince(take.startedAt, performance.now())
    stopMeter(take)
    const recorder = take.recorder
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop() // onstop → finish(take)
        return
      } catch { /* fall through and clean up */ }
    }
    // Never started (still asking for the mic) or failed to stop: just let go.
    releaseTake(take)
  }, [])

  const dispatchRef = useRef<(event: RecorderEvent) => void>(() => {})

  const startRecording = useCallback(async () => {
    const take: Take = {
      stream: null, recorder: null, chunks: [], levels: [], mime: '',
      startedAt: null, elapsedAtStop: 0, outcome: 'cancel', meter: null, tick: null, released: false,
    }
    takeRef.current = take
    setElapsed(0)
    setLevel(0)

    // Said even if the button was already let go: a denied permission
    // prompt usually arrives after the press ended.
    const fail = (message: string) => {
      releaseTake(take)
      if (!mountedRef.current) return
      if (takeRef.current === take) {
        takeRef.current = null
        dispatchRef.current({ type: 'failed' })
      }
      cbRef.current.onError(message)
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      fail(micErrorText(err))
      return
    }
    take.stream = stream
    // Let go, cancelled or unmounted while the permission prompt was up.
    if (takeRef.current !== take || !mountedRef.current) {
      releaseTake(take)
      return
    }

    const Recorder = (window as unknown as { MediaRecorder: typeof MediaRecorder }).MediaRecorder
    take.mime = pickRecorderMime((m) => Recorder.isTypeSupported(m))
    try {
      const recorder = take.mime ? new Recorder(stream, { mimeType: take.mime }) : new Recorder(stream)
      take.recorder = recorder
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) take.chunks.push(e.data)
      }
      recorder.onstop = () => { void finish(take) }
      recorder.start()
    } catch {
      take.recorder = null
      fail('Voice messages can’t be recorded in this browser.')
      return
    }
    take.startedAt = performance.now()

    // Live level: an analyser on the mic, sampled with the timer.
    let analyser: AnalyserNode | null = null
    let frame: Uint8Array<ArrayBuffer> | null = null
    const Ctor = audioContextCtor()
    if (Ctor) {
      try {
        const ctx = new Ctor()
        take.meter = ctx
        analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        ctx.createMediaStreamSource(stream).connect(analyser)
        frame = new Uint8Array(new ArrayBuffer(analyser.fftSize))
      } catch {
        analyser = null
      }
    }
    take.tick = setInterval(() => {
      if (takeRef.current !== take) return
      const ms = elapsedSince(take.startedAt, performance.now())
      if (analyser && frame) {
        analyser.getByteTimeDomainData(frame)
        const l = levelFromTimeDomain(frame)
        pushLevel(take.levels, l)
        setLevel(displayLevel(l))
      }
      setElapsed(ms)
      dispatchRef.current({ type: 'tick', elapsedMs: ms })
    }, TICK_MS)
  }, [finish])

  const dispatch = useCallback((event: RecorderEvent) => {
    const { state, effect } = recorderReducer(stateRef.current, event)
    stateRef.current = state
    setPhase(state.phase)
    if (effect === 'start') void startRecording()
    else if (effect === 'send') stopRecording('send')
    else if (effect === 'cancel') stopRecording('cancel')
  }, [startRecording, stopRecording])
  useEffect(() => { dispatchRef.current = dispatch }, [dispatch])

  const recording = phase !== 'idle'

  const reportedRef = useRef(false)
  useEffect(() => {
    if (reportedRef.current === recording) return
    reportedRef.current = recording
    cbRef.current.onRecordingChange?.(recording)
  }, [recording])

  // Escape throws the recording away, in either mode.
  useEffect(() => {
    if (!recording) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        dispatchRef.current({ type: 'escape' })
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [recording])

  // Turned off mid-recording (the chat closed, sending was blocked): discard.
  useEffect(() => {
    if (disabled && stateRef.current.phase !== 'idle') dispatchRef.current({ type: 'cancel' })
  }, [disabled])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const take = takeRef.current
      takeRef.current = null
      stateRef.current = IDLE
      if (!take) return
      take.outcome = 'cancel'
      stopMeter(take)
      const recorder = take.recorder
      if (recorder && recorder.state !== 'inactive') {
        try { recorder.stop() } catch { /* ignore */ }
      }
      releaseTake(take)
    }
  }, [])

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || processing || e.button !== 0) return
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not capturable */ }
    originRef.current = { x: e.clientX, y: e.clientY }
    dispatch({ type: 'press', at: performance.now() })
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (stateRef.current.phase !== 'pressing') return
    dispatch({ type: 'move', far: isFarFrom(originRef.current, { x: e.clientX, y: e.clientY }) })
  }
  const onPointerUp = () => {
    dispatch({ type: 'release', at: performance.now() })
  }
  const onPointerCancel = () => {
    if (stateRef.current.phase === 'pressing') dispatch({ type: 'cancel' })
  }
  // Keyboard: Enter or Space starts hands-free recording (a "tap").
  const onKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    if (disabled || processing || stateRef.current.phase !== 'idle') return
    const at = performance.now()
    dispatch({ type: 'press', at })
    dispatch({ type: 'release', at })
  }

  if (!supported) return null

  const timer = formatVoiceDuration(Math.floor(elapsed / 1000) * 1000)
  const meter = (
    <div className="flex min-w-0 flex-1 items-center gap-2" aria-live="off">
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-danger" aria-hidden />
      <span className="shrink-0 text-[13px] font-medium tabular-nums text-brand-text" role="timer" aria-label={`Recording ${timer}`}>
        {timer}
      </span>
      <div className="h-1.5 min-w-[40px] flex-1 overflow-hidden rounded-full bg-brand-text/10" aria-hidden>
        <div className="h-full rounded-full bg-primary-ink transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
      </div>
    </div>
  )

  if (phase === 'locked') {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <button
          type="button"
          onClick={() => dispatch({ type: 'cancel' })}
          aria-label="Discard voice message"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-danger transition-colors hover:bg-danger/10"
        >
          <Trash2 className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
        {meter}
        <button
          type="button"
          onClick={() => dispatch({ type: 'send' })}
          aria-label="Send voice message"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-send text-white transition-colors hover:bg-send-hover active:scale-90"
        >
          <Send className="-ml-px h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
      </div>
    )
  }

  return (
    <div className={`flex min-w-0 items-center gap-2 ${recording ? 'flex-1' : ''}`}>
      {recording && (
        <>
          {meter}
          <span className="hidden shrink-0 text-[11px] text-brand-text/50 sm:inline">Release to send · drag away to cancel</span>
        </>
      )}
      <button
        type="button"
        disabled={disabled || processing}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={recording ? 'Recording voice message' : 'Record voice message'}
        aria-pressed={recording}
        title="Hold to record, or tap to start"
        className={`flex h-9 w-9 shrink-0 touch-none select-none items-center justify-center rounded-full transition-colors disabled:opacity-40 ${recording
            ? 'scale-110 bg-danger text-white'
            : 'text-brand-text/50 hover:text-brand-text'
          }`}
      >
        <Mic className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </button>
    </div>
  )
}

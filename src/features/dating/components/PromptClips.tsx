"use client"

/*
  Voice and video prompt answers (mechanic M15).

    PromptClipPlayer   a card's clip. Nothing loads or plays until the person
                       presses play; a video starts muted and has its own
                       sound button. Never autoplays with sound.
    ClipStatusLine     the owner's clip: kind, length, review state, reason.
    PromptClipControls the owner's "Record voice" (30 s hard stop with a
                       countdown) and "Upload video" (over 30 s refused before
                       any upload), and what is happening meanwhile.

  The views without browser APIs (ClipPlayerView, RecordingBar,
  ClipControlsView) are what the tests render.
*/

import { useEffect, useRef, useState, type RefObject } from "react"
import { Loader2, Mic, Pause, Play, Square, Upload, Video, Volume2, VolumeX, X } from "lucide-react"

import { useClipSource, type ClipLoad } from "../hooks/promptClips"
import {
  audioUploadMime,
  CLIP_VIDEO_ACCEPT,
  CLIPS_OFF_COPY,
  clipBusy,
  clipDurationLabel,
  clipKindLabel,
  clipPhaseLine,
  clipStatusView,
  pickAudioMime,
  playLabel,
  RECORD_LIMIT_MS,
  recordingOver,
  recordSecondsLeft,
  videoDurationProblem,
  videoFileProblem,
  voiceProblem,
  type ClipKind,
  type ClipPhase,
  type OwnClip,
  type PromptClip,
} from "../model/promptClips"
import { Button, Notice, Pill } from "./kit"

/* ── playing a card's clip ───────────────────────────────────────── */

export function ClipPlayerView({
  clip,
  load,
  playing,
  muted,
  mediaRef,
  onToggle,
  onMute,
  onRetry,
  onPlaying,
}: {
  clip: PromptClip
  load: ClipLoad
  playing: boolean
  /** Video only; a voice answer plays only when pressed. */
  muted: boolean
  mediaRef?: RefObject<HTMLAudioElement & HTMLVideoElement | null>
  onToggle: () => void
  onMute: () => void
  onRetry: () => void
  onPlaying: (playing: boolean) => void
}) {
  const loading = load.state === "loading"
  const ready = load.state === "ready"
  const length = clipDurationLabel(clip.durationMs)
  const PlayIcon = loading ? Loader2 : playing ? Pause : Play
  const playButton = (
    <button type="button" className="pulse-clip__play" onClick={onToggle} disabled={loading} aria-busy={loading || undefined} aria-label={playLabel(clip.kind, clip.durationMs, playing)}>
      <PlayIcon size={18} className={loading ? "pulse-spin" : undefined} aria-hidden="true" />
    </button>
  )
  const events = {
    onPlay: () => onPlaying(true),
    onPause: () => onPlaying(false),
    onEnded: () => onPlaying(false),
  }
  const failed =
    load.state === "failed" ? (
      <p className="pulse-clip__error" role="alert">
        This clip couldn&apos;t play.{" "}
        <button type="button" className="pulse-clip__retry" onClick={onRetry}>
          Try again
        </button>
      </p>
    ) : null

  if (clip.kind === "audio") {
    return (
      <div className="pulse-clip pulse-clip--audio" data-state={load.state}>
        {playButton}
        <span className="pulse-clip__meta">
          <Mic size={14} aria-hidden="true" />
          {clipKindLabel("audio")}
        </span>
        {length ? <span className="pulse-clip__time">{length}</span> : null}
        {ready ? <audio ref={mediaRef} src={load.src} preload="auto" {...events} /> : null}
        {failed}
      </div>
    )
  }

  return (
    <div className="pulse-clip pulse-clip--video" data-state={load.state}>
      <div className="pulse-clip__frame">
        {ready ? (
          <video ref={mediaRef} src={load.src} muted={muted} playsInline preload="auto" className="pulse-clip__video" onClick={onToggle} {...events} />
        ) : (
          <span className="pulse-clip__start" aria-hidden="true">
            <Video size={28} />
          </span>
        )}
        <span className="pulse-clip__center">{playButton}</span>
        {ready ? (
          <button type="button" className="pulse-clip__mute" onClick={onMute} aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Turn sound off"}>
            {muted ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
          </button>
        ) : null}
        {length ? <span className="pulse-clip__badge">{length}</span> : null}
      </div>
      {failed}
    </div>
  )
}

/** A card's clip, from exactly the route the server named. */
export function PromptClipPlayer({ clip }: { clip: PromptClip }) {
  const [wanted, setWanted] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const media = useRef<HTMLAudioElement & HTMLVideoElement | null>(null)
  const playWhenReady = useRef(false)
  const load = useClipSource(clip.url, wanted, attempt)

  const start = (el: HTMLMediaElement) => {
    // A video always starts muted; only the sound button turns it up.
    if (clip.kind === "video") el.muted = muted
    void el.play().catch(() => setPlaying(false))
  }

  // The first press fetches; play follows as soon as the blob is in.
  useEffect(() => {
    if (load.state !== "ready" || !playWhenReady.current || !media.current) return
    playWhenReady.current = false
    start(media.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load.state])

  return (
    <ClipPlayerView
      clip={clip}
      load={load}
      playing={playing}
      muted={muted}
      mediaRef={media}
      onPlaying={setPlaying}
      onToggle={() => {
        const el = media.current
        if (load.state !== "ready" || !el) {
          playWhenReady.current = true
          setWanted(true)
          return
        }
        if (el.paused) start(el)
        else el.pause()
      }}
      onMute={() => {
        const next = !muted
        setMuted(next)
        if (media.current) media.current.muted = next
      }}
      onRetry={() => {
        playWhenReady.current = true
        setWanted(true)
        setAttempt((n) => n + 1)
      }}
    />
  )
}

/* ── the owner's clip ────────────────────────────────────────────── */

export function ClipStatusLine({ clip }: { clip: OwnClip }) {
  const view = clipStatusView(clip)
  const length = clipDurationLabel(clip.durationMs)
  const Icon = clip.kind === "audio" ? Mic : Video
  return (
    <div className="pulse-clip-status">
      <span className="pulse-clip-status__kind">
        <Icon size={14} aria-hidden="true" />
        {clipKindLabel(clip.kind)}
        {length ? <span className="pulse-clip__time">{length}</span> : null}
      </span>
      <Pill tone={view.tone}>{view.label}</Pill>
      {view.body ? <p className="pulse-clip-status__body">{view.body}</p> : null}
    </div>
  )
}

/** While recording: the countdown and the two ways out. */
export function RecordingBar({ secondsLeft, onStop, onCancel }: { secondsLeft: number; onStop: () => void; onCancel: () => void }) {
  return (
    <div className="pulse-recording">
      <span className="pulse-recording__dot" aria-hidden="true" />
      <span className="pulse-recording__text" role="timer" aria-live="polite">
        Recording · {secondsLeft}s left
      </span>
      <Button variant="quiet" icon={X} onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="primary" icon={Square} onClick={onStop}>
        Stop
      </Button>
    </div>
  )
}

export function ClipControlsView({
  promptChosen,
  phase,
  off,
  recordingSecondsLeft,
  canRecord,
  onRecord,
  onStop,
  onCancel,
  onUpload,
}: {
  promptChosen: boolean
  phase: ClipPhase
  off: boolean
  /** null while not recording. */
  recordingSecondsLeft: number | null
  /** false when this browser can't record audio; the button stays, explaining on press. */
  canRecord: boolean
  onRecord: () => void
  onStop: () => void
  onCancel: () => void
  onUpload: () => void
}) {
  if (off) return <Notice tone="muted">{CLIPS_OFF_COPY}</Notice>
  const busy = clipBusy(phase)
  const line = clipPhaseLine(phase)
  return (
    <div className="pulse-clip-controls">
      <p className="pulse-field__label">Or answer out loud</p>
      <p className="pulse-field__help">A voice note or a video of up to 30 seconds. It shows once it&apos;s been checked.</p>
      {recordingSecondsLeft !== null ? (
        <RecordingBar secondsLeft={recordingSecondsLeft} onStop={onStop} onCancel={onCancel} />
      ) : (
        <div className="pulse-row">
          <Button icon={Mic} disabled={!promptChosen || busy} onClick={onRecord} title={canRecord ? undefined : "This browser can't record audio"}>
            Record voice
          </Button>
          <Button icon={Upload} disabled={!promptChosen || busy} onClick={onUpload}>
            Upload video
          </Button>
        </div>
      )}
      {!promptChosen ? <p className="pulse-field__help">Choose a prompt first.</p> : null}
      {line ? (
        phase.kind === "failed" ? (
          <p className="pulse-field__error" role="alert">
            {line}
          </p>
        ) : (
          <p className="pulse-clip-controls__progress" role="status" aria-live="polite">
            <Loader2 size={14} className="pulse-spin" aria-hidden="true" />
            {line}
          </p>
        )
      ) : null}
    </div>
  )
}

/* ── recording and picking (browser APIs) ────────────────────────── */

function detectAudioMime(): string {
  if (typeof window === "undefined" || typeof navigator === "undefined") return ""
  const Recorder = (window as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder
  return pickAudioMime({
    hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === "function",
    hasMediaRecorder: typeof Recorder === "function",
    isTypeSupported: (mime) => Recorder?.isTypeSupported?.(mime) === true,
  })
}

/** The video element's own reading of a file's length, in seconds; NaN when it can't tell. */
function readVideoSeconds(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement("video")
    video.preload = "metadata"
    video.muted = true
    let settled = false
    const done = (seconds: number) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      video.removeAttribute("src")
      URL.revokeObjectURL(url)
      resolve(seconds)
    }
    const timer = setTimeout(() => done(Number.NaN), 10_000)
    video.onloadedmetadata = () => done(video.duration)
    video.onerror = () => done(Number.NaN)
    video.src = url
  })
}

/**
  The owner's clip controls for the chosen prompt. `onSend` uploads and
  attaches; `onProblem` shows a refusal found before any upload.
*/
export function PromptClipControls({
  promptId,
  phase,
  off,
  onSend,
  onProblem,
}: {
  promptId: number
  phase: ClipPhase
  off: boolean
  onSend: (promptId: number, clip: Blob, kind: ClipKind, mime: string) => void
  onProblem: (message: string) => void
}) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [canRecord, setCanRecord] = useState(true)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const cancelled = useRef(false)
  const timers = useRef<{ tick?: ReturnType<typeof setInterval>; stop?: ReturnType<typeof setTimeout> }>({})
  const target = useRef(promptId)

  useEffect(() => setCanRecord(detectAudioMime() !== ""), [])

  const stopRecording = () => {
    const r = recorder.current
    if (r && r.state !== "inactive") r.stop()
  }

  // Leaving the page or choosing another prompt throws a recording away.
  useEffect(() => {
    return () => {
      cancelled.current = true
      stopRecording()
    }
  }, [promptId])

  const record = async () => {
    const mime = detectAudioMime()
    if (!mime) return onProblem("This browser can't record audio. Upload a video instead.")
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    } catch {
      return onProblem("Allow the microphone to record a voice answer.")
    }
    let r: MediaRecorder
    try {
      r = new MediaRecorder(stream, { mimeType: mime })
    } catch {
      stream.getTracks().forEach((t) => t.stop())
      return onProblem("This browser can't record audio. Upload a video instead.")
    }
    const chunks: Blob[] = []
    let startedAt = 0
    cancelled.current = false
    target.current = promptId
    recorder.current = r
    r.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    r.onstop = () => {
      clearInterval(timers.current.tick)
      clearTimeout(timers.current.stop)
      stream.getTracks().forEach((t) => t.stop())
      recorder.current = null
      setSecondsLeft(null)
      if (cancelled.current) return
      const elapsed = Math.min(Date.now() - startedAt, RECORD_LIMIT_MS)
      const type = audioUploadMime(mime)
      const clip = new Blob(chunks, { type })
      const problem = voiceProblem(elapsed, clip.size)
      if (problem) return onProblem(problem)
      onSend(target.current, clip, "audio", type)
    }
    r.onerror = () => {
      cancelled.current = true
      stopRecording()
      onProblem("The recording didn't work. Try again.")
    }
    r.start(250)
    startedAt = Date.now()
    setSecondsLeft(recordSecondsLeft(0))
    timers.current.tick = setInterval(() => {
      const elapsed = Date.now() - startedAt
      setSecondsLeft(recordSecondsLeft(elapsed))
      if (recordingOver(elapsed)) stopRecording()
    }, 250)
    // The hard stop, whatever the ticker does.
    timers.current.stop = setTimeout(stopRecording, RECORD_LIMIT_MS)
  }

  const picked = async (file: File | undefined) => {
    if (!file) return
    const typeProblem = videoFileProblem(file)
    if (typeProblem) return onProblem(typeProblem)
    const lengthProblem = videoDurationProblem(await readVideoSeconds(file))
    if (lengthProblem) return onProblem(lengthProblem)
    onSend(promptId, file, "video", file.type)
  }

  return (
    <>
      <ClipControlsView
        promptChosen={promptId > 0}
        phase={phase}
        off={off}
        recordingSecondsLeft={secondsLeft}
        canRecord={canRecord}
        onRecord={() => void record()}
        onStop={stopRecording}
        onCancel={() => {
          cancelled.current = true
          stopRecording()
        }}
        onUpload={() => fileInput.current?.click()}
      />
      {off ? null : (
        <input
          ref={fileInput}
          type="file"
          accept={CLIP_VIDEO_ACCEPT}
          className="pulse-sr"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            void picked(file)
          }}
        />
      )}
    </>
  )
}

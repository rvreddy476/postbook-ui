"use client"

/*
  /dating/verify — the selfie check.

    status → (consent) → challenge → record ≤ max duration with the front
    camera → upload as a video → POST {challenge_id, video_media_id} →
    passed / in review / try again / limit reached.

  A browser that cannot record a clip the check accepts, or a refused camera,
  gets one clear notice: this step is done in the mobile app. There is no
  skip: discovery and messaging stay closed until the check has passed.
*/

import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import { BadgeCheck, Camera, Hourglass, ScanFace, ShieldAlert, Smartphone, Video } from "lucide-react"

import { uploadSelfieClip } from "../api/media"
import { createSelfieChallenge, submitSelfie } from "../api/verification"
import { ErrorState, Guard } from "../components/Guard"
import { Button, LinkButton, Loading, Notice, PageHead, StatePanel } from "../components/kit"
import { KEYS, useConsents, useSetConsent, useVerificationStatus } from "../hooks/profile"
import { isGranted } from "../model/consents"
import { datingErrorCopy } from "../model/errors"
import { DATING_BASE } from "../model/profile"
import {
  MEDIA_NOT_READY,
  MOBILE_ONLY_COPY,
  attemptsLine,
  instructionCopy,
  notReadyDelay,
  pickRecorderMime,
  recordMillis,
  uploadMime,
  viewFromRefusal,
  viewFromResult,
  viewFromStatus,
  type SelfieChallenge,
  type SelfieView,
} from "../model/verification"
import { toDatingError } from "../model/wire"
import { StepHeader } from "./OnboardingScreens"

type Phase =
  | { kind: "loading" }
  | { kind: "mobile_only"; reason: "unsupported" | "camera" }
  | { kind: "consent"; declined: boolean }
  | { kind: "ready"; challenge: SelfieChallenge; note: string }
  | { kind: "recording"; challenge: SelfieChallenge }
  | { kind: "uploading"; percent: number }
  | { kind: "checking" }
  | { kind: "still_processing"; challengeId: string; mediaId: string }
  | { kind: "view"; view: SelfieView }

function detectMime(): string {
  if (typeof window === "undefined" || typeof navigator === "undefined") return ""
  const Recorder = (window as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder
  return pickRecorderMime({
    hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === "function",
    hasMediaRecorder: typeof Recorder === "function",
    isTypeSupported: (mime) => Recorder?.isTypeSupported?.(mime) === true,
  })
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/* ── the views that need no camera; what the tests render ────────── */

export function MobileOnlyNotice({ reason }: { reason: "unsupported" | "camera" }) {
  return (
    <StatePanel
      icon={Smartphone}
      tone="info"
      title="Finish this step in the mobile app"
      body={reason === "camera" ? `We couldn't use your camera here. ${MOBILE_ONLY_COPY}` : `This browser can't record the short video the check needs. ${MOBILE_ONLY_COPY}`}
    />
  )
}

export function SelfieOutcome({ view, attemptsLeft, onRetry }: { view: SelfieView; attemptsLeft: number | null; onRetry: () => void }) {
  switch (view.kind) {
    case "passed":
      return (
        <StatePanel icon={BadgeCheck} tone="success" title="You're verified" body="Thanks. Your profile now shows the verified mark.">
          <LinkButton href={DATING_BASE} variant="primary">
            Continue
          </LinkButton>
        </StatePanel>
      )
    case "in_review":
      return <StatePanel icon={Hourglass} tone="info" title="Your selfie is in review" body="A moderator is taking a look. We'll open Pulse for you as soon as it's done. There's nothing more to do here." />
    case "limit_reached":
      return <StatePanel icon={ShieldAlert} tone="warning" title="That's all the attempts for today" body="You can try the selfie check again tomorrow." />
    case "blocked":
      return (
        <StatePanel icon={ShieldAlert} tone="warning" title="One thing first" body={view.copy}>
          <LinkButton href={`${DATING_BASE}/onboarding/photos`} variant="primary">
            Your photos
          </LinkButton>
        </StatePanel>
      )
    case "retry": {
      const left = attemptsLine(view.attemptsLeft ?? attemptsLeft)
      return (
        <StatePanel icon={ScanFace} tone="warning" title="That didn't pass" body={view.copy}>
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
          {left ? <p className="pulse-field__help">{left}</p> : null}
        </StatePanel>
      )
    }
    case "error":
      return (
        <StatePanel icon={ShieldAlert} tone="danger" title="Something went wrong" body={view.copy}>
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
        </StatePanel>
      )
    default:
      return <Loading />
  }
}

export function ConsentAsk({ declined, busy, onAnswer }: { declined: boolean; busy: boolean; onAnswer: (granted: boolean) => void }) {
  return (
    <StatePanel
      icon={ScanFace}
      title="Allow a face check?"
      body="To confirm it's really you, a short selfie video is compared with your main photo. The video is used only for this check, and you can withdraw consent in Settings at any time."
    >
      <Button variant="primary" busy={busy} onClick={() => onAnswer(true)}>
        Allow
      </Button>
      <Button variant="quiet" disabled={busy} onClick={() => onAnswer(false)}>
        Not now
      </Button>
      {declined ? <Notice tone="warning">The face check is required before you can see people or message on Pulse.</Notice> : null}
    </StatePanel>
  )
}

/* ── the flow ────────────────────────────────────────────────────── */

function SelfieFlow() {
  const qc = useQueryClient()
  const consents = useConsents()
  const status = useVerificationStatus()
  const grant = useSetConsent()
  const [phase, setPhase] = useState<Phase>({ kind: "loading" })
  const [mime] = useState(detectMime)
  const [cameraOn, setCameraOn] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const alive = useRef(true)
  const started = useRef(false)

  const stopCamera = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    setCameraOn(false)
  }, [])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      stream.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const settle = useCallback(
    (view: SelfieView) => {
      if (!alive.current) return
      if (view.kind === "needs_consent") return setPhase({ kind: "consent", declined: false })
      if (view.kind === "passed" || view.kind === "in_review") {
        void qc.invalidateQueries({ queryKey: KEYS.profile })
        void qc.invalidateQueries({ queryKey: KEYS.verification })
      }
      setPhase({ kind: "view", view })
    },
    [qc],
  )

  const requestChallenge = useCallback(
    async (note = "") => {
      setPhase({ kind: "loading" })
      try {
        const challenge = await createSelfieChallenge()
        if (alive.current) setPhase({ kind: "ready", challenge, note })
      } catch (error) {
        settle(viewFromRefusal(toDatingError(error)))
      }
    },
    [settle],
  )

  // Where the check stands is the server's to say; only then is a challenge asked for.
  useEffect(() => {
    if (started.current || !status.isSuccess || !consents.isSuccess) return
    started.current = true
    const settled = viewFromStatus(status.data)
    if (settled) return setPhase({ kind: "view", view: settled })
    if (!mime) return setPhase({ kind: "mobile_only", reason: "unsupported" })
    if (!isGranted(consents.data, "biometric_selfie")) return setPhase({ kind: "consent", declined: false })
    void requestChallenge()
  }, [status.isSuccess, status.data, consents.isSuccess, consents.data, mime, requestChallenge])

  const submit = useCallback(
    async (challengeId: string, mediaId: string) => {
      setPhase({ kind: "checking" })
      for (let retries = 0; ; retries++) {
        try {
          const result = await submitSelfie(challengeId, mediaId)
          settle(viewFromResult(result))
          return
        } catch (error) {
          const e = toDatingError(error)
          if (e.code !== MEDIA_NOT_READY) {
            const view = viewFromRefusal(e)
            if (view.kind === "new_challenge") return void requestChallenge("That attempt expired. Record again.")
            return settle(view)
          }
          // Refused before the attempt was spent: same clip, same challenge, after a wait.
          const delay = notReadyDelay(retries)
          if (delay === null) {
            if (alive.current) setPhase({ kind: "still_processing", challengeId, mediaId })
            return
          }
          await sleep(delay)
          if (!alive.current) return
        }
      }
    },
    [requestChallenge, settle],
  )

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
      if (!alive.current) return s.getTracks().forEach((t) => t.stop())
      stream.current = s
      setCameraOn(true)
      if (video.current) {
        video.current.srcObject = s
        void video.current.play().catch(() => undefined)
      }
    } catch {
      setPhase({ kind: "mobile_only", reason: "camera" })
    }
  }

  const record = (challenge: SelfieChallenge) => {
    const s = stream.current
    if (!s) return
    const ms = recordMillis(challenge.maxDurationMs)
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(s, { mimeType: mime, videoBitsPerSecond: 1_000_000 })
    } catch {
      stopCamera()
      return setPhase({ kind: "mobile_only", reason: "unsupported" })
    }
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    recorder.onerror = () => {
      stopCamera()
      if (alive.current) setPhase({ kind: "ready", challenge, note: "The recording didn't work. Try again." })
    }
    recorder.onstop = async () => {
      stopCamera()
      if (!alive.current) return
      const type = uploadMime(mime)
      const clip = new Blob(chunks, { type })
      if (clip.size === 0) return setPhase({ kind: "ready", challenge, note: "The recording didn't work. Try again." })
      setPhase({ kind: "uploading", percent: 0 })
      try {
        const mediaId = await uploadSelfieClip(clip, type, {
          onProgress: (f) => alive.current && setPhase({ kind: "uploading", percent: Math.round(f * 100) }),
          onProcessing: () => alive.current && setPhase({ kind: "checking" }),
        })
        if (alive.current) await submit(challenge.challengeId, mediaId)
      } catch (error) {
        // Nothing was submitted, so the challenge is still unused.
        const refused = error instanceof Error && error.message === "clip_refused"
        if (alive.current) setPhase({ kind: "ready", challenge, note: refused ? "That recording couldn't be used. Record again in good light." : "The video didn't upload. Check your connection and try again." })
      }
    }
    setPhase({ kind: "recording", challenge })
    setSecondsLeft(Math.ceil(ms / 1000))
    recorder.start()
    const tick = setInterval(() => setSecondsLeft((n) => Math.max(n - 1, 0)), 1000)
    setTimeout(() => {
      clearInterval(tick)
      if (recorder.state !== "inactive") recorder.stop()
    }, ms)
  }

  const onConsent = (granted: boolean) => {
    if (!granted) return setPhase({ kind: "consent", declined: true })
    grant.mutate(
      { type: "biometric_selfie", granted: true },
      {
        onSuccess: () => void requestChallenge(),
        onError: (e) => setPhase({ kind: "view", view: { kind: "error", copy: datingErrorCopy(e) } }),
      },
    )
  }

  if (status.isError) return <ErrorState error={status.error} onRetry={() => void status.refetch()} />
  if (consents.isError) return <ErrorState error={consents.error} onRetry={() => void consents.refetch()} />

  const attemptsLeft = status.data ? status.data.attemptsLeftToday : null

  switch (phase.kind) {
    case "loading":
      return <Loading />
    case "mobile_only":
      return <MobileOnlyNotice reason={phase.reason} />
    case "consent":
      return <ConsentAsk declined={phase.declined} busy={grant.isPending} onAnswer={onConsent} />
    case "uploading":
      return <Loading label={`Uploading ${phase.percent}%`} />
    case "checking":
      return <Loading label="Checking your video" />
    case "still_processing":
      return (
        <StatePanel icon={Hourglass} tone="info" title="Your video is still processing" body="This attempt hasn't been used. Send it again in a moment.">
          <Button variant="primary" onClick={() => void submit(phase.challengeId, phase.mediaId)}>
            Send again
          </Button>
        </StatePanel>
      )
    case "view":
      return <SelfieOutcome view={phase.view} attemptsLeft={attemptsLeft} onRetry={() => void requestChallenge()} />
    case "ready":
    case "recording": {
      const recording = phase.kind === "recording"
      const seconds = Math.round(recordMillis(phase.challenge.maxDurationMs) / 1000)
      const left = attemptsLine(attemptsLeft)
      return (
        <div className="pulse-selfie">
          <p className="pulse-selfie__instruction">{instructionCopy(phase.challenge.instruction)}</p>
          <p className="pulse-field__help">
            The clip is about {seconds} seconds. Hold the camera at eye level, in good light, with only your face in the frame.
          </p>
          <div className="pulse-selfie__stage" data-recording={recording || undefined}>
            <video ref={video} className="pulse-selfie__video" playsInline muted aria-label="Camera preview" />
            {!cameraOn ? (
              <span className="pulse-selfie__placeholder" aria-hidden="true">
                <Camera size={32} />
              </span>
            ) : null}
            {recording ? (
              <span className="pulse-selfie__timer" role="status" aria-live="polite">
                Recording · {secondsLeft}s
              </span>
            ) : null}
          </div>
          {phase.kind === "ready" && phase.note ? <Notice tone="warning">{phase.note}</Notice> : null}
          <div className="pulse-row">
            {!cameraOn ? (
              <Button variant="primary" icon={Camera} onClick={() => void startCamera()}>
                Turn on camera
              </Button>
            ) : (
              <Button variant="primary" icon={Video} disabled={recording} busy={recording} onClick={() => phase.kind === "ready" && record(phase.challenge)}>
                {recording ? "Recording" : "Record"}
              </Button>
            )}
          </div>
          {left ? <p className="pulse-field__help">{left}</p> : null}
        </div>
      )
    }
  }
}

export function SelfieScreen() {
  return (
    <Guard need="access">
      <div className="pulse-page pulse-page--narrow">
        <StepHeader step="selfie" title="Selfie check" sub="Required before you can see people or message. It confirms you're the person in your photos." />
        <SelfieFlow />
      </div>
    </Guard>
  )
}

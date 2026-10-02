import { describe, expect, test } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { mediaVerdict } from "../api/media"
import { DealbreakersOnlyPanel, FiltersPanel, KeptDealbreakers } from "../components/Filters"
import { ClipControlsView, ClipPlayerView, ClipStatusLine, PromptClipControls, PromptClipPlayer, RecordingBar } from "../components/PromptClips"
import type { ClipLoad } from "../hooks/promptClips"
import {
  dealbreakerSwitchState,
  dealbreakersToSend,
  dealbreakerTitle,
  freeDealbreakerRows,
  KEPT_DEALBREAKERS_TITLE,
  keptPassDealbreakers,
  withDealbreakers,
} from "../model/dealbreakers"
import { copyFor, datingErrorCopy, KNOWN_ERROR_CODES } from "../model/errors"
import { chatSourceMatch, needsMatchLookup, toChatSource } from "../model/matches"
import { toProfileOptions } from "../model/options"
import { toPerson } from "../model/people"
import { filtersForm, toPreferences } from "../model/profile"
import {
  attachWhenReady,
  audioUploadMime,
  CLIP_IDLE,
  CLIP_MAX_MS,
  CLIP_NOT_READY_WAITS_MS,
  CLIP_REJECTED_FALLBACK,
  CLIP_UPLOAD_REFUSED_COPY,
  CLIP_VIDEO_ACCEPT,
  CLIPS_OFF_COPY,
  clipBusy,
  clipDurationLabel,
  clipFailureCopy,
  clipPath,
  clipPhaseLine,
  clipRefusal,
  clipStatusView,
  pickAudioMime,
  playLabel,
  RECORD_LIMIT_MS,
  recordingOver,
  recordSecondsLeft,
  toClipResult,
  toOwnClip,
  toPromptClip,
  videoDurationProblem,
  videoFileProblem,
  voiceProblem,
  type PromptClip,
} from "../model/promptClips"
import { toPromptAnswer, toPromptAnswers } from "../model/prompts"
import { errorFromEnvelope } from "../model/wire"
import { PromptEditor } from "../screens/OnboardingScreens"
import { PersonDetails } from "../screens/PersonScreen"

import { readFixture } from "./contractFixtures"

const html = (node: React.ReactElement) => renderToStaticMarkup(node)
const noop = () => {}
const axiosError = (status: number, code: string, details?: Record<string, unknown>) => ({ response: { status, data: { error: { code, message: "developer words", details } } } })
const CLIP_URL = "/v1/dating/people/u-1/prompts/4/clip"
const VOICE: PromptClip = { kind: "audio", durationMs: 8000, url: CLIP_URL }
const VIDEO: PromptClip = { kind: "video", durationMs: 10000, url: CLIP_URL }
const IDLE: ClipLoad = { state: "idle", src: "" }
const LOADING: ClipLoad = { state: "loading", src: "" }
const READY: ClipLoad = { state: "ready", src: "blob:clip" }
const FAILED: ClipLoad = { state: "failed", src: "" }

/* ── the wire ────────────────────────────────────────────────────── */

describe("prompt clips: reading the wire", () => {
  test("only a prompt-clip route is loadable; anything else is dropped", () => {
    expect(clipPath(CLIP_URL)).toBe(CLIP_URL)
    expect(clipPath("/v1/dating/people/<owner>/prompts/4/clip")).toBe("/v1/dating/people/<owner>/prompts/4/clip")
    for (const bad of ["", null, 4, "https://cdn.example/clip.mp4", "/v1/dating/people/u-1/prompts/x/clip", "/v1/dating/people/u-1/prompts/4/clip?x=1", "/v1/media/abc/serve", "/v1/dating/photos/p/full"]) {
      expect(clipPath(bad)).toBe("")
    }
  })

  test("a card's clip: audio or video with a route; anything else is no clip", () => {
    expect(toPromptClip({ kind: "audio", duration_ms: 8000, url: CLIP_URL })).toEqual(VOICE)
    // Go omitted the length: 0, and no length is drawn.
    expect(toPromptClip({ kind: "video", url: CLIP_URL })).toEqual({ kind: "video", durationMs: 0, url: CLIP_URL })
    expect(toPromptClip({ kind: "image", duration_ms: 1, url: CLIP_URL })).toBeNull()
    expect(toPromptClip({ kind: "video", duration_ms: 1, url: "https://elsewhere/clip" })).toBeNull()
    expect(toPromptClip(null)).toBeNull()
    expect(toPromptClip(undefined)).toBeNull()
  })

  test("a card keeps a clip-only answer and drops an answer with neither text nor clip", () => {
    const p = toPerson({
      user_id: "u-1",
      detail: {
        prompts: [
          { prompt_id: 1, question: "Q1", answer: "Words" },
          { prompt_id: 2, question: "Q2", answer: "", clip: { kind: "audio", duration_ms: 8000, url: CLIP_URL } },
          { prompt_id: 3, question: "Q3", answer: "" },
          { prompt_id: 4, question: "Q4", answer: "", clip: { kind: "video", url: "https://elsewhere" } },
        ],
      },
    })!
    expect(p.prompts.map((x) => [x.promptId, x.answer, x.clip?.kind ?? null])).toEqual([
      [1, "Words", null],
      [2, "", "audio"],
    ])
  })

  test("the owner's GET /prompts: clip_* fields, or no clip", () => {
    const [plain, clipped, rejected, odd] = toPromptAnswers([
      { prompt_id: 1, answer: "Hi" },
      { prompt_id: 2, answer: "", clip_kind: "audio", clip_duration_ms: 8000, clip_status: "pending" },
      { prompt_id: 3, answer: "Yes", clip_kind: "video", clip_duration_ms: 12000, clip_status: "rejected", clip_reason: "Faces must be visible." },
      { prompt_id: 4, answer: "Hm", clip_kind: "video", clip_status: "something_new" },
    ])
    expect(plain.clip).toBeNull()
    expect(clipped).toEqual({ promptId: 2, answer: "", clip: { kind: "audio", durationMs: 8000, status: "pending", reason: "" } })
    expect(rejected.clip).toEqual({ kind: "video", durationMs: 12000, status: "rejected", reason: "Faces must be visible." })
    // A status this client doesn't know reads as still being checked, never as live.
    expect(odd.clip?.status).toBe("pending")
    expect(toOwnClip({ clip_status: "approved" })).toBeNull()
    expect(toPromptAnswer({ prompt_id: 5, answer: "x", clip_kind: "", clip_status: "" })?.clip).toBeNull()
  })

  test("the PUT result, with or without a reason", () => {
    expect(toClipResult({ prompt_id: 3, kind: "video", duration_ms: 12000, status: "rejected", reason: "Not this one." })).toEqual({
      promptId: 3,
      clip: { kind: "video", durationMs: 12000, status: "rejected", reason: "Not this one." },
    })
    expect(toClipResult({ kind: "video" })).toBeNull()
    expect(toClipResult({ prompt_id: 3, kind: "gif" })).toBeNull()
  })

  test("media-service's status: a clip is ready once processed, refused when it failed", () => {
    expect(mediaVerdict({ processing_status: "ready" }, "audio")).toBe("ready")
    expect(mediaVerdict({ processing_status: "processing" }, "audio")).toBe("waiting")
    expect(mediaVerdict({ processing_status: "failed" }, "audio")).toBe("refused")
    expect(mediaVerdict({ processing_status: "ready", moderation_status: "rejected" }, "video")).toBe("refused")
  })
})

/* ── status and words ────────────────────────────────────────────── */

describe("prompt clips: the owner's status", () => {
  test("approved, pending, pending_review, rejected", () => {
    expect(clipStatusView({ status: "approved", reason: "" })).toEqual({ tone: "success", label: "Live on your profile", body: "" })
    expect(clipStatusView({ status: "pending", reason: "" }).label).toBe("Being checked")
    expect(clipStatusView({ status: "pending_review", reason: "" })).toEqual(clipStatusView({ status: "pending", reason: "" }))
    expect(clipStatusView({ status: "rejected", reason: "Faces must be visible." })).toEqual({ tone: "danger", label: "Not shown", body: "Faces must be visible." })
    expect(clipStatusView({ status: "rejected", reason: "" }).body).toBe(CLIP_REJECTED_FALLBACK)
  })

  test("the status line draws each state", () => {
    const live = html(<ClipStatusLine clip={{ kind: "video", durationMs: 12000, status: "approved", reason: "" }} />)
    expect(live).toContain("Video answer")
    expect(live).toContain("0:12")
    expect(live).toContain("pulse-tone--success")
    expect(live).toContain("Live on your profile")
    const checking = html(<ClipStatusLine clip={{ kind: "audio", durationMs: 8000, status: "pending_review", reason: "" }} />)
    expect(checking).toContain("Voice answer")
    expect(checking).toContain("Being checked")
    expect(checking).toContain("Only you can see it")
    const refused = html(<ClipStatusLine clip={{ kind: "audio", durationMs: 0, status: "rejected", reason: "Too quiet to hear." }} />)
    expect(refused).toContain("Not shown")
    expect(refused).toContain("Too quiet to hear.")
    expect(refused).toContain("pulse-tone--danger")
  })

  test("lengths and the player's name", () => {
    expect(clipDurationLabel(12000)).toBe("0:12")
    expect(clipDurationLabel(8000)).toBe("0:08")
    expect(clipDurationLabel(400)).toBe("0:01")
    expect(clipDurationLabel(90_000)).toBe("1:30")
    expect(clipDurationLabel(0)).toBe("")
    expect(clipDurationLabel(Number.NaN)).toBe("")
    expect(playLabel("audio", 8000, false)).toBe("Play voice answer, 0:08")
    expect(playLabel("video", 10000, true)).toBe("Pause video answer, 0:10")
    expect(playLabel("video", 0, false)).toBe("Play video answer")
  })
})

/* ── the player ──────────────────────────────────────────────────── */

describe("prompt clips: the player", () => {
  const view = (clip: PromptClip, load: ClipLoad, over: Partial<React.ComponentProps<typeof ClipPlayerView>> = {}) =>
    html(<ClipPlayerView clip={clip} load={load} playing={false} muted onToggle={noop} onMute={noop} onRetry={noop} onPlaying={noop} {...over} />)

  test("voice, before a press: a play button and the length, no media element, nothing fetched", () => {
    const out = view(VOICE, IDLE)
    expect(out).toContain('aria-label="Play voice answer, 0:08"')
    expect(out).toContain("Voice answer")
    expect(out).toContain("0:08")
    expect(out).not.toContain("<audio")
    expect(out).not.toMatch(/autoplay/i)
  })

  test("voice, loading after the press: busy, the button waits", () => {
    const out = view(VOICE, LOADING)
    expect(out).toContain('aria-busy="true"')
    expect(out).toMatch(/<button[^>]*class="pulse-clip__play"[^>]*disabled=""/)
    expect(out).not.toContain("<audio")
  })

  test("voice, ready: the blob in an audio element that never starts by itself", () => {
    const out = view(VOICE, READY)
    expect(out).toContain('<audio src="blob:clip" preload="auto"')
    expect(out).not.toMatch(/autoplay/i)
    expect(view(VOICE, READY, { playing: true })).toContain('aria-label="Pause voice answer, 0:08"')
  })

  test("a failed read says so, with a retry", () => {
    const out = view(VOICE, FAILED)
    expect(out).toContain('role="alert"')
    expect(out).toContain(">Try again<")
    expect(view(VIDEO, FAILED)).toContain(">Try again<")
  })

  test("video, before a press: a poster-less frame with a play button; no video element", () => {
    const out = view(VIDEO, IDLE)
    expect(out).toContain('aria-label="Play video answer, 0:10"')
    expect(out).toContain("pulse-clip__start")
    expect(out).not.toContain("<video")
    expect(out).not.toContain("poster")
    expect(out).not.toContain("Turn sound")
  })

  test("video, ready: muted, inline, no poster, no autoplay; a sound button", () => {
    const out = view(VIDEO, READY)
    expect(out).toMatch(/<video src="blob:clip" muted=""/)
    expect(out).toContain("playsInline")
    expect(out).not.toContain("poster")
    expect(out).not.toMatch(/autoplay/i)
    expect(out).toContain('aria-label="Turn sound on"')
    expect(out).toContain('aria-pressed="false"')
    const loud = view(VIDEO, READY, { muted: false })
    expect(loud).not.toContain('muted=""')
    expect(loud).toContain('aria-label="Turn sound off"')
    expect(loud).toContain('aria-pressed="true"')
  })

  test("the live player starts idle: no request, no media, whatever the kind", () => {
    for (const clip of [VOICE, VIDEO]) {
      const out = html(<PromptClipPlayer clip={clip} />)
      expect(out).toContain('data-state="idle"')
      expect(out).not.toMatch(/<audio|<video/)
    }
  })

  test("a card's prompt with a clip plays it; a clip-only answer has no empty text", () => {
    const p = toPerson({
      user_id: "u-1",
      first_name: "Asha",
      detail: {
        prompts: [
          { prompt_id: 4, question: "A skill I'm working on...", answer: "", clip: { kind: "video", duration_ms: 10000, url: CLIP_URL } },
          { prompt_id: 5, question: "My ideal Sunday is...", answer: "Long walks", clip: { kind: "audio", duration_ms: 8000, url: "/v1/dating/people/u-1/prompts/5/clip" } },
        ],
      },
    })!
    const out = html(<PersonDetails person={p} />)
    expect(out).toContain("A skill I&#x27;m working on...")
    expect(out).toContain('aria-label="Play video answer, 0:10"')
    expect(out).toContain("Long walks")
    expect(out).toContain('aria-label="Play voice answer, 0:08"')
    expect(out).not.toContain("<dd></dd>")
  })
})

/* ── recording and picking ───────────────────────────────────────── */

describe("prompt clips: the 30 second guards", () => {
  test("the recorder's mime: WebM first, MP4 next, none when the browser can't", () => {
    const env = (supported: string[]) => ({ hasGetUserMedia: true, hasMediaRecorder: true, isTypeSupported: (m: string) => supported.includes(m) })
    expect(pickAudioMime(env(["audio/webm;codecs=opus", "audio/mp4"]))).toBe("audio/webm;codecs=opus")
    expect(pickAudioMime(env(["audio/mp4"]))).toBe("audio/mp4")
    expect(pickAudioMime(env(["audio/ogg"]))).toBe("")
    expect(pickAudioMime({ ...env(["audio/webm"]), hasMediaRecorder: false })).toBe("")
    expect(pickAudioMime({ ...env(["audio/webm"]), hasGetUserMedia: false })).toBe("")
    expect(
      pickAudioMime({
        hasGetUserMedia: true,
        hasMediaRecorder: true,
        isTypeSupported: (m) => {
          if (m.includes("codecs")) throw new Error("unknown")
          return m === "audio/webm"
        },
      }),
    ).toBe("audio/webm")
    expect(audioUploadMime("audio/webm;codecs=opus")).toBe("audio/webm")
    expect(audioUploadMime("audio/mp4")).toBe("audio/mp4")
  })

  test("the countdown runs from 30 to 0 and the recording stops itself before the cap", () => {
    expect(RECORD_LIMIT_MS).toBeLessThanOrEqual(CLIP_MAX_MS)
    expect(recordSecondsLeft(0)).toBe(30)
    expect(recordSecondsLeft(600)).toBe(29)
    expect(recordSecondsLeft(RECORD_LIMIT_MS - 1)).toBe(1)
    expect(recordSecondsLeft(RECORD_LIMIT_MS)).toBe(0)
    expect(recordSecondsLeft(45_000)).toBe(0)
    expect(recordSecondsLeft(-5)).toBe(30)
    expect(recordingOver(RECORD_LIMIT_MS - 1)).toBe(false)
    expect(recordingOver(RECORD_LIMIT_MS)).toBe(true)
    expect(recordingOver(31_000)).toBe(true)
  })

  test("a recording too short or empty doesn't go", () => {
    expect(voiceProblem(400, 1200)).toBe("Record for at least a second.")
    expect(voiceProblem(5000, 0)).toBe("The recording didn't work. Try again.")
    expect(voiceProblem(5000, 1200)).toBe("")
  })

  test("the recording bar: the seconds left, Stop and Cancel", () => {
    const out = html(<RecordingBar secondsLeft={27} onStop={noop} onCancel={noop} />)
    expect(out).toContain('role="timer"')
    expect(out).toContain("27s left")
    expect(out).toContain(">Stop<")
    expect(out).toContain(">Cancel<")
  })

  test("a video file: MP4, MOV or WebM, not empty", () => {
    expect(CLIP_VIDEO_ACCEPT).toBe("video/mp4,video/quicktime,video/webm")
    expect(videoFileProblem({ type: "video/mp4", size: 10 })).toBe("")
    expect(videoFileProblem({ type: "video/quicktime", size: 10 })).toBe("")
    expect(videoFileProblem({ type: "video/webm", size: 10 })).toBe("")
    expect(videoFileProblem({ type: "video/x-matroska", size: 10 })).toBe("Choose an MP4, MOV or WebM video.")
    expect(videoFileProblem({ type: "image/png", size: 10 })).toBe("Choose an MP4, MOV or WebM video.")
    expect(videoFileProblem({ type: "video/mp4", size: 0 })).toBe("That file is empty. Choose another.")
  })

  test("a video over 30 seconds is refused before upload; an unreadable length goes to the server", () => {
    expect(videoDurationProblem(12)).toBe("")
    expect(videoDurationProblem(30)).toBe("")
    expect(videoDurationProblem(30.4)).toBe("A video answer can be at most 30 seconds. This one is 31.")
    expect(videoDurationProblem(95)).toBe("A video answer can be at most 30 seconds. This one is 95.")
    expect(videoDurationProblem(Number.NaN)).toBe("")
    expect(videoDurationProblem(Number.POSITIVE_INFINITY)).toBe("")
    expect(videoDurationProblem(0)).toBe("")
    expect(videoDurationProblem(16, 15_000)).toBe("A video answer can be at most 15 seconds. This one is 16.")
  })
})

/* ── refusals and the retry ──────────────────────────────────────── */

describe("prompt clips: every refusal", () => {
  test("each code, its kind and its own words", () => {
    const cases: [number, string, string, Record<string, unknown>?][] = [
      [409, "CLIP_NOT_READY", "not_ready"],
      [422, "CLIP_TOO_LONG", "too_long", { max_ms: 30000 }],
      [422, "CLIP_UNSUPPORTED", "unsupported"],
      [404, "CLIP_MEDIA_NOT_FOUND", "not_found"],
      [503, "CLIP_MEDIA_UNAVAILABLE", "unavailable"],
      [404, "MECHANIC_NOT_ENABLED", "off"],
      [500, "CLIP_FAILED", "other"],
    ]
    for (const [status, code, kind, details] of cases) {
      const e = axiosError(status, code, details)
      expect(clipRefusal(e)).toBe(kind)
      expect(datingErrorCopy(e)).not.toBe("developer words")
    }
    for (const code of ["CLIP_MEDIA_NOT_FOUND", "CLIP_MEDIA_UNAVAILABLE", "CLIP_NOT_READY", "CLIP_TOO_LONG", "CLIP_UNSUPPORTED"]) expect(KNOWN_ERROR_CODES).toContain(code)
    expect(clipRefusal(new Error("network"))).toBe("other")
  })

  test("CLIP_TOO_LONG says the server's figure", () => {
    expect(clipFailureCopy(axiosError(422, "CLIP_TOO_LONG", { max_ms: 30000 }))).toBe("A clip can be at most 30 seconds. Try a shorter one.")
    expect(clipFailureCopy(axiosError(422, "CLIP_TOO_LONG", { max_ms: 20000 }))).toBe("A clip can be at most 20 seconds. Try a shorter one.")
    expect(clipFailureCopy(axiosError(422, "CLIP_TOO_LONG"))).toBe("That clip is too long. Try a shorter one.")
    expect(copyFor(errorFromEnvelope(readFixture("prompt_clip_put_422_too_long")))).toContain("at most 30 seconds")
  })

  test("the other words", () => {
    expect(clipFailureCopy(axiosError(409, "CLIP_NOT_READY"))).toBe("Your clip is still processing. Try again shortly.")
    expect(clipFailureCopy(axiosError(422, "CLIP_UNSUPPORTED"))).toBe("That file can't be used. Record your voice or choose a video.")
    expect(clipFailureCopy(axiosError(404, "CLIP_MEDIA_NOT_FOUND"))).toBe("That clip couldn't be found. Record or upload it again.")
    expect(clipFailureCopy(axiosError(503, "CLIP_MEDIA_UNAVAILABLE"))).toBe("Voice and video answers are unavailable right now. Try again later.")
    expect(clipFailureCopy(new Error("clip_refused"))).toBe(CLIP_UPLOAD_REFUSED_COPY)
    expect(clipFailureCopy(new Error("upload_failed"))).toBe("Check your connection and try again.")
  })

  test("CLIP_NOT_READY is re-sent after each wait, then gives up with its own words", async () => {
    const slept: number[] = []
    const sleep = async (ms: number) => void slept.push(ms)
    let calls = 0
    const result = await attachWhenReady(async () => {
      calls++
      if (calls < 3) throw axiosError(409, "CLIP_NOT_READY")
      return "attached"
    }, sleep)
    expect(result).toBe("attached")
    expect(calls).toBe(3)
    expect(slept).toEqual(CLIP_NOT_READY_WAITS_MS.slice(0, 2))

    slept.length = 0
    calls = 0
    const never = attachWhenReady(async () => {
      calls++
      throw axiosError(409, "CLIP_NOT_READY")
    }, sleep)
    const error = await never.catch((e: unknown) => e)
    expect(calls).toBe(CLIP_NOT_READY_WAITS_MS.length + 1)
    expect(slept).toEqual([...CLIP_NOT_READY_WAITS_MS])
    expect(clipFailureCopy(error)).toBe("Your clip is still processing. Try again shortly.")
  })

  test("any other refusal is not retried", async () => {
    for (const code of ["CLIP_TOO_LONG", "CLIP_UNSUPPORTED", "CLIP_MEDIA_NOT_FOUND", "CLIP_MEDIA_UNAVAILABLE", "MECHANIC_NOT_ENABLED"]) {
      let calls = 0
      const slept: number[] = []
      const error = await attachWhenReady(
        async () => {
          calls++
          throw axiosError(422, code)
        },
        async (ms) => void slept.push(ms),
      ).catch((e: unknown) => e)
      expect(calls).toBe(1)
      expect(slept).toEqual([])
      expect(clipRefusal(error)).not.toBe("not_ready")
    }
  })

  test("the progress line", () => {
    expect(clipPhaseLine(CLIP_IDLE)).toBe("")
    expect(clipPhaseLine({ kind: "uploading", percent: 41.6 })).toBe("Uploading… 42%")
    expect(clipPhaseLine({ kind: "uploading", percent: 140 })).toBe("Uploading… 100%")
    expect(clipPhaseLine({ kind: "processing" })).toBe("Processing your clip…")
    expect(clipPhaseLine({ kind: "attaching" })).toBe("Adding it to your answer…")
    expect(clipPhaseLine({ kind: "failed", message: "Nope." })).toBe("Nope.")
    expect([CLIP_IDLE, { kind: "uploading", percent: 0 }, { kind: "processing" }, { kind: "attaching" }, { kind: "failed", message: "x" }].map((p) => clipBusy(p as never))).toEqual([false, true, true, true, false])
  })
})

/* ── the owner's controls ────────────────────────────────────────── */

describe("prompt clips: the editor", () => {
  const controls = (over: Partial<React.ComponentProps<typeof ClipControlsView>> = {}) =>
    html(<ClipControlsView promptChosen phase={CLIP_IDLE} off={false} recordingSecondsLeft={null} canRecord onRecord={noop} onStop={noop} onCancel={noop} onUpload={noop} {...over} />)
  const button = (out: string, label: string) => out.match(new RegExp(`<button[^>]*>(?:(?!</button>).)*>${label}<`))?.[0] ?? ""

  test("ready: Record voice, then Upload video, both working", () => {
    const out = controls()
    expect(out.indexOf(">Record voice<")).toBeLessThan(out.indexOf(">Upload video<"))
    expect(button(out, "Record voice")).not.toContain("disabled")
    expect(button(out, "Upload video")).not.toContain("disabled")
    expect(out).toContain("up to 30 seconds")
  })

  test("no prompt chosen: both off, and it says why", () => {
    const out = controls({ promptChosen: false })
    expect(button(out, "Record voice")).toContain('disabled=""')
    expect(button(out, "Upload video")).toContain('disabled=""')
    expect(out).toContain("Choose a prompt first.")
  })

  test("while uploading, processing or attaching: both off, the progress showing", () => {
    for (const phase of [{ kind: "uploading", percent: 50 }, { kind: "processing" }, { kind: "attaching" }] as const) {
      const out = controls({ phase })
      expect(button(out, "Record voice")).toContain('disabled=""')
      expect(out).toContain('role="status"')
      expect(out).toContain(clipPhaseLine(phase))
    }
  })

  test("a failure is an alert and the buttons work again", () => {
    const out = controls({ phase: { kind: "failed", message: "A clip can be at most 30 seconds. Try a shorter one." } })
    expect(out).toMatch(/role="alert">A clip can be at most 30 seconds/)
    expect(button(out, "Record voice")).not.toContain("disabled")
  })

  test("recording: the countdown in place of the buttons", () => {
    const out = controls({ recordingSecondsLeft: 30 })
    expect(out).toContain("30s left")
    expect(out).not.toContain(">Record voice<")
  })

  test("the mechanic off (404 MECHANIC_NOT_ENABLED): no controls at all", () => {
    const out = controls({ off: true })
    expect(out).toContain(CLIPS_OFF_COPY.replaceAll("'", "&#x27;"))
    expect(out).not.toContain(">Record voice<")
    expect(out).not.toContain(">Upload video<")
  })

  test("the live controls render with a hidden video picker for the three types", () => {
    const out = html(<PromptClipControls promptId={4} phase={CLIP_IDLE} off={false} onSend={noop} onProblem={noop} />)
    expect(out).toContain('accept="video/mp4,video/quicktime,video/webm"')
    expect(out).toContain(">Record voice<")
  })

  const catalog = [
    { id: 1, question: "My ideal Sunday is..." },
    { id: 4, question: "A skill I'm working on..." },
  ]
  const answers = toPromptAnswers([
    { prompt_id: 1, answer: "Long walks", clip_kind: "audio", clip_duration_ms: 8000, clip_status: "approved" },
    { prompt_id: 4, answer: "", clip_kind: "video", clip_duration_ms: 12000, clip_status: "rejected", clip_reason: "Faces must be visible." },
  ])
  const clips = { phase: CLIP_IDLE, off: false, removing: false, onSend: noop, onProblem: noop, onRemove: noop }

  test("the answers list shows each clip's state; Remove clip only beside text", () => {
    const out = html(<PromptEditor catalog={catalog} answers={answers} busy={false} onSave={noop} onDelete={noop} clips={clips} />)
    expect(out).toContain("Live on your profile")
    expect(out).toContain("Not shown")
    expect(out).toContain("Faces must be visible.")
    expect(out).not.toContain("<dd></dd>")
    // One answer has text and a clip; the clip-only one goes whole with Remove.
    expect(out.match(/>Remove clip</g)?.length).toBe(1)
    expect(out.match(/>Remove</g)?.length).toBe(2)
    expect(out).toContain(">Record voice<")
    expect(out).toContain(">Upload video<")
  })

  test("off: the states stay, the clip actions go", () => {
    const out = html(<PromptEditor catalog={catalog} answers={answers} busy={false} onSave={noop} onDelete={noop} clips={{ ...clips, off: true }} />)
    expect(out).toContain("Live on your profile")
    expect(out).not.toContain(">Remove clip<")
    expect(out).not.toContain(">Record voice<")
    expect(out).toContain(CLIPS_OFF_COPY.replaceAll("'", "&#x27;"))
  })

  test("without clips the editor is as it was", () => {
    const out = html(<PromptEditor catalog={catalog} answers={answers} busy={false} onSave={noop} onDelete={noop} />)
    expect(out).not.toContain(">Record voice<")
    expect(out).not.toContain(">Remove clip<")
  })
})

/* ── M13: telling a Pulse chat from the conversation ─────────────── */

describe("Pulse chat detection from chat-service's conversation", () => {
  test("source_app and match_id, from the envelope or the bare conversation", () => {
    expect(toChatSource({ data: { id: "c1", source_app: "dating", match_id: "m1" } }, "c1")).toEqual({ conversationId: "c1", sourceApp: "dating", matchId: "m1" })
    expect(toChatSource({ id: "c2", source_app: "dating", match_id: "m2" }, "")).toEqual({ conversationId: "c2", sourceApp: "dating", matchId: "m2" })
    // Every other conversation omits both.
    expect(toChatSource({ data: { id: "c3", type: "direct" } }, "c3")).toEqual({ conversationId: "c3", sourceApp: "", matchId: "" })
    expect(toChatSource(null, "c4")).toEqual({ conversationId: "c4", sourceApp: "", matchId: "" })
  })

  test("the server's word decides, from any entry point", () => {
    expect(chatSourceMatch({ conversationId: "c1", sourceApp: "dating", matchId: "m1" })).toBe("m1")
    expect(chatSourceMatch({ conversationId: "c1", sourceApp: "", matchId: "m1" })).toBe("")
    expect(chatSourceMatch({ conversationId: "c1", sourceApp: "shop", matchId: "m1" })).toBe("")
    expect(chatSourceMatch(null)).toBe("")
    expect(chatSourceMatch(undefined)).toBe("")
  })

  test("the match list is only the fallback", () => {
    const dating = { conversationId: "c1", sourceApp: "dating", matchId: "m1" }
    const plain = { conversationId: "c1", sourceApp: "", matchId: "" }
    // Said by the server: no lookup, whichever way the chat was opened.
    expect(needsMatchLookup("c1", dating)).toBe(false)
    expect(needsMatchLookup(undefined, dating)).toBe(false)
    // Not loaded yet: wait.
    expect(needsMatchLookup("c1", null)).toBe(false)
    // Opened by id and the fields are missing (an older chat-service): the list decides.
    expect(needsMatchLookup("c1", plain)).toBe(true)
    expect(needsMatchLookup("c1", { ...dating, matchId: "" })).toBe(true)
    // The generic inbox (no id) never asks; another app's chat never asks.
    expect(needsMatchLookup(undefined, plain)).toBe(false)
    expect(needsMatchLookup("c1", { conversationId: "c1", sourceApp: "shop", matchId: "" })).toBe(false)
  })
})

/* ── M12: switching a kept pass dealbreaker off without a pass ───── */

describe("dealbreakers: a kept pass one can be switched off without a pass", () => {
  const options = toProfileOptions(readFixture("profile_options_get_200").data)
  const prefs = toPreferences({ ...(readFixture("preferences_get_200_filters").data as object), dealbreakers: ["age", "diet"] })
  const form = filtersForm(prefs, options)
  const switchFor = (out: string, code: string) => out.match(new RegExp(`<input id="pulse-dealbreaker-${code}"[^>]*>`))?.[0] ?? ""
  const panel = (over: Partial<React.ComponentProps<typeof FiltersPanel>>) =>
    html(<FiltersPanel options={options} form={form} locked={false} savedPass={false} busy={false} clearing={false} error="" fieldError={null} onChange={noop} onSave={noop} onClear={noop} dealbreakers {...over} />)

  test("the switch states", () => {
    expect(dealbreakerSwitchState("age", true, [])).toBe("open")
    expect(dealbreakerSwitchState("diet", false, [])).toBe("open")
    expect(dealbreakerSwitchState("diet", true, ["diet"])).toBe("kept")
    expect(dealbreakerSwitchState("height", true, ["diet"])).toBe("locked")
    expect(keptPassDealbreakers(["age", "diet", "verified"], () => true)).toEqual(["verified", "diet"])
    expect(keptPassDealbreakers(["diet"], (c) => c !== "diet")).toEqual([])
    expect(dealbreakerTitle("verified")).toBe("Verified people only")
    expect(dealbreakerTitle("diet")).toBe("Diet")
  })

  test("locked: the saved diet dealbreaker works, outside the locked section; a new one stays off", () => {
    const out = panel({ locked: true, savedDealbreakers: ["age", "diet"] })
    const fieldsetEnd = out.indexOf("</fieldset>", out.indexOf('class="pulse-filters__pass"'))
    expect(out).toContain(KEPT_DEALBREAKERS_TITLE)
    const diet = switchFor(out, "diet")
    expect(diet).toContain('checked=""')
    expect(diet).not.toContain("disabled")
    // Drawn after the disabled fieldset closes, so the browser doesn't switch it off too.
    expect(out.indexOf('id="pulse-dealbreaker-diet"')).toBeGreaterThan(fieldsetEnd)
    expect(out.match(/id="pulse-dealbreaker-diet"/g)?.length).toBe(1)
    expect(out).toContain('Diet<span class="pulse-sr"> dealbreaker</span>')
    // Not saved: adding needs a pass.
    expect(switchFor(out, "height")).toContain('disabled=""')
    expect(switchFor(out, "age")).not.toContain("disabled")
  })

  test("with a pass: no kept list, every switch in place", () => {
    const out = panel({ locked: false, savedDealbreakers: ["age", "diet"] })
    expect(out).not.toContain(KEPT_DEALBREAKERS_TITLE)
    expect(switchFor(out, "diet")).not.toContain("disabled")
  })

  test("switched off and saved without a pass: diet goes, nothing is added", () => {
    const chosen = ["age"]
    const body = withDealbreakers({}, { enabled: true, saved: ["age", "diet"], chosen, isSet: () => true, withPass: false })
    expect(body.dealbreakers).toEqual(["age"])
    // Switched back on before saving: kept, which needs no pass.
    expect(dealbreakersToSend(["age", "diet"], () => true, false, ["age", "diet"])).toEqual(["age", "diet"])
  })

  test("the kept list draws each switch with its name, checked as chosen", () => {
    const out = html(<KeptDealbreakers codes={["verified", "diet"]} selected={["verified"]} onChange={noop} />)
    expect(switchFor(out, "verified")).toContain('checked=""')
    expect(switchFor(out, "diet")).not.toContain("checked")
    expect(out).toContain("Verified people only")
    expect(html(<KeptDealbreakers codes={[]} selected={[]} onChange={noop} />)).toBe("")
  })

  test("filters off, dealbreakers on: kept pass ones listed and saveable", () => {
    const breakersOnly = toPreferences(readFixture("preferences_get_200_dealbreakers").data)
    const out = html(<DealbreakersOnlyPanel rows={freeDealbreakerRows(breakersOnly)} kept={["diet"]} selected={["age", "diet"]} busy={false} error="" onChange={noop} onSave={noop} />)
    expect(out).toContain(KEPT_DEALBREAKERS_TITLE)
    expect(switchFor(out, "diet")).not.toContain("disabled")
    const onlyKept = html(<DealbreakersOnlyPanel rows={[]} kept={["diet"]} selected={["diet"]} busy={false} error="" onChange={noop} onSave={noop} />)
    expect(onlyKept).not.toContain("Set your preferences first")
    expect(onlyKept).toContain(">Save dealbreakers<")
  })
})

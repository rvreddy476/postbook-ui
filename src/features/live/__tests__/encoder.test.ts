import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  ENCODER_STEPS,
  IngressShapeError,
  createStreamBody,
  encoderHostView,
  encoderIdentity,
  encoderPanel,
  ingressErrorCopy,
  ingressPath,
  isHostIdentity,
  maskKey,
  parseIngress,
  pickHostVideo,
  requestIngress,
  resetIngress,
  shownKey,
  streamSource,
  studioFor,
  type IngressHttp,
} from "../encoder"
import { PILOT_REFUSAL_COPY } from "../errors"

const STREAM = { id: "11111111-1111-4111-8111-111111111111", creator_user_id: "host-user" }
const ENCODER = `encoder_${STREAM.id}`
const KEY = "sk_FAKE_abc123XYZ"

const axiosErr = (status: number, code = "", message = "raw server text") => ({
  response: { status, data: { error: { code, message } } },
})

describe("stream source", () => {
  it("only the exact value encoder is streaming software; absent, empty and unknown are this device", () => {
    expect(streamSource({ source: "encoder" })).toBe("encoder")
    expect(streamSource({ source: "device" })).toBe("device")
    expect(streamSource({})).toBe("device")
    expect(streamSource({ source: "" })).toBe("device")
    expect(streamSource({ source: "whip" })).toBe("device")
    expect(streamSource(null)).toBe("device")
  })
})

describe("create request (POST /v1/livestream/streams)", () => {
  const base = { title: "T", visibility: "public" as const }
  it("sends source only for streaming software", () => {
    expect(createStreamBody({ ...base, source: "encoder" })).toEqual({
      title: "T", description: "", visibility: "public", cover_media_id: null, scheduled_at: null, source: "encoder",
    })
  })
  it("a device stream keeps today's body exactly", () => {
    const today = { title: "T", description: "", visibility: "public", cover_media_id: null, scheduled_at: null }
    expect(createStreamBody(base)).toEqual(today)
    expect(createStreamBody({ ...base, source: "device" })).toEqual(today)
    expect(createStreamBody({ ...base, description: "d", cover_media_id: "c" })).toEqual({ ...today, description: "d", cover_media_id: "c" })
  })
})

describe("which studio the host gets", () => {
  it("nothing mounts until the row is known, so an encoder stream never opens the camera studio", () => {
    expect(studioFor(undefined, false)).toBe("loading")
    expect(studioFor(null, false)).toBe("loading")
    expect(studioFor({ source: "encoder" }, false)).toBe("encoder")
    expect(studioFor({ source: "encoder" }, true)).toBe("encoder")
    expect(studioFor({ source: "device" }, false)).toBe("device")
    expect(studioFor({}, false)).toBe("device")
  })
  it("a row that failed to load goes to the camera studio's own error state", () => {
    expect(studioFor(undefined, true)).toBe("device")
  })
})

describe("encoder studio panel per status", () => {
  it("scheduled: setup card with the key and Start; nothing to end yet", () => {
    expect(encoderPanel({ status: "scheduled" })).toEqual({ panel: "setup", showKey: true, canStart: true, canEnd: false, connectPreview: false })
  })
  it("starting: still the setup card and key (waiting for the software); Start is gone, End appears", () => {
    expect(encoderPanel({ status: "starting" })).toEqual({ panel: "setup", showKey: true, canStart: false, canEnd: true, connectPreview: false })
  })
  it("live and reconnecting: the preview, and the key is no longer asked for or shown", () => {
    for (const status of ["live", "reconnecting"]) {
      expect(encoderPanel({ status })).toEqual({ panel: "preview", showKey: false, canStart: false, canEnd: true, connectPreview: true })
    }
  })
  it("ended and failed: over, no key, no preview", () => {
    for (const status of ["ended", "failed"]) {
      expect(encoderPanel({ status })).toEqual({ panel: "over", showKey: false, canStart: false, canEnd: false, connectPreview: false })
    }
  })
  it("an unknown status offers nothing", () => {
    expect(encoderPanel({ status: "paused" })).toEqual({ panel: "setup", showKey: false, canStart: false, canEnd: false, connectPreview: false })
    expect(encoderPanel({})).toEqual({ panel: "setup", showKey: false, canStart: false, canEnd: false, connectPreview: false })
  })
})

describe("host copy for an encoder stream", () => {
  it("the state line follows the server status", () => {
    expect(encoderHostView({ status: "scheduled" }).title).toBe("Set up your streaming software")
    expect(encoderHostView({ status: "starting" }).label).toBe("Starting")
    expect(encoderHostView({ status: "starting" }).title).toBe("Waiting for your software to connect")
    expect(encoderHostView({ status: "live" }).label).toBe("Live")
    expect(encoderHostView({ status: "reconnecting" }).label).toBe("Reconnecting")
    expect(encoderHostView({ status: "ended", ended_reason: "host_ended" }).body).toBe("You ended the stream.")
    expect(encoderHostView({ status: "failed" }).label).toBe("Failed")
  })
  it("never talks about this device or the host's connection", () => {
    const bodies = [
      encoderHostView({ status: "starting" }),
      encoderHostView({ status: "reconnecting" }),
      encoderHostView({ status: "ended", ended_reason: "host_lost" }),
      encoderHostView({ status: "ended", ended_reason: "no_media" }),
      encoderHostView({ status: "failed", ended_reason: "no_media" }),
      encoderHostView({ status: "failed" }),
    ].map((v) => v.body)
    for (const body of bodies) {
      expect(body).not.toContain("your device")
      expect(body).not.toContain("Your connection")
      expect(body).toMatch(/software/)
    }
  })
  it("keeps the status flags of the shared view", () => {
    expect(encoderHostView({ status: "live" }).connectPlayer).toBe(true)
    expect(encoderHostView({ status: "starting" }).connectPlayer).toBe(false)
    expect(encoderHostView({ status: "ended" }).terminal).toBe(true)
  })
})

describe("whose video is the host's", () => {
  it("the encoder identity is encoder_<stream id>", () => {
    expect(encoderIdentity(STREAM.id)).toBe(ENCODER)
  })
  it("the creator and this stream's encoder are the host; nobody else is", () => {
    expect(isHostIdentity("host-user", STREAM)).toBe(true)
    expect(isHostIdentity(ENCODER, STREAM)).toBe(true)
    expect(isHostIdentity("viewer-1", STREAM)).toBe(false)
    expect(isHostIdentity("encoder_some-other-stream", STREAM)).toBe(false)
    expect(isHostIdentity("encoder_", STREAM)).toBe(false)
    expect(isHostIdentity("", STREAM)).toBe(false)
    expect(isHostIdentity(undefined, STREAM)).toBe(false)
    expect(isHostIdentity("host-user", null)).toBe(false)
  })
  it("an empty creator id or stream id never matches an empty or bare identity", () => {
    expect(isHostIdentity("", { id: "", creator_user_id: "" })).toBe(false)
    expect(isHostIdentity("encoder_", { id: "", creator_user_id: "" })).toBe(false)
  })
  it("device stream: the creator's video", () => {
    const got = pickHostVideo([{ identity: "viewer-1", hasVideo: false }, { identity: "host-user", hasVideo: true }], STREAM)
    expect(got?.identity).toBe("host-user")
  })
  it("encoder stream: the encoder's video, while the creator only watches", () => {
    const got = pickHostVideo(
      [{ identity: "host-user", hasVideo: false }, { identity: "viewer-1", hasVideo: false }, { identity: ENCODER, hasVideo: true }],
      STREAM,
    )
    expect(got?.identity).toBe(ENCODER)
  })
  it("never a viewer, even one that publishes video", () => {
    expect(pickHostVideo([{ identity: "viewer-1", hasVideo: true }], STREAM)).toBeNull()
    const got = pickHostVideo([{ identity: "viewer-1", hasVideo: true }, { identity: ENCODER, hasVideo: true }], STREAM)
    expect(got?.identity).toBe(ENCODER)
  })
  it("a host identity without video is not picked", () => {
    expect(pickHostVideo([{ identity: "host-user", hasVideo: false }, { identity: ENCODER, hasVideo: false }], STREAM)).toBeNull()
    expect(pickHostVideo([], STREAM)).toBeNull()
    expect(pickHostVideo([{ identity: "host-user", hasVideo: true }], null)).toBeNull()
  })
  it("both publishing: the encoder wins", () => {
    const got = pickHostVideo([{ identity: "host-user", hasVideo: true }, { identity: ENCODER, hasVideo: true }], STREAM)
    expect(got?.identity).toBe(ENCODER)
  })
})

describe("ingress response", () => {
  it("reads {data:{server_url, stream_key, ingress_id}}", () => {
    expect(parseIngress({ data: { server_url: "rtmps://x.livekit.cloud/x", stream_key: KEY, ingress_id: "IN_1" } })).toEqual({
      server_url: "rtmps://x.livekit.cloud/x", stream_key: KEY, ingress_id: "IN_1",
    })
  })
  it("Go zero values: an empty URL or key is no ingress", () => {
    expect(parseIngress({ data: { server_url: "", stream_key: KEY, ingress_id: "IN_1" } })).toBeNull()
    expect(parseIngress({ data: { server_url: "rtmps://x", stream_key: "", ingress_id: "IN_1" } })).toBeNull()
    expect(parseIngress({ data: null })).toBeNull()
    expect(parseIngress({ server_url: "rtmps://x", stream_key: KEY })).toBeNull()
    expect(parseIngress(null)).toBeNull()
  })
})

describe("ingress requests", () => {
  function fakeHttp(answers: unknown[]) {
    const calls: Array<{ method: string; url: string; args: number }> = []
    const http: IngressHttp = {
      post(...args: unknown[]) {
        calls.push({ method: "POST", url: String(args[0]), args: args.length })
        return Promise.resolve({ data: answers.shift() })
      },
      delete(...args: unknown[]) {
        calls.push({ method: "DELETE", url: String(args[0]), args: args.length })
        return Promise.resolve({})
      },
    }
    return { http, calls }
  }
  const body = (key: string) => ({ data: { server_url: "rtmps://x", stream_key: key, ingress_id: "IN_1" } })

  it("the path carries the stream id and nothing else", () => {
    expect(ingressPath(STREAM.id)).toBe(`/v1/livestream/streams/${STREAM.id}/ingress`)
    expect(ingressPath("a/b?c")).toBe("/v1/livestream/streams/a%2Fb%3Fc/ingress")
  })
  it("get the key: one POST, no body, no query", async () => {
    const { http, calls } = fakeHttp([body(KEY)])
    expect((await requestIngress(http, STREAM.id)).stream_key).toBe(KEY)
    expect(calls).toEqual([{ method: "POST", url: `/v1/livestream/streams/${STREAM.id}/ingress`, args: 1 }])
  })
  it("reset: DELETE first, then POST, and the answer is the new key", async () => {
    const { http, calls } = fakeHttp([body("sk_FAKE_new")])
    expect((await resetIngress(http, STREAM.id)).stream_key).toBe("sk_FAKE_new")
    expect(calls.map((c) => c.method)).toEqual(["DELETE", "POST"])
    expect(calls.every((c) => c.url === `/v1/livestream/streams/${STREAM.id}/ingress` && c.args === 1)).toBe(true)
  })
  it("a failed DELETE does not go on to POST", async () => {
    const calls: string[] = []
    const http: IngressHttp = {
      post() { calls.push("POST"); return Promise.resolve({ data: body(KEY) }) },
      delete() { calls.push("DELETE"); return Promise.reject(axiosErr(502, "INGRESS_UNAVAILABLE")) },
    }
    await expect(resetIngress(http, STREAM.id)).rejects.toBeDefined()
    expect(calls).toEqual(["DELETE"])
  })
  it("an answer without a key is an error that does not carry the body", async () => {
    const { http } = fakeHttp([{ data: { server_url: "rtmps://x", stream_key: "", ingress_id: "IN_1" } }])
    const err = await requestIngress(http, STREAM.id).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(IngressShapeError)
  })
})

describe("the stream key is a secret", () => {
  it("masked: a fixed run of dots, no character and no length of the key", () => {
    const masked = maskKey(KEY)
    expect(masked).toBe("•".repeat(16))
    expect(maskKey("x")).toBe(masked)
    expect(maskKey("a-very-long-stream-key-0123456789-abcdefghijklmnopqrstuvwxyz")).toBe(masked)
    for (const ch of new Set(KEY)) expect(masked).not.toContain(ch)
    expect(maskKey("")).toBe("")
  })
  it("hidden by default, the real key only when revealed", () => {
    expect(shownKey(KEY, false)).toBe(maskKey(KEY))
    expect(shownKey(KEY, false)).not.toContain(KEY)
    expect(shownKey(KEY, true)).toBe(KEY)
  })
  it("the sources never put the key in a URL, storage or a log", () => {
    const root = resolve(import.meta.dir, "../../..")
    const files = [
      "features/live/encoder.ts",
      "features/live/components/EncoderSetup.tsx",
      "features/live/components/EncoderStudio.tsx",
      "features/live/components/EncoderPreview.tsx",
      "hooks/useLiveV2.ts",
    ]
    for (const file of files) {
      const src = readFileSync(resolve(root, file), "utf8")
      expect(src).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/)
      expect(src).not.toMatch(/console\.(log|info|warn|error|debug)/)
      expect(src).not.toMatch(/searchParams|router\.(push|replace)|[?&]stream_key=|[?&]key=/)
    }
    // The hook keeps the answer in component state, not in the query cache.
    const hook = readFileSync(resolve(root, "hooks/useLiveV2.ts"), "utf8")
    const ingressHook = hook.slice(hook.indexOf("export function useStreamIngress"))
    expect(ingressHook).not.toMatch(/useQuery|useMutation|setQueryData/)
  })
})

describe("ingress error copy", () => {
  it("every code the ingress routes write", () => {
    expect(ingressErrorCopy(axiosErr(502, "INGRESS_UNAVAILABLE"))).toBe("We couldn't set up the connection for your streaming software. Try again in a moment.")
    expect(ingressErrorCopy(axiosErr(409, "STREAM_STATE_CONFLICT"))).toBe("The stream key can't be shown or changed once you're live or the stream is over.")
    expect(ingressErrorCopy(axiosErr(422, "VALIDATION_ERROR"))).toBe("This stream uses this device's camera, so it has no stream key.")
    expect(ingressErrorCopy(axiosErr(403, "LIVE_NOT_ENABLED"))).toBe(PILOT_REFUSAL_COPY)
    expect(ingressErrorCopy(axiosErr(403, "LIVE_BANNED"))).toBe("You can't go live right now.")
    expect(ingressErrorCopy(axiosErr(403, "FORBIDDEN"))).toBe("Only the host can see the stream key.")
    expect(ingressErrorCopy(axiosErr(404, "NOT_FOUND"))).toBe("This stream no longer exists.")
    expect(ingressErrorCopy(axiosErr(401, "UNAUTHORIZED"))).toBe("Sign in to go live.")
    expect(ingressErrorCopy(axiosErr(500))).toBe("We couldn't get your stream key. Try again.")
    expect(ingressErrorCopy(new IngressShapeError())).toBe("We couldn't get your stream key. Try again.")
  })
  it("branches on the code, never on the status or the server's message", () => {
    expect(ingressErrorCopy(axiosErr(502, "", "INGRESS_UNAVAILABLE"))).toBe("We couldn't get your stream key. Try again.")
    expect(ingressErrorCopy(axiosErr(409, "STREAM_NOT_LIVE"))).toBe("We couldn't get your stream key. Try again.")
    expect(ingressErrorCopy(axiosErr(502, "INGRESS_UNAVAILABLE", "livekit: dial tcp 10.0.0.4"))).not.toContain("livekit")
  })
})

describe("setup steps", () => {
  it("three short steps: paste into OBS, Start here, Start Streaming in OBS", () => {
    expect(ENCODER_STEPS).toHaveLength(3)
    expect(ENCODER_STEPS[0]).toContain("Settings → Stream")
    expect(ENCODER_STEPS[0]).toContain("Custom")
    expect(ENCODER_STEPS[1]).toContain("Start")
    expect(ENCODER_STEPS[2]).toContain("Start Streaming in OBS")
  })
})

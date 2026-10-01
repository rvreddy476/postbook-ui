import { describe, expect, it } from "bun:test"

import {
  PILOT_REFUSAL_COPY,
  chatSendErrorCopy,
  goLiveErrorCopy,
  isChatBan,
  isPilotRefusal,
  isStreamNotLive,
  moderationErrorCopy,
  viewerTokenRetry,
  watchErrorCopy,
} from "../errors"

const axiosErr = (status: number, code = "", message = "raw server text") => ({
  response: { status, data: { error: { code, message } } },
})

describe("LIVE_NOT_ENABLED pilot refusal", () => {
  it("is the closed-pilot sentence", () => {
    expect(PILOT_REFUSAL_COPY).toBe("Going live is in a closed pilot right now.")
    expect(isPilotRefusal(axiosErr(403, "LIVE_NOT_ENABLED"))).toBe(true)
    expect(goLiveErrorCopy(axiosErr(403, "LIVE_NOT_ENABLED"))).toBe(PILOT_REFUSAL_COPY)
  })
  it("branches on the code, not on 403 or the message", () => {
    expect(isPilotRefusal(axiosErr(403, "FORBIDDEN"))).toBe(false)
    expect(isPilotRefusal(axiosErr(403, "", "LIVE_NOT_ENABLED"))).toBe(false)
    expect(goLiveErrorCopy(axiosErr(403, "", "LIVE_NOT_ENABLED"))).toBe("We couldn't start your stream. Try again.")
    expect(isPilotRefusal(new Error("LIVE_NOT_ENABLED"))).toBe(false)
    expect(isPilotRefusal(null)).toBe(false)
  })
})

describe("go live (create, start)", () => {
  it("every code create/start writes", () => {
    expect(goLiveErrorCopy(axiosErr(403, "LIVE_BANNED"))).toBe("You can't go live right now.")
    expect(goLiveErrorCopy(axiosErr(403, "FORBIDDEN"))).toBe("Only the host can start this stream.")
    expect(goLiveErrorCopy(axiosErr(409, "STREAM_STATE_CONFLICT"))).toBe("This stream has already ended. Start a new one.")
    expect(goLiveErrorCopy(axiosErr(404, "NOT_FOUND"))).toBe("This stream no longer exists.")
    expect(goLiveErrorCopy(axiosErr(422, "VALIDATION_ERROR"))).toBe("Check the details and try again.")
    expect(goLiveErrorCopy(axiosErr(400, "INVALID_REQUEST"))).toBe("Check the details and try again.")
    expect(goLiveErrorCopy(axiosErr(401, "UNAUTHORIZED"))).toBe("Sign in to go live.")
  })
  it("names the backend never sends are not read", () => {
    expect(goLiveErrorCopy(axiosErr(403, "USER_LIVE_BANNED"))).toBe("We couldn't start your stream. Try again.")
  })
})

describe("chat send (POST /chat)", () => {
  it("every refusal SendChat writes", () => {
    expect(chatSendErrorCopy(axiosErr(403, "CHAT_BANNED"))).toBe("You've been removed from this stream.")
    expect(chatSendErrorCopy(axiosErr(403, "LIVE_BANNED"))).toBe("You can't chat on live streams right now.")
    expect(chatSendErrorCopy(axiosErr(403, "CHAT_MUTED"))).toBe("You've been muted in this chat.")
    expect(chatSendErrorCopy(axiosErr(400, "CHAT_BLOCKED_WORD"))).toBe("That message has a word the host doesn't allow.")
    expect(chatSendErrorCopy(axiosErr(429, "RATE_LIMITED"))).toBe("You're sending too quickly. Wait a moment.")
    expect(chatSendErrorCopy(axiosErr(409, "STREAM_NOT_LIVE"))).toBe("Chat opens when the stream is live.")
    expect(chatSendErrorCopy(axiosErr(403, "NOT_FOLLOWER"))).toBe("Only the creator's followers can chat here.")
    expect(chatSendErrorCopy(axiosErr(404, "NOT_FOUND"))).toBe("This stream is no longer available.")
    expect(chatSendErrorCopy(axiosErr(400, "INVALID_REQUEST"))).toBe("Messages can be up to 500 characters.")
    expect(chatSendErrorCopy(axiosErr(503, "AUTHORITY_UNAVAILABLE"))).toBe("Your message didn't send. Try again.")
    expect(chatSendErrorCopy(axiosErr(500))).toBe("Your message didn't send. Try again.")
  })
  it("CHAT_BANNED is the stream ban; the old guesses are not read", () => {
    expect(isChatBan(axiosErr(403, "CHAT_BANNED"))).toBe(true)
    expect(isChatBan(axiosErr(403, "LIVE_BANNED"))).toBe(false)
    expect(chatSendErrorCopy(axiosErr(403, "USER_BANNED"))).toBe("Your message didn't send. Try again.")
    expect(chatSendErrorCopy(axiosErr(403, "BANNED"))).toBe("Your message didn't send. Try again.")
  })
})

describe("watch (GET /streams/:id, GET /viewer-token)", () => {
  it("access refusals", () => {
    expect(watchErrorCopy(axiosErr(403, "NOT_FOLLOWER"))).toBe("Only the creator's followers can watch this stream.")
    expect(watchErrorCopy(axiosErr(403, "BANNED_FROM_STREAM"))).toBe("You've been removed from this stream.")
    expect(watchErrorCopy(axiosErr(402, "PAID_REQUIRED"))).toBe("Paid streams aren't available yet.")
    expect(watchErrorCopy(axiosErr(404, "NOT_FOUND"))).toBe("This stream no longer exists.")
    expect(watchErrorCopy(axiosErr(401, "UNAUTHORIZED"))).toBe("Sign in to watch this stream.")
  })
  it("not on air and transient failures are not access refusals", () => {
    expect(watchErrorCopy(axiosErr(409, "STREAM_NOT_LIVE"))).toBeNull()
    expect(isStreamNotLive(axiosErr(409, "STREAM_NOT_LIVE"))).toBe(true)
    expect(isStreamNotLive(axiosErr(409, "STREAM_STATE_CONFLICT"))).toBe(false)
    expect(watchErrorCopy(axiosErr(503, "AUTHORITY_UNAVAILABLE"))).toBeNull()
    expect(watchErrorCopy(axiosErr(500))).toBeNull()
    expect(watchErrorCopy(null)).toBeNull()
  })
  it("viewer-token retry: refusals are final, STREAM_NOT_LIVE retried briefly", () => {
    for (const [status, code] of [[401, "UNAUTHORIZED"], [402, "PAID_REQUIRED"], [403, "BANNED_FROM_STREAM"], [403, "NOT_FOLLOWER"], [404, "NOT_FOUND"]] as const) {
      expect(viewerTokenRetry(0, axiosErr(status, code))).toBe(false)
    }
    expect(viewerTokenRetry(2, axiosErr(409, "STREAM_NOT_LIVE"))).toBe(true)
    expect(viewerTokenRetry(3, axiosErr(409, "STREAM_NOT_LIVE"))).toBe(false)
    expect(viewerTokenRetry(1, axiosErr(503, "AUTHORITY_UNAVAILABLE"))).toBe(true)
    expect(viewerTokenRetry(2, axiosErr(503, "AUTHORITY_UNAVAILABLE"))).toBe(false)
  })
})

describe("moderation (remove, bans, moderators)", () => {
  it("the codes the moderation routes write", () => {
    expect(moderationErrorCopy(axiosErr(403, "FORBIDDEN"))).toBe("You can't do that in this stream.")
    expect(moderationErrorCopy(axiosErr(422, "VALIDATION_ERROR"))).toBe("That isn't possible for this person.")
    expect(moderationErrorCopy(axiosErr(404, "NOT_FOUND"))).toBe("That message is already gone.")
    expect(moderationErrorCopy(axiosErr(500))).toBe("That didn't work. Try again.")
  })
})

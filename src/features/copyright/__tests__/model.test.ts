import { afterEach, describe, expect, spyOn, test } from "bun:test"

const { default: api } = await import("@/lib/api")
const {
  APPEAL_DEFAULT_NOTE,
  APPEAL_SENT_COPY,
  APPEAL_UPHELD_COPY,
  APPEAL_USED_COPY,
  ASK_FOR_REVIEW_LABEL,
  appealNoteProblem,
  appealRequestBody,
  reviewFormNoteProblem,
  CLEARED_COPY,
  COPYRIGHT_REPORT_REASONS,
  COPYRIGHT_REVIEW_CREATE_COPY,
  COPYRIGHT_REVIEW_EDIT_COPY,
  CREATOR_HUB_PATH,
  copyrightCodeMessage,
  copyrightNotificationCopy,
  copyrightRefusalMessage,
  copyrightReviewCopy,
  decodeCopyrightReview,
  formatCopyrightDate,
  isCopyrightHeld,
  isCopyrightNotification,
  isCopyrightRefusal,
  reviewNoteLength,
  reviewNoteProblem,
  reviewRequestBody,
  reviewRequestErrorMessage,
  reviewRequestIsStale,
  reviewRequestPath,
  uploadsPausedCopy,
  uploadsPausedUntil,
} = await import("../model")
const { requestCopyrightReview } = await import("../api")
const { normalizeLibraryRow, normalizePostDetail } = await import("@/features/posttube/hub/hubApi")
const { readableHubError, readableHubFailure } = await import("@/features/posttube/hub/hubModel")
const { isFinalPublishRefusal, publishFailure, publishedOutcome, readPublishedCopyrightReview } = await import("@/features/upload/studioApi")
const { membershipErrorMessage } = await import("@/features/memberships/model")
const { creditNotificationHref, decodeNotificationPage } = await import("@/lib/notificationInbox")
const { COMMENT_REPORT_REASONS, REPORT_REASONS, VIDEO_REPORT_REASONS, reportRequestBody } = await import("@/hooks/useReport")
const { reportReasonsFor } = await import("@/features/reels/components/ReelReportDialog")
const { NETWORK_ERROR, SOURCES, fixture, fixtureNames, httpError } = await import("./fixtures")

const POST = "7a1d0000-0000-4000-8000-000000000001"

type Envelope = { data: Record<string, unknown> }
type Page = { data: Record<string, unknown>[] }

const spies: { mockRestore(): void }[] = []
afterEach(() => {
  while (spies.length) spies.pop()!.mockRestore()
})

describe("fixtures", () => {
  test("every fixture names the Go code it is built from, and every source has its fixture", () => {
    const names = fixtureNames()
    for (const n of names) expect(SOURCES[n]).toBeTruthy()
    for (const k of Object.keys(SOURCES)) if (k !== "report_reasons") expect(names).toContain(k)
  })
})

describe("decodeCopyrightReview", () => {
  test("the owner's pending review off the detail; optional instants absent", () => {
    const raw = (fixture("post_detail_owner_pending") as Envelope).data.copyright_review
    expect(decodeCopyrightReview(raw)).toEqual({
      state: "pending",
      matchedTitle: "Sholay",
      createdAt: "2026-10-24T05:00:00Z",
      decidedAt: null,
      reviewRequestedAt: null,
      appealedAt: null,
      canAppeal: false,
    })
  })

  test("a requested review carries when it was asked", () => {
    const raw = (fixture("post_detail_owner_requested") as Envelope).data.copyright_review
    expect(decodeCopyrightReview(raw)?.reviewRequestedAt).toBe("2026-10-25T06:30:00Z")
  })

  test("each uploads row: pending, cleared (decided, requested), blocked, none", () => {
    const rows = (fixture("uploads_videos_states") as Page).data.map((r) => decodeCopyrightReview(r.copyright_review))
    expect(rows.map((r) => r?.state ?? null)).toEqual(["pending", "cleared", "blocked", null])
    expect(rows[1]).toMatchObject({ decidedAt: "2026-10-21T10:00:00Z", reviewRequestedAt: "2026-10-20T08:00:00Z" })
    expect(rows[2]).toMatchObject({ matchedTitle: "Dilwale Dulhania Le Jayenge", decidedAt: "2026-10-19T09:00:00Z" })
  })

  test("absent, not an object, an unknown state, Go zero values", () => {
    expect(decodeCopyrightReview(undefined)).toBeNull()
    expect(decodeCopyrightReview(null)).toBeNull()
    expect(decodeCopyrightReview("pending")).toBeNull()
    expect(decodeCopyrightReview([])).toBeNull()
    expect(decodeCopyrightReview({ state: "escalated", matched_title: "X" })).toBeNull()
    expect(decodeCopyrightReview({ state: "" })).toBeNull()
    expect(decodeCopyrightReview({ state: "PENDING", matched_title: "  ", created_at: "0001-01-01T00:00:00Z", decided_at: "", review_requested_at: "soon" })).toEqual({
      state: "pending",
      matchedTitle: "",
      createdAt: null,
      decidedAt: null,
      reviewRequestedAt: null,
      appealedAt: null,
      canAppeal: false,
    })
  })

  test("the hub's detail and library rows carry it; a viewer's detail never does", () => {
    const owner = normalizePostDetail((fixture("post_detail_owner_pending") as Envelope).data)
    expect(owner?.copyright_review?.state).toBe("pending")
    const viewer = normalizePostDetail((fixture("post_detail_viewer") as Envelope).data)
    expect(viewer).not.toBeNull()
    expect("copyright_review" in viewer!).toBe(false)
    const rows = (fixture("uploads_videos_states") as Page).data.map(normalizeLibraryRow)
    expect(rows.map((r) => r?.copyright_review?.state ?? null)).toEqual(["pending", "cleared", "blocked", null])
    expect("copyright_review" in rows[3]!).toBe(false)
    // copyright_hold still reads as the hub's hold flag
    expect(rows[0]?.flags).toEqual(["review_hold"])
  })

  test("held means pending or blocked", () => {
    expect(isCopyrightHeld({ state: "pending", matchedTitle: "", createdAt: null, decidedAt: null, reviewRequestedAt: null, appealedAt: null, canAppeal: false })).toBe(true)
    expect(isCopyrightHeld({ state: "blocked", matchedTitle: "", createdAt: null, decidedAt: null, reviewRequestedAt: null, appealedAt: null, canAppeal: false })).toBe(true)
    expect(isCopyrightHeld({ state: "cleared", matchedTitle: "", createdAt: null, decidedAt: null, reviewRequestedAt: null, appealedAt: null, canAppeal: false })).toBe(false)
    expect(isCopyrightHeld(null)).toBe(false)
    expect(isCopyrightHeld(undefined)).toBe(false)
  })
})

describe("copyrightReviewCopy (the contract's words)", () => {
  const review = (over: Record<string, unknown>) => decodeCopyrightReview({ state: "pending", matched_title: "Sholay", created_at: "2026-10-24T05:00:00Z", ...over })!

  test("pending, not yet asked: the hold sentence and Request review", () => {
    expect(copyrightReviewCopy(review({}))).toEqual({
      tone: "warning",
      label: "In copyright review",
      message: "In copyright review — this video is hidden until our team checks it. It matched “Sholay”.",
      requested: null,
      canRequest: true,
      canAppeal: false,
    })
  })

  test("pending, asked: Review requested <date>, no second request", () => {
    const copy = copyrightReviewCopy(review({ review_requested_at: "2026-10-25T06:30:00Z" }))
    expect(copy.requested).toBe("Review requested 25 Oct 2026")
    expect(copy.canRequest).toBe(false)
    expect(copy.message).toBe("In copyright review — this video is hidden until our team checks it. It matched “Sholay”.")
  })

  test("cleared", () => {
    expect(copyrightReviewCopy(review({ state: "cleared", decided_at: "2026-10-26T00:00:00Z", review_requested_at: "2026-10-25T06:30:00Z" }))).toEqual({
      tone: "success",
      label: "Copyright cleared",
      message: "Cleared — your video is live",
      requested: null,
      canRequest: false,
      canAppeal: false,
    })
    expect(CLEARED_COPY).toBe("Cleared — your video is live")
  })

  test("blocked", () => {
    expect(copyrightReviewCopy(review({ state: "blocked" }))).toEqual({
      tone: "danger",
      label: "Blocked for copyright",
      message: "Blocked for copyright — it matched “Sholay”. This isn't a strike, but repeated blocks pause long-video uploads.",
      requested: null,
      canRequest: false,
      canAppeal: false,
    })
  })

  test("no matched title: the sentences stand without it", () => {
    expect(copyrightReviewCopy(review({ matched_title: "" })).message).toBe("In copyright review — this video is hidden until our team checks it.")
    expect(copyrightReviewCopy(review({ state: "blocked", matched_title: "" })).message).toBe(
      "Blocked for copyright. This isn't a strike, but repeated blocks pause long-video uploads.",
    )
  })

  test("dates are India time", () => {
    // 20:00 UTC on the 24th is the 25th in India.
    expect(formatCopyrightDate("2026-10-24T20:00:00Z")).toBe("25 Oct 2026")
    expect(formatCopyrightDate(null)).toBe("")
    expect(formatCopyrightDate("nope")).toBe("")
  })
})

describe("Request review", () => {
  test("the note: 1 to 1,000 characters after trimming, counted as the server counts runes", () => {
    expect(reviewNoteProblem("")).toBe("Tell us why you have the rights to use it.")
    expect(reviewNoteProblem("   \n ")).toBe("Tell us why you have the rights to use it.")
    expect(reviewNoteProblem("a")).toBeNull()
    expect(reviewNoteProblem("a".repeat(1000))).toBeNull()
    expect(reviewNoteProblem("a".repeat(1001))).toBe("Keep it to 1,000 characters (1,001 now).")
    expect(reviewNoteProblem(`  ${"a".repeat(1000)}  `)).toBeNull()
    // 1,000 emoji are 2,000 UTF-16 units but 1,000 runes.
    expect(reviewNoteLength("😀".repeat(1000))).toBe(1000)
    expect(reviewNoteProblem("😀".repeat(1000))).toBeNull()
    expect(reviewNoteProblem("😀".repeat(1001))).not.toBeNull()
  })

  test("the body is {note}, trimmed; the path is the post's", () => {
    expect(reviewRequestBody("  I own the rights \n")).toEqual({ note: "I own the rights" })
    expect(Object.keys(reviewRequestBody("x"))).toEqual(["note"])
    expect(reviewRequestPath(POST)).toBe(`/v1/posts/${POST}/copyright-review/request`)
    expect(reviewRequestPath("a/b")).toBe("/v1/posts/a%2Fb/copyright-review/request")
  })

  test("requestCopyrightReview posts the body and decodes the 200", async () => {
    const post = spyOn(api, "post").mockResolvedValue({ data: fixture("review_request_200") } as never)
    spies.push(post)
    const review = await requestCopyrightReview(POST, " I have a licence ")
    expect(post).toHaveBeenCalledWith(`/v1/posts/${POST}/copyright-review/request`, { note: "I have a licence" })
    expect(review).toMatchObject({ state: "pending", matchedTitle: "Sholay", reviewRequestedAt: "2026-10-25T06:30:00Z" })
    expect(copyrightReviewCopy(review).requested).toBe("Review requested 25 Oct 2026")
  })

  test("a 200 in a shape we don't know is an error, not a silent success", async () => {
    spies.push(spyOn(api, "post").mockResolvedValue({ data: { data: { state: "weird" } } } as never))
    await expect(requestCopyrightReview(POST, "x")).rejects.toThrow()
  })

  test("each refusal in words; decided and gone ones refetch", () => {
    expect(reviewRequestErrorMessage(httpError(400, "review_request_400_note"))).toBe("Write a note of 1 to 1,000 characters.")
    expect(reviewRequestErrorMessage(httpError(404, "review_request_404"))).toBe("This video has no copyright review to answer any more.")
    expect(reviewRequestErrorMessage(httpError(409, "review_request_409_decided"))).toBe("This review has already been decided. Refresh to see the result.")
    expect(reviewRequestErrorMessage(httpError(503, "review_request_503"))).toBe("Copyright review is unavailable right now. Try again in a few minutes.")
    expect(reviewRequestErrorMessage(httpError(503))).toBe("Copyright review is unavailable right now. Try again in a few minutes.")
    expect(reviewRequestErrorMessage(NETWORK_ERROR)).toBe("The connection dropped. Check your network and try again.")
    expect(reviewRequestErrorMessage(httpError(500))).toBe("Your request couldn't be sent. Try again.")
    expect(reviewRequestIsStale(httpError(409, "review_request_409_decided"))).toBe(true)
    expect(reviewRequestIsStale(httpError(404, "review_request_404"))).toBe(true)
    expect(reviewRequestIsStale(httpError(503, "review_request_503"))).toBe(false)
    expect(reviewRequestIsStale(NETWORK_ERROR)).toBe(false)
  })
})

describe("Ask for a review (the block's one appeal, commit cb571fa20)", () => {
  const blocked = () => decodeCopyrightReview((fixture("post_detail_owner_blocked_can_appeal") as Envelope).data.copyright_review)!

  test("a blocked review with its appeal unused offers Ask for a review", () => {
    const review = blocked()
    expect(review).toMatchObject({ state: "blocked", canAppeal: true, appealedAt: null, decidedAt: "2026-10-25T09:00:00Z" })
    const copy = copyrightReviewCopy(review)
    expect(copy).toMatchObject({ tone: "danger", canAppeal: true, canRequest: false, requested: null })
    expect(ASK_FOR_REVIEW_LABEL).toBe("Ask for a review")
  })

  test("can_appeal counts only on a block, only when true, and never once an appeal is on record", () => {
    const base = { matched_title: "Sholay", created_at: "2026-10-24T05:00:00Z", can_appeal: true }
    expect(decodeCopyrightReview({ ...base, state: "pending" })?.canAppeal).toBe(false)
    expect(decodeCopyrightReview({ ...base, state: "cleared" })?.canAppeal).toBe(false)
    expect(decodeCopyrightReview({ ...base, state: "blocked", can_appeal: "true" })?.canAppeal).toBe(false)
    expect(decodeCopyrightReview({ ...base, state: "blocked", can_appeal: false })?.canAppeal).toBe(false)
    expect(decodeCopyrightReview({ ...base, state: "blocked", appealed_at: "2026-10-26T04:00:00Z" })?.canAppeal).toBe(false)
    expect(decodeCopyrightReview({ ...base, state: "blocked", appealed_at: "0001-01-01T00:00:00Z" })).toMatchObject({ canAppeal: true, appealedAt: null })
    expect(copyrightReviewCopy(decodeCopyrightReview({ ...base, state: "pending" })!).canAppeal).toBe(false)
  })

  test("the appeal answered with the block kept: no second offer, and it says so", () => {
    const review = decodeCopyrightReview({ state: "blocked", matched_title: "Sholay", appealed_at: "2026-10-26T04:00:00Z", can_appeal: false })!
    expect(copyrightReviewCopy(review)).toMatchObject({ canAppeal: false, canRequest: false, requested: APPEAL_UPHELD_COPY })
  })

  test("an appeal back with a reviewer reads Review requested, dated by the appeal", () => {
    const review = decodeCopyrightReview((fixture("review_appeal_200") as Envelope).data)!
    expect(review).toMatchObject({ state: "pending", appealedAt: "2026-10-26T04:00:00Z", canAppeal: false })
    const copy = copyrightReviewCopy(review)
    expect(copy.requested).toBe("Review requested 26 Oct 2026")
    expect(copy.canRequest).toBe(false)
    expect(copy.canAppeal).toBe(false)
    // appealed_at alone (no review_requested_at) still counts as asked
    const only = copyrightReviewCopy(decodeCopyrightReview({ state: "pending", appealed_at: "2026-10-26T04:00:00Z" })!)
    expect(only).toMatchObject({ requested: "Review requested 26 Oct 2026", canRequest: false })
  })

  test("the note is optional; an empty one sends the default note the server requires", () => {
    expect(appealNoteProblem("")).toBeNull()
    expect(appealNoteProblem("   ")).toBeNull()
    expect(appealNoteProblem("I have a licence")).toBeNull()
    expect(appealNoteProblem("a".repeat(1001))).toBe("Keep it to 1,000 characters (1,001 now).")
    expect(appealRequestBody("  I have a licence ")).toEqual({ note: "I have a licence" })
    expect(appealRequestBody(" \n ")).toEqual({ note: APPEAL_DEFAULT_NOTE })
    expect(Array.from(APPEAL_DEFAULT_NOTE).length).toBeLessThanOrEqual(1000)
    expect(reviewNoteProblem(APPEAL_DEFAULT_NOTE)).toBeNull()
    // the form: optional for an appeal, required for a request
    expect(reviewFormNoteProblem("", true)).toBeNull()
    expect(reviewFormNoteProblem("", false)).toBe("Tell us why you have the rights to use it.")
    expect(reviewFormNoteProblem("a".repeat(1001), true)).not.toBeNull()
  })

  test("requestCopyrightReview with appeal posts the same route; no note → the default note", async () => {
    const post = spyOn(api, "post").mockResolvedValue({ data: fixture("review_appeal_200") } as never)
    spies.push(post)
    const review = await requestCopyrightReview(POST, "  ", true)
    expect(post).toHaveBeenCalledWith(`/v1/posts/${POST}/copyright-review/request`, { note: APPEAL_DEFAULT_NOTE })
    expect(review).toMatchObject({ state: "pending", appealedAt: "2026-10-26T04:00:00Z" })
    await requestCopyrightReview(POST, " mine ", true)
    expect(post).toHaveBeenLastCalledWith(`/v1/posts/${POST}/copyright-review/request`, { note: "mine" })
  })

  test("409 APPEAL_ALREADY_USED: the founder's sentence, and the cached review refetches", () => {
    const used = httpError(409, "review_request_409_appeal_used")
    expect(reviewRequestErrorMessage(used)).toBe("You have already asked for a review of this block.")
    expect(APPEAL_USED_COPY).toBe("You have already asked for a review of this block.")
    expect(reviewRequestIsStale(used)).toBe(true)
    expect(APPEAL_SENT_COPY).toBe("A reviewer will look at it. The video stays hidden until then.")
  })
})

describe("refusals on publish and edit", () => {
  const paused = httpError(403, "publish_403_uploads_paused")
  const held = httpError(409, "edit_409_copyright_review")
  const PAUSED = "Long-video uploads are paused until 31 Oct 2026 after repeated copyright blocks. Reels and posts still work."

  test("UPLOADS_PAUSED names the day the pause ends", () => {
    expect(uploadsPausedUntil(paused)).toBe("2026-10-31T09:30:00Z")
    expect(uploadsPausedUntil(held)).toBeNull()
    // Only the pause's own refusal names an end, whatever another one carries.
    expect(uploadsPausedUntil({ response: { status: 409, data: { error: { code: "COPYRIGHT_REVIEW", details: { until: "2026-10-31T09:30:00Z" } } } } })).toBeNull()
    expect(uploadsPausedUntil(NETWORK_ERROR)).toBeNull()
    expect(copyrightRefusalMessage(paused)).toBe(PAUSED)
    expect(copyrightRefusalMessage(paused, "create")).toBe(PAUSED)
    expect(uploadsPausedCopy(null)).toBe("Long-video uploads are paused after repeated copyright blocks. Reels and posts still work.")
    const noDate = { response: { status: 403, data: { error: { code: "UPLOADS_PAUSED", details: { until: "" } } } } }
    expect(copyrightRefusalMessage(noDate)).toBe("Long-video uploads are paused after repeated copyright blocks. Reels and posts still work.")
  })

  test("COPYRIGHT_REVIEW: the contract's sentence on edits, a create's own", () => {
    expect(copyrightRefusalMessage(held)).toBe("This video is in copyright review — you can't change who can see it until it's cleared.")
    expect(copyrightRefusalMessage(held, "edit")).toBe(COPYRIGHT_REVIEW_EDIT_COPY)
    expect(copyrightRefusalMessage(held, "create")).toBe(COPYRIGHT_REVIEW_CREATE_COPY)
    expect(copyrightCodeMessage("COPYRIGHT_REVIEW")).toBe(COPYRIGHT_REVIEW_EDIT_COPY)
  })

  test("anything else is not a copyright refusal", () => {
    for (const err of [httpError(400, "review_request_400_note"), httpError(500), NETWORK_ERROR, null, undefined, new Error("x")]) {
      expect(copyrightRefusalMessage(err)).toBeNull()
      expect(isCopyrightRefusal(err)).toBe(false)
    }
    expect(copyrightCodeMessage("INVALID_TIER")).toBeNull()
    expect(copyrightCodeMessage(null)).toBeNull()
    expect(isCopyrightRefusal(paused)).toBe(true)
    expect(isCopyrightRefusal(held)).toBe(true)
  })

  test("the upload studio: the paused sentence, the create sentence, and no fall-through to the direct create", () => {
    expect(publishFailure(paused)).toEqual({ code: "UPLOADS_PAUSED", message: PAUSED })
    expect(publishFailure(held)).toEqual({ code: "COPYRIGHT_REVIEW", message: COPYRIGHT_REVIEW_CREATE_COPY })
    expect(isFinalPublishRefusal(paused)).toBe(true)
    expect(isFinalPublishRefusal(held)).toBe(true)
    expect(isFinalPublishRefusal(httpError(500))).toBe(false)
    expect(isFinalPublishRefusal(NETWORK_ERROR)).toBe(false)
  })

  test("the Creator Hub: the edit sentence, the pause with its date, other codes as before", () => {
    expect(readableHubFailure(held)).toBe(COPYRIGHT_REVIEW_EDIT_COPY)
    expect(readableHubFailure(paused, "fallback")).toBe(PAUSED)
    expect(readableHubError("COPYRIGHT_REVIEW")).toBe(COPYRIGHT_REVIEW_EDIT_COPY)
    expect(readableHubError("UPLOADS_PAUSED")).toBe(uploadsPausedCopy(null))
    expect(readableHubFailure(httpError(403, undefined), "fallback")).toBe("fallback")
    expect(readableHubFailure({ response: { data: { error: { code: "RELATED_SELF" } } } })).toBe("A video can't point at itself as its related video.")
    expect(readableHubFailure({ response: { data: { error: "NOT_FOUND" } } })).toBe("This video no longer exists.")
  })

  test("the members-only control's words match", () => {
    expect(membershipErrorMessage(held)).toBe(COPYRIGHT_REVIEW_EDIT_COPY)
  })
})

describe("after publishing a long video", () => {
  const pending = normalizePostDetail((fixture("post_detail_owner_pending") as Envelope).data)!
  const viewer = normalizePostDetail((fixture("post_detail_viewer") as Envelope).data)!

  test("the detail is read back: held → the review, otherwise or on failure → null", async () => {
    expect((await readPublishedCopyrightReview(POST, async () => pending))?.state).toBe("pending")
    expect(await readPublishedCopyrightReview(POST, async () => viewer)).toBeNull()
    expect(await readPublishedCopyrightReview(POST, async () => null)).toBeNull()
    const cleared = { ...pending, copyright_review: { ...pending.copyright_review!, state: "cleared" as const } }
    expect(await readPublishedCopyrightReview(POST, async () => cleared)).toBeNull()
    expect(await readPublishedCopyrightReview(POST, async () => Promise.reject(new Error("down")))).toBeNull()
  })

  test("the read goes to GET /v1/posts/:id by default", async () => {
    const get = spyOn(api, "get").mockResolvedValue({ data: fixture("post_detail_owner_pending") } as never)
    spies.push(get)
    expect((await readPublishedCopyrightReview(POST))?.matchedTitle).toBe("Sholay")
    expect(get).toHaveBeenCalledWith(`/v1/posts/${POST}`)
  })

  test("the success screen: in review instead of published", () => {
    expect(publishedOutcome({ label: "Video", scheduled: false, review: pending.copyright_review! })).toEqual({
      held: true,
      title: "Video in copyright review",
      body: "In copyright review — this video is hidden until our team checks it. It matched “Sholay”. You can request a review in Creator Hub.",
    })
    const blocked = { ...pending.copyright_review!, state: "blocked" as const }
    expect(publishedOutcome({ label: "Video", scheduled: false, review: blocked })).toMatchObject({ held: true, title: "Video blocked for copyright" })
    expect(publishedOutcome({ label: "Video", scheduled: false, review: null })).toEqual({
      held: false,
      title: "Video published",
      body: "It is processing now and will be watchable in a few minutes.",
    })
    expect(publishedOutcome({ label: "Video", scheduled: true, review: null }).title).toBe("Video scheduled")
    const cleared = { ...pending.copyright_review!, state: "cleared" as const }
    expect(publishedOutcome({ label: "Video", scheduled: false, review: cleared }).held).toBe(false)
  })
})

describe("report reasons", () => {
  test("videos and reels add the two copyright reasons before Other; the shared list does not", () => {
    expect(COPYRIGHT_REPORT_REASONS.map((r) => [r.value, r.label])).toEqual([
      ["copyright_mine", "Copyright: this is my content"],
      ["copyright_media", "Copyright: film, TV or music"],
    ])
    const values = VIDEO_REPORT_REASONS.map((r) => r.value)
    expect(values.slice(-3)).toEqual(["copyright_mine", "copyright_media", "other"])
    expect(VIDEO_REPORT_REASONS).toHaveLength(REPORT_REASONS.length + 2)
    expect(VIDEO_REPORT_REASONS.find((r) => r.value === "copyright_media")?.label).toBe("Copyright: film, TV or music")
    expect(REPORT_REASONS.some((r) => r.value.startsWith("copyright"))).toBe(false)
    expect(COMMENT_REPORT_REASONS.some((r) => r.value.startsWith("copyright"))).toBe(false)
    expect(reportReasonsFor("reel")).toBe(VIDEO_REPORT_REASONS)
    expect(reportReasonsFor("video")).toBe(VIDEO_REPORT_REASONS)
    expect(reportReasonsFor("post")).toBe(REPORT_REASONS)
  })

  test("a copyright report on a video files against the post", () => {
    expect(reportRequestBody({ targetType: "video", targetId: POST, reason: "copyright_media" })).toEqual({
      entity_type: "post",
      entity_id: POST,
      reason: "copyright_media",
      details: "",
    })
  })
})

describe("notifications", () => {
  const page = fixture("notification_page_copyright")

  test("the three types: the server's title, our line, the contract's links", () => {
    const { notifications } = decodeNotificationPage(page)
    expect(notifications.map((n) => [n.type, n.title, n.deep_link])).toEqual([
      ["copyright_review_hold", "Your video is in copyright review", "/posttube/hub"],
      ["copyright_review_cleared", "Your video cleared copyright review", "/posttube/watch/7a1d0000-0000-4000-8000-000000000003"],
      ["copyright_review_blocked", "Your video was blocked after copyright review", "/posttube/hub"],
    ])
    expect(notifications[0].body).toBe("Only you can see it until our team checks it. You can request a review in Creator Hub.")
    expect(notifications[1].body).toBe("It's live for everyone now.")
    expect(notifications[2].body).toBe("It stays hidden. This isn't a strike, but repeated blocks pause long-video uploads.")
  })

  test("with no server title the web's own; a hold always opens the hub", () => {
    const rows = (page as Page).data.map((r) => ({ ...r, title: undefined, deep_link: "/somewhere/else" }))
    const { notifications } = decodeNotificationPage({ data: rows })
    expect(notifications.map((n) => n.title)).toEqual([
      "Your video is in copyright review",
      "Your video cleared copyright review",
      "Your video was blocked after copyright review",
    ])
    expect(notifications.map((n) => n.deep_link)).toEqual([CREATOR_HUB_PATH, CREATOR_HUB_PATH, CREATOR_HUB_PATH])
  })

  test("the bell menus route the same way", () => {
    expect(creditNotificationHref("copyright_review_hold", "/posttube/hub")).toBe("/posttube/hub")
    expect(creditNotificationHref("copyright_review_hold", undefined)).toBe("/posttube/hub")
    expect(creditNotificationHref("copyright_review_blocked", "/tube/watch/v1")).toBe("/posttube/hub")
    expect(creditNotificationHref("copyright_review_cleared", "/tube/watch/v1")).toBe("/posttube/watch/v1")
    expect(creditNotificationHref("copyright_review_cleared", "/posttube/watch/v1")).toBe("/posttube/watch/v1")
    expect(creditNotificationHref("copyright_review_cleared", undefined)).toBe("/posttube/hub")
    expect(creditNotificationHref("copyright_review_cleared", "https://evil.example/x")).toBe("/posttube/hub")
    expect(creditNotificationHref("follow", "/u/x")).toBeUndefined()
  })

  test("only the three types", () => {
    expect(isCopyrightNotification("copyright_review_hold")).toBe(true)
    expect(isCopyrightNotification("copyright_review")).toBe(false)
    expect(copyrightNotificationCopy("post_reclassified", undefined, "/x")).toBeNull()
  })
})

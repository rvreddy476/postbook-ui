import { describe, expect, it } from "bun:test"

import {
  CREATE_POST_HREF,
  OTHER_REQUIREMENT_COPY,
  VERIFY_EMAIL_HREF,
  gateRequirements,
  goLiveGate,
  isNotEligible,
  learnMoreLines,
  parseEligibility,
  parseRequirements,
  primaryAction,
  requirementView,
  requirementsFromError,
  viewerCapNote,
  type LiveEligibility,
  type LiveRequirement,
} from "../eligibility"
import { ACCOUNT_CHECK_FAILED_COPY, NOT_ELIGIBLE_COPY, goLiveErrorCopy } from "../errors"
import { ingressErrorCopy } from "../encoder"
import { scheduleErrorCopy } from "../discovery"

/** One wire row, parsed exactly as the server sends it. */
const req = (raw: Record<string, unknown>): LiveRequirement => parseRequirements([raw])[0]!
const text = (raw: Record<string, unknown>) => requirementView(req(raw)).text
const state = (raw: Record<string, unknown>) => requirementView(req(raw)).state

const axiosErr = (status: number, code: string, details?: unknown) => ({
  response: { status, data: { error: { code, message: "raw server text", ...(details === undefined ? {} : { details }) } } },
})

describe("requirement wording: every key in every state", () => {
  it("email_verified", () => {
    expect(text({ key: "email_verified", met: true })).toBe("Email verified")
    expect(text({ key: "email_verified", met: false })).toBe("Verify your email address")
    expect(text({ key: "email_verified", met: null })).toBe("Your email address must be verified")
    expect(state({ key: "email_verified", met: true })).toBe("met")
    expect(state({ key: "email_verified", met: false })).toBe("todo")
    expect(state({ key: "email_verified", met: null })).toBe("unknown")
    expect(state({ key: "email_verified" })).toBe("unknown")
  })
  it("phone_verified (no longer sent normally; still worded if it appears)", () => {
    expect(text({ key: "phone_verified", met: true })).toBe("Your phone number is verified")
    expect(text({ key: "phone_verified", met: false })).toBe("Verify your phone number")
    expect(text({ key: "phone_verified", met: null })).toBe("Your phone number must be verified")
  })
  it("adult", () => {
    expect(text({ key: "adult", met: true })).toBe("You're 18 or over")
    expect(text({ key: "adult", met: false })).toBe("You must be 18 or over to go live")
    expect(text({ key: "adult", met: null })).toBe("You must be 18 or over")
  })
  it("good_standing", () => {
    expect(text({ key: "good_standing", met: true })).toBe("Your account is in good standing")
    expect(text({ key: "good_standing", met: false })).toBe("Your account isn't in good standing right now")
    expect(text({ key: "good_standing", met: null })).toBe("Your account must be in good standing")
  })
  it("account_age in days: what is needed and how long is left", () => {
    expect(text({ key: "account_age", met: false, current: 2, needed: 7, unit: "days" })).toBe("Your account must be 7 days old (5 days to go)")
    expect(text({ key: "account_age", met: false, current: 6, needed: 7, unit: "days" })).toBe("Your account must be 7 days old (1 day to go)")
    expect(text({ key: "account_age", met: false, current: 0, needed: 1, unit: "days" })).toBe("Your account must be 1 day old (1 day to go)")
    expect(text({ key: "account_age", met: true, current: 30, needed: 7, unit: "days" })).toBe("Your account is at least 7 days old")
  })
  it("account_age in hours", () => {
    expect(text({ key: "account_age", met: false, current: 8, needed: 12, unit: "hours" })).toBe("Your account must be 12 hours old (4 hours to go)")
    expect(text({ key: "account_age", met: false, current: 0, needed: 1, unit: "hours" })).toBe("Your account must be 1 hour old (1 hour to go)")
    expect(text({ key: "account_age", met: true, current: 20, needed: 12, unit: "hours" })).toBe("Your account is at least 12 hours old")
  })
  it("account_age that could not be checked: no count, no time left (current is omitted)", () => {
    expect(text({ key: "account_age", met: null, needed: 7, unit: "days" })).toBe("Your account must be 7 days old")
    expect(state({ key: "account_age", met: null, needed: 7, unit: "days" })).toBe("unknown")
    // Not met but the count is missing: never a made-up "7 days to go".
    expect(text({ key: "account_age", met: false, needed: 7, unit: "days" })).toBe("Your account must be 7 days old")
    expect(text({ key: "account_age", met: false })).toBe("Your account must be a little older")
    expect(text({ key: "account_age", met: true })).toBe("Your account is old enough")
  })
  it("activity: posts or followers, with both counts", () => {
    const row = { key: "activity", met: false, posts: { current: 1, needed: 3 }, followers: { current: 4, needed: 10 } }
    expect(text(row)).toBe("Publish 3 posts or reach 10 followers (1 of 3 posts, 4 of 10 followers)")
    expect(text({ ...row, met: true })).toBe("You have enough posts or followers")
  })
  it("activity: an unknown count is omitted, and left out of the sentence", () => {
    expect(text({ key: "activity", met: false, posts: { current: 1, needed: 3 }, followers: { needed: 10 } })).toBe(
      "Publish 3 posts or reach 10 followers (1 of 3 posts)",
    )
    expect(text({ key: "activity", met: null, posts: { needed: 3 }, followers: { needed: 10 } })).toBe("Publish 3 posts or reach 10 followers")
    expect(text({ key: "activity", met: false, posts: { needed: 3 }, followers: { needed: 10 } })).toBe("Publish 3 posts or reach 10 followers")
    // Even with counts, a row that could not be checked shows no progress.
    expect(text({ key: "activity", met: null, posts: { current: 1, needed: 3 }, followers: { current: 4, needed: 10 } })).toBe(
      "Publish 3 posts or reach 10 followers",
    )
  })
  it("activity: one side switched off, and singular counts", () => {
    expect(text({ key: "activity", met: false, posts: { current: 0, needed: 1 } })).toBe("Publish 1 post (0 of 1 post)")
    expect(text({ key: "activity", met: false, followers: { current: 4, needed: 10 } })).toBe("Reach 10 followers (4 of 10 followers)")
    expect(text({ key: "activity", met: false, posts: { current: 2, needed: 3 }, followers: { current: 0, needed: 0 } })).toBe("Publish 3 posts (2 of 3 posts)")
    expect(text({ key: "activity", met: false })).toBe("Publish a few posts or gain some followers")
  })
  it("states: true is met, false is still to do, anything else could not be checked", () => {
    expect(state({ key: "adult", met: true })).toBe("met")
    expect(state({ key: "adult", met: false })).toBe("todo")
    expect(state({ key: "adult", met: null })).toBe("unknown")
    expect(state({ key: "adult" })).toBe("unknown")
    expect(state({ key: "adult", met: "true" })).toBe("unknown")
  })
  it("a requirement this build has no words for is still listed, never as its key", () => {
    const view = requirementView(req({ key: "two_factor", met: false }))
    expect(view.text).toBe(OTHER_REQUIREMENT_COPY)
    expect(view.text).not.toContain("two_factor")
    expect(view.state).toBe("todo")
  })
})

describe("the one primary button", () => {
  const rows = (...raw: Record<string, unknown>[]) => parseRequirements(raw)
  it("activity not met → Create a post, at the existing composer", () => {
    expect(primaryAction(rows({ key: "phone_verified", met: true }, { key: "activity", met: false }))).toEqual({
      kind: "link", key: "activity", label: "Create a post", href: CREATE_POST_HREF,
    })
    expect(CREATE_POST_HREF).toBe("/create/post")
  })
  it("email not verified → Verify email", () => {
    expect(primaryAction(rows({ key: "email_verified", met: false }, { key: "adult", met: true }))).toEqual({
      kind: "link", key: "email_verified", label: "Verify email", href: VERIFY_EMAIL_HREF,
    })
    expect(VERIFY_EMAIL_HREF).toBe("/settings/security")
  })
  it("email and activity both unmet → whichever the server lists first (email)", () => {
    const email = { key: "email_verified", met: false }
    const activity = { key: "activity", met: false, posts: { current: 1, needed: 3 } }
    expect(primaryAction(rows(email, { key: "account_age", met: false }, activity))).toMatchObject({ key: "email_verified", label: "Verify email" })
    // The order is the server's, not a ranking in this file.
    expect(primaryAction(rows(activity, email))).toMatchObject({ key: "activity", label: "Create a post" })
  })
  it("email that is verified, or that could not be checked, never offers Verify email", () => {
    const activity = { key: "activity", met: false }
    expect(primaryAction(rows({ key: "email_verified", met: true }, activity))).toMatchObject({ key: "activity" })
    expect(primaryAction(rows({ key: "email_verified", met: null }, activity))).toMatchObject({ key: "activity" })
    expect(primaryAction(rows({ key: "email_verified", met: true })).kind).toBe("recheck")
    expect(primaryAction(rows({ key: "email_verified", met: null })).kind).toBe("recheck")
  })
  it("the first unmet requirement WITH an action wins over earlier ones without", () => {
    const action = primaryAction(rows({ key: "account_age", met: false, current: 2, needed: 7, unit: "days" }, { key: "activity", met: false }))
    expect(action.kind).toBe("link")
  })
  it("nothing actionable → Check again", () => {
    expect(primaryAction(rows({ key: "account_age", met: false, current: 2, needed: 7, unit: "days" }))).toEqual({ kind: "recheck", label: "Check again" })
    expect(primaryAction(rows({ key: "phone_verified", met: false }, { key: "adult", met: false }, { key: "good_standing", met: false })).kind).toBe("recheck")
    expect(primaryAction([]).kind).toBe("recheck")
  })
  it("activity that is met, or that could not be checked, never offers Create a post", () => {
    expect(primaryAction(rows({ key: "activity", met: true }, { key: "account_age", met: false })).kind).toBe("recheck")
    expect(primaryAction(rows({ key: "activity", met: null })).kind).toBe("recheck")
  })
})

describe("which screen a go-live entry shows", () => {
  const elig = (patch: Partial<LiveEligibility>): LiveEligibility => ({ mode: "open", eligible: false, pilot_only: false, requirements: [], viewer_cap: null, ...patch })
  it("eligible → the form, in either mode", () => {
    expect(goLiveGate({ loading: false, eligibility: elig({ eligible: true }) })).toBe("form")
    expect(goLiveGate({ loading: false, eligibility: elig({ eligible: true, mode: "pilot" }) })).toBe("form")
  })
  it("pilot: not on the list → the closed-pilot notice, never the panel", () => {
    expect(goLiveGate({ loading: false, eligibility: elig({ mode: "pilot", pilot_only: true }) })).toBe("pilot")
    expect(goLiveGate({ loading: false, eligibility: elig({ mode: "pilot" }) })).toBe("pilot")
    expect(goLiveGate({ loading: false, eligibility: elig({ mode: "open", pilot_only: true }) })).toBe("pilot")
  })
  it("open: not eligible → the nearly-ready panel", () => {
    expect(goLiveGate({ loading: false, eligibility: elig({ mode: "open" }) })).toBe("nearly")
  })
  it("the eligibility call failed → the form (the server still decides)", () => {
    expect(goLiveGate({ loading: false, eligibility: null })).toBe("form")
    expect(goLiveGate({ loading: false, eligibility: undefined })).toBe("form")
  })
  it("still asking → neither the form nor a refusal", () => {
    expect(goLiveGate({ loading: true, eligibility: undefined })).toBe("loading")
  })
  it("a refusal on submit wins over the earlier answer", () => {
    const ok = elig({ eligible: true })
    expect(goLiveGate({ loading: false, eligibility: ok, pilotRefused: true })).toBe("pilot")
    expect(goLiveGate({ loading: false, eligibility: ok, refused: [] })).toBe("nearly")
    expect(goLiveGate({ loading: false, eligibility: null, refused: parseRequirements([{ key: "adult", met: false }]) })).toBe("nearly")
    expect(goLiveGate({ loading: true, eligibility: undefined, refused: [] })).toBe("nearly")
  })
  it("the panel lists the refusal's rows, else the eligibility answer's", () => {
    const refused = parseRequirements([{ key: "adult", met: false }])
    const answer = elig({ requirements: parseRequirements([{ key: "phone_verified", met: true }, { key: "adult", met: false }]) })
    expect(gateRequirements(refused, answer).map((r) => r.key)).toEqual(["adult"])
    expect(gateRequirements(null, answer).map((r) => r.key)).toEqual(["phone_verified", "adult"])
    expect(gateRequirements([], answer).map((r) => r.key)).toEqual(["phone_verified", "adult"])
    expect(gateRequirements(null, null)).toEqual([])
  })
})

// Inline until the backend's golden files carry the row (contract 2 Oct 2026:
// `email_verified` listed first, `phone_verified` normally not sent).
describe("the email row, as the server sends it", () => {
  const body = {
    data: {
      mode: "open",
      eligible: false,
      requirements: [
        { key: "email_verified", met: false },
        { key: "adult", met: true },
        { key: "account_age", met: false, current: 2, needed: 7, unit: "days" },
        { key: "activity", met: false, posts: { current: 1, needed: 3 }, followers: { current: 4, needed: 10 } },
        { key: "good_standing", met: true },
      ],
    },
  }
  it("GET /eligibility: listed first, worded, and the button is Verify email", () => {
    const e = parseEligibility(body)!
    expect(goLiveGate({ loading: false, eligibility: e })).toBe("nearly")
    expect(e.requirements.map(requirementView).slice(0, 2)).toEqual([
      { key: "email_verified", state: "todo", text: "Verify your email address" },
      { key: "adult", state: "met", text: "You're 18 or over" },
    ])
    expect(primaryAction(e.requirements)).toEqual({ kind: "link", key: "email_verified", label: "Verify email", href: VERIFY_EMAIL_HREF })
  })
  it("403 LIVE_NOT_ELIGIBLE: an email row that could not be checked is listed, without the button", () => {
    const rows = requirementsFromError(axiosErr(403, "LIVE_NOT_ELIGIBLE", { requirements: [{ key: "email_verified", met: null }, { key: "activity", met: false }] }))!
    expect(requirementView(rows[0]!)).toEqual({ key: "email_verified", state: "unknown", text: "Your email address must be verified" })
    expect(primaryAction(rows)).toMatchObject({ key: "activity" })
  })
})

describe("403 LIVE_NOT_ELIGIBLE → the panel's rows", () => {
  const details = { requirements: [{ key: "account_age", met: false, current: 2, needed: 7, unit: "days" }, { key: "phone_verified", met: null }] }
  it("reads error.details.requirements, unknown rows included", () => {
    const rows = requirementsFromError(axiosErr(403, "LIVE_NOT_ELIGIBLE", details))
    expect(rows?.map((r) => [r.key, r.met])).toEqual([["account_age", false], ["phone_verified", null]])
    expect(requirementView(rows![0]!).text).toBe("Your account must be 7 days old (5 days to go)")
  })
  it("branches on the code, not on the status or the message", () => {
    expect(requirementsFromError(axiosErr(403, "LIVE_NOT_ENABLED", details))).toBeNull()
    expect(requirementsFromError(axiosErr(403, "LIVE_BANNED", details))).toBeNull()
    expect(requirementsFromError(axiosErr(503, "AUTHORITY_UNAVAILABLE"))).toBeNull()
    expect(requirementsFromError(new Error("LIVE_NOT_ELIGIBLE"))).toBeNull()
    expect(requirementsFromError(null)).toBeNull()
    expect(isNotEligible(axiosErr(403, "LIVE_NOT_ELIGIBLE"))).toBe(true)
    expect(isNotEligible(axiosErr(403, "FORBIDDEN"))).toBe(false)
  })
  it("a refusal without the list is still the panel (no rows), not an error", () => {
    expect(requirementsFromError(axiosErr(403, "LIVE_NOT_ELIGIBLE"))).toEqual([])
    expect(requirementsFromError(axiosErr(403, "LIVE_NOT_ELIGIBLE", { requirements: null }))).toEqual([])
  })
  it("where there is no panel, the refusals have sentences; 503 reads as retryable", () => {
    expect(goLiveErrorCopy(axiosErr(403, "LIVE_NOT_ELIGIBLE"))).toBe(NOT_ELIGIBLE_COPY)
    expect(goLiveErrorCopy(axiosErr(503, "AUTHORITY_UNAVAILABLE"))).toBe("We couldn't check your account just now. Try again.")
    expect(ingressErrorCopy(axiosErr(503, "AUTHORITY_UNAVAILABLE"))).toBe(ACCOUNT_CHECK_FAILED_COPY)
    expect(ingressErrorCopy(axiosErr(403, "LIVE_NOT_ELIGIBLE"))).toBe(NOT_ELIGIBLE_COPY)
    expect(scheduleErrorCopy(axiosErr(503, "AUTHORITY_UNAVAILABLE"))).toBe(ACCOUNT_CHECK_FAILED_COPY)
    expect(scheduleErrorCopy(axiosErr(403, "LIVE_NOT_ELIGIBLE"))).toBe(NOT_ELIGIBLE_COPY)
  })
})

describe("parsing the eligibility answer", () => {
  it("an unreadable answer is null, so the caller falls back to the form", () => {
    expect(parseEligibility(null)).toBeNull()
    expect(parseEligibility({})).toBeNull()
    expect(parseEligibility({ data: null })).toBeNull()
    expect(parseEligibility({ data: { mode: "open" } })).toBeNull()
    expect(parseEligibility({ data: { mode: "open", eligible: "yes" } })).toBeNull()
    expect(parseEligibility({ error: { code: "UNAUTHORIZED" } })).toBeNull()
  })
  it("omitted fields: no pilot_only, no viewer_cap, no requirements", () => {
    expect(parseEligibility({ data: { mode: "open", eligible: true } })).toEqual({ mode: "open", eligible: true, pilot_only: false, requirements: [], viewer_cap: null })
    expect(parseEligibility({ data: { mode: "open", eligible: true, viewer_cap: 0 } })?.viewer_cap).toBeNull()
  })
  it("rows without a key are dropped; omitted counts read as null, never 0", () => {
    const rows = parseRequirements([{ met: false }, null, "x", { key: "account_age", met: null, needed: 7, unit: "days" }])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({ key: "account_age", met: null, current: null, needed: 7, unit: "days", posts: null, followers: null })
    expect(parseRequirements(null)).toEqual([])
  })
})

describe("small print", () => {
  it("the viewer cap note, only while a cap applies", () => {
    expect(viewerCapNote(200)).toBe("Your first streams are limited to 200 viewers.")
    expect(viewerCapNote(1)).toBe("Your first streams are limited to 1 viewer.")
    expect(viewerCapNote(null)).toBe("")
    expect(viewerCapNote(undefined)).toBe("")
    expect(viewerCapNote(0)).toBe("")
  })
  it("Learn more mentions an unfinished check only when there is one", () => {
    const known = parseRequirements([{ key: "adult", met: false }])
    const unknown = parseRequirements([{ key: "adult", met: null }])
    expect(learnMoreLines(known).join(" ")).not.toContain("couldn't complete")
    expect(learnMoreLines(unknown).join(" ")).toContain("couldn't complete")
    expect(learnMoreLines(known, 200).at(-1)).toBe("Your first streams are limited to 200 viewers.")
    // Verification is by email now: the small print never asks for a phone.
    const all = learnMoreLines(parseRequirements([{ key: "email_verified", met: false }, { key: "adult", met: null }]), 200).join(" ")
    expect(all.toLowerCase()).not.toContain("phone")
  })
})

import { describe, expect, test } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { CheckinCards, CheckinDone, CheckinEntry, CheckinForm, SAFETY_HREF } from "../components/DateCheckin"
import { PastMatchList } from "../components/PastMatches"
import {
  checkinBody,
  checkinCardTitle,
  checkinDone,
  checkinHref,
  checkinRefusal,
  chooseMet,
  EMPTY_CHECKIN,
  showFollowUps,
  supportLine,
  toDateCheckins,
  toDateFeedback,
  wantsCheckin,
  type CheckinForm as Form,
} from "../model/dateCheckin"
import { copyFor, datingErrorCopy, KNOWN_ERROR_CODES } from "../model/errors"
import { endedLabel, endedLine, markReported, NO_PAST_MATCHES, pastMatchesSub, pastMatchName, toPastMatches } from "../model/pastMatches"
import { errorFromEnvelope } from "../model/wire"

import { readFixture } from "./contractFixtures"

const html = (node: React.ReactElement) => renderToStaticMarkup(node)
const noop = () => {}
const has = (out: string, text: string) => out.includes(text.replaceAll("'", "&#x27;"))
const axiosError = (status: number, code: string) => ({ response: { status, data: { error: { code, message: "developer words" } } } })

/* ── M14 after-date check-in ─────────────────────────────────────── */

describe("check-ins: reading the asks", () => {
  test("Go's zeros: no first name, no time; a row without a match id is dropped; null is none", () => {
    expect(toDateCheckins(null)).toEqual([])
    expect(toDateCheckins([{ match_id: "m1", person: { user_id: "u1" } }, { meet_id: "x" }])).toEqual([{ matchId: "m1", meetId: "", person: { userId: "u1", firstName: "" }, askedAt: "" }])
  })

  test("the card title names the person, or not", () => {
    expect(checkinCardTitle("Asha")).toBe("How did it go with Asha?")
    expect(checkinCardTitle("")).toBe("How did your date go?")
  })

  test("the deep link, and reading it back", () => {
    expect(checkinHref("m 1")).toBe("/dating/matches/m%201?checkin=1")
    expect(wantsCheckin("1")).toBe(true)
    expect(wantsCheckin(["1", "0"])).toBe(true)
    expect(wantsCheckin("0")).toBe(false)
    expect(wantsCheckin("")).toBe(false)
    expect(wantsCheckin(undefined)).toBe(false)
  })
})

describe("check-ins: the answers", () => {
  test("nothing is sent until 'did you meet' is answered", () => {
    expect(checkinBody(EMPTY_CHECKIN)).toBeNull()
  })

  test("the follow-ups appear only after yes, and are optional", () => {
    let f: Form = chooseMet(EMPTY_CHECKIN, "yes")
    expect(showFollowUps(f)).toBe(true)
    expect(checkinBody(f)).toEqual({ met: "yes" })
    f = { ...f, again: "unsure" }
    expect(checkinBody(f)).toEqual({ met: "yes", again: "unsure" })
    f = { ...f, feltSafe: false }
    expect(checkinBody(f)).toEqual({ met: "yes", again: "unsure", felt_safe: false })
  })

  test("no or not yet clears the follow-ups, so they are never sent with it", () => {
    const yes: Form = { met: "yes", again: "yes", feltSafe: true }
    for (const met of ["no", "not_yet"] as const) {
      const f = chooseMet(yes, met)
      expect(showFollowUps(f)).toBe(false)
      expect(checkinBody(f)).toEqual({ met })
    }
    // Even a stale form never sends them without yes.
    expect(checkinBody({ met: "no", again: "yes", feltSafe: false })).toEqual({ met: "no" })
  })

  test("the result: felt_safe absent is unanswered; offer_report decides the next step", () => {
    expect(toDateFeedback({ match_id: "m", met: "not_yet" })).toEqual({ matchId: "m", met: "not_yet", again: "", feltSafe: null, createdAt: "", offerReport: false })
    expect(checkinDone(toDateFeedback({ met: "not_yet" }))).toEqual({ kind: "thanks", line: "Thanks. You can tell us later from your match." })
    expect(checkinDone(toDateFeedback({ met: "no" })).kind).toBe("thanks")
    expect(checkinDone(toDateFeedback(readFixture("date_feedback_post_201_unsafe").data))).toEqual({ kind: "report" })
  })

  test("refusals: invalid inline, limit is 'already told us', any 404 hides it", () => {
    expect(checkinRefusal(axiosError(400, "INVALID_DATE_FEEDBACK"))).toBe("invalid")
    expect(checkinRefusal(axiosError(429, "DATE_FEEDBACK_LIMIT"))).toBe("limit")
    expect(checkinRefusal(axiosError(404, "MECHANIC_NOT_ENABLED"))).toBe("off")
    expect(checkinRefusal(axiosError(404, "MATCH_NOT_FOUND"))).toBe("off")
    expect(checkinRefusal(axiosError(500, "DATE_FEEDBACK_FAILED"))).toBe("other")
    expect(datingErrorCopy(axiosError(429, "DATE_FEEDBACK_LIMIT"))).toBe("You've already told us how this one went. Thank you.")
    expect(copyFor(errorFromEnvelope(readFixture("date_feedback_post_400_invalid")))).not.toContain("met must be")
    expect(KNOWN_ERROR_CODES).toEqual(expect.arrayContaining(["DATE_FEEDBACK_LIMIT", "INVALID_DATE_FEEDBACK"]))
  })
})

describe("check-ins: the screens", () => {
  test("matches page: one card per ask, each to the match's sheet; none, nothing", () => {
    const items = toDateCheckins([...(readFixture("date_checkins_get_200").data as object[]), { match_id: "m2", person: { user_id: "u2" } }])
    const out = html(<CheckinCards items={items} />)
    expect((out.match(/class="pulse-checkin"/g) ?? []).length).toBe(2)
    expect(out).toContain("How did it go with Asha?")
    expect(out).toContain("How did your date go?")
    expect(out).toContain('href="/dating/matches/%3Cmatch%3E?checkin=1"')
    expect(out).toContain('href="/dating/matches/m2?checkin=1"')
    expect(html(<CheckinCards items={[]} />)).toBe("")
  })

  test("the match page's own way in", () => {
    const out = html(<CheckinEntry onOpen={noop} />)
    expect(out).toContain(">We met<")
  })

  const form = (f: Form) => html(<CheckinForm name="Asha" form={f} error="" busy={false} onMet={noop} onAgain={noop} onSafe={noop} onSubmit={noop} onCancel={noop} />)

  test("the sheet: only 'did you meet' first, Send off until it's answered", () => {
    const out = form(EMPTY_CHECKIN)
    expect(out).toContain("Did you meet Asha?")
    expect(out).toContain(">Not yet<")
    expect(out).not.toContain("Would you meet again?")
    expect(out).not.toContain("Did you feel safe?")
    expect(out).toMatch(/<button type="submit"[^>]*disabled=""/)
  })

  test("after yes: the two optional questions, answers shown as picked", () => {
    const out = form({ met: "yes", again: "unsure", feltSafe: false })
    expect(out).toContain("Would you meet again? (optional)")
    expect(out).toContain("Did you feel safe? (optional)")
    expect(out).toMatch(/name="checkin-again" checked="" value="unsure"/)
    expect(out).toMatch(/name="checkin-safe" checked="" value="no"/)
    expect(out).not.toMatch(/<button type="submit"[^>]*disabled=""/)
  })

  test("an inline error", () => {
    const out = html(<CheckinForm name="Asha" form={EMPTY_CHECKIN} error="That answer didn't go through." busy={false} onMet={noop} onAgain={noop} onSafe={noop} onSubmit={noop} onCancel={noop} />)
    expect(has(out, "That answer didn't go through.")).toBe(true)
    expect(out).toContain('role="alert"')
  })

  test("done, safe: thanks and nothing to report", () => {
    const out = html(<CheckinDone report={false} line="Thanks for telling us." name="Asha" canReport onReport={noop} onClose={noop} />)
    expect(out).toContain("Thanks for telling us.")
    expect(out).not.toContain("Report Asha")
  })

  test("done, not safe: support, Report {name} and the safety page", () => {
    const out = html(<CheckinDone report line="" name="Asha" canReport onReport={noop} onClose={noop} />)
    expect(has(out, supportLine("Asha"))).toBe(true)
    expect(out).toContain(">Report Asha<")
    expect(out).toContain(`href="${SAFETY_HREF}"`)
    // No one to report (the person has gone): the support stays, the button doesn't.
    expect(html(<CheckinDone report line="" name="Asha" canReport={false} onReport={noop} onClose={noop} />)).not.toContain("Report Asha")
  })
})

/* ── M19 past matches ────────────────────────────────────────────── */

describe("past matches: reading", () => {
  test("Go's zeros: no name is 'Someone'; a row with no one to report is dropped; window absent is 0", () => {
    const past = toPastMatches({ data: [{ match_id: "m1", person: { user_id: "u1" }, ended: "expired" }, { match_id: "m2", person: {} }], meta: {} })
    expect(past.windowDays).toBe(0)
    expect(past.items).toHaveLength(1)
    expect(pastMatchName(past.items[0])).toBe("Someone")
    expect(past.items[0].reported).toBe(false)
    expect(toPastMatches(null)).toEqual({ items: [], windowDays: 0 })
    expect(pastMatchesSub(0)).toBe("Matches that ended recently.")
  })

  test("how it ended, in our words, with the date when it parses", () => {
    expect(["unmatched", "blocked", "expired", "closed", "", "mystery"].map(endedLabel)).toEqual(["Unmatched", "Blocked", "Ran out of time", "Closed", "Ended", "Ended"])
    expect(endedLine({ ended: "blocked", endedAt: "" })).toBe("Blocked")
    expect(endedLine({ ended: "unmatched", endedAt: "2026-10-02T10:00:00Z" }, "en-GB")).toBe("Unmatched · 2 Oct")
  })

  test("a report marks the row at once", () => {
    const past = toPastMatches(readFixture("past_matches_get_200"))
    expect(markReported(past, "<other>").items[0].reported).toBe(true)
    expect(markReported(past, "someone-else").items[0].reported).toBe(false)
  })
})

describe("past matches: the safety page section", () => {
  test("a row per match: name, how it ended, Report; reported rows say so instead", () => {
    const base = toPastMatches(readFixture("past_matches_get_200")).items[0]
    const items = [base, { ...base, matchId: "m2", person: { userId: "u2", firstName: "" }, ended: "blocked", reported: true }]
    const out = html(<PastMatchList items={items} onReport={noop} />)
    expect(out).toContain(">Asha<")
    expect(out).toContain(">Unmatched<")
    expect(out).toContain('aria-label="Report Asha"')
    expect(out).toContain(">Someone<")
    expect(out).toContain(">Blocked<")
    expect(out).toContain(">Reported<")
    expect((out.match(/>Report</g) ?? []).length).toBe(1)
  })

  test("empty: one short line", () => {
    const out = html(<PastMatchList items={[]} onReport={noop} />)
    expect(out).toContain(NO_PAST_MATCHES)
    expect(out).not.toContain("<button")
  })
})

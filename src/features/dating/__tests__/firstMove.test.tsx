import { describe, expect, test } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { AnswerSent, ExtendLimitNotice, FIRST_MOVE_TOGGLE_HELP, FirstMoveEditor, FirstMoveStatus, NO_ANSWER, OpeningQuestionList } from "../components/FirstMove"
import { copyFor, datingErrorCopy, GENERIC_COPY, KNOWN_ERROR_CODES } from "../model/errors"
import {
  answerRefusalRefetches,
  charCount,
  cleanQuestions,
  counterLine,
  firstMoveBody,
  firstMoveListLine,
  firstMoveState,
  isFirstMoveOff,
  openingAnswerBody,
  openingAnswerCopy,
  openingAnswerProblem,
  questionsChanged,
  questionsProblem,
  spanUntil,
  toFirstMoveSettings,
  toFirstMoveView,
  type FirstMoveSettings,
  type FirstMoveState,
} from "../model/firstMove"
import { extendedLine, extendLimitLine, toExtendLimit, toExtendResult, toMatch } from "../model/matches"
import { toDatingError } from "../model/wire"
import { MatchList, matchListLine } from "../screens/HomeScreen"
import { matchControls, WaitingPanel } from "../screens/MatchScreen"

import { readFixture } from "./contractFixtures"

const html = (node: React.ReactElement) => renderToStaticMarkup(node)
const noop = () => {}
const axiosError = (status: number, code: string, details?: Record<string, unknown>) => ({ response: { status, data: { error: { code, message: "developer words", details } } } })

const NOW = Date.parse("2026-10-02T10:00:00Z")
const IN_5H = "2026-10-02T15:10:00Z"
const PAST = "2026-10-02T09:00:00Z"

const base = { status: "matched", firstMessageAt: "", expiresAt: IN_5H }
const waitingView = { youMoveFirst: false, deadline: IN_5H, openingQuestions: [{ id: "q1", text: "Tea or coffee?" }, { id: "q2", text: "Best street food?" }], canExtend: true }
const yoursView = { youMoveFirst: true, deadline: IN_5H, openingQuestions: [], canExtend: false }

describe("first move: the match view", () => {
  test("absent, null or not an object is a normal match", () => {
    for (const w of [undefined, null, "", 0, [], "yes"]) expect(toFirstMoveView(w)).toBeNull()
    const m = toMatch({ id: "m1", status: "matched", expires_at: IN_5H })!
    expect(m.firstMove).toBeNull()
    expect(firstMoveState(m, NOW)).toEqual({ kind: "none" })
  })

  test("Go zero values: an empty member is someone waiting, with nothing to answer and no free time", () => {
    expect(toFirstMoveView({})).toEqual({ youMoveFirst: false, deadline: "", openingQuestions: [], canExtend: false })
    expect(toFirstMoveView({ you_move_first: "true", can_extend: 1 })).toEqual({ youMoveFirst: false, deadline: "", openingQuestions: [], canExtend: false })
  })

  test("questions without an id or text are dropped; a first mover never gets questions or the free extend", () => {
    const v = toFirstMoveView({ you_move_first: false, can_extend: true, opening_questions: [{ id: "q1", text: " Hi? " }, { id: "", text: "x" }, { id: "q3", text: "" }, null] })!
    expect(v.openingQuestions).toEqual([{ id: "q1", text: "Hi?" }])
    expect(v.canExtend).toBe(true)
    const mover = toFirstMoveView({ you_move_first: true, can_extend: true, opening_questions: [{ id: "q1", text: "Hi?" }] })!
    expect(mover.openingQuestions).toEqual([])
    expect(mover.canExtend).toBe(false)
  })

  test("the state: yours, waiting, expired, and none once someone wrote or the match closed", () => {
    expect(firstMoveState({ ...base, firstMove: yoursView }, NOW)).toEqual({ kind: "yours", left: "5h 10m" })
    expect(firstMoveState({ ...base, firstMove: waitingView }, NOW)).toEqual({ kind: "waiting", left: "5h 10m", questions: waitingView.openingQuestions, canExtend: true })
    expect(firstMoveState({ ...base, firstMove: { ...waitingView, canExtend: false } }, NOW)).toMatchObject({ kind: "waiting", canExtend: false })
    expect(firstMoveState({ ...base, firstMove: { ...yoursView, deadline: PAST } }, NOW)).toEqual({ kind: "expired" })
    expect(firstMoveState({ ...base, firstMessageAt: PAST, firstMove: yoursView }, NOW)).toEqual({ kind: "none" })
    expect(firstMoveState({ ...base, status: "closed", firstMove: yoursView }, NOW)).toEqual({ kind: "none" })
  })

  test("no deadline on the member falls back to the match's expiry; neither means no time shown", () => {
    expect(firstMoveState({ ...base, firstMove: { ...yoursView, deadline: "" } }, NOW)).toEqual({ kind: "yours", left: "5h 10m" })
    expect(firstMoveState({ ...base, expiresAt: "", firstMove: { ...yoursView, deadline: "" } }, NOW)).toEqual({ kind: "yours", left: "" })
  })

  test("time left", () => {
    expect(spanUntil("2026-10-03T12:30:00Z", NOW)).toBe("1d 2h")
    expect(spanUntil("2026-10-02T10:00:20Z", NOW)).toBe("1m")
    expect(spanUntil(PAST, NOW)).toBe("")
    expect(spanUntil("", NOW)).toBe("")
  })

  test("the matches list line", () => {
    expect(firstMoveListLine({ kind: "yours", left: "5h 10m" })).toBe("You start · 5h 10m left")
    expect(firstMoveListLine({ kind: "waiting", left: "5h 10m", questions: [], canExtend: false })).toBe("Waiting for them · 5h 10m left")
    expect(firstMoveListLine({ kind: "yours", left: "" })).toBe("You start")
    expect(firstMoveListLine({ kind: "expired" })).toBe("Out of time")
    expect(firstMoveListLine({ kind: "none" })).toBe("")
  })
})

describe("first move: settings", () => {
  test("Go zero values: absent limits fall back to the server's own", () => {
    expect(toFirstMoveSettings({})).toEqual({ enabled: false, questions: [], maxQuestions: 3, maxLength: 140 })
    expect(toFirstMoveSettings({ enabled: true, questions: null, max_questions: 0, max_length: 0 })).toEqual({ enabled: true, questions: [], maxQuestions: 3, maxLength: 140 })
  })

  test("the PUT body: absent fields are left out, questions trimmed and blanks dropped, [] clears", () => {
    expect(firstMoveBody({ enabled: true })).toEqual({ enabled: true })
    expect(firstMoveBody({ enabled: false })).toEqual({ enabled: false })
    expect(firstMoveBody({ questions: [" Tea? ", "", "  "] })).toEqual({ questions: ["Tea?"] })
    expect(firstMoveBody({ questions: [] })).toEqual({ questions: [] })
    expect(JSON.stringify(firstMoveBody({}))).toBe("{}")
  })

  test("the drafts' problems use the server's limits and count characters as it does", () => {
    expect(questionsProblem(["a", "b", "c"], 3, 140)).toBe("")
    expect(questionsProblem(["a", "b", "c", "d"], 3, 140)).toBe("You can have up to 3 questions.")
    expect(questionsProblem(["a", "", "b", "c", " "], 3, 140)).toBe("")
    expect(questionsProblem(["x".repeat(141)], 3, 140)).toBe("Keep each question to 140 characters.")
    // An emoji is one character to the server, two UTF-16 units to JavaScript.
    expect(charCount("😀")).toBe(1)
    expect(questionsProblem(["😀".repeat(140)], 3, 140)).toBe("")
    expect(counterLine("  Tea?  ", 140)).toBe("4/140")
    expect(cleanQuestions([" a ", ""])).toEqual(["a"])
  })

  test("changed or not", () => {
    const saved = [{ id: "1", text: "Tea?" }]
    expect(questionsChanged(saved, ["Tea?"])).toBe(false)
    expect(questionsChanged(saved, ["Tea? ", ""])).toBe(false)
    expect(questionsChanged(saved, ["Coffee?"])).toBe(true)
    expect(questionsChanged(saved, [])).toBe(true)
  })

  test("off is MECHANIC_NOT_ENABLED only", () => {
    expect(isFirstMoveOff(axiosError(404, "MECHANIC_NOT_ENABLED"))).toBe(true)
    expect(isFirstMoveOff(axiosError(404, "NOT_FOUND"))).toBe(false)
    expect(isFirstMoveOff(new Error("offline"))).toBe(false)
  })

  test("refusals in our own words, with the server's limits", () => {
    expect(datingErrorCopy(axiosError(400, "OPENING_QUESTIONS_TOO_MANY", { max: 3 }))).toBe("You can have up to 3 questions.")
    expect(datingErrorCopy(axiosError(400, "OPENING_QUESTION_INVALID", { max_length: 140 }))).toBe("Each question needs 1 to 140 characters.")
    expect(datingErrorCopy(axiosError(400, "OPENING_QUESTION_INVALID"))).not.toContain("0")
    expect(datingErrorCopy(axiosError(400, "OPENING_QUESTION_REFUSED"))).toContain("phone numbers, emails or links")
    for (const code of ["CHAT_UNAVAILABLE", "EXTEND_LIMIT_REACHED", "FIRST_MOVE_NOT_PENDING", "FIRST_MOVE_PENDING", "OPENING_ANSWER_INVALID", "OPENING_ANSWER_REFUSED", "OPENING_QUESTION_INVALID", "OPENING_QUESTION_REFUSED", "OPENING_QUESTION_UNKNOWN", "OPENING_QUESTIONS_TOO_MANY"]) {
      expect(KNOWN_ERROR_CODES).toContain(code)
      expect(copyFor(toDatingError(axiosError(400, code)))).not.toBe(GENERIC_COPY)
    }
    expect(datingErrorCopy(axiosError(403, "FIRST_MOVE_PENDING"))).toContain("Your match starts this chat")
  })
})

describe("first move: the opening answer", () => {
  test("body, problems and counter limit", () => {
    expect(openingAnswerBody("q1", "  Masala chai.  ")).toEqual({ question_id: "q1", answer: "Masala chai." })
    expect(openingAnswerProblem("   ")).toBe("Write an answer first.")
    expect(openingAnswerProblem("x".repeat(500))).toBe("")
    expect(openingAnswerProblem("x".repeat(501))).toBe("Keep your answer to 500 characters.")
  })

  test("refusals: which re-read the match, and the words", () => {
    expect(answerRefusalRefetches(toDatingError(axiosError(409, "FIRST_MOVE_NOT_PENDING")))).toBe(true)
    expect(answerRefusalRefetches(toDatingError(axiosError(404, "OPENING_QUESTION_UNKNOWN")))).toBe(true)
    expect(answerRefusalRefetches(toDatingError(axiosError(404, "NOT_FOUND")))).toBe(true)
    expect(answerRefusalRefetches(toDatingError(axiosError(400, "OPENING_ANSWER_REFUSED")))).toBe(false)
    expect(answerRefusalRefetches(toDatingError(axiosError(503, "CHAT_UNAVAILABLE")))).toBe(false)
    expect(openingAnswerCopy(axiosError(404, "NOT_FOUND"))).toBe("This match isn't available any more.")
    expect(openingAnswerCopy(axiosError(400, "OPENING_ANSWER_INVALID", { max_length: 500 }))).toBe("Write an answer of up to 500 characters.")
    expect(openingAnswerCopy(axiosError(503, "CHAT_UNAVAILABLE"))).toContain("Try again in a moment")
  })
})

describe("more time: old and new answers", () => {
  test("the premium answer, old (days only) and new (days and hours)", () => {
    const old = toExtendResult({ extended: true, extra_days: 7 })
    expect(old).toEqual({ extended: true, extraDays: 7, extraHours: 168, expiresAt: "", free: false })
    expect(extendedLine(old)).toBe("7 more days added")
    const now = toExtendResult({ extended: true, extra_days: 7, extra_hours: 168, expires_at: "2026-10-09T10:00:00Z" })
    expect(now.expiresAt).toBe("2026-10-09T10:00:00Z")
    expect(extendedLine(now)).toBe("7 more days added")
  })

  test("the free answer, and an empty one", () => {
    const free = toExtendResult({ extended: true, extra_hours: 24, free: true })
    expect(free.free).toBe(true)
    expect(extendedLine(free)).toBe("24 more hours added")
    expect(toExtendResult(null)).toEqual({ extended: false, extraDays: 0, extraHours: 0, expiresAt: "", free: false })
    expect(extendedLine(toExtendResult({ extended: true }))).toBe("More time added")
  })

  test("the limit: only EXTEND_LIMIT_REACHED, with the local reset time when it parses", () => {
    expect(toExtendLimit(toDatingError(axiosError(403, "FORBIDDEN")))).toBeNull()
    const resetsAt = new Date(Date.now() + 3600_000).toISOString()
    const l = toExtendLimit(toDatingError(axiosError(429, "EXTEND_LIMIT_REACHED", { limit: 1, window_hours: 24, resets_at: resetsAt })))!
    expect(l).toEqual({ limit: 1, windowHours: 24, resetsAt })
    expect(extendLimitLine(l)).toMatch(/^You can give more time once every 24 hours\. You can do it again (at|\w+day at) /)
    expect(extendLimitLine({ limit: 0, windowHours: 0, resetsAt: "" })).toBe("You've used your free extra time for now. Try again later.")
  })
})

describe("first move: which controls a match shows", () => {
  const running = { kind: "running" as const, text: "5h left to say hello" }
  const waiting = (canExtend: boolean): FirstMoveState => ({ kind: "waiting", left: "5h", questions: [], canExtend })

  test("the person waiting: no chat; the free extend while can_extend, pass or not; never the premium path", () => {
    for (const hasExtendFeature of [false, true]) {
      expect(matchControls({ open: true, state: waiting(true), left: running, hasExtendFeature, answered: false })).toEqual({ chat: false, freeExtend: true, premiumExtend: false })
      expect(matchControls({ open: true, state: waiting(false), left: running, hasExtendFeature, answered: false })).toEqual({ chat: false, freeExtend: false, premiumExtend: false })
    }
  })

  test("the first mover and a normal match: chat, and the premium path for a pass holder", () => {
    for (const state of [{ kind: "yours", left: "5h" }, { kind: "none" }] as FirstMoveState[]) {
      expect(matchControls({ open: true, state, left: running, hasExtendFeature: true, answered: false })).toEqual({ chat: true, freeExtend: false, premiumExtend: true })
      expect(matchControls({ open: true, state, left: running, hasExtendFeature: false, answered: false })).toEqual({ chat: true, freeExtend: false, premiumExtend: false })
    }
  })

  test("after an accepted answer the chat opens; expired or closed shows nothing", () => {
    expect(matchControls({ open: true, state: waiting(true), left: running, hasExtendFeature: false, answered: true })).toEqual({ chat: true, freeExtend: false, premiumExtend: false })
    expect(matchControls({ open: true, state: { kind: "expired" }, left: running, hasExtendFeature: true, answered: false })).toEqual({ chat: false, freeExtend: false, premiumExtend: false })
    expect(matchControls({ open: false, state: waiting(true), left: running, hasExtendFeature: true, answered: false })).toEqual({ chat: false, freeExtend: false, premiumExtend: false })
  })
})

describe("first move: the match page", () => {
  test("yours: who starts and the time left", () => {
    const out = html(<FirstMoveStatus state={{ kind: "yours", left: "5h 10m" }} name="Asha" />)
    expect(out).toContain("You start this one: Asha is waiting for your hello.")
    expect(out).toContain("5h 10m left.")
  })

  test("waiting: who starts, and what to do meanwhile", () => {
    const withQs = html(<FirstMoveStatus state={{ kind: "waiting", left: "5h 10m", questions: waitingView.openingQuestions, canExtend: true }} name="Asha" />)
    expect(withQs).toContain("Asha starts this one.")
    expect(withQs).toContain("answer one of their questions")
    const without = html(<FirstMoveStatus state={{ kind: "waiting", left: "", questions: [], canExtend: false }} name="Asha" />)
    expect(without).toContain("The chat opens when they say hello.")
    expect(without).not.toContain("left.")
  })

  test("expired, and nothing for a normal match", () => {
    expect(html(<FirstMoveStatus state={{ kind: "expired" }} name="Asha" />)).toContain("ran out of time")
    expect(html(<FirstMoveStatus state={{ kind: "none" }} name="Asha" />)).toBe("")
  })

  test("the waiting panel: each question with Answer, the free 24 hours, and no Open chat", () => {
    const state = firstMoveState(toMatch(readFixture("match_get_200_first_move_waiting").data)!)
    if (state.kind !== "waiting") throw new Error("expected waiting")
    // The fixture uses one placeholder id; give each question its own.
    const distinct = { ...state, questions: state.questions.map((q, i) => ({ ...q, id: `q${i}` })) }
    const out = html(<WaitingPanel state={distinct} draft={NO_ANSWER} answering={false} freeExtend extending={false} limit={null} onOpen={noop} onText={noop} onSend={noop} onCancel={noop} onExtend={noop} />)
    expect(out).toContain("“What does your perfect Sunday look like?”")
    expect(out).toContain("“Tea or coffee, and why?”")
    expect((out.match(/>Answer</g) ?? []).length).toBe(2)
    expect(out).toContain(">Give them 24 more hours<")
    expect(out).not.toContain("Open chat")
    expect(out).not.toContain("<textarea")
  })

  test("the waiting panel without the free extend, and with the limit's local reset time", () => {
    const state = { kind: "waiting" as const, left: "", questions: [], canExtend: false }
    const off = html(<WaitingPanel state={state} draft={NO_ANSWER} answering={false} freeExtend={false} extending={false} limit={null} onOpen={noop} onText={noop} onSend={noop} onCancel={noop} onExtend={noop} />)
    expect(off).not.toContain("Give them 24 more hours")
    const resetsAt = new Date(Date.now() + 3600_000).toISOString()
    const limited = html(<WaitingPanel state={{ ...state, canExtend: true }} draft={NO_ANSWER} answering={false} freeExtend extending={false} limit={{ limit: 1, windowHours: 24, resetsAt }} onOpen={noop} onText={noop} onSend={noop} onCancel={noop} onExtend={noop} />)
    expect(limited).not.toContain("Give them 24 more hours")
    expect(limited).toMatch(/You can do it again (at|\w+day at) /)
    expect(html(<ExtendLimitNotice limit={{ limit: 1, windowHours: 24, resetsAt: "" }} />)).toContain("Try again later.")
  })

  test("an open answer form: the counter to 500, Send disabled until there is text, the error", () => {
    const qs = [{ id: "q1", text: "Tea or coffee?" }, { id: "q2", text: "Best street food?" }]
    const empty = html(<OpeningQuestionList questions={qs} draft={{ openId: "q1", text: "", error: "" }} onOpen={noop} onText={noop} onSend={noop} onCancel={noop} />)
    expect((empty.match(/<textarea/g) ?? []).length).toBe(1)
    expect(empty).toContain("0/500")
    expect(empty).toMatch(/<button[^>]*disabled=""[^>]*>.*Send answer/)
    // The other question still offers its own Answer.
    expect((empty.match(/>Answer</g) ?? []).length).toBe(1)
    const typed = html(<OpeningQuestionList questions={qs} draft={{ openId: "q1", text: "Chai, always.", error: "" }} onOpen={noop} onText={noop} onSend={noop} onCancel={noop} />)
    expect(typed).toContain("13/500")
    expect(typed).not.toMatch(/<button[^>]*disabled=""[^>]*>.*Send answer/)
    const refused = html(<OpeningQuestionList questions={qs} draft={{ openId: "q1", text: "x", error: "Answers can't include phone numbers, emails or links." }} onOpen={noop} onText={noop} onSend={noop} onCancel={noop} />)
    expect(refused).toContain('role="alert"')
    const over = html(<OpeningQuestionList questions={qs} draft={{ openId: "q1", text: "x".repeat(501), error: "" }} onOpen={noop} onText={noop} onSend={noop} onCancel={noop} />)
    expect(over).toContain("Keep your answer to 500 characters.")
    expect(html(<OpeningQuestionList questions={[]} draft={NO_ANSWER} onOpen={noop} onText={noop} onSend={noop} onCancel={noop} />)).toBe("")
  })

  test("after the answer is sent: the chat opens", () => {
    const out = html(<AnswerSent conversationId="c1" />)
    expect(out).toContain("first message in your chat")
    expect(out).toContain('href="/messenger?conversation=c1"')
  })
})

describe("first move: the matches list", () => {
  test("You start / Waiting for them with the time left; a normal match keeps its countdown", () => {
    const at = (id: string, firstMove: object | null) => toMatch({ id, status: "matched", expires_at: IN_5H, first_move: firstMove ?? undefined, person: { user_id: id, first_name: "Asha", age: 30 } })!
    const yours = at("m1", { you_move_first: true, deadline: IN_5H })
    const waiting = at("m2", { you_move_first: false, deadline: IN_5H, can_extend: true })
    const normal = at("m3", null)
    expect(matchListLine(yours, NOW)).toBe("You start · 5h 10m left")
    expect(matchListLine(waiting, NOW)).toBe("Waiting for them · 5h 10m left")
    expect(matchListLine(normal, NOW)).toBe("5h 10m left to say hello")
    const out = html(<MatchList matches={[yours, waiting, normal]} nowMs={NOW} />)
    expect(out).toContain("You start · 5h 10m left")
    expect(out).toContain("Waiting for them · 5h 10m left")
    expect(out).toContain("5h 10m left to say hello")
  })
})

describe("first move: the settings editor", () => {
  const settings: FirstMoveSettings = toFirstMoveSettings(readFixture("first_move_get_200").data)
  const editor = (over: Partial<React.ComponentProps<typeof FirstMoveEditor>> = {}) =>
    html(<FirstMoveEditor settings={settings} drafts={settings.questions.map((q) => q.text)} onToggle={noop} onDraft={noop} onAdd={noop} onRemove={noop} onSave={noop} {...over} />)

  test("the switch, in our words, reflecting the saved setting", () => {
    const on = editor()
    expect(on).toMatch(/role="switch"[^>]*checked=""/)
    expect(on).toContain(FIRST_MOVE_TOGGLE_HELP.replace(/'/g, "&#x27;"))
    expect(on).not.toMatch(/bumble|tinder|women first|ladies/i)
    expect(editor({ settings: { ...settings, enabled: false } })).not.toContain('checked=""')
  })

  test("the saved questions, each with a counter and Remove; Save waits for a change", () => {
    const out = editor()
    expect(out).toContain('value="What does your perfect Sunday look like?"')
    expect(out).toContain("40/140")
    expect((out.match(/>Remove</g) ?? []).length).toBe(2)
    expect(out).toContain('aria-label="Remove question 1"')
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>.*?Save questions/)
    expect(out).not.toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Add a question/)
  })

  test("at the server's maximum, no more can be added; over it, Save is refused with the limit", () => {
    const full = editor({ drafts: ["a", "b", "c"] })
    expect(full).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Add a question/)
    const over = editor({ drafts: ["a", "b", "c", "d"] })
    expect(over).toContain("You can have up to 3 questions.")
    expect(over).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Save questions/)
  })

  test("a question over the length limit says so beside it", () => {
    const out = editor({ drafts: ["x".repeat(141)] })
    expect(out).toContain("141/140")
    expect(out).toContain("Keep it to 140 characters.")
  })

  test("none yet, a server refusal, and busy states", () => {
    expect(editor({ drafts: [] })).toContain("No questions yet.")
    expect(editor({ error: "Questions can't include phone numbers, emails or links." })).toContain('role="alert"')
    expect(editor({ toggleBusy: true })).toMatch(/role="switch"[^>]*disabled=""|disabled=""[^>]*role="switch"/)
    expect(editor({ drafts: ["Changed?"], saveBusy: true })).toContain('aria-busy="true"')
  })
})

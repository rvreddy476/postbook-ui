/* The deck, sparks, the stash, people and matches. */

import { firstMoveBody, openingAnswerBody, toFirstMoveSettings, toOpeningAnswerResult, type FirstMoveSettings, type OpeningAnswerResult } from "../model/firstMove"
import { toCloseResult, toExtendResult, toMatch, toMatches, type ExtendResult, type Match } from "../model/matches"
import { toPerson, type Person } from "../model/people"
import { toAllowances, type Allowances } from "../model/allowances"
import { LIKED_YOU_PAGE, toLikedYou, type LikedYou } from "../model/likedYou"
import { toDeck, toPassResult, toRewindResult, type Deck, type PassResult, type RewindResult } from "../model/pulse"
import { browserTimeZone, loadPicksWithZone, toPicks, type Picks } from "../model/picks"
import { passBody, sparkBody, toDeclineResult, toIncomingSparks, toSparkOutcome, toStash, toStashEntry, type ActionSource, type DeclineResult, type IncomingSpark, type SparkOutcome, type StashEntry } from "../model/sparks"
import { toTravelState, travelBody, type TravelForm, type TravelState } from "../model/travel"
import { readReceiptsBody, toReadReceipts, type ReadReceipts } from "../model/readReceipts"
import { toDateCheckins, toDateFeedback, type DateCheckin, type DateFeedback, type DateFeedbackBody } from "../model/dateCheckin"
import { del, get, getBody, post, put, seg } from "./client"

/* ── read receipts (mechanic M9) ─────────────────────────────────── */

/** GET /read-receipts — 404 MECHANIC_NOT_ENABLED while off. */
export async function fetchReadReceipts(): Promise<ReadReceipts> {
  return toReadReceipts(await get("/read-receipts"))
}

/** PUT /read-receipts {enabled} — on without a pass is 403 READ_RECEIPTS_REQUIRE_PASS; off always works. */
export async function saveReadReceipts(enabled: boolean): Promise<ReadReceipts> {
  return toReadReceipts(await put("/read-receipts", readReceiptsBody(enabled)))
}

/** GET /pulse/today — `{data: [cards], meta}`; the mapper takes the whole body. */
export async function fetchDeck(): Promise<Deck> {
  return toDeck(await getBody("/pulse/today"))
}

/** `source` other than the deck spends no deck card (mechanic M7); the deck sends `{}` as before. */
export async function passCandidate(candidateId: string, source: ActionSource = "deck"): Promise<PassResult> {
  return toPassResult(await post(`/pulse/${seg(candidateId)}/pass`, passBody(source)))
}

/* ── daily picks (mechanic M7) ───────────────────────────────────── */

/** GET /picks?tz= — the whole body; an unknown zone is asked again once without one. 404 MECHANIC_NOT_ENABLED while off. */
export async function fetchPicks(tz: string = browserTimeZone()): Promise<Picks> {
  return toPicks(await loadPicksWithZone((zone) => getBody("/picks", zone ? { tz: zone } : undefined), tz))
}

/* ── travel mode (mechanic M8) ───────────────────────────────────── */

/** GET /travel — 404 MECHANIC_NOT_ENABLED while off. */
export async function fetchTravel(): Promise<TravelState> {
  return toTravelState(await get("/travel"))
}

/** PUT /travel {city, days} — starts or replaces the trip. 403 TRAVEL_REQUIRES_PASS without a pass. */
export async function startTravel(form: TravelForm): Promise<TravelState> {
  return toTravelState(await put("/travel", travelBody(form)))
}

/** DELETE /travel — back home. */
export async function endTravel(): Promise<TravelState> {
  return toTravelState(await del("/travel"))
}

/** POST /pulse/rewind — undo the most recent pass, one step. The route reads no body. */
export async function rewindLastPass(): Promise<RewindResult> {
  return toRewindResult(await post("/pulse/rewind"))
}

/** GET /allowances — a mechanic whose flag is off is absent. */
export async function fetchAllowances(): Promise<Allowances> {
  return toAllowances(await get("/allowances"))
}

/** `superSpark` sends it as a Super Spark (mechanic M3); `source` names where it came from (M7). */
export async function createSpark(toUserId: string, note?: string, superSpark = false, source: ActionSource = "deck"): Promise<SparkOutcome> {
  return toSparkOutcome(await post("/sparks", sparkBody(toUserId, note, superSpark, source)))
}

export async function fetchIncomingSparks(): Promise<IncomingSpark[]> {
  return toIncomingSparks(await get("/sparks/incoming", { limit: 50 }))
}

/** GET /liked-you — mechanic M4: the total and the grid, Super Sparks first; locked cards name no one. */
export async function fetchLikedYou(): Promise<LikedYou> {
  return toLikedYou(await get("/liked-you", { limit: LIKED_YOU_PAGE, offset: 0 }))
}

/** A locked spark is refused with 403 LIKED_YOU_LOCKED (a match would reveal the sender). */
export async function acceptSpark(sparkId: string): Promise<SparkOutcome> {
  return toSparkOutcome(await post(`/sparks/${seg(sparkId)}/accept`))
}

export async function declineSpark(sparkId: string): Promise<DeclineResult> {
  return toDeclineResult(await post(`/sparks/${seg(sparkId)}/decline`))
}

export async function fetchStash(): Promise<StashEntry[]> {
  return toStash(await get("/stash"))
}

export async function addStash(candidateId: string): Promise<StashEntry | null> {
  return toStashEntry(await post("/stash", { candidate_id: candidateId }))
}

export async function removeStash(candidateId: string): Promise<void> {
  await del(`/stash/${seg(candidateId)}`)
}

/** GET /people/:userId — a current match, an incoming spark, someone in the deck or one of today's picks; 404 otherwise. */
export async function fetchPerson(userId: string): Promise<Person | null> {
  return toPerson(await get(`/people/${seg(userId)}`))
}

export async function fetchMatches(): Promise<Match[]> {
  return toMatches(await get("/matches"))
}

export async function fetchMatch(id: string): Promise<Match | null> {
  return toMatch(await get(`/matches/${seg(id)}`))
}

export async function closeMatch(id: string): Promise<{ closed: boolean }> {
  return toCloseResult(await post(`/matches/${seg(id)}/close`))
}

/** The free 24 hours for the person waiting on a first-move match, otherwise a pass holder's 7 days. */
export async function extendMatch(id: string): Promise<ExtendResult> {
  return toExtendResult(await post(`/matches/${seg(id)}/extend`))
}

/* ── after-date check-ins (mechanic M14) ─────────────────────────── */

/** GET /date-checkins — the asks still waiting for an answer. 404 MECHANIC_NOT_ENABLED while off. */
export async function fetchDateCheckins(): Promise<DateCheckin[]> {
  return toDateCheckins(await get("/date-checkins"))
}

/** POST /matches/:id/date-feedback — 201, with offer_report when they didn't feel safe. */
export async function sendDateFeedback(matchId: string, body: DateFeedbackBody): Promise<DateFeedback> {
  return toDateFeedback(await post(`/matches/${seg(matchId)}/date-feedback`, body))
}

/* ── first move (mechanic M5) ────────────────────────────────────── */

/** GET /first-move — 404 MECHANIC_NOT_ENABLED while the mechanic is off. */
export async function fetchFirstMove(): Promise<FirstMoveSettings> {
  return toFirstMoveSettings(await get("/first-move"))
}

/** PUT /first-move — an absent field is unchanged; `questions: []` removes them all. */
export async function saveFirstMove(change: { enabled?: boolean; questions?: string[] }): Promise<FirstMoveSettings> {
  return toFirstMoveSettings(await put("/first-move", firstMoveBody(change)))
}

/** POST /matches/:id/opening-answer — the answer becomes the match's first message. */
export async function sendOpeningAnswer(matchId: string, questionId: string, answer: string): Promise<OpeningAnswerResult> {
  return toOpeningAnswerResult(await post(`/matches/${seg(matchId)}/opening-answer`, openingAnswerBody(questionId, answer)))
}

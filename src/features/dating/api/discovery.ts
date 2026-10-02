/* The deck, sparks, the stash, people and matches. */

import { firstMoveBody, openingAnswerBody, toFirstMoveSettings, toOpeningAnswerResult, type FirstMoveSettings, type OpeningAnswerResult } from "../model/firstMove"
import { toCloseResult, toExtendResult, toMatch, toMatches, type ExtendResult, type Match } from "../model/matches"
import { toPerson, type Person } from "../model/people"
import { toAllowances, type Allowances } from "../model/allowances"
import { LIKED_YOU_PAGE, toLikedYou, type LikedYou } from "../model/likedYou"
import { toDeck, toPassResult, toRewindResult, type Deck, type PassResult, type RewindResult } from "../model/pulse"
import { sparkBody, toDeclineResult, toIncomingSparks, toSparkOutcome, toStash, toStashEntry, type DeclineResult, type IncomingSpark, type SparkOutcome, type StashEntry } from "../model/sparks"
import { del, get, getBody, post, put, seg } from "./client"

/** GET /pulse/today — `{data: [cards], meta}`; the mapper takes the whole body. */
export async function fetchDeck(): Promise<Deck> {
  return toDeck(await getBody("/pulse/today"))
}

export async function passCandidate(candidateId: string): Promise<PassResult> {
  return toPassResult(await post(`/pulse/${seg(candidateId)}/pass`, {}))
}

/** POST /pulse/rewind — undo the most recent pass, one step. The route reads no body. */
export async function rewindLastPass(): Promise<RewindResult> {
  return toRewindResult(await post("/pulse/rewind"))
}

/** GET /allowances — a mechanic whose flag is off is absent. */
export async function fetchAllowances(): Promise<Allowances> {
  return toAllowances(await get("/allowances"))
}

/** `superSpark` sends it as a Super Spark (mechanic M3). */
export async function createSpark(toUserId: string, note?: string, superSpark = false): Promise<SparkOutcome> {
  return toSparkOutcome(await post("/sparks", sparkBody(toUserId, note, superSpark)))
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

/** GET /people/:userId — a current match, an incoming spark or someone in the deck; 404 otherwise. */
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

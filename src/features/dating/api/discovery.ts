/* The deck, sparks, the stash, people and matches. */

import { toCloseResult, toExtendResult, toMatch, toMatches, type Match } from "../model/matches"
import { toPerson, type Person } from "../model/people"
import { toDeck, toPassResult, type Deck, type PassResult } from "../model/pulse"
import { sparkBody, toDeclineResult, toIncomingSparks, toSparkOutcome, toStash, toStashEntry, type DeclineResult, type IncomingSpark, type SparkOutcome, type StashEntry } from "../model/sparks"
import { del, get, getBody, post, seg } from "./client"

/** GET /pulse/today — `{data: [cards], meta}`; the mapper takes the whole body. */
export async function fetchDeck(): Promise<Deck> {
  return toDeck(await getBody("/pulse/today"))
}

export async function passCandidate(candidateId: string): Promise<PassResult> {
  return toPassResult(await post(`/pulse/${seg(candidateId)}/pass`, {}))
}

export async function createSpark(toUserId: string, note?: string): Promise<SparkOutcome> {
  return toSparkOutcome(await post("/sparks", sparkBody(toUserId, note)))
}

export async function fetchIncomingSparks(): Promise<IncomingSpark[]> {
  return toIncomingSparks(await get("/sparks/incoming", { limit: 50 }))
}

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

export async function extendMatch(id: string): Promise<{ extended: boolean; extraDays: number }> {
  return toExtendResult(await post(`/matches/${seg(id)}/extend`))
}

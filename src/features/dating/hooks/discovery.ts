"use client"

/* The deck, sparks, the stash, people, matches, and the photo loader. */

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"

import {
  acceptSpark,
  addStash,
  closeMatch,
  createSpark,
  declineSpark,
  endTravel,
  extendMatch,
  fetchAllowances,
  fetchDateCheckins,
  fetchDeck,
  fetchFirstMove,
  fetchIncomingSparks,
  fetchLikedYou,
  fetchMatch,
  fetchMatches,
  fetchPerson,
  fetchPicks,
  fetchReadReceipts,
  fetchTravel,
  passCandidate,
  rewindLastPass,
  saveFirstMove,
  saveReadReceipts,
  sendDateFeedback,
  sendOpeningAnswer,
  startTravel,
} from "../api/discovery"
import { fetchPhotoBlob } from "../api/media"
import type { Allowances } from "../model/allowances"
import type { DateCheckin, DateFeedback, DateFeedbackBody } from "../model/dateCheckin"
import { isMechanicOff, isReadReceiptsRequirePass, isTravelRequiresPass } from "../model/errors"
import type { Picks } from "../model/picks"
import type { ReadReceipts } from "../model/readReceipts"
import type { ActionSource } from "../model/sparks"
import type { TravelForm, TravelState } from "../model/travel"
import type { FirstMoveSettings, OpeningAnswerResult } from "../model/firstMove"
import { isLikedYouLocked, lockLikedYou, type LikedYou } from "../model/likedYou"
import type { ExtendResult, Match } from "../model/matches"
import { viewablePhotoPath, type Person } from "../model/people"
import type { Deck, RewindResult } from "../model/pulse"
import type { IncomingSpark, SparkOutcome } from "../model/sparks"
import { errorStatus } from "../model/wire"
import { KEYS } from "./profile"

const retry = (count: number, error: unknown) => {
  const status = errorStatus(error)
  if (status >= 400 && status < 500) return false
  return count < 2
}

export function useDeck(enabled = true) {
  return useQuery<Deck>({ queryKey: KEYS.deck, queryFn: fetchDeck, retry, enabled, staleTime: 60_000, refetchOnWindowFocus: false })
}

/**
  Every daily allowance, and which optional mechanics are on. Read again after
  every spark, Super Spark, pass, rewind and completed purchase. A failed read
  leaves `data` undefined, which the screens treat as "every mechanic off".
*/
export function useAllowances(enabled = true) {
  return useQuery<Allowances>({ queryKey: KEYS.allowances, queryFn: fetchAllowances, retry, enabled, staleTime: 30_000 })
}

/**
  No optimistic update anywhere here: a card leaves the deck only after the
  server accepts. `source` (M7) is the deck unless said otherwise.
*/
export function useSpark() {
  const qc = useQueryClient()
  return useMutation<SparkOutcome, unknown, { toUserId: string; note?: string; superSpark?: boolean; source?: ActionSource }>({
    mutationFn: ({ toUserId, note, superSpark, source }) => createSpark(toUserId, note, superSpark, source),
    onSuccess: (outcome) => {
      if (outcome.matched) void qc.invalidateQueries({ queryKey: KEYS.matches })
    },
    // Accepted or refused, the counts may have moved (a refusal means the read was stale).
    onSettled: () => void qc.invalidateQueries({ queryKey: KEYS.allowances }),
  })
}

export function usePass() {
  const qc = useQueryClient()
  return useMutation<unknown, unknown, { candidateId: string; source?: ActionSource }>({
    mutationFn: ({ candidateId, source }) => passCandidate(candidateId, source),
    onSettled: () => void qc.invalidateQueries({ queryKey: KEYS.allowances }),
  })
}

/* ── daily picks (mechanic M7) ───────────────────────────────────── */

/** The session flag that hides Picks once the server has said the mechanic is off. */
export const PICKS_OFF_FLAG = "picks-off"

/**
  Today's picks. They stay the same all day, so they are not read again on
  focus; the screen asks again when `resetsAt` passes. A 404
  MECHANIC_NOT_ENABLED hides Picks for the rest of the session.
*/
export function usePicks(enabled = true) {
  const query = useQuery<Picks>({ queryKey: KEYS.picks, queryFn: () => fetchPicks(), retry, enabled, staleTime: 5 * 60_000, refetchOnWindowFocus: false })
  const [, raiseOff] = useSessionFlag(PICKS_OFF_FLAG)
  const off = query.isError && isMechanicOff(query.error)
  useEffect(() => {
    if (off) raiseOff()
  }, [off, raiseOff])
  return query
}

/**
  For the tabs: true once picks are known to be off, from this session's
  flag or from a read already in the cache. It never asks the server itself
  (the picks are made on the first read of the day, so only a ready profile
  reads them).
*/
export function usePicksKnownOff(): boolean {
  const cached = useQuery<Picks>({ queryKey: KEYS.picks, queryFn: () => fetchPicks(), retry, enabled: false })
  const [flag] = useSessionFlag(PICKS_OFF_FLAG)
  return flag || (cached.isError && isMechanicOff(cached.error))
}

/* ── travel mode (mechanic M8) ───────────────────────────────────── */

/** The trip, the cities and whether the viewer may travel. A 404 MECHANIC_NOT_ENABLED means travel is hidden. */
export function useTravel(enabled = true) {
  return useQuery<TravelState>({ queryKey: KEYS.travel, queryFn: fetchTravel, retry, enabled, staleTime: 60_000 })
}

/** Everything the trip moves: the deck and the picks are now another city's. */
function afterTrip(qc: QueryClient, state?: TravelState) {
  if (state) qc.setQueryData(KEYS.travel, state)
  else void qc.invalidateQueries({ queryKey: KEYS.travel })
  void qc.invalidateQueries({ queryKey: KEYS.deck })
  void qc.invalidateQueries({ queryKey: KEYS.picks })
}

export function useStartTravel() {
  const qc = useQueryClient()
  return useMutation<TravelState, unknown, TravelForm>({
    mutationFn: startTravel,
    onSuccess: (state) => afterTrip(qc, state),
    // A 403 means `available` on screen was stale: read it again.
    onError: (error) => {
      if (isTravelRequiresPass(error)) void qc.invalidateQueries({ queryKey: KEYS.travel })
    },
  })
}

export function useEndTravel() {
  const qc = useQueryClient()
  return useMutation<TravelState, unknown, void>({
    mutationFn: () => endTravel(),
    onSuccess: (state) => afterTrip(qc, state),
  })
}

/* ── read receipts (mechanic M9) ─────────────────────────────────── */

/** The viewer's choice and whether a pass lets it apply. A 404 MECHANIC_NOT_ENABLED means the setting is hidden. */
export function useReadReceipts(enabled = true) {
  return useQuery<ReadReceipts>({ queryKey: KEYS.readReceipts, queryFn: fetchReadReceipts, retry, enabled, staleTime: 60_000 })
}

export function useSaveReadReceipts() {
  const qc = useQueryClient()
  return useMutation<ReadReceipts, unknown, boolean>({
    mutationFn: saveReadReceipts,
    onSuccess: (state) => qc.setQueryData(KEYS.readReceipts, state),
    // A 403 means `available` on screen was stale (a pass ran out): read it again.
    onError: (error) => {
      if (isReadReceiptsRequirePass(error) || isMechanicOff(error)) void qc.invalidateQueries({ queryKey: KEYS.readReceipts })
    },
  })
}

/** Undo the last pass. With no card in the answer the deck is read again so the person comes back from the server. */
export function useRewind() {
  const qc = useQueryClient()
  return useMutation<RewindResult, unknown, void>({
    mutationFn: () => rewindLastPass(),
    onSuccess: (result) => {
      if (!result.card) void qc.invalidateQueries({ queryKey: KEYS.deck })
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: KEYS.allowances }),
  })
}

/* ── a flag for the rest of the browser session ──────────────────── */

const sessionFlags = new Set<string>()

function readSessionFlag(name: string): boolean {
  if (sessionFlags.has(name)) return true
  try {
    return window.sessionStorage.getItem(`pulse.${name}`) === "1"
  } catch {
    return false
  }
}

/**
  A one-way switch that lasts the browser session (MECHANIC_NOT_ENABLED hides
  a control until the tab is closed). Read after mount, so the server render
  and the first client render agree.
*/
export function useSessionFlag(name: string): [boolean, () => void] {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (readSessionFlag(name)) setOn(true)
  }, [name])
  const raise = useCallback(() => {
    sessionFlags.add(name)
    try {
      window.sessionStorage.setItem(`pulse.${name}`, "1")
    } catch {
      // Storage refused: the in-memory flag still lasts this page's life.
    }
    setOn(true)
  }, [name])
  return [on, raise]
}

export function useStash() {
  return useMutation<unknown, unknown, string>({ mutationFn: addStash })
}

export function useIncomingSparks(enabled = true) {
  return useQuery<IncomingSpark[]>({ queryKey: KEYS.sparks, queryFn: fetchIncomingSparks, retry, enabled })
}

/** Who liked you (M4). Read again after any spark answer and after a pass is bought. */
export function useLikedYou(enabled = true) {
  return useQuery<LikedYou>({ queryKey: KEYS.likedYou, queryFn: fetchLikedYou, retry, enabled })
}

/**
  After a refused accept. 403 LIKED_YOU_LOCKED means the grid on screen is out
  of date (a pass ran out, or the gate turned on): it switches to locked at
  once — no person, note or unblurred photo left — and is read again.
  Returns whether it was that refusal.
*/
export function applyAcceptRefusal(qc: QueryClient, error: unknown): boolean {
  if (!isLikedYouLocked(error)) return false
  qc.setQueryData<LikedYou>(KEYS.likedYou, (data) => (data ? lockLikedYou(data) : data))
  void qc.invalidateQueries({ queryKey: KEYS.sparks })
  return true
}

export function useAcceptSpark() {
  const qc = useQueryClient()
  return useMutation<SparkOutcome, unknown, string>({
    mutationFn: acceptSpark,
    onSuccess: () => {
      // KEYS.sparks covers the liked-you grid too.
      void qc.invalidateQueries({ queryKey: KEYS.sparks })
      void qc.invalidateQueries({ queryKey: KEYS.matches })
    },
    onError: (error) => void applyAcceptRefusal(qc, error),
  })
}

export function useDeclineSpark() {
  const qc = useQueryClient()
  return useMutation<unknown, unknown, string>({
    mutationFn: declineSpark,
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEYS.sparks }),
  })
}

export function usePerson(userId: string) {
  return useQuery<Person | null>({ queryKey: KEYS.person(userId), queryFn: () => fetchPerson(userId), retry, enabled: !!userId })
}

export function useMatches(enabled = true) {
  return useQuery<Match[]>({ queryKey: KEYS.matches, queryFn: fetchMatches, retry, enabled })
}

export function useMatch(id: string) {
  return useQuery<Match | null>({ queryKey: KEYS.match(id), queryFn: () => fetchMatch(id), retry, enabled: !!id })
}

export function useCloseMatch() {
  const qc = useQueryClient()
  return useMutation<unknown, unknown, string>({
    mutationFn: closeMatch,
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEYS.matches }),
  })
}

/** Accepted or refused, the match is read again: a 429 means `can_extend` on screen was stale. */
export function useExtendMatch() {
  const qc = useQueryClient()
  return useMutation<ExtendResult, unknown, string>({
    mutationFn: extendMatch,
    onSettled: (_, __, id) => {
      void qc.invalidateQueries({ queryKey: KEYS.match(id) })
      void qc.invalidateQueries({ queryKey: KEYS.matches })
    },
  })
}

/* ── after-date check-ins (mechanic M14) ─────────────────────────── */

/**
  The check-ins waiting for an answer. A 404 MECHANIC_NOT_ENABLED (or any
  failed read) leaves `data` undefined: no cards, and no "We met" entry on a
  match page either.
*/
export function useDateCheckins(enabled = true) {
  return useQuery<DateCheckin[]>({ queryKey: KEYS.dateCheckins, queryFn: fetchDateCheckins, retry, enabled, staleTime: 60_000 })
}

/** Answered or refused, the asks are read again (a 429 means the card on screen was stale). */
export function useDateFeedback() {
  const qc = useQueryClient()
  return useMutation<DateFeedback, unknown, { matchId: string; body: DateFeedbackBody }>({
    mutationFn: ({ matchId, body }) => sendDateFeedback(matchId, body),
    onSettled: () => void qc.invalidateQueries({ queryKey: KEYS.dateCheckins }),
  })
}

/* ── first move (mechanic M5) ────────────────────────────────────── */

/** The viewer's opt-in and opening questions. A 404 MECHANIC_NOT_ENABLED means the feature is hidden. */
export function useFirstMove(enabled = true) {
  return useQuery<FirstMoveSettings>({ queryKey: KEYS.firstMove, queryFn: fetchFirstMove, retry, enabled, staleTime: 60_000 })
}

export function useSaveFirstMove() {
  const qc = useQueryClient()
  return useMutation<FirstMoveSettings, unknown, { enabled?: boolean; questions?: string[] }>({
    mutationFn: saveFirstMove,
    onSuccess: (settings) => qc.setQueryData(KEYS.firstMove, settings),
  })
}

/** The answer becomes the first message; the match is read again either way. */
export function useAnswerOpening() {
  const qc = useQueryClient()
  return useMutation<OpeningAnswerResult, unknown, { matchId: string; questionId: string; answer: string }>({
    mutationFn: ({ matchId, questionId, answer }) => sendOpeningAnswer(matchId, questionId, answer),
    onSettled: (_, __, { matchId }) => {
      void qc.invalidateQueries({ queryKey: KEYS.match(matchId) })
      void qc.invalidateQueries({ queryKey: KEYS.matches })
    },
  })
}

/* ── photos ──────────────────────────────────────────────────────── */

export type PhotoLoad = { state: "loading" | "ready" | "failed" | "none"; src: string }

/**
  A dating photo as an object URL. The route needs the bearer token, which an
  <img> cannot send, so the bytes are fetched and handed to the image as a
  blob. The object URL is revoked when the path changes or the image unmounts.
*/
export function usePhoto(serverPath: string): PhotoLoad {
  const path = viewablePhotoPath(serverPath)
  const [load, setLoad] = useState<PhotoLoad>({ state: path ? "loading" : "none", src: "" })

  useEffect(() => {
    if (!path) {
      setLoad({ state: "none", src: "" })
      return
    }
    const controller = new AbortController()
    let url = ""
    setLoad({ state: "loading", src: "" })
    fetchPhotoBlob(path, controller.signal).then(
      (blob) => {
        if (controller.signal.aborted) return
        url = URL.createObjectURL(blob)
        setLoad({ state: "ready", src: url })
      },
      () => {
        if (!controller.signal.aborted) setLoad({ state: "failed", src: "" })
      },
    )
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [path])

  return load
}

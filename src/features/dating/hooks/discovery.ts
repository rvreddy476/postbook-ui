"use client"

/* The deck, sparks, the stash, people, matches, and the photo loader. */

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"

import { acceptSpark, addStash, closeMatch, createSpark, declineSpark, extendMatch, fetchAllowances, fetchDeck, fetchIncomingSparks, fetchLikedYou, fetchMatch, fetchMatches, fetchPerson, passCandidate, rewindLastPass } from "../api/discovery"
import { fetchPhotoBlob } from "../api/media"
import type { Allowances } from "../model/allowances"
import { isLikedYouLocked, lockLikedYou, type LikedYou } from "../model/likedYou"
import type { Match } from "../model/matches"
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

/** No optimistic update anywhere here: a card leaves the deck only after the server accepts. */
export function useSpark() {
  const qc = useQueryClient()
  return useMutation<SparkOutcome, unknown, { toUserId: string; note?: string; superSpark?: boolean }>({
    mutationFn: ({ toUserId, note, superSpark }) => createSpark(toUserId, note, superSpark),
    onSuccess: (outcome) => {
      if (outcome.matched) void qc.invalidateQueries({ queryKey: KEYS.matches })
    },
    // Accepted or refused, the counts may have moved (a refusal means the read was stale).
    onSettled: () => void qc.invalidateQueries({ queryKey: KEYS.allowances }),
  })
}

export function usePass() {
  const qc = useQueryClient()
  return useMutation<unknown, unknown, string>({
    mutationFn: passCandidate,
    onSettled: () => void qc.invalidateQueries({ queryKey: KEYS.allowances }),
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

export function useExtendMatch() {
  const qc = useQueryClient()
  return useMutation<{ extended: boolean; extraDays: number }, unknown, string>({
    mutationFn: extendMatch,
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: KEYS.match(id) })
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

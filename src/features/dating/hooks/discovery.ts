"use client"

/* The deck, sparks, the stash, people, matches, and the photo loader. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { acceptSpark, addStash, closeMatch, createSpark, declineSpark, extendMatch, fetchDeck, fetchIncomingSparks, fetchMatch, fetchMatches, fetchPerson, passCandidate } from "../api/discovery"
import { fetchPhotoBlob } from "../api/media"
import type { Match } from "../model/matches"
import { photoPath, type Person } from "../model/people"
import type { Deck } from "../model/pulse"
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

/** No optimistic update anywhere here: a card leaves the deck only after the server accepts. */
export function useSpark() {
  const qc = useQueryClient()
  return useMutation<SparkOutcome, unknown, { toUserId: string; note?: string }>({
    mutationFn: ({ toUserId, note }) => createSpark(toUserId, note),
    onSuccess: (outcome) => {
      if (outcome.matched) void qc.invalidateQueries({ queryKey: KEYS.matches })
    },
  })
}

export function usePass() {
  return useMutation<unknown, unknown, string>({ mutationFn: passCandidate })
}

export function useStash() {
  return useMutation<unknown, unknown, string>({ mutationFn: addStash })
}

export function useIncomingSparks(enabled = true) {
  return useQuery<IncomingSpark[]>({ queryKey: KEYS.sparks, queryFn: fetchIncomingSparks, retry, enabled })
}

export function useAcceptSpark() {
  const qc = useQueryClient()
  return useMutation<SparkOutcome, unknown, string>({
    mutationFn: acceptSpark,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.sparks })
      void qc.invalidateQueries({ queryKey: KEYS.matches })
    },
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
  const path = photoPath(serverPath)
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

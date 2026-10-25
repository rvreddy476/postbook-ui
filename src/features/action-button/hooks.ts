"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { fetchActionLabels, fetchActionStats, fetchChannelAction, fetchLink } from "./api"
import { ACTION_LABELS, decodeAction, type ActionLabelOption } from "./model"

export const ACTION_KEYS = {
  stats: (postId: string) => ["action-button", "stats", postId] as const,
  link: (id: string) => ["action-button", "link", id] as const,
  channel: (ref: string) => ["action-button", "channel", ref] as const,
}

const noRetryOn4xx = (count: number, err: unknown) => {
  const s = (err as { response?: { status?: number } })?.response?.status ?? 0
  return s >= 400 && s < 500 ? false : count < 2
}

/*
  The label list is read once per page load and shared by every editor. It
  is not a React Query query on purpose: the editor sits inside composers
  and settings screens that also render without a QueryClient (the server
  render, the screen tests), and the contract's list is a complete answer
  until the server's arrives.
*/
let labelsCache: ActionLabelOption[] | null = null
let labelsRequest: Promise<ActionLabelOption[] | null> | null = null

function loadLabels(): Promise<ActionLabelOption[] | null> {
  labelsRequest ??= fetchActionLabels()
    .then((list) => (labelsCache = list))
    .catch(() => {
      labelsRequest = null // asked again by the next editor that opens
      return null
    })
  return labelsRequest
}

/** The picker's labels: the server's list, the contract's while it loads or when it fails. */
export function useActionLabels(): readonly ActionLabelOption[] {
  const [labels, setLabels] = useState<readonly ActionLabelOption[]>(labelsCache ?? ACTION_LABELS)
  useEffect(() => {
    if (labelsCache) {
      setLabels(labelsCache)
      return
    }
    let live = true
    void loadLabels().then((list) => {
      if (live && list) setLabels(list)
    })
    return () => {
      live = false
    }
  }, [])
  return labels
}

/** Taps for the author's own post; asked only when there is a button. */
export function useActionStats(postId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ACTION_KEYS.stats(postId ?? ""),
    queryFn: () => fetchActionStats(postId as string),
    enabled: !!postId && enabled,
    staleTime: 60_000,
    retry: noRetryOn4xx,
  })
}

/**
  The link behind /l/<id>. Every GET counts a click (the server dedupes per
  viewer per hour), so it is read once: no refetch on focus, no retry of a 4xx.
*/
export function useLinkTarget(id: string | null | undefined) {
  return useQuery({
    queryKey: ACTION_KEYS.link(id ?? ""),
    queryFn: () => fetchLink(id as string),
    enabled: !!id,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: noRetryOn4xx,
  })
}

/**
  The profile button. The profile payload carries `action` (contract); when
  a payload has no `action` key at all (a profile service that does not send
  it yet), the channel's is read instead. A payload with `action: null` is
  an answer: no button, nothing fetched.
*/
export function useProfileAction(profile: { id?: string; action?: unknown } | null | undefined) {
  const carried = !!profile && Object.prototype.hasOwnProperty.call(profile, "action")
  const q = useQuery({
    queryKey: ACTION_KEYS.channel(profile?.id ?? ""),
    queryFn: () => fetchChannelAction(profile?.id as string),
    enabled: !!profile?.id && !carried,
    staleTime: 60_000,
    retry: noRetryOn4xx,
  })
  return decodeAction(carried ? profile?.action : q.data)
}

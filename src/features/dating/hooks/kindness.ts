"use client"

/* Kind messages (M13) and hide from people I know (M16). */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { fetchCommentFilter, fetchHideKnown, saveCommentFilter, saveHideKnown } from "../api/kindness"
import type { HideKnown } from "../model/hideKnown"
import type { CommentFilter } from "../model/kindMessages"
import { chatSourceMatch, matchForConversation, needsMatchLookup, type ChatSource } from "../model/matches"
import { errorStatus } from "../model/wire"
import { useMatches } from "./discovery"
import { KEYS } from "./profile"

const retry = (count: number, error: unknown) => {
  const status = errorStatus(error)
  if (status >= 400 && status < 500) return false
  return count < 2
}

/** GET /comment-filter. A 404 leaves `data` undefined and the section is hidden. */
export function useCommentFilter(enabled = true) {
  return useQuery<CommentFilter>({ queryKey: KEYS.commentFilter, queryFn: fetchCommentFilter, retry, enabled })
}

export function useSaveCommentFilter() {
  const qc = useQueryClient()
  return useMutation<CommentFilter, unknown, CommentFilter>({
    mutationFn: saveCommentFilter,
    onSuccess: (filter) => {
      qc.setQueryData(KEYS.commentFilter, filter)
      // Which notes are tucked away follows the filter.
      void qc.invalidateQueries({ queryKey: KEYS.sparks })
    },
  })
}

/** GET /hide-known. A 404 leaves `data` undefined and the setting is hidden. */
export function useHideKnown(enabled = true) {
  return useQuery<HideKnown>({ queryKey: KEYS.hideKnown, queryFn: fetchHideKnown, retry, enabled })
}

export function useSaveHideKnown() {
  const qc = useQueryClient()
  return useMutation<HideKnown, unknown, boolean>({
    mutationFn: saveHideKnown,
    onSuccess: (state) => {
      qc.setQueryData(KEYS.hideKnown, state)
      // Who is in the deck and in picks changes both ways.
      void qc.invalidateQueries({ queryKey: KEYS.deck })
      void qc.invalidateQueries({ queryKey: KEYS.picks })
    },
  })
}

/**
  The Pulse match a chat conversation belongs to, or "" when it is not one.

  chat-service's conversation says so itself (`source_app: "dating"` and
  `match_id`, `source` here): that decides, from any entry point, and costs
  no request. The viewer's own match list (GET /matches, every status) is
  only the fallback, for a chat Pulse opened by id whose conversation came
  back without those fields: a conversation is then a Pulse chat when one of
  their matches names it. `source` null means "not loaded yet" and asks
  nothing; undefined (a caller that has no conversation) keeps the old
  lookup. An empty id asks nothing, so ordinary chats cost no request; a
  failed read (a 404 outside the pilot included) reads as "not a Pulse chat".
*/
export function useDatingMatchFor(conversationId: string | undefined, source?: ChatSource | null): string {
  const fromServer = chatSourceMatch(source)
  const lookup = source === undefined ? Boolean(conversationId) : needsMatchLookup(conversationId, source)
  const matches = useMatches(lookup)
  if (fromServer) return fromServer
  if (!lookup || !conversationId || !matches.data) return ""
  return matchForConversation(matches.data, conversationId)
}

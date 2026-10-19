"use client"

import { useCallback, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"

import { feedPostFromCreate } from "@/hooks/feedPostFromCreate"
import type { PostDetail } from "@/types/profile"

import {
  applyAltTexts,
  createPost,
  createPostDraft,
  deletePostDraft,
  getPostDraft,
  isNetworkFailure,
  listPostDrafts,
  publishPostDraft,
  updatePostDraft,
  uploadPending,
} from "./api"
import {
  buildCreateRequest,
  buildDraftRequest,
  createAttemptKeys,
  type ComposeExtras,
  type ComposeMedia,
  type CreatePostBody,
  type PostDetailsForm,
  type PostDraftRow,
} from "./model"

export const POST_DRAFTS_KEY = ["post-drafts"] as const

/**
 * Show a new post at once. The home feed reads a timeline that fan-out fills
 * about a second after the create, so the created post goes to the top of
 * every loaded ranked page now and the refetch replaces it (the feed
 * de-duplicates by id). Ranked only: Following asks for exclude_self, and a
 * post of your own placed there would vanish on the next refetch. The same
 * rule the old create hook applied.
 */
export function showCreatedPost(qc: QueryClient, created: PostDetail, media?: { media_id: string; kind: string }[]) {
  const optimistic = feedPostFromCreate(created, media)
  qc.setQueryData(["post-detail", created.id], optimistic)
  qc.setQueriesData({ queryKey: ["home-feed", "ranked"] }, (old: unknown) => {
    const feed = old as { pages?: { data?: PostDetail[] }[] } | undefined
    if (!feed?.pages?.length) return old
    const [first, ...rest] = feed.pages
    const data: PostDetail[] = first?.data ?? []
    if (data.some((p) => p.id === created.id)) return old
    return { ...feed, pages: [{ ...first, data: [optimistic, ...data] }, ...rest] }
  })
  qc.invalidateQueries({ queryKey: ["home-feed"] })
  qc.invalidateQueries({ queryKey: ["profile-posts"] })
}

export interface CreatePostVariables {
  body: CreatePostBody
  /** Minted by the caller, once per intent: react-query hands these same variables to every retry. */
  idempotencyKey: string
  /** For the optimistic card only; never sent. */
  media?: { media_id: string; kind: string }[]
}

/** POST /v1/posts. A retry (network failures only) reuses the variables, so it reuses the key. */
export function useCreatePostMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: CreatePostVariables) => createPost(body, idempotencyKey),
    retry: (count, err) => count < 2 && isNetworkFailure(err),
    onSuccess: (created, variables) => showCreatedPost(qc, created, variables.media),
  })
}

export function usePostDrafts(enabled = true) {
  return useQuery({ queryKey: POST_DRAFTS_KEY, queryFn: () => listPostDrafts(), enabled, staleTime: 15_000 })
}

export function usePostDraft(id: string | null | undefined) {
  return useQuery({
    queryKey: [...POST_DRAFTS_KEY, id],
    queryFn: () => getPostDraft(id as string),
    enabled: Boolean(id),
    // A draft opened into the form must not refetch under the author's typing.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

export function useDeletePostDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePostDraft(id),
    onSuccess: (_void, id) => {
      qc.setQueryData<PostDraftRow[]>(POST_DRAFTS_KEY, (rows) => rows?.filter((r) => r.id !== id))
      qc.invalidateQueries({ queryKey: POST_DRAFTS_KEY })
    },
  })
}

/** Everything a composer hands over to post or save. */
export interface ComposeSubmission {
  text: string
  details: PostDetailsForm
  media: readonly ComposeMedia[]
  extras: ComposeExtras
  /** The draft this form was opened from: Post saves it and publishes it, Drafts saves over it. */
  draftId?: string | null
}

/**
 * Post and Drafts for both composers.
 *
 * Both upload what is not yet uploaded first, through lib/mediaUpload.ts, and
 * report each new id through `onUploaded` so the composer keeps it — a failed
 * post retried, or a draft posted later, uploads nothing twice.
 *
 * Post from a fresh form: alt texts onto the assets, then POST /v1/posts with
 * ONE Idempotency-Key per attempt (createAttemptKeys: the same request gets
 * the same key across retries and re-clicks; an edited request gets a new
 * one). Post from a draft: PATCH the draft with what is on screen, then
 * publish it — the draft id becomes the post id, which is its own dedupe.
 */
export function useComposeSubmit(onUploaded?: (key: string, mediaId: string) => void) {
  const qc = useQueryClient()
  const create = useCreatePostMutation()
  const keysRef = useRef(createAttemptKeys())
  const [posting, setPosting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)

  const publish = useCallback(
    async ({ text, details, media, extras, draftId }: ComposeSubmission): Promise<PostDetail> => {
      setPosting(true)
      try {
        const uploaded = await uploadPending(media, onUploaded)
        const kinds = uploaded.map((m) => ({ media_id: m.mediaId, kind: m.kind }))
        if (draftId) {
          await updatePostDraft(draftId, buildDraftRequest({ text, details, media: uploaded, extras }))
          const created = await publishPostDraft(draftId)
          showCreatedPost(qc, created, kinds)
          qc.removeQueries({ queryKey: [...POST_DRAFTS_KEY, draftId] })
          qc.invalidateQueries({ queryKey: POST_DRAFTS_KEY })
          return created
        }
        await applyAltTexts(uploaded)
        const body = buildCreateRequest({ text, details, media: uploaded, extras })
        const idempotencyKey = keysRef.current.keyFor(JSON.stringify(body))
        const created = await create.mutateAsync({ body, idempotencyKey, media: kinds })
        keysRef.current.reset()
        return created
      } finally {
        setPosting(false)
      }
    },
    [create, onUploaded, qc],
  )

  const saveDraft = useCallback(
    async ({ text, details, media, extras, draftId }: ComposeSubmission): Promise<PostDraftRow> => {
      setSavingDraft(true)
      try {
        const uploaded = await uploadPending(media, onUploaded)
        const request = buildDraftRequest({ text, details, media: uploaded, extras })
        const row = draftId ? await updatePostDraft(draftId, request) : await createPostDraft(request)
        qc.setQueryData([...POST_DRAFTS_KEY, row.id], row)
        qc.invalidateQueries({ queryKey: POST_DRAFTS_KEY, exact: true })
        return row
      } finally {
        setSavingDraft(false)
      }
    },
    [onUploaded, qc],
  )

  return { publish, saveDraft, posting, savingDraft }
}

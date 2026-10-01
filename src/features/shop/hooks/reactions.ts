"use client"

// Like / dislike on a product, Helpful / Not helpful on a review: drawn the
// moment they are pressed, put back if the server refuses, and settled to
// the server's own figures when it answers. The rules are in
// model/reactions.ts; this only applies them to the caches.
//
// Each press carries the state it was pressed FROM (`before`), so the
// request sent is the one the person saw: pressing a lit Like sends DELETE.
// The mutation options are built by plain functions (the hooks only bind
// them), so the optimistic write and the rollback run in a bun test against
// a real QueryClient.

import { useMutation, useQueryClient, type MutationOptions, type QueryClient } from "@tanstack/react-query"
import { sendProductReaction, sendReviewVote } from "../api/reactions"
import {
  pressReaction,
  pressReviewVote,
  type Reaction,
  type ReactionState,
  type ReviewVote,
  type ReviewVoteState,
  type VoteRequest,
} from "../model/reactions"
import { withReviewVote, type ReviewsPage } from "../model/reviews"
import { isSignedOut, signInHref, type WireProductSummary } from "../model/storefront"
import type { WireProductDetailBody } from "../model/catalogue"
import { CATALOGUE_KEYS } from "./catalogue"
import { REVIEWS_KEY } from "./reviews"

type Snapshot = Array<[readonly unknown[], unknown]>

export type DetailWithReaction = WireProductDetailBody & {
  product?: (WireProductSummary & { viewer_reaction?: Reaction | null; like_count?: number; share_count?: number }) | null
}

/** The detail body with the reaction written onto its product. */
export function withProductReaction(body: DetailWithReaction | undefined, state: ReactionState): DetailWithReaction | undefined {
  if (!body?.product) return body
  return { ...body, product: { ...body.product, viewer_reaction: state.viewerReaction, like_count: state.likeCount } }
}

const goSignIn = (error: unknown) => {
  if (typeof window !== "undefined" && isSignedOut(error)) {
    window.location.assign(signInHref(window.location.pathname + window.location.search))
  }
}

export type ReactionVars = { before: ReactionState; pressed: Reaction }
export type SendReaction = (productId: string, request: VoteRequest<Reaction>) => Promise<ReactionState>

export function productReactionOptions(
  qc: QueryClient,
  productId: string,
  send: SendReaction = sendProductReaction,
): MutationOptions<ReactionState, unknown, ReactionVars, { snapshot: Snapshot }> {
  const key = CATALOGUE_KEYS.detail(productId)
  return {
    mutationFn: ({ before, pressed }) => send(productId, pressReaction(before, pressed).request),
    onMutate: async ({ before, pressed }) => {
      await qc.cancelQueries({ queryKey: key })
      const snapshot: Snapshot = [[key, qc.getQueryData(key)]]
      qc.setQueryData<DetailWithReaction>(key, (body) => withProductReaction(body, pressReaction(before, pressed).next))
      return { snapshot }
    },
    onSuccess: (state) => {
      qc.setQueryData<DetailWithReaction>(key, (body) => withProductReaction(body, state))
    },
    onError: (error, _vars, context) => {
      for (const [k, data] of context?.snapshot ?? []) qc.setQueryData(k, data)
      goSignIn(error)
    },
  }
}

/** `PUT|DELETE /products/:id/reaction`, optimistic on the detail cache. */
export function useProductReaction(productId: string) {
  const qc = useQueryClient()
  return useMutation(productReactionOptions(qc, productId))
}

export type VoteVars = { reviewId: string; before: ReviewVoteState; pressed: ReviewVote }
export type SendVote = (reviewId: string, request: VoteRequest<ReviewVote>) => Promise<ReviewVoteState>

export function reviewVoteOptions(
  qc: QueryClient,
  productId: string,
  send: SendVote = sendReviewVote,
): MutationOptions<ReviewVoteState, unknown, VoteVars, { snapshot: Snapshot }> {
  const prefix = REVIEWS_KEY(productId)
  return {
    mutationFn: ({ reviewId, before, pressed }) => send(reviewId, pressReviewVote(before, pressed).request),
    onMutate: async ({ reviewId, before, pressed }) => {
      await qc.cancelQueries({ queryKey: prefix })
      const snapshot: Snapshot = qc.getQueriesData({ queryKey: prefix })
      const next = pressReviewVote(before, pressed).next
      qc.setQueriesData<ReviewsPage>({ queryKey: prefix }, (page) => withReviewVote(page, reviewId, next) ?? page)
      return { snapshot }
    },
    onSuccess: (state, { reviewId }) => {
      qc.setQueriesData<ReviewsPage>({ queryKey: prefix }, (page) => withReviewVote(page, reviewId, state) ?? page)
    },
    onError: (error, _vars, context) => {
      for (const [k, data] of context?.snapshot ?? []) qc.setQueryData(k, data)
      goSignIn(error)
    },
  }
}

/** `PUT|DELETE /reviews/:id/vote`, optimistic on every sort of the product's reviews. */
export function useReviewVote(productId: string) {
  const qc = useQueryClient()
  return useMutation(reviewVoteOptions(qc, productId))
}

// Like / dislike a product, and Helpful / Not helpful on a review
// (shop-engagement contract §2, §3). AUTH; all four are idempotent.
//   PUT    /products/:id/reaction {kind}  → {viewer_reaction, like_count}
//   DELETE /products/:id/reaction         → {viewer_reaction:null, like_count}
//   PUT    /reviews/:id/vote {vote}       → {viewer_vote, helpful_count}
//   DELETE /reviews/:id/vote              → {viewer_vote:null, helpful_count}

import api from "@/lib/api"
import {
  toReactionState,
  toReviewVoteState,
  type Reaction,
  type ReactionState,
  type ReviewVote,
  type ReviewVoteState,
  type VoteRequest,
  type WireReactionResult,
  type WireReviewVoteResult,
} from "../model/reactions"

const BASE = "/v1/commerce"

export async function sendProductReaction(productId: string, request: VoteRequest<Reaction>): Promise<ReactionState> {
  const url = `${BASE}/products/${encodeURIComponent(productId)}/reaction`
  const res = request.method === "PUT"
    ? await api.put<{ data: WireReactionResult }>(url, { kind: request.kind })
    : await api.delete<{ data: WireReactionResult }>(url)
  return toReactionState(res.data?.data)
}

export async function sendReviewVote(reviewId: string, request: VoteRequest<ReviewVote>): Promise<ReviewVoteState> {
  const url = `${BASE}/reviews/${encodeURIComponent(reviewId)}/vote`
  const res = request.method === "PUT"
    ? await api.put<{ data: WireReviewVoteResult }>(url, { vote: request.kind })
    : await api.delete<{ data: WireReviewVoteResult }>(url)
  return toReviewVoteState(res.data?.data)
}

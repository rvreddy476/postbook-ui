// Product like / dislike, and review Helpful / Not helpful, as state.
//
// shop-engagement contract §2 and §3:
//   PUT    /products/:id/reaction {kind:"like"|"dislike"} → {viewer_reaction, like_count}
//   DELETE /products/:id/reaction                         → {viewer_reaction:null, like_count}
//   PUT    /reviews/:id/vote {vote:"helpful"|"not_helpful"} → {viewer_vote, helpful_count}
//   DELETE /reviews/:id/vote                               → {viewer_vote:null, helpful_count}
//
// The LIKE count is public; a DISLIKE is private and its count is never
// sent, so nothing here has one to draw. Likewise only the helpful count of
// a review is public. Both pairs are one state machine: pressing the lit
// button clears it, pressing the other one switches, and the public count
// moves only when the public side is entered or left.

// ── The machine ────────────────────────────────────────────────────────

/**
 * `positive` is the side with a public count ("like", "helpful"); `negative`
 * is the private one ("dislike", "not_helpful"). `null` is neither.
 */
export interface VoteState<P extends string, N extends string> {
  viewer: P | N | null
  count: number
}

export type VoteRequest<K extends string> = { method: "PUT"; kind: K } | { method: "DELETE" }

/** What a press does: the next state, drawn now, and the request that makes it so. */
export function pressVote<P extends string, N extends string>(
  state: VoteState<P, N>,
  pressed: P | N,
  positive: P,
): { next: VoteState<P, N>; request: VoteRequest<P | N> } {
  const clearing = state.viewer === pressed
  const viewer = clearing ? null : pressed
  const wasPositive = state.viewer === positive
  const isPositive = viewer === positive
  const delta = wasPositive === isPositive ? 0 : isPositive ? 1 : -1
  return {
    next: { viewer, count: Math.max(0, safeCount(state.count) + delta) },
    request: clearing ? { method: "DELETE" } : { method: "PUT", kind: pressed },
  }
}

const safeCount = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)

// ── Product reactions ─────────────────────────────────────────────────

export type Reaction = "like" | "dislike"

export function isReaction(value: unknown): value is Reaction {
  return value === "like" || value === "dislike"
}

export interface ReactionState {
  viewerReaction: Reaction | null
  likeCount: number
}

export interface WireReactionResult {
  viewer_reaction?: Reaction | null
  like_count?: number
}

/** The server's answer as state. An unknown reaction reads as none; an absent count (Go omitempty) as 0. */
export function toReactionState(wire: WireReactionResult | null | undefined): ReactionState {
  return {
    viewerReaction: isReaction(wire?.viewer_reaction) ? wire.viewer_reaction : null,
    likeCount: safeCount(wire?.like_count),
  }
}

/**
 * The reaction fields of `GET /products/:id`. The contract adds them to the
 * product; a body that carries them beside the product is read too, so the
 * page does not depend on which of the two the handler chose.
 */
export function readProductReaction(body: {
  product?: (WireReactionResult & { share_count?: number }) | null
  viewer_reaction?: Reaction | null
  like_count?: number
} | null | undefined): ReactionState {
  const product = body?.product ?? null
  return {
    viewerReaction: isReaction(product?.viewer_reaction) ? product.viewer_reaction : isReaction(body?.viewer_reaction) ? body.viewer_reaction : null,
    likeCount: safeCount(product?.like_count) || safeCount(body?.like_count),
  }
}

export function pressReaction(state: ReactionState, pressed: Reaction): { next: ReactionState; request: VoteRequest<Reaction> } {
  const { next, request } = pressVote<"like", "dislike">({ viewer: state.viewerReaction, count: state.likeCount }, pressed, "like")
  return { next: { viewerReaction: next.viewer, likeCount: next.count }, request }
}

/** "1.2K" style for the like count; "0" stays "0". */
export function compactCount(n: number): string {
  const value = safeCount(n)
  if (value < 1000) return String(value)
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

/** The like button's accessible name: the action, and the count it shows. */
export function likeLabel(state: ReactionState): string {
  const n = state.likeCount
  const count = `${n} ${n === 1 ? "like" : "likes"}`
  return state.viewerReaction === "like" ? `Remove your like, ${count}` : `Like this product, ${count}`
}

/** The dislike button's accessible name. It never carries a count. */
export function dislikeLabel(state: ReactionState): string {
  return state.viewerReaction === "dislike" ? "Remove your dislike" : "Dislike this product"
}

// ── Review votes ──────────────────────────────────────────────────────

export type ReviewVote = "helpful" | "not_helpful"

export function isReviewVote(value: unknown): value is ReviewVote {
  return value === "helpful" || value === "not_helpful"
}

export interface ReviewVoteState {
  viewerVote: ReviewVote | null
  helpfulCount: number
}

export interface WireReviewVoteResult {
  viewer_vote?: ReviewVote | null
  helpful_count?: number
}

export function toReviewVoteState(wire: WireReviewVoteResult | null | undefined): ReviewVoteState {
  return {
    viewerVote: isReviewVote(wire?.viewer_vote) ? wire.viewer_vote : null,
    helpfulCount: safeCount(wire?.helpful_count),
  }
}

export function pressReviewVote(state: ReviewVoteState, pressed: ReviewVote): { next: ReviewVoteState; request: VoteRequest<ReviewVote> } {
  const { next, request } = pressVote<"helpful", "not_helpful">({ viewer: state.viewerVote, count: state.helpfulCount }, pressed, "helpful")
  return { next: { viewerVote: next.viewer, helpfulCount: next.count }, request }
}

/**
 * Whether the vote buttons are drawn on a review. Never on the viewer's own
 * (the server answers 403 CANNOT_VOTE_OWN_REVIEW). A signed-out viewer sees
 * them and is sent to sign in; while the session is not known yet they are
 * held back, so an author never sees them flash on their own review.
 */
export function canShowReviewVotes(input: { reviewerId: string; viewerId: string | null; known: boolean }): boolean {
  if (!input.known) return false
  if (!input.viewerId) return true
  return !input.reviewerId || input.reviewerId !== input.viewerId
}

/** "Helpful (3)", or just "Helpful" while nobody has said so. */
export function helpfulLabel(count: number): string {
  const n = safeCount(count)
  return n > 0 ? `Helpful (${n})` : "Helpful"
}

/**
 * What a refused press says. A 401 is not said (the shopper is sent to sign
 * in); the codes are branched on, never the message.
 */
export function voteFailureMessage(error: unknown): string {
  const code = (error as { response?: { data?: { error?: { code?: unknown } } } } | null)?.response?.data?.error?.code
  switch (code) {
    case "CANNOT_VOTE_OWN_REVIEW":
      return "You can't vote on your own review."
    case "RATE_LIMITED":
      return "Too many taps. Try again in a moment."
    default:
      return "That did not save. Try again."
  }
}

// ── Review sort ───────────────────────────────────────────────────────

export type ReviewSort = "helpful" | "recent"

export const DEFAULT_REVIEW_SORT: ReviewSort = "helpful"

/** The sort menu, in ascending alphabetical order by label (the founder's rule). */
export const REVIEW_SORTS: ReadonlyArray<{ value: ReviewSort; label: string }> = [
  { value: "helpful", label: "Most helpful" },
  { value: "recent", label: "Most recent" },
]

export function isReviewSort(value: unknown): value is ReviewSort {
  return value === "helpful" || value === "recent"
}

/** The `sort` query value; anything unknown is the server's default. */
export function reviewSortParam(value: unknown): ReviewSort {
  return isReviewSort(value) ? value : DEFAULT_REVIEW_SORT
}

import Link from "next/link"
import { BadgeCheck, Star, ThumbsDown, ThumbsUp } from "lucide-react"
import {
  canShowReviewVotes,
  helpfulLabel,
  REVIEW_SORTS,
  type ReviewSort,
  type ReviewVote,
  type ReviewVoteState,
} from "../../model/reactions"
import { WRITE_REVIEW_HREF, type Review } from "../../model/reviews"

export function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <span className="shop-review__stars" role="img" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} aria-hidden="true" fill={n <= rating ? "currentColor" : "none"} data-empty={n > rating ? "true" : undefined} />
      ))}
    </span>
  )
}

/**
 * "Helpful (n)" and "Not helpful" under a review. Only the helpful side has
 * a public count. Signed out, both are sign-in links.
 */
export function ReviewVoteButtons({ review, signInUrl, pending, onVote }: {
  review: Review
  signInUrl: string | null
  pending?: boolean
  onVote: (pressed: ReviewVote, before: ReviewVoteState) => void
}) {
  const before: ReviewVoteState = { viewerVote: review.viewerVote, helpfulCount: review.helpfulCount }
  const helpful = review.viewerVote === "helpful"
  const notHelpful = review.viewerVote === "not_helpful"
  if (signInUrl) {
    return (
      <div className="shop-review__votes" role="group" aria-label="Was this review helpful?">
        <Link href={signInUrl} className="shop-review__vote" aria-label={`Sign in to mark this review helpful, ${review.helpfulCount} found it helpful`}>
          <ThumbsUp size={13} aria-hidden="true" /> {helpfulLabel(review.helpfulCount)}
        </Link>
        <Link href={signInUrl} className="shop-review__vote" aria-label="Sign in to mark this review not helpful">
          <ThumbsDown size={13} aria-hidden="true" /> Not helpful
        </Link>
      </div>
    )
  }
  return (
    <div className="shop-review__votes" role="group" aria-label="Was this review helpful?" aria-busy={pending || undefined}>
      <button
        type="button"
        className={`shop-review__vote${helpful ? " shop-review__vote--on" : ""}`}
        aria-pressed={helpful}
        disabled={pending}
        onClick={() => onVote("helpful", before)}
      >
        <ThumbsUp size={13} aria-hidden="true" fill={helpful ? "currentColor" : "none"} /> {helpfulLabel(review.helpfulCount)}
      </button>
      <button
        type="button"
        className={`shop-review__vote${notHelpful ? " shop-review__vote--on" : ""}`}
        aria-pressed={notHelpful}
        disabled={pending}
        onClick={() => onVote("not_helpful", before)}
      >
        <ThumbsDown size={13} aria-hidden="true" fill={notHelpful ? "currentColor" : "none"} /> Not helpful
      </button>
    </div>
  )
}

export interface ReviewVoting {
  /** The signed-in viewer's id, or null. Their own reviews get no buttons. */
  viewerId: string | null
  /** False until the session has been read, so an author never sees buttons flash on their own review. */
  known: boolean
  /** Set when nobody is signed in. */
  signInUrl: string | null
  /** The review whose vote is in flight. */
  pendingReviewId: string | null
  onVote: (reviewId: string, pressed: ReviewVote, before: ReviewVoteState) => void
}

/**
 * The reviews block: sort, rating, title, body, date, Helpful / Not helpful.
 * "Write a review" belongs to an order (W2), so the link goes to the orders
 * page.
 */
export function ReviewList({ reviews, total, average, isLoading, sort, onSort, voting }: {
  reviews: Review[]
  total: number
  average: number | null
  isLoading?: boolean
  sort?: ReviewSort
  onSort?: (sort: ReviewSort) => void
  voting?: ReviewVoting
}) {
  return (
    <section className="shop-pdp__section" aria-labelledby="shop-reviews-title">
      <div className="shop-reviews">
        <div className="shop-reviews__head">
          <h2 id="shop-reviews-title" style={{ margin: 0 }}>
            Reviews{total > 0 ? <span className="shop-page__lede" style={{ display: "inline", marginLeft: 6 }}>({total})</span> : null}
          </h2>
          <div className="shop-reviews__tools">
            {sort && onSort && reviews.length > 1 ? (
              <label className="shop-reviews__sort">
                <span>Sort by</span>
                <select
                  className="shop-input shop-input--sm"
                  value={sort}
                  onChange={(event) => onSort(event.target.value as ReviewSort)}
                >
                  {REVIEW_SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            ) : null}
            <Link href={WRITE_REVIEW_HREF} className="shop-link">Write a review</Link>
          </div>
        </div>
        {average !== null && reviews.length > 0 ? (
          <div className="shop-pdp__rating" style={{ marginTop: 0 }}>
            <Stars rating={Math.round(average)} />
            <span>{average.toFixed(1)} from {reviews.length} {reviews.length === 1 ? "review" : "reviews"}</span>
          </div>
        ) : null}
        {isLoading ? (
          <div className="shop-reviews__list" aria-busy="true">
            <div className="shop-skeleton" style={{ height: 88 }} />
            <div className="shop-skeleton" style={{ height: 88 }} />
          </div>
        ) : reviews.length === 0 ? (
          <p className="shop-notice">No reviews yet. Buyers can review this product from a delivered order.</p>
        ) : (
          <ul className="shop-reviews__list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {reviews.map((r) => (
              <li key={r.id} className="shop-review">
                <div className="shop-review__top">
                  <Stars rating={r.rating} />
                  {r.date ? <time className="shop-review__date" dateTime={r.createdAt}>{r.date}</time> : null}
                </div>
                {r.title ? <p className="shop-review__title">{r.title}</p> : null}
                {r.body ? <p className="shop-review__body">{r.body}</p> : null}
                {r.verified ? <span className="shop-review__verified"><BadgeCheck size={13} aria-hidden="true" /> Verified purchase</span> : null}
                {r.sellerResponse ? <p className="shop-review__response">Seller: {r.sellerResponse}</p> : null}
                {voting && canShowReviewVotes({ reviewerId: r.reviewerId, viewerId: voting.viewerId, known: voting.known }) ? (
                  <ReviewVoteButtons
                    review={r}
                    signInUrl={voting.signInUrl}
                    pending={voting.pendingReviewId === r.id}
                    onVote={(pressed, before) => voting.onVote(r.id, pressed, before)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

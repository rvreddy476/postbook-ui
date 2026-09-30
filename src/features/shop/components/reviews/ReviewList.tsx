import Link from "next/link"
import { BadgeCheck, Star } from "lucide-react"
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
 * The reviews block: rating, title, body, date. "Write a review" belongs to
 * an order (W2), so the link goes to the orders page.
 */
export function ReviewList({ reviews, total, average, isLoading }: { reviews: Review[]; total: number; average: number | null; isLoading?: boolean }) {
  return (
    <section className="shop-pdp__section" aria-labelledby="shop-reviews-title">
      <div className="shop-reviews">
        <div className="shop-reviews__head">
          <h2 id="shop-reviews-title" style={{ margin: 0 }}>
            Reviews{total > 0 ? <span className="shop-page__lede" style={{ display: "inline", marginLeft: 6 }}>({total})</span> : null}
          </h2>
          <Link href={WRITE_REVIEW_HREF} className="shop-link">Write a review</Link>
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

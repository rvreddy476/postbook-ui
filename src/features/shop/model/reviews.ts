// Reviews, as `GET /products/:id/reviews` sends them: `{reviews, total}`
// of `postgres.Review`. Writing one is W2's (it needs a delivered order),
// so this side only reads and links to the orders page.

import { SHOP_BASE } from "./storefront"

export interface WireReview {
  id?: string
  product_id?: string
  seller_id?: string
  reviewer_id?: string
  /** omitempty: a 0 would be absent, and a review without a rating is not one. */
  rating?: number
  title?: string | null
  body?: string | null
  is_verified_purchase?: boolean
  is_published?: boolean
  helpful_count?: number
  seller_response?: string | null
  seller_responded_at?: string
  created_at?: string
}

export interface WireReviewsPage {
  reviews?: WireReview[] | null
  total?: number
}

export interface Review {
  id: string
  /** 1..5. */
  rating: number
  title: string | null
  body: string | null
  verified: boolean
  /** "12 Mar 2026", or "" when the wire sent no date. */
  date: string
  createdAt: string
  sellerResponse: string | null
}

export interface ReviewsPage {
  reviews: Review[]
  total: number
  /** The mean of the loaded ratings, one decimal, or null with none. */
  average: number | null
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" })

export function formatReviewDate(iso: string | null | undefined): string {
  if (!iso) return ""
  const at = new Date(iso)
  return Number.isNaN(at.getTime()) ? "" : DATE_FORMAT.format(at)
}

export function toReview(r: WireReview): Review | null {
  if (!r || !r.id) return null
  const rating = typeof r.rating === "number" ? Math.round(r.rating) : 0
  if (rating < 1 || rating > 5) return null
  return {
    id: r.id,
    rating,
    title: r.title || null,
    body: r.body || null,
    verified: r.is_verified_purchase === true,
    date: formatReviewDate(r.created_at),
    createdAt: r.created_at || "",
    sellerResponse: r.seller_response || null,
  }
}

export function toReviewsPage(page: WireReviewsPage | null | undefined): ReviewsPage {
  const rows = Array.isArray(page?.reviews) ? page.reviews : []
  const reviews: Review[] = []
  for (const row of rows) {
    const review = toReview(row)
    if (review) reviews.push(review)
  }
  const total = typeof page?.total === "number" && page.total >= reviews.length ? page.total : reviews.length
  const average = reviews.length
    ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
    : null
  return { reviews, total, average }
}

/** "4.3 (12)" / "No reviews yet" for the product page's meta line. */
export function ratingSummary(avgRating: number | null, count: number): string {
  if (!avgRating || count <= 0) return "No reviews yet"
  return `${avgRating.toFixed(1)} (${count})`
}

/** "Write a review" is W2's; it lives on the order, so the link goes there. */
export const WRITE_REVIEW_HREF = `${SHOP_BASE}/orders`

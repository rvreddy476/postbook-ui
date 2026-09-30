import { describe, expect, it } from "bun:test"
import { WRITE_REVIEW_HREF, formatReviewDate, ratingSummary, toReview, toReviewsPage } from "../model/reviews"

// GET /products/:id/reviews → {reviews, total}. A review without a rating
// (Go's absent 0) is not one; the date is formatted for India.

describe("toReview", () => {
  it("reads a published review", () => {
    const r = toReview({ id: "r1", rating: 4, title: "Good", body: "Solid.", is_verified_purchase: true, created_at: "2026-03-12T10:00:00Z" })!
    expect(r.rating).toBe(4)
    expect(r.title).toBe("Good")
    expect(r.verified).toBe(true)
    expect(r.date).toBe("12 Mar 2026")
  })

  it("drops a review with no id or a rating outside 1..5, and empties become null", () => {
    expect(toReview({ rating: 5 })).toBeNull()
    expect(toReview({ id: "r", rating: undefined })).toBeNull()
    expect(toReview({ id: "r", rating: 6 })).toBeNull()
    const r = toReview({ id: "r", rating: 3, title: "", body: "" })!
    expect(r.title).toBeNull()
    expect(r.body).toBeNull()
    expect(r.verified).toBe(false)
    expect(r.date).toBe("")
  })
})

describe("toReviewsPage", () => {
  it("counts, averages to one decimal, and trusts a larger server total", () => {
    const page = toReviewsPage({ reviews: [{ id: "a", rating: 5 }, { id: "b", rating: 4 }, { id: "c", rating: 4 }], total: 12 })
    expect(page.reviews).toHaveLength(3)
    expect(page.total).toBe(12)
    expect(page.average).toBe(4.3)
  })

  it("is empty for nothing", () => {
    expect(toReviewsPage(undefined)).toEqual({ reviews: [], total: 0, average: null })
    expect(toReviewsPage({ reviews: null, total: 0 })).toEqual({ reviews: [], total: 0, average: null })
  })

  it("summarises the rating line and links writing to the orders page", () => {
    expect(ratingSummary(4.25, 12)).toBe("4.3 (12)")
    expect(ratingSummary(null, 0)).toBe("No reviews yet")
    expect(ratingSummary(4, 0)).toBe("No reviews yet")
    expect(WRITE_REVIEW_HREF).toBe("/shop/orders")
    expect(formatReviewDate("garbage")).toBe("")
  })
})

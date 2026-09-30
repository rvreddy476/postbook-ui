// Reviews, read side. `GET /products/:id/reviews?limit&offset` → `{reviews, total}`.
// Writing one is W2's (it needs a delivered order item).

import api from "@/lib/api"
import { toReviewsPage, type ReviewsPage, type WireReviewsPage } from "../model/reviews"

const BASE = "/v1/commerce"

export const REVIEWS_LIMIT = 20

export async function fetchProductReviews(productId: string, page: { limit?: number; offset?: number } = {}): Promise<ReviewsPage> {
  const res = await api.get<{ data: WireReviewsPage }>(`${BASE}/products/${encodeURIComponent(productId)}/reviews`, {
    params: { limit: page.limit ?? REVIEWS_LIMIT, offset: page.offset ?? 0 },
  })
  return toReviewsPage(res.data?.data)
}

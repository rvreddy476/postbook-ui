"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchProductReviews } from "../api/reviews"
import { reviewSortParam, type ReviewSort } from "../model/reactions"
import type { ReviewsPage } from "../model/reviews"

/** Every sort of one product's reviews shares this prefix; a vote updates them all. */
export const REVIEWS_KEY = (productId: string) => ["shop", "reviews", productId] as const
export const REVIEWS_SORTED_KEY = (productId: string, sort: ReviewSort) => ["shop", "reviews", productId, sort] as const

/** `GET /products/:id/reviews?sort=`, the first page. The previous sort stays drawn while the next loads. */
export function useProductReviews(productId: string | undefined, sort?: ReviewSort) {
  const order = reviewSortParam(sort)
  return useQuery<ReviewsPage>({
    queryKey: REVIEWS_SORTED_KEY(productId ?? "", order),
    queryFn: () => fetchProductReviews(productId as string, { sort: order }),
    enabled: !!productId,
    staleTime: 60 * 1000,
    // Only the same product's other sort stands in, never another product's reviews.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[2] === (productId ?? "") ? previous : undefined),
  })
}

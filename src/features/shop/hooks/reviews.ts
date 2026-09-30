"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchProductReviews } from "../api/reviews"
import type { ReviewsPage } from "../model/reviews"

export const REVIEWS_KEY = (productId: string) => ["shop", "reviews", productId] as const

/** `GET /products/:id/reviews`, the first page. */
export function useProductReviews(productId: string | undefined) {
  return useQuery<ReviewsPage>({
    queryKey: REVIEWS_KEY(productId ?? ""),
    queryFn: () => fetchProductReviews(productId as string),
    enabled: !!productId,
    staleTime: 60 * 1000,
  })
}

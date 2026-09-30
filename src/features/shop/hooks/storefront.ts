"use client"

// TanStack Query hooks for the storefront reads, and the shop's view of the
// session. Query keys are namespaced ["shop", "storefront", …].

import { useEffect, useState } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useAuthUser } from "@/store/auth"
import { fetchCategories, fetchHome, fetchProducts } from "../api/storefront"
import { orderCategories, type BrowseFilters, type CategoryCard, type HomePage, type ProductCard, type ProductPage } from "../model/storefront"

export const STOREFRONT_KEYS = {
  home: ["shop", "storefront", "home"] as const,
  categories: ["shop", "storefront", "categories"] as const,
  products: (filters: Partial<BrowseFilters>, limit: number) =>
    ["shop", "storefront", "products", filters.q || "", filters.category || "", !!filters.inStock, filters.minPrice ?? null, filters.maxPrice ?? null, filters.minRating ?? null, limit] as const,
  /** The prefix every product-list query shares; the heart's optimistic update walks it. */
  allProducts: ["shop", "storefront", "products"] as const,
}

/**
 * Whether a shopper is signed in.
 *
 * `useAuthUser` reads the cached session record (src/store/auth.ts); on the
 * server and during hydration it answers null, so `known` is false until
 * the first client render has run. The gated queries (bag, favourites,
 * addresses) wait for `known && signedIn`; a signed-out shopper is never
 * asked for a bag, which is what stops a 401 loop on a public page.
 */
export function useShopSession(): { signedIn: boolean; known: boolean; user: ReturnType<typeof useAuthUser> } {
  const user = useAuthUser()
  const [known, setKnown] = useState(false)
  useEffect(() => setKnown(true), [])
  return { signedIn: !!user, known, user }
}

/** `GET /home`. One request for the whole first screen. */
export function useHome() {
  return useQuery<HomePage>({
    queryKey: STOREFRONT_KEYS.home,
    queryFn: fetchHome,
    staleTime: 60 * 1000,
  })
}

/** `GET /categories`, already in strip order. */
export function useCategories() {
  return useQuery<CategoryCard[]>({
    queryKey: STOREFRONT_KEYS.categories,
    queryFn: async () => orderCategories(await fetchCategories()),
    staleTime: 5 * 60 * 1000,
  })
}

export const PRODUCT_PAGE_SIZE = 24

/**
 * `GET /products`, cursor-paged. `fetchNextPage` when the sentinel at the
 * bottom of the grid is in view; `hasNextPage` is false once the server
 * sends an empty `next_cursor`.
 */
export function useInfiniteProducts(filters: Partial<BrowseFilters>, limit = PRODUCT_PAGE_SIZE) {
  return useInfiniteQuery<ProductPage, Error, { pages: ProductPage[]; pageParams: unknown[] }, readonly unknown[], string | null>({
    queryKey: STOREFRONT_KEYS.products(filters, limit),
    initialPageParam: null,
    queryFn: ({ pageParam }) => fetchProducts(filters, { cursor: pageParam, limit }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30 * 1000,
  })
}

/** Every loaded card across the pages, in order. */
export function flattenProducts(data: { pages: ProductPage[] } | undefined): ProductCard[] {
  if (!data) return []
  return data.pages.flatMap((page) => page.items)
}

/** True when the OS asks for less motion. False on the server. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return reduced
}

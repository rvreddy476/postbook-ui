"use client"

// Favourites: the list, and the optimistic heart.
//
// Every cached copy of the product flips at once — the favourites list,
// the home rails, every product-list page, the detail page — and the
// snapshot of all of them is the rollback. The rules are in
// model/favourites.ts; this only applies them.

import { useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query"
import { addFavourite, fetchFavourites, removeFavourite } from "../api/favourites"
import { favouritesAfterToggle, markFavouriteIn, type FavouritesPage } from "../model/favourites"
import { isSignedOut, signInHref, type HomePage, type ProductCard, type ProductPage } from "../model/storefront"
import { CATALOGUE_KEYS } from "./catalogue"
import { STOREFRONT_KEYS, useShopSession } from "./storefront"

export const FAVOURITES_KEY = ["shop", "favourites"] as const

/** `GET /favourites?limit=100`. Never asked for a signed-out shopper. */
export function useFavourites() {
  const { signedIn, known } = useShopSession()
  return useQuery<FavouritesPage>({
    queryKey: FAVOURITES_KEY,
    queryFn: fetchFavourites,
    enabled: known && signedIn,
    staleTime: 30 * 1000,
  })
}

type Vars = { product: ProductCard; isFavourite: boolean }
type Snapshot = Array<[readonly unknown[], unknown]>

/**
 * `POST /favourites {product_id}` / `DELETE /favourites/:productId`, applied
 * to every cache first and undone if the server refuses. A 401 sends the
 * shopper to sign in with a way back, exactly as adding to the bag does.
 */
export function useToggleFavourite() {
  const qc = useQueryClient()

  const apply = (id: string, on: boolean) => {
    qc.setQueryData<HomePage>(STOREFRONT_KEYS.home, (home) =>
      home ? { ...home, sections: home.sections.map((s) => ({ ...s, products: markFavouriteIn(s.products, id, on) })) } : home)
    qc.setQueriesData<InfiniteData<ProductPage>>({ queryKey: STOREFRONT_KEYS.allProducts }, (data) =>
      data && Array.isArray(data.pages)
        ? { ...data, pages: data.pages.map((p) => ({ ...p, items: markFavouriteIn(p.items, id, on) })) }
        : data)
    qc.setQueryData<{ product?: { is_favourite?: boolean | null } | null }>(CATALOGUE_KEYS.detail(id), (detail) =>
      detail?.product ? { ...detail, product: { ...detail.product, is_favourite: on } } : detail)
  }

  return useMutation<void, unknown, Vars, { snapshot: Snapshot }>({
    mutationFn: ({ product, isFavourite }) => (isFavourite ? addFavourite(product.id) : removeFavourite(product.id)),
    onMutate: async ({ product, isFavourite }) => {
      await qc.cancelQueries({ queryKey: FAVOURITES_KEY })
      const snapshot: Snapshot = [
        ...qc.getQueriesData({ queryKey: FAVOURITES_KEY }),
        ...qc.getQueriesData({ queryKey: STOREFRONT_KEYS.home }),
        ...qc.getQueriesData({ queryKey: STOREFRONT_KEYS.allProducts }),
        ...qc.getQueriesData({ queryKey: CATALOGUE_KEYS.detail(product.id) }),
      ]
      qc.setQueryData<FavouritesPage>(FAVOURITES_KEY, (page) => favouritesAfterToggle(page, product, isFavourite))
      apply(product.id, isFavourite)
      return { snapshot }
    },
    onError: (error, _vars, context) => {
      for (const [key, data] of context?.snapshot ?? []) qc.setQueryData(key, data)
      if (typeof window !== "undefined" && isSignedOut(error)) {
        window.location.assign(signInHref(window.location.pathname + window.location.search))
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: FAVOURITES_KEY })
    },
  })
}

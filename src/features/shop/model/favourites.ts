// Favourites, as state: what the heart does to the caches BEFORE the server
// answers, and what it puts back when the server says no.
//
// Pure on purpose. The optimistic update touches four query shapes (the
// favourites list, the home page, every product list page, one product
// detail) and the same product can sit in three of them at once. Getting
// that right inside a mutation callback is how a heart ends up filled on
// the grid and empty on the rail for the same product, so the rules live
// here and the hook only applies them.

import type { ProductCard } from "./storefront"

/** `GET /favourites`: full product summaries, keyset-paged, already mapped to cards. */
export interface FavouritesPage {
  items: ProductCard[]
  nextCursor: string | null
}

export type Favouritable = Pick<ProductCard, "id"> & { isFavourite?: boolean }

/** The same product with its heart set. The SAME object when nothing changes, so a cache is not dirtied for a no-op. */
export function withFavourite<T extends Favouritable>(product: T, isFavourite: boolean): T {
  if ((product.isFavourite ?? false) === isFavourite) return product
  return { ...product, isFavourite }
}

/** Every copy of `productId` in a list, hearted or un-hearted. */
export function markFavouriteIn<T extends Favouritable>(
  items: readonly T[] | null | undefined,
  productId: string,
  isFavourite: boolean,
): T[] {
  if (!items) return []
  return items.map((item) => (item.id === productId ? withFavourite(item, isFavourite) : item))
}

/**
 * The favourites LIST after a toggle. Adding puts the product at the front,
 * where the server's newest-first order will put it on the next fetch.
 * Removing drops every copy. Both are idempotent, mirroring the server's
 * "hearting twice is 200" rule.
 */
export function favouritesAfterToggle(
  page: FavouritesPage | null | undefined,
  product: ProductCard,
  isFavourite: boolean,
): FavouritesPage {
  const items = page?.items ?? []
  const rest = items.filter((item) => item.id !== product.id)
  const nextCursor = page?.nextCursor ?? null
  if (!isFavourite) return { items: rest, nextCursor }
  return { items: [withFavourite(product, true), ...rest], nextCursor }
}

/** How many hearts the header shows. Never the cursor's worth of unknowns. */
export function favouriteCount(page: FavouritesPage | null | undefined): number {
  return page?.items?.length ?? 0
}

/** Whether a product is hearted; absent means "nobody asked" and draws as not hearted. */
export function isFavourited(product: Favouritable | null | undefined): boolean {
  return product?.isFavourite === true
}

/** "Favourites, 3 saved" for the icon's label. */
export function favouritesLabel(count: number): string {
  return count > 0 ? `Favourites, ${count} saved` : "Favourites"
}

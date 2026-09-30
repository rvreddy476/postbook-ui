"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMemo } from "react"
import { SearchX } from "lucide-react"
import { flattenProducts, useCategories, useInfiniteProducts } from "../hooks/storefront"
import { browseHref, parseBrowseFilters, SHOP_BASE, type BrowseFilters } from "../model/storefront"
import { FilterBar } from "../components/storefront/FilterBar"
import { InfiniteSentinel } from "../components/storefront/InfiniteSentinel"
import { ProductGrid } from "../components/storefront/ProductGrid"
import { StateBlock } from "../components/storefront/StateBlock"

/**
 * `/shop/browse?q=&category=&in_stock=&min_price=&max_price=&min_rating=`.
 * The URL is the state: the filter bar hands up a whole filter set and this
 * screen writes it back to the address bar, so a filtered list can be
 * shared and the back button works. There is no sort; the server has none.
 */
export function BrowseScreen() {
  const router = useRouter()
  const params = useSearchParams()
  const filters = useMemo(() => parseBrowseFilters(params), [params])
  const categories = useCategories()
  const products = useInfiniteProducts(filters)
  const items = flattenProducts(products.data)
  const activeCategory = filters.category ? categories.data?.find((c) => c.id === filters.category) : undefined
  const title = filters.q ? `Results for “${filters.q}”` : activeCategory ? activeCategory.name : "All products"
  const apply = (next: BrowseFilters) => router.push(browseHref(next))

  return (
    <div>
      <ol className="shop-crumbs" aria-label="Breadcrumb">
        <li><Link href={SHOP_BASE}>Shop</Link></li>
        <li aria-hidden="true">/</li>
        <li aria-current="page">{filters.q ? "Search" : activeCategory ? activeCategory.name : "Browse"}</li>
      </ol>
      <div className="shop-page__head">
        <div>
          <h1 className="shop-page__title">{title}</h1>
          {activeCategory?.description ? <p className="shop-page__lede">{activeCategory.description}</p> : null}
        </div>
      </div>
      <FilterBar filters={filters} categories={categories.data ?? []} onChange={apply} />
      {products.isError ? (
        <StateBlock text="Products could not be loaded." action={{ label: "Try again", onClick: () => void products.refetch() }} />
      ) : (
        <>
          <ProductGrid
            products={items}
            isLoading={products.isLoading}
            loadingMore={products.isFetchingNextPage}
            empty={
              <StateBlock
                icon={<SearchX size={20} aria-hidden="true" />}
                text={filters.q ? "No products match your search." : "Nothing is listed here yet."}
                action={{ label: "Browse everything", href: browseHref({}) }}
              />
            }
          />
          <InfiniteSentinel hasMore={!!products.hasNextPage} isLoading={products.isFetchingNextPage} onMore={() => void products.fetchNextPage()} />
        </>
      )}
    </div>
  )
}

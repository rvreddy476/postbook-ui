"use client"

import Link from "next/link"
import { ArrowRight, Store } from "lucide-react"
import { flattenProducts, useCategories, useHome, useInfiniteProducts } from "../hooks/storefront"
import { browseHref } from "../model/storefront"
import { CategoryStrip } from "../components/storefront/CategoryStrip"
import { LiveSpotlight, StoreHero } from "../components/storefront/StoreHero"
import { InfiniteSentinel } from "../components/storefront/InfiniteSentinel"
import { ProductGrid } from "../components/storefront/ProductGrid"
import { ProductShelf } from "../components/storefront/ProductShelf"
import { StateBlock } from "../components/storefront/StateBlock"

/** Editorial hero, scrollable departments, server highlights, then catalogue. */
export function HomeScreen() {
  const home = useHome()
  const categories = useCategories()
  const products = useInfiniteProducts({})
  const cats = categories.data ?? []
  const banners = home.data?.banners ?? []
  const sections = home.data?.sections ?? []
  const items = flattenProducts(products.data)

  return (
    <div className="shop-home">
      {banners.length > 0 ? <h1 className="shop-sr">Discover MStore</h1> : null}
      <StoreHero categories={cats} banners={banners} />

      {cats.length > 0 ? (
        <section className="shop-departments" aria-label="Categories">
          <CategoryStrip categories={cats} />
        </section>
      ) : null}

      {categories.isError ? <StateBlock text="Categories could not be loaded." action={{ label: "Try again", onClick: () => void categories.refetch() }} /> : null}

      {home.isLoading ? (
        <section className="shop-section" aria-busy="true" aria-label="Loading offers">
          <div className="shop-section__head"><div className="shop-skeleton" style={{ height: 16, width: 140 }} /></div>
          <ProductShelf products={[]} loading />
        </section>
      ) : null}

      {home.isError ? <StateBlock text="Shop highlights could not be loaded. You can still browse products below." action={{ label: "Try again", onClick: () => void home.refetch() }} /> : null}

      {sections.map((section, index) => (
        <div key={section.key} className={index === 0 ? "shop-featured-row" : undefined}>
        <section className="shop-section" aria-labelledby={`shop-rail-${section.key}`}>
          <div className="shop-section__head">
            <h2 id={`shop-rail-${section.key}`} className="shop-section__title">{section.title}</h2>
            <Link href={browseHref({ inStock: true })} className="shop-link">See all <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
          <ProductShelf products={section.products} />
        </section>
        {index === 0 ? <LiveSpotlight /> : null}
        </div>
      ))}

      <section className="shop-section" aria-labelledby="shop-everything">
        <div className="shop-section__head">
          <h2 id="shop-everything" className="shop-section__title">Everything in the shop</h2>
          <Link href={browseHref({})} className="shop-link">Browse <ArrowRight size={14} aria-hidden="true" /></Link>
        </div>
        {products.isError ? (
          <StateBlock text="Products could not be loaded." action={{ label: "Try again", onClick: () => void products.refetch() }} />
        ) : (
          <>
            <ProductGrid
              products={items}
              isLoading={products.isLoading}
              loadingMore={products.isFetchingNextPage}
              empty={<StateBlock icon={<Store size={20} aria-hidden="true" />} text="Nothing is listed yet. New products are on their way." />}
            />
            <InfiniteSentinel hasMore={!!products.hasNextPage} isLoading={products.isFetchingNextPage} onMore={() => void products.fetchNextPage()} />
          </>
        )}
      </section>
    </div>
  )
}

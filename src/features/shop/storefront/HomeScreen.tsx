"use client"

import Link from "next/link"
import { ArrowRight, Grid2X2, Store } from "lucide-react"
import { flattenProducts, useCategories, useHome, useInfiniteProducts } from "../hooks/storefront"
import { browseHref } from "../model/storefront"
import { BannerCarousel } from "../components/storefront/BannerCarousel"
import { CategoryStrip, CategoryTiles } from "../components/storefront/CategoryStrip"
import { InfiniteSentinel } from "../components/storefront/InfiniteSentinel"
import { ProductGrid } from "../components/storefront/ProductGrid"
import { ProductShelf } from "../components/storefront/ProductShelf"
import { StateBlock } from "../components/storefront/StateBlock"

/**
 * The landing, in the founder's order: search (in the header), the
 * category strip, the offers carousel, Deals of the day, Best sellers,
 * New arrivals, Shop by category, then everything in the shop as a paged
 * grid. Every section with nothing in it is absent rather than empty.
 * Works signed out.
 */
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
      <div className="shop-home__heading">
        <div><span className="shop-home__eyebrow">MStore / Discover</span><h1>Explore the shop</h1></div>
        <Link href={browseHref({})} className="shop-btn shop-btn--outline"><Grid2X2 size={16} aria-hidden="true" />All products<ArrowRight size={16} aria-hidden="true" /></Link>
      </div>

      {cats.length > 0 ? (
        <section className="shop-departments" aria-label="Categories">
          <CategoryStrip categories={cats} />
        </section>
      ) : null}

      {categories.isError ? <StateBlock text="Categories could not be loaded." action={{ label: "Try again", onClick: () => void categories.refetch() }} /> : null}

      {banners.length > 0 ? (
        <section className="shop-section shop-section--first">
          <BannerCarousel banners={banners} />
        </section>
      ) : null}

      {home.isLoading ? (
        <section className="shop-section" aria-busy="true" aria-label="Loading offers">
          <div className="shop-section__head"><div className="shop-skeleton" style={{ height: 16, width: 140 }} /></div>
          <ProductShelf products={[]} loading />
        </section>
      ) : null}

      {home.isError ? <StateBlock text="Shop highlights could not be loaded. You can still browse products below." action={{ label: "Try again", onClick: () => void home.refetch() }} /> : null}

      {sections.map((section) => (
        <section key={section.key} className="shop-section" aria-labelledby={`shop-rail-${section.key}`}>
          <div className="shop-section__head">
            <h2 id={`shop-rail-${section.key}`} className="shop-section__title">{section.title}</h2>
            <Link href={browseHref({ inStock: true })} className="shop-link">See all <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
          <ProductShelf products={section.products} />
        </section>
      ))}

      {cats.length > 0 ? (
        <section className="shop-section" aria-labelledby="shop-by-category">
          <div className="shop-section__head">
            <h2 id="shop-by-category" className="shop-section__title">Shop by category</h2>
          </div>
          <CategoryTiles categories={cats} />
        </section>
      ) : null}

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

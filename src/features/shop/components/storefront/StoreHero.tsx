import Link from "next/link"
import { ArrowRight, Radio, ShoppingBag } from "lucide-react"
import { browseHref, type Banner, type CategoryCard } from "../../model/storefront"
import { BannerCarousel } from "./BannerCarousel"

/** Editorial art never replaces a seller's product photo or invents an offer. */
export function StoreHero({ categories, banners }: { categories: CategoryCard[]; banners: Banner[] }) {
  const fashion = categories.find((c) => c.name.toLowerCase().includes("fashion"))
  const home = categories.find((c) => c.name.toLowerCase().includes("home"))
  return (
    <div className="shop-hero-row">
      {banners.length ? <div className="shop-hero-row__offers"><BannerCarousel banners={banners} /></div> : (
        <section className="shop-editorial shop-editorial--style" aria-labelledby="shop-welcome">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="shop-editorial__image" src="/images/shop/style-hero.webp" alt="" fetchPriority="high" />
          <div className="shop-editorial__copy">
            <span className="shop-editorial__eyebrow"><ShoppingBag size={14} aria-hidden="true" /> Everyday discoveries</span>
            <h1 id="shop-welcome">Good finds.<br />Better everyday.</h1>
            <p>Find something that feels like you.</p>
            <Link href={browseHref(fashion ? { category: fashion.id } : {})} className="shop-btn shop-btn--primary">{fashion ? "Explore fashion" : "Explore the shop"}<ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </section>
      )}
      <section className="shop-editorial shop-editorial--home" aria-labelledby="shop-home-edit">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="shop-editorial__image" src="/images/shop/home-hero.webp" alt="" loading="lazy" />
        <div className="shop-editorial__copy">
          <h2 id="shop-home-edit">A little more<br />like home.</h2>
          <p>Make room for the things you love.</p>
          <Link href={browseHref(home ? { category: home.id } : {})} className="shop-btn shop-btn--outline">{home ? "Explore home" : "Browse products"}<ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
      </section>
    </div>
  )
}

export function LiveSpotlight() {
  return (
    <aside className="shop-live-spotlight" aria-labelledby="shop-live-spotlight">
      <span className="shop-live-spotlight__eyebrow"><Radio size={16} aria-hidden="true" /> Creator broadcasts</span>
      <h2 id="shop-live-spotlight">Meet creators.<br />In the moment.</h2>
      <p>Watch live streams and join the conversation.</p>
      <div className="shop-live-spotlight__art" aria-hidden="true"><Radio size={42} strokeWidth={1.5} /></div>
      <Link href="/live" className="shop-btn shop-btn--outline">Explore live<ArrowRight size={16} aria-hidden="true" /></Link>
    </aside>
  )
}

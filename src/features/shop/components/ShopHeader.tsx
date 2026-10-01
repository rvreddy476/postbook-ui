"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useId, useRef, useState, type RefObject } from "react"
import { ChevronDown, CreditCard, Heart, MapPin, Menu, MessageCircle, Package, Radio, Search, ShoppingBag, Store, User } from "lucide-react"
import { useBagCount } from "../hooks/bag"
import { useFavourites } from "../hooks/favourites"
import { useCategories, useShopSession } from "../hooks/storefront"
import { favouriteCount, favouritesLabel } from "../model/favourites"
import { ACCOUNT_MENU, SHOP_BASE, STORE_NAME, avatarInitial, bagLabel, browseHref, signInHref, type CategoryCard } from "../model/storefront"
import { Wordmark } from "./storefront/Wordmark"

const MENU_ICONS: Record<string, React.ComponentType<{ size?: number; "aria-hidden"?: boolean | "true" }>> = {
  Addresses: MapPin,
  Favourites: Heart,
  Orders: Package,
  Payments: CreditCard,
  [`Sell on ${STORE_NAME}`]: Store,
}

/**
 * The search box is the one part of this header that reads the URL, and
 * `useSearchParams` opts its tree out of prerendering, so it is isolated
 * behind Suspense: the fallback emits the same markup with an empty box.
 */
function SearchForm({ initialQuery, initialCategory = "", categories = [], onSubmit }: { initialQuery: string; initialCategory?: string; categories?: CategoryCard[]; onSubmit?: (query: string, category: string) => void }) {
  const [q, setQ] = useState(initialQuery)
  const [category, setCategory] = useState(initialCategory)
  useEffect(() => setQ(initialQuery), [initialQuery])
  useEffect(() => setCategory(initialCategory), [initialCategory])
  const id = useId()
  return (
    <form className="shop-search" role="search" onSubmit={(event) => { event.preventDefault(); onSubmit?.(q, category) }}>
      <label className="shop-sr" htmlFor={id}>Search {STORE_NAME}</label>
      <Search size={16} aria-hidden="true" />
      <input id={id} type="search" className="shop-search__input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products, brands and more" autoComplete="off" enterKeyHint="search" />
      {categories.length > 0 ? <select className="shop-search__category" aria-label="Search category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select> : null}
      <button type="submit" className="shop-search__submit" aria-label="Search"><Search size={15} aria-hidden="true" /></button>
    </form>
  )
}

function LiveSearchForm() {
  const router = useRouter()
  const params = useSearchParams()
  const categories = useCategories()
  return (
    <SearchForm
      initialQuery={params.get("q") ?? ""}
      initialCategory={params.get("category") ?? ""}
      categories={categories.data ?? []}
      onSubmit={(q, category) => router.push(browseHref({ q: q.trim(), category }))}
    />
  )
}

/** The avatar menu: ACCOUNT_MENU, alphabetical. Kept mounted and hidden so it is in the markup. */
function AccountMenu({ initial }: { initial: string }) {
  const baseId = useId()
  const menuId = `${baseId}-menu`
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent | TouchEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("touchstart", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("touchstart", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, close])

  return (
    <div className="shop-menu" ref={wrapper}>
      <button
        type="button"
        className="shop-icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Your account"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="shop-avatar" aria-hidden="true">{initial || <User size={15} />}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <ul id={menuId} className="shop-menu__panel" role="menu" hidden={!open} onClick={close}>
        {ACCOUNT_MENU.map((entry) => {
          const Icon = MENU_ICONS[entry.label] ?? User
          return (
            <li key={entry.href} role="none">
              <Link href={entry.href} role="menuitem" className="shop-menu__item">
                <Icon size={16} aria-hidden="true" /> {entry.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * The zone's bar: wordmark left; search; then favourites, bag with count
 * and the avatar menu. Signed out, the three go to sign in with a way back
 * to the page the shopper is on.
 */
export function ShopHeader({ onMenu, menuOpen, menuRef, context = "shop" }: { onMenu?: () => void; menuOpen?: boolean; menuRef?: RefObject<HTMLButtonElement | null>; context?: "shop" | "live" }) {
  const { signedIn, known, user } = useShopSession()
  const pathname = usePathname()
  const bagCount = useBagCount()
  const { data: favourites } = useFavourites()
  const saved = favouriteCount(favourites)
  const here = pathname || SHOP_BASE
  const gated = (href: string) => (known && !signedIn ? signInHref(href) : href)

  return (
    <header className="shop-header">
      <div className="shop-header__bar">
        <div className="shop-header__brand">
          {onMenu ? <button ref={menuRef} type="button" className="shop-icon-btn shop-header__menu" aria-label="Shop menu" aria-controls="shop-navigation" aria-expanded={menuOpen} onClick={onMenu}><Menu size={21} strokeWidth={1.75} aria-hidden="true" /></button> : null}
          <Link href="/" className="shop-header__home" aria-label="VChat home">VC</Link>
          <span className="shop-header__divider" aria-hidden="true" />
          <Link href={context === "live" ? "/live" : SHOP_BASE} className="shop-header__store" aria-label={context === "live" ? "Live streams home" : `${STORE_NAME} home`}>{context === "live" ? <><Radio size={23} aria-hidden="true" /><span className="shop-wordmark">Live</span></> : <><ShoppingBag size={24} strokeWidth={1.75} aria-hidden="true" /><Wordmark /></>}</Link>
        </div>
        <Suspense fallback={<SearchForm initialQuery="" />}>
          <LiveSearchForm />
        </Suspense>
        <nav className="shop-header__actions" aria-label="Account and shopping">
          <Link href="/messenger" className="shop-icon-btn shop-header__messenger" aria-label="Messenger"><MessageCircle size={20} strokeWidth={1.75} aria-hidden="true" /></Link>
          <Link href={gated(`${SHOP_BASE}/favourites`)} className="shop-icon-btn" aria-label={favouritesLabel(saved)}>
            <Heart size={20} aria-hidden="true" />
            {saved > 0 ? <span className="shop-icon-btn__count" aria-hidden="true">{saved}</span> : null}
          </Link>
          <Link href={gated(`${SHOP_BASE}/bag`)} className="shop-icon-btn" aria-label={bagLabel(bagCount)}>
            <ShoppingBag size={20} aria-hidden="true" />
            <span className="shop-icon-btn__label" aria-hidden="true">Bag</span>
            {bagCount > 0 ? <span className="shop-icon-btn__count" aria-hidden="true">{bagCount}</span> : null}
          </Link>
          {known && signedIn ? (
            <AccountMenu initial={avatarInitial(user)} />
          ) : (
            <Link href={signInHref(here)} className="shop-icon-btn" aria-label="Sign in">
              <User size={20} aria-hidden="true" />
              <span className="shop-icon-btn__label" aria-hidden="true">Sign in</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}

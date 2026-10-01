// The storefront's non-React half: what commerce-service sends for a product
// summary, a category card and the home page, and the rules the screens
// apply to them. Pure, so every rule is a bun test away from being pinned.
//
// Read what the handler writes (commerce-service internal/http/handler.go,
// handler_storefront.go, store/postgres/models.go). Go sends zero values:
// `omitempty` drops an empty string, a 0 and a nil pointer, so every read
// here falls through on EMPTY (`x || fallback`), never only on absent.

import { discountPercent, inrMinor } from "../money"

/** The shop's name. One constant, so a rename is one line. */
export const STORE_NAME = "MStore"

/** Where the zone lives. Every href in the shop is built from this. */
export const SHOP_BASE = "/shop"

// ── Product summary (list, home rails, favourites) ─────────────────────

/**
 * `postgres.Product` as the list, home and favourites routes send it. Every
 * field is optional on the wire because of `omitempty`; the mapper below is
 * what turns that into something a card can draw.
 */
export interface WireProductSummary {
  id?: string
  title?: string
  slug?: string
  short_description?: string | null
  description?: string | null
  category_id?: string | null
  category_name?: string | null
  seller_id?: string
  seller_name?: string | null
  retailer_name?: string | null
  brand_name?: string | null
  primary_image_media_id?: string | null
  image_url?: string | null
  thumbnail_url?: string | null
  source_image_url?: string | null
  /** Integer paise. */
  min_price_minor?: number | null
  /** Integer paise. */
  mrp_minor?: number | null
  /** Derived by the server; never recomputed here. */
  discount_pct?: number | null
  in_stock?: boolean | null
  total_stock?: number | null
  avg_rating?: number
  review_count?: number
  default_variant_id?: string | null
  /** Absent when nobody is signed in; false and absent are different answers. */
  is_favourite?: boolean | null
  /** Public like count (shop-engagement contract §2); absent for 0. A dislike count is never sent. */
  like_count?: number
  try_on?: unknown
}

/** What a product card draws. Nothing on it needs a second look at the wire. */
export interface ProductCard {
  id: string
  title: string
  /** Resolved image or null: the card draws the placeholder for null. */
  image: string | null
  seller: string | null
  categoryName: string | null
  /** Integer paise, or null when the summary carries no price. */
  priceMinor: number | null
  mrpMinor: number | null
  /** Formatted for the card; "—" when there is no price. */
  price: string
  /** Formatted struck MRP, or null when it is not above the price. */
  was: string | null
  /** Whole percent off, the server's figure when it sent one. */
  discountPct: number | null
  inStock: boolean
  /** Units left when the server said so, else null. */
  stock: number | null
  rating: number | null
  reviewCount: number
  defaultVariantId: string | null
  /** Tri-state read honestly: only `true` draws a filled heart. */
  isFavourite: boolean
  /** Public likes; 0 when none or not sent. */
  likeCount: number
}

/**
 * The image for a product, in the order the server documents: the resolved
 * `image_url`, then `thumbnail_url`, then the imported `source_image_url`,
 * then null so the card draws the placeholder. Empty strings fall through.
 */
export function productImageUrl(
  p: Pick<WireProductSummary, "image_url" | "thumbnail_url" | "source_image_url"> | null | undefined,
): string | null {
  if (!p) return null
  return p.image_url || p.thumbnail_url || p.source_image_url || null
}

/** Integer paise or null. Refuses a float, a NaN and a non-positive figure. */
export function readMinor(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value <= 0) return null
  return value
}

/**
 * The server's `discount_pct` when it sent a positive whole number, else the
 * same sum done once, in `money.ts`, from the paise pair. Never a float
 * division here: the grid and the detail page must agree.
 */
export function readDiscountPct(
  p: Pick<WireProductSummary, "discount_pct" | "min_price_minor" | "mrp_minor"> | null | undefined,
): number | null {
  if (!p) return null
  const pct = p.discount_pct
  if (typeof pct === "number" && Number.isFinite(pct) && pct > 0) return Math.round(pct)
  return discountPercent(readMinor(p.mrp_minor), readMinor(p.min_price_minor))
}

/** In stock unless the server said otherwise. `in_stock` wins; `total_stock` 0 is sold out. */
export function readInStock(p: Pick<WireProductSummary, "in_stock" | "total_stock">): boolean {
  if (p.in_stock === false) return false
  if (p.in_stock === true) return true
  if (typeof p.total_stock === "number") return p.total_stock > 0
  return true
}

export function toProductCard(p: WireProductSummary): ProductCard | null {
  if (!p || !p.id) return null
  const priceMinor = readMinor(p.min_price_minor)
  const mrpMinor = readMinor(p.mrp_minor)
  const was = priceMinor !== null && mrpMinor !== null && mrpMinor > priceMinor ? inrMinor(mrpMinor) : null
  const rating = typeof p.avg_rating === "number" && p.avg_rating > 0 ? p.avg_rating : null
  return {
    id: p.id,
    title: p.title || "Untitled product",
    image: productImageUrl(p),
    seller: p.seller_name || p.retailer_name || null,
    categoryName: p.category_name || null,
    priceMinor,
    mrpMinor,
    price: priceMinor === null ? "—" : inrMinor(priceMinor),
    was,
    discountPct: readDiscountPct(p),
    inStock: readInStock(p),
    stock: typeof p.total_stock === "number" ? p.total_stock : null,
    rating,
    reviewCount: typeof p.review_count === "number" ? p.review_count : 0,
    defaultVariantId: p.default_variant_id || null,
    isFavourite: p.is_favourite === true,
    likeCount: typeof p.like_count === "number" && p.like_count > 0 ? Math.floor(p.like_count) : 0,
  }
}

/** Every summary that has an id, as a card. Rows without an id are dropped, not drawn blank. */
export function toProductCards(items: readonly WireProductSummary[] | null | undefined): ProductCard[] {
  if (!Array.isArray(items)) return []
  const out: ProductCard[] = []
  for (const item of items) {
    const card = toProductCard(item)
    if (card) out.push(card)
  }
  return out
}

// ── Product list pages ─────────────────────────────────────────────────

/** `GET /products` in cursor mode: `{items, next_cursor, limit}`. `next_cursor` is "" on the last page. */
export interface WireProductPage {
  items?: WireProductSummary[] | null
  next_cursor?: string
  limit?: number
  /** Present only on the legacy offset path. */
  total?: number
  offset?: number
}

export interface ProductPage {
  items: ProductCard[]
  /** null when there is no next page. Empty string from Go means none. */
  nextCursor: string | null
}

export function toProductPage(page: WireProductPage | WireProductSummary[] | null | undefined): ProductPage {
  if (Array.isArray(page)) return { items: toProductCards(page), nextCursor: null }
  return { items: toProductCards(page?.items), nextCursor: page?.next_cursor || null }
}

// ── Browse filters ─────────────────────────────────────────────────────

/**
 * The browse page's filters, exactly the query the handler reads:
 * `q, category, in_stock, min_price, max_price, min_rating`. There is NO
 * sort on the server, so there is none here either.
 *
 * `min_price` / `max_price` are RUPEES: the handler parses them as floats
 * and the store compares them against `v.min_selling_price`, the rupee
 * column, not the paise one (store.go ListProductsFiltered).
 */
export interface BrowseFilters {
  q: string
  category: string
  inStock: boolean
  minPrice: number | null
  maxPrice: number | null
  minRating: number | null
}

export const EMPTY_FILTERS: BrowseFilters = {
  q: "",
  category: "",
  inStock: false,
  minPrice: null,
  maxPrice: null,
  minRating: null,
}

const readPositive = (raw: string | null): number | null => {
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Filters from a URL's search params (a `URLSearchParams` or anything with `get`). */
export function parseBrowseFilters(params: { get(name: string): string | null } | null | undefined): BrowseFilters {
  if (!params) return { ...EMPTY_FILTERS }
  const rating = readPositive(params.get("min_rating"))
  return {
    q: (params.get("q") ?? "").trim(),
    category: (params.get("category") ?? "").trim(),
    inStock: params.get("in_stock") === "true",
    minPrice: readPositive(params.get("min_price")),
    maxPrice: readPositive(params.get("max_price")),
    minRating: rating !== null && rating <= 5 ? rating : null,
  }
}

/** The query string for a set of filters; only the set ones are written. */
export function browseQuery(filters: Partial<BrowseFilters>): string {
  const params = new URLSearchParams()
  if (filters.q) params.set("q", filters.q)
  if (filters.category) params.set("category", filters.category)
  if (filters.inStock) params.set("in_stock", "true")
  if (filters.minPrice) params.set("min_price", String(filters.minPrice))
  if (filters.maxPrice) params.set("max_price", String(filters.maxPrice))
  if (filters.minRating) params.set("min_rating", String(filters.minRating))
  const text = params.toString()
  return text ? `?${text}` : ""
}

export function browseHref(filters: Partial<BrowseFilters>): string {
  return `${SHOP_BASE}/browse${browseQuery(filters)}`
}

/** The params sent to `GET /products` for a page. Only the set ones go on the wire. */
export function productListParams(
  filters: Partial<BrowseFilters>,
  page: { cursor?: string | null; limit: number },
): Record<string, string | number> {
  const params: Record<string, string | number> = { limit: page.limit }
  if (filters.q) params.q = filters.q
  if (filters.category) params.category = filters.category
  if (filters.inStock) params.in_stock = "true"
  if (filters.minPrice) params.min_price = filters.minPrice
  if (filters.maxPrice) params.max_price = filters.maxPrice
  if (filters.minRating) params.min_rating = filters.minRating
  if (page.cursor) params.cursor = page.cursor
  return params
}

/** How many filters are set, for the bar's "Clear (n)" affordance. */
export function activeFilterCount(filters: BrowseFilters): number {
  let n = 0
  if (filters.category) n += 1
  if (filters.inStock) n += 1
  if (filters.minPrice !== null || filters.maxPrice !== null) n += 1
  if (filters.minRating !== null) n += 1
  return n
}

/** "₹500 – ₹2,000", "Under ₹2,000", "Over ₹500", or null when no range is set. Rupees in, rupees out. */
export function priceRangeLabel(minPrice: number | null, maxPrice: number | null): string | null {
  const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`
  if (minPrice !== null && maxPrice !== null) return `${rupees(minPrice)} – ${rupees(maxPrice)}`
  if (maxPrice !== null) return `Under ${rupees(maxPrice)}`
  if (minPrice !== null) return `Over ${rupees(minPrice)}`
  return null
}

// ── Categories ─────────────────────────────────────────────────────────

/** `GET /categories`: `postgres.CategoryCard` (a ProductCategory with artwork and a live count). */
export interface WireCategoryCard {
  id?: string
  name?: string
  slug?: string
  description?: string | null
  parent_id?: string | null
  display_order?: number
  is_active?: boolean
  is_featured?: boolean
  image_media_id?: string | null
  image_url?: string
  thumbnail_url?: string
  /** Not omitempty: 0 is on the wire and means "nothing listed yet". */
  product_count: number
}

export interface CategoryCard {
  id: string
  name: string
  description: string | null
  image: string | null
  /** 0 dims the chip; the chip still opens. */
  count: number
  displayOrder: number
}

export function toCategoryCard(c: WireCategoryCard): CategoryCard | null {
  if (!c || !c.id) return null
  return {
    id: c.id,
    name: c.name || "Category",
    description: c.description || null,
    image: c.thumbnail_url || c.image_url || null,
    count: typeof c.product_count === "number" && c.product_count > 0 ? c.product_count : 0,
    displayOrder: typeof c.display_order === "number" ? c.display_order : 0,
  }
}

/**
 * The cards in strip order: stocked categories first (most first), then the
 * empties in their catalogue order. An empty category is dimmed, not hidden:
 * the strip is the shop's table of contents.
 */
export function orderCategories(items: readonly WireCategoryCard[] | null | undefined): CategoryCard[] {
  if (!Array.isArray(items)) return []
  const cards: CategoryCard[] = []
  for (const item of items) {
    const card = toCategoryCard(item)
    if (card) cards.push(card)
  }
  return cards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => b.card.count - a.card.count || a.card.displayOrder - b.card.displayOrder || a.index - b.index)
    .map(({ card }) => card)
}

/** "12 products", "1 product", or "Coming soon" for none. */
export function categoryCountLabel(count: number): string {
  if (count <= 0) return "Coming soon"
  return `${count} ${count === 1 ? "product" : "products"}`
}

// ── Home ───────────────────────────────────────────────────────────────

/** One merchandising card, as `postgres.Banner` is sent. */
export interface WireBanner {
  id?: string
  title?: string
  subtitle?: string | null
  image_media_id?: string | null
  /** Resolved by the server in one media batch; empty when it could not be. */
  image_url?: string
  /** `product` | `category` | `url` | `search`. */
  target_type?: string
  target_id?: string
  position?: number
  active?: boolean
}

export interface WireHomeSection {
  key?: string
  title?: string
  products?: WireProductSummary[] | null
}

export interface WireHomePage {
  banners?: WireBanner[] | null
  sections?: WireHomeSection[] | null
}

export interface Banner {
  id: string
  title: string
  subtitle: string | null
  image: string
  href: string
  external: boolean
}

export interface HomeSection {
  key: string
  title: string
  products: ProductCard[]
}

export interface HomePage {
  banners: Banner[]
  sections: HomeSection[]
}

/**
 * The decided order of the rails. The server sends them in this order today,
 * but the order is a merchandising decision on this side of the wire. A rail
 * the server adds later is appended after the known ones, not dropped.
 */
export const HOME_SECTION_ORDER = ["deals", "best_sellers", "new_arrivals"] as const

const HOME_SECTION_TITLES: Record<string, string> = {
  deals: "Deals of the day",
  best_sellers: "Best sellers",
  new_arrivals: "New arrivals",
}

/**
 * Where a banner goes. Relative to the zone; an external `url` target is
 * returned as-is and opens in the same tab (it is the merchandiser's link).
 */
export function bannerHref(banner: Pick<WireBanner, "target_type" | "target_id">): { href: string; external: boolean } {
  const target = banner.target_id || ""
  switch (banner.target_type) {
    case "product":
      return { href: `${SHOP_BASE}/products/${encodeURIComponent(target)}`, external: false }
    case "category":
      return { href: browseHref({ category: target }), external: false }
    case "search":
      return { href: browseHref({ q: target }), external: false }
    case "url":
      return { href: target || SHOP_BASE, external: /^https?:\/\//i.test(target) }
    default:
      return { href: SHOP_BASE, external: false }
  }
}

/**
 * The banners the carousel can draw: active, with a picture, in merchandiser
 * order. A banner without a resolved image is a blank card, and a blank card
 * in a carousel of photographs is worse than one fewer slide.
 */
export function liveBanners(banners: readonly WireBanner[] | null | undefined): Banner[] {
  if (!Array.isArray(banners)) return []
  return banners
    .filter((b) => !!b && !!b.id && b.active !== false && !!b.image_url)
    .map((b, index) => ({ b, index }))
    .sort((a, z) => (a.b.position ?? 0) - (z.b.position ?? 0) || a.index - z.index)
    .map(({ b }) => {
      const { href, external } = bannerHref(b)
      return {
        id: b.id as string,
        title: b.title || "",
        subtitle: b.subtitle || null,
        image: b.image_url as string,
        href,
        external,
      }
    })
}

/**
 * The rails in the decided order, with the empty ones gone. A section with
 * no products is a heading over a blank strip, which reads as a failed load.
 */
export function orderHomeSections(sections: readonly WireHomeSection[] | null | undefined): HomeSection[] {
  if (!Array.isArray(sections)) return []
  const rank = (key: string) => {
    const at = (HOME_SECTION_ORDER as readonly string[]).indexOf(key)
    return at === -1 ? HOME_SECTION_ORDER.length : at
  }
  return sections
    .filter((s) => !!s && !!s.key && Array.isArray(s.products) && s.products.length > 0)
    .map((s, index) => ({ s, index }))
    .sort((a, b) => rank(a.s.key as string) - rank(b.s.key as string) || a.index - b.index)
    .map(({ s }) => ({
      key: s.key as string,
      title: s.title || HOME_SECTION_TITLES[s.key as string] || s.key as string,
      products: toProductCards(s.products),
    }))
    .filter((s) => s.products.length > 0)
}

export function toHomePage(page: WireHomePage | null | undefined): HomePage {
  return { banners: liveBanners(page?.banners), sections: orderHomeSections(page?.sections) }
}

/**
 * Whether the offers carousel may advance on its own. Never under reduced
 * motion, never with fewer than two slides, never while the person is on it.
 */
export function shouldAutoplay(input: { reducedMotion: boolean; count: number; engaged: boolean }): boolean {
  return !input.reducedMotion && input.count > 1 && !input.engaged
}

/** Which slide follows `index`, wrapping. */
export function nextSlide(index: number, count: number, step: 1 | -1 = 1): number {
  if (count <= 0) return 0
  return (((index + step) % count) + count) % count
}

// ── The header ─────────────────────────────────────────────────────────

export interface MenuEntry {
  label: string
  href: string
}

/**
 * The avatar menu, in ASCENDING ALPHABETICAL order by label (the founder's
 * rule for any menu a person reads as a list). The test pins the order, so
 * adding an entry out of place fails before anyone sees it.
 */
export const ACCOUNT_MENU: readonly MenuEntry[] = [
  { label: "Addresses", href: `${SHOP_BASE}/addresses` },
  { label: "Favourites", href: `${SHOP_BASE}/favourites` },
  { label: "Orders", href: `${SHOP_BASE}/orders` },
  { label: "Payments", href: `${SHOP_BASE}/payments` },
  { label: `Sell on ${STORE_NAME}`, href: `${SHOP_BASE}/sell` },
]

/** True when every label follows the one before it, case-insensitively. */
export function isAlphabetical(entries: readonly { label: string }[]): boolean {
  for (let i = 1; i < entries.length; i += 1) {
    if (entries[i - 1].label.localeCompare(entries[i].label, "en", { sensitivity: "base" }) > 0) return false
  }
  return true
}

/**
 * The sign-in URL with a way back. `next` is the gate's parameter;
 * `redirect` is what src/app/login/page.tsx reads today, so both are set,
 * exactly as src/middleware.ts does.
 */
export function signInHref(returnTo: string): string {
  const back = returnTo && returnTo.startsWith("/") ? returnTo : SHOP_BASE
  const encoded = encodeURIComponent(back)
  return `/login?next=${encoded}&redirect=${encoded}`
}

/** The avatar's letter: the person's name, else their username, else nothing. */
export function avatarInitial(user: { name?: string | null; username?: string | null } | null | undefined): string {
  const source = (user?.name || user?.username || "").trim()
  return source ? source.charAt(0).toUpperCase() : ""
}

/** "Bag, 3 items" for the icon's label. */
export function bagLabel(count: number): string {
  if (count <= 0) return "Bag"
  return `Bag, ${count} ${count === 1 ? "item" : "items"}`
}

// ── Errors ─────────────────────────────────────────────────────────────

/** The error code an axios failure carries, or null. Branch on this, never on the message. */
export function apiErrorCode(error: unknown): string | null {
  const code = (error as { response?: { data?: { error?: { code?: unknown } } } } | null | undefined)
    ?.response?.data?.error?.code
  return typeof code === "string" && code ? code : null
}

export function apiErrorStatus(error: unknown): number | null {
  const status = (error as { response?: { status?: unknown } } | null | undefined)?.response?.status
  return typeof status === "number" ? status : null
}

/** A 401 means the shopper is signed out, not that something broke. */
export function isSignedOut(error: unknown): boolean {
  return apiErrorStatus(error) === 401
}

export function isNotFound(error: unknown): boolean {
  return apiErrorStatus(error) === 404
}

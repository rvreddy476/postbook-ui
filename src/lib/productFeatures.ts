import { APP_KEYS_BY_NAV_ID, PARKED_NAV_IDS } from '@/lib/parkedProducts'

/*
  Which products are open, from the api-gateway's public GET /v1/features
  (founder decision C, 24 Oct 2026):

    { "data": { "products": { "broadcast_channels": { "enabled": true }, … } } }

  The gateway computes each flag from its own dormant-product gates and
  GATEWAY_DISABLED_PREFIXES, so a closed product is closed at the door. The
  web hides EVERY surface of a closed product (messenger Channels lane, the
  new-channel sheet, rail and launcher entries, partner portals) instead of
  letting the viewer walk into an error.

  Two rules, both here and nowhere else:

  1. An entry (a way in: rail, launcher, menu, lane) shows only when the
     product is NOT parked (lib/parkedProducts.ts) AND the route says it is
     enabled. Parked stays the launch plan; the route is the live switch.
  2. A page (a direct visit) and a partner portal need only the route's
     yes: parked products' pages are still served, as before, unless the
     gateway closes them.

  When the route cannot be read, the client keeps its built-in default: the
  parked list for entries and pages, and broadcast channels and communities
  hidden everywhere — never a broken screen.

  Pure: the store and hook live in hooks/useProductFeatures.ts.
*/

export const PRODUCT_KEYS = [
  'broadcast_channels',
  'communities',
  'groups',
  'qa',
  'pages',
  'memories',
  'food',
  'rider',
  'dating',
  'doorstep',
  // Echo, premium short notes (modernsmapp docs/designs/echo-contract.md).
  'echo',
] as const

export type ProductKey = (typeof PRODUCT_KEYS)[number]

/** The route's answer, one flag per product. */
export type ProductFlags = Readonly<Record<ProductKey, boolean>>

/** What the client knows: the route's flags, or null when the route failed or has not answered. */
export type FeatureState = ProductFlags | null

/**
 * Hidden when the route cannot be read, whatever the parked list says. Echo
 * fails closed as well: it stays switched off on the server until it
 * launches, so no answer must never open a way in, or its pages.
 */
const HIDDEN_WITHOUT_ROUTE: ReadonlySet<ProductKey> = new Set(['broadcast_channels', 'communities', 'echo'])

/** The app keys (lib/appBrand.ts brands and launcher tiles) each product stands for. */
export const APP_KEYS_BY_PRODUCT: Readonly<Record<ProductKey, readonly string[]>> = {
  broadcast_channels: [],
  communities: ['communities'],
  groups: ['groups'],
  qa: ['ask'],
  pages: ['pages'],
  memories: ['memories'],
  food: ['feast'],
  rider: ['ride'],
  dating: ['match'],
  doorstep: ['doorstep'],
  echo: ['echo'],
}

/** The rail ids (components/sidebarNav.ts) each product owns. */
export const NAV_IDS_BY_PRODUCT: Readonly<Record<ProductKey, readonly string[]>> = {
  broadcast_channels: [],
  communities: [],
  groups: ['Groups'],
  qa: ['Ask'],
  pages: ['Pages'],
  memories: ['Memories'],
  food: ['Feast'],
  rider: [],
  dating: ['PostMatch'],
  doorstep: ['Doorstep'],
  echo: ['Echo'],
}

/**
 * Read the route's body. Any product the body leaves out, or does not state
 * as a boolean, reads as closed. A body that is not the features document
 * at all returns null, which callers treat like a failed request.
 */
export function parseFeatures(body: unknown): ProductFlags | null {
  const data = body && typeof body === 'object' ? (body as { data?: unknown }).data : undefined
  const products = data && typeof data === 'object' ? (data as { products?: unknown }).products : undefined
  if (!products || typeof products !== 'object' || Array.isArray(products)) return null
  const flags = {} as Record<ProductKey, boolean>
  for (const key of PRODUCT_KEYS) {
    const entry = (products as Record<string, unknown>)[key]
    flags[key] = !!entry && typeof entry === 'object' && (entry as { enabled?: unknown }).enabled === true
  }
  return flags
}

/** True when the launch plan parks this product (any of its app keys is under a parked rail id). */
export function isParkedProduct(product: ProductKey, parked: ReadonlySet<string> = PARKED_NAV_IDS): boolean {
  const keys = APP_KEYS_BY_PRODUCT[product]
  for (const id of parked) {
    if ((APP_KEYS_BY_NAV_ID[id] ?? []).some((key) => keys.includes(key))) return true
  }
  return false
}

/** Rule 1: may a way into this product be shown? */
export function productEntryVisible(product: ProductKey, state: FeatureState, parked: ReadonlySet<string> = PARKED_NAV_IDS): boolean {
  if (isParkedProduct(product, parked)) return false
  if (state === null) return !HIDDEN_WITHOUT_ROUTE.has(product)
  return state[product]
}

/** Rule 2: may this product's page render on a direct visit? */
export function productPageAvailable(product: ProductKey, state: FeatureState): boolean {
  if (state === null) return !HIDDEN_WITHOUT_ROUTE.has(product)
  return state[product]
}

/** Rail ids to leave out: the parked list plus every id of a product whose entries are hidden. */
export function hiddenNavIds(state: FeatureState, parked: ReadonlySet<string> = PARKED_NAV_IDS): Set<string> {
  const ids = new Set(parked)
  for (const product of PRODUCT_KEYS) {
    if (!productEntryVisible(product, state, parked)) for (const id of NAV_IDS_BY_PRODUCT[product]) ids.add(id)
  }
  return ids
}

/** App keys (brands, launcher tiles) to leave out, by the same rule. */
export function hiddenAppKeys(state: FeatureState, parked: ReadonlySet<string> = PARKED_NAV_IDS): Set<string> {
  const keys = new Set<string>()
  for (const id of parked) for (const key of APP_KEYS_BY_NAV_ID[id] ?? []) keys.add(key)
  for (const product of PRODUCT_KEYS) {
    if (!productEntryVisible(product, state, parked)) for (const key of APP_KEYS_BY_PRODUCT[product]) keys.add(key)
  }
  return keys
}

/** The routes each product owns. Longest match wins in productForPath. */
export const PRODUCT_ROUTES: Readonly<Record<ProductKey, readonly string[]>> = {
  broadcast_channels: [],
  communities: ['/communities'],
  groups: ['/groups'],
  qa: ['/qa'],
  pages: ['/pages', '/page'],
  memories: ['/memories'],
  food: ['/feast', '/mini-apps/food'],
  rider: ['/mopedu'],
  dating: ['/dating', '/postmatch'],
  doorstep: ['/doorstep', '/doorstep-pro'],
  echo: ['/echo'],
}

/** The product a pathname belongs to, or null for everything else. */
export function productForPath(pathname: string | null | undefined): ProductKey | null {
  if (!pathname) return null
  const path = pathname.split(/[?#]/)[0]
  let best: { product: ProductKey; length: number } | null = null
  for (const product of PRODUCT_KEYS) {
    for (const root of PRODUCT_ROUTES[product]) {
      if ((path === root || path.startsWith(root + '/')) && (!best || root.length > best.length)) best = { product, length: root.length }
    }
  }
  return best?.product ?? null
}

/** The product a partner portal (components/auth/portalRoles.ts PARTNER_MENU id) belongs to; null for one that is always open. */
export const PRODUCT_BY_PARTNER: Readonly<Record<string, ProductKey>> = {
  'feast-partner': 'food',
  'delivery-partner': 'food',
  'ride-partner': 'rider',
  'doorstep-partner': 'doorstep',
}

/**
 * Partner portals (sign-up choosers, the role menu) offered now. They are
 * how partners onboard before a product launches, so the parked list never
 * hid them; they follow the page rule: gone only when the gateway closes the
 * product. Shop is always open.
 */
export function partnerOpen(id: string, state: FeatureState): boolean {
  const product = PRODUCT_BY_PARTNER[id]
  return !product || productPageAvailable(product, state)
}

export function visiblePartnerItems<T extends { id: string }>(items: readonly T[], state: FeatureState): T[] {
  return items.filter((item) => partnerOpen(item.id, state))
}

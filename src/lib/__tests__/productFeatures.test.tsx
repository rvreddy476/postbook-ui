import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  PRODUCT_KEYS,
  hiddenAppKeys,
  hiddenNavIds,
  parseFeatures,
  productEntryVisible,
  productForPath,
  productPageAvailable,
  visiblePartnerItems,
  type ProductFlags,
  type ProductKey,
} from '@/lib/productFeatures'
import { PARKED_NAV_IDS } from '@/lib/parkedProducts'
import { ALL_APP_LAUNCHER, launchedTiles, resolveAppNavigation } from '@/lib/appBrand'
import { ALL_MORE_ITEMS, ALL_PRIMARY_ITEMS, launchedItems } from '@/components/sidebarNav'
import { openMorePanel } from '@/features/video-shell/nav'
import { PARTNER_MENU } from '@/components/auth/portalRoles'
import { NOTIFICATION_CATEGORIES, openCategories } from '@/app/settings/_lib/notificationPreferences'
import { laneChips, visibleLane } from '@/components/messenger/messengerLanes'
import { FEATURES_REFRESH_MS, createFeatureStore } from '@/hooks/useProductFeatures'
import { ProductRouteGateView } from '@/components/ProductRouteGate'

/*
  Founder decision C (24 Oct 2026): GET /v1/features says which products are
  open; a closed product leaves no way in and a direct visit says "Not
  available". A route failure keeps the built-in default: the parked list,
  with broadcast channels and communities hidden.
*/

function body(open: Partial<Record<ProductKey, boolean>>) {
  return { data: { products: Object.fromEntries(PRODUCT_KEYS.map((k) => [k, { enabled: open[k] ?? false }])) } }
}
const allOpen = parseFeatures(body(Object.fromEntries(PRODUCT_KEYS.map((k) => [k, true])))) as ProductFlags
const allClosed = parseFeatures(body({})) as ProductFlags
const only = (...keys: ProductKey[]) => parseFeatures(body(Object.fromEntries(keys.map((k) => [k, true])))) as ProductFlags

describe('reading GET /v1/features', () => {
  test('one flag per product', () => {
    expect(allOpen.broadcast_channels).toBe(true)
    expect(allClosed.broadcast_channels).toBe(false)
    expect(only('rider').rider).toBe(true)
    expect(only('rider').food).toBe(false)
  })
  test('a product the body leaves out, or does not state as true, is closed', () => {
    const flags = parseFeatures({ data: { products: { groups: { enabled: true }, qa: { enabled: 'yes' }, pages: {} } } })!
    expect(flags.groups).toBe(true)
    expect(flags.qa).toBe(false)
    expect(flags.pages).toBe(false)
    expect(flags.dating).toBe(false)
  })
  test('a body that is not the features document is no answer at all', () => {
    for (const bad of [null, undefined, {}, { data: null }, { data: { products: null } }, { data: { products: [] } }, 'oops']) expect(parseFeatures(bad)).toBeNull()
  })
})

describe('entries: shown only when not parked AND enabled', () => {
  test('enabled and not parked: shown', () => {
    expect(productEntryVisible('broadcast_channels', allOpen)).toBe(true)
    expect(productEntryVisible('rider', allOpen)).toBe(true)
  })
  test('disabled: hidden', () => {
    expect(productEntryVisible('broadcast_channels', allClosed)).toBe(false)
    expect(productEntryVisible('rider', allClosed)).toBe(false)
  })
  test('parked: hidden even when the route says enabled; communities ride on Groups', () => {
    for (const p of ['groups', 'communities', 'qa', 'pages', 'memories', 'food', 'dating', 'doorstep'] as const) expect(productEntryVisible(p, allOpen)).toBe(false)
    expect(productEntryVisible('groups', allOpen, new Set())).toBe(true)
  })
  test('route failure: the parked list, and broadcast channels and communities hidden', () => {
    expect(productEntryVisible('broadcast_channels', null)).toBe(false)
    expect(productEntryVisible('communities', null, new Set())).toBe(false)
    expect(productEntryVisible('rider', null)).toBe(true)
    expect(productEntryVisible('groups', null)).toBe(false)
    expect(productEntryVisible('groups', null, new Set())).toBe(true)
  })
})

describe('pages: a direct visit needs the route to say enabled', () => {
  test('enabled (even parked) renders; disabled says Not available', () => {
    expect(productPageAvailable('groups', allOpen)).toBe(true)
    expect(productPageAvailable('groups', allClosed)).toBe(false)
    expect(productPageAvailable('food', only('food'))).toBe(true)
    expect(productPageAvailable('doorstep', only('food'))).toBe(false)
  })
  test('route failure: served as before, except broadcast channels and communities', () => {
    expect(productPageAvailable('groups', null)).toBe(true)
    expect(productPageAvailable('communities', null)).toBe(false)
    expect(productPageAvailable('broadcast_channels', null)).toBe(false)
  })
  test('every product route maps to its product; nothing else does', () => {
    const cases: [string, ProductKey | null][] = [
      ['/groups', 'groups'], ['/groups/abc/settings', 'groups'], ['/communities/1', 'communities'], ['/qa/ask', 'qa'],
      ['/pages/manage', 'pages'], ['/page/acme', 'pages'], ['/memories/slambooks', 'memories'], ['/feast/kitchen', 'food'],
      ['/mini-apps/food', 'food'], ['/mopedu/partner', 'rider'], ['/dating/picks', 'dating'], ['/postmatch/chat/1', 'dating'],
      ['/doorstep/bookings', 'doorstep'], ['/doorstep-pro/digilocker', 'doorstep'], ['/doorstep?x=1', 'doorstep'],
      ['/', null], ['/feed', null], ['/messenger', null], ['/pagesx', null], ['/groupsy', null], ['/shop', null], [null as unknown as string, null],
    ]
    for (const [path, product] of cases) expect(productForPath(path), String(path)).toBe(product)
  })
  test('the gate: open renders the page, closed says Not available, loading holds', () => {
    const open = renderToStaticMarkup(<ProductRouteGateView status="open"><p>the page</p></ProductRouteGateView>)
    expect(open).toBe('<p>the page</p>')
    const closed = renderToStaticMarkup(<ProductRouteGateView status="closed"><p>the page</p></ProductRouteGateView>)
    expect(closed).toContain('Not available')
    expect(closed).toContain('href="/"')
    expect(closed).not.toContain('the page')
    const loading = renderToStaticMarkup(<ProductRouteGateView status="loading"><p>the page</p></ProductRouteGateView>)
    expect(loading).toContain('role="status"')
    expect(loading).not.toContain('the page')
  })
})

describe('the ways in follow the answer', () => {
  test('rail: the parked list, plus every rail id of a closed product', () => {
    expect([...hiddenNavIds(allOpen)].sort()).toEqual([...PARKED_NAV_IDS].sort())
    const none = new Set<string>()
    expect(hiddenNavIds(allClosed, none)).toEqual(new Set(['Groups', 'Ask', 'Pages', 'Memories', 'Feast', 'PostMatch', 'Doorstep']))
    expect(hiddenNavIds(only('groups', 'qa'), none).has('Groups')).toBe(false)
    const rail = launchedItems([...ALL_PRIMARY_ITEMS, ...ALL_MORE_ITEMS], hiddenNavIds(allClosed, none)).map((i) => i.id)
    expect(rail).not.toContain('Feast')
    expect(rail).toContain('Shop')
  })
  test('launcher: Ride and Communities go when closed, stay when open and not parked', () => {
    const none = new Set<string>()
    const closed = launchedTiles(ALL_APP_LAUNCHER, none, hiddenAppKeys(allClosed, none)).map((t) => t.key)
    for (const key of ['ride', 'communities', 'groups', 'feast', 'match', 'ask', 'pages', 'memories']) expect(closed).not.toContain(key)
    for (const key of ['home', 'reels', 'tube', 'messenger', 'shop']) expect(closed).toContain(key)
    const open = launchedTiles(ALL_APP_LAUNCHER, none, hiddenAppKeys(allOpen, none)).map((t) => t.key)
    expect(open).toContain('ride')
    expect(open).toContain('communities')
    // Route failure: communities hidden even if unparked.
    expect(launchedTiles(ALL_APP_LAUNCHER, none, hiddenAppKeys(null, none)).map((t) => t.key)).not.toContain('communities')
  })
  test('a closed product has no per-app rail of its own', () => {
    const none = new Set<string>()
    expect(resolveAppNavigation('/feast', none, hiddenAppKeys(allClosed, none))).toBeNull()
    expect(resolveAppNavigation('/feast', none, hiddenAppKeys(only('food'), none))).not.toBeNull()
  })
  test('reels More panel: the Groups tile goes while Groups is hidden', () => {
    const tiles = (keys: ReadonlySet<string>) => openMorePanel(keys).flatMap((s) => s.items.map((i) => i.key))
    expect(tiles(hiddenAppKeys(allOpen))).not.toContain('groups')
    expect(tiles(hiddenAppKeys(only('groups'), new Set()))).toContain('groups')
    expect(tiles(hiddenAppKeys(allOpen))).toContain('tube')
  })
  test('partner portals: gone only when the gateway closes the product; Selling always stays', () => {
    const ids = (state: ProductFlags | null) => visiblePartnerItems(PARTNER_MENU, state).map((i) => i.id)
    expect(ids(null)).toEqual(PARTNER_MENU.map((i) => i.id))
    expect(ids(allOpen)).toEqual(PARTNER_MENU.map((i) => i.id))
    expect(ids(allClosed)).toEqual(['shop-partner'])
    expect(ids(only('food'))).toEqual(['shop-partner', 'feast-partner', 'delivery-partner'])
  })
  test('notification settings: no switches for a closed product', () => {
    const keys = (isOpen: (p: ProductKey) => boolean) => openCategories(NOTIFICATION_CATEGORIES, isOpen).map((c) => c.key)
    const closed = keys((p) => productEntryVisible(p, allClosed, new Set()))
    for (const key of ['group_posts', 'group_mentions', 'channel_updates', 'channel_urgent', 'community_posts', 'community_mentions']) expect(closed).not.toContain(key)
    expect(closed).toContain('likes')
    expect(keys(() => true)).toEqual(NOTIFICATION_CATEGORIES.map((c) => c.key))
  })
})

describe('messenger lanes', () => {
  test('Channels and Groups lanes appear only while their products are open', () => {
    const chips = (groupsOpen: boolean, channelsOpen: boolean) => laneChips({ groupsOpen, channelsOpen }, { count: 0, hidden: 0, current: 'friends' }).map((c) => c.id)
    expect(chips(true, true)).toEqual(['friends', 'groups', 'channels'])
    expect(chips(true, false)).toEqual(['friends', 'groups'])
    expect(chips(false, true)).toEqual(['friends', 'channels'])
    expect(chips(false, false)).toEqual(['friends'])
    expect(laneChips({ groupsOpen: false, channelsOpen: false }, { count: 2, hidden: 0, current: 'friends' }).map((c) => c.id)).toEqual(['friends', 'requests'])
  })
  test('a closed lane asked for by the address shows Direct; an open one shows itself', () => {
    expect(visibleLane('channels', { groupsOpen: true, channelsOpen: false })).toBe('friends')
    expect(visibleLane('channels', { groupsOpen: true, channelsOpen: true })).toBe('channels')
    expect(visibleLane('groups', { groupsOpen: false, channelsOpen: true })).toBe('friends')
    expect(visibleLane('requests', { groupsOpen: false, channelsOpen: false })).toBe('requests')
  })
})

describe('the features store: once per session, again after ten minutes on focus', () => {
  function harness(responses: (() => unknown)[]) {
    let t = 1_000
    let calls = 0
    const store = createFeatureStore(async () => {
      const next = responses[Math.min(calls, responses.length - 1)]
      calls++
      return next()
    }, () => t)
    return { store, advance: (ms: number) => { t += ms }, calls: () => calls }
  }

  test('enabled: one read, shared; the answer is kept', async () => {
    const h = harness([() => body({ broadcast_channels: true })])
    expect(h.store.getSnapshot()).toEqual({ state: null, settled: false })
    await Promise.all([h.store.ensure(), h.store.ensure(), h.store.ensure()])
    expect(h.calls()).toBe(1)
    expect(h.store.getSnapshot().settled).toBe(true)
    expect(h.store.getSnapshot().state?.broadcast_channels).toBe(true)
  })
  test('a second caller waits for the read already in flight, then sees its answer', async () => {
    let release: (value: unknown) => void = () => {}
    let calls = 0
    const store = createFeatureStore(() => { calls++; return new Promise((resolve) => { release = resolve }) }, () => 1_000)
    void store.ensure()
    let done = false
    const second = store.ensure().then(() => { done = true })
    for (let i = 0; i < 5; i++) await Promise.resolve()
    expect(done).toBe(false)
    release(body({ rider: true }))
    await second
    expect(calls).toBe(1)
    expect(store.getSnapshot()).toMatchObject({ settled: true, state: { rider: true } })
  })
  test('no second read inside ten minutes; one after', async () => {
    const h = harness([() => body({ broadcast_channels: true }), () => body({})])
    await h.store.ensure()
    h.advance(FEATURES_REFRESH_MS - 1)
    await h.store.ensure()
    expect(h.calls()).toBe(1)
    h.advance(1)
    await h.store.ensure()
    expect(h.calls()).toBe(2)
    expect(h.store.getSnapshot().state?.broadcast_channels).toBe(false)
  })
  test('disabled: the answer closes the product', async () => {
    const h = harness([() => body({})])
    await h.store.ensure()
    expect(productEntryVisible('broadcast_channels', h.store.getSnapshot().state)).toBe(false)
    expect(productPageAvailable('communities', h.store.getSnapshot().state)).toBe(false)
  })
  test('route failure: settled with no answer, so the built-in default applies', async () => {
    const h = harness([() => { throw new Error('502') }])
    await h.store.ensure()
    expect(h.store.getSnapshot()).toEqual({ state: null, settled: true })
    expect(productEntryVisible('broadcast_channels', h.store.getSnapshot().state)).toBe(false)
  })
  test('a refresh that fails, or answers with junk, keeps the last good answer', async () => {
    const h = harness([() => body({ rider: true }), () => { throw new Error('down') }, () => ({ nope: 1 })])
    await h.store.ensure()
    h.advance(FEATURES_REFRESH_MS)
    await h.store.ensure()
    expect(h.store.getSnapshot().state?.rider).toBe(true)
    h.advance(FEATURES_REFRESH_MS)
    await h.store.ensure()
    expect(h.calls()).toBe(3)
    expect(h.store.getSnapshot().state?.rider).toBe(true)
  })
  test('subscribers hear the answer', async () => {
    const h = harness([() => body({})])
    let heard = 0
    const off = h.store.subscribe(() => { heard++ })
    await h.store.ensure()
    off()
    expect(heard).toBe(1)
  })
})

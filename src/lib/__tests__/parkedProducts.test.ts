import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { APP_KEYS_BY_NAV_ID, PARKED_NAV_IDS, isParkedAppKey, parkedAppKeys } from '@/lib/parkedProducts'
import { PARKED_NAV_IDS as SIDEBAR_PARKED, ALL_MORE_ITEMS, ALL_PRIMARY_ITEMS } from '@/components/sidebarNav'
import { ALL_APP_LAUNCHER, APP_BRANDS, APP_LAUNCHER, filterAppLauncher, launchedTiles, resolveAppNavigation } from '@/lib/appBrand'

const keys = (tiles: readonly { key: string }[]) => tiles.map((t) => t.key)

// Every route a parked product owns, as a pathname inside it.
const PARKED_ROUTES = ['/groups/abc', '/communities/abc', '/qa/questions/1', '/pages/manage', '/feast/kitchen', '/dating/settings', '/postmatch/safety']

describe('one parked list', () => {
  test('the rail and the launcher read the same set', () => {
    expect(SIDEBAR_PARKED).toBe(PARKED_NAV_IDS)
  })

  test('every parked rail id names the app keys it stands for', () => {
    for (const id of PARKED_NAV_IDS) expect(APP_KEYS_BY_NAV_ID[id]?.length ?? 0).toBeGreaterThan(0)
    const rail = new Set([...ALL_PRIMARY_ITEMS, ...ALL_MORE_ITEMS].map((i) => i.id))
    for (const id of Object.keys(APP_KEYS_BY_NAV_ID)) expect(rail.has(id)).toBe(true)
  })

  test('Groups covers Communities; Pulse is the "match" app', () => {
    expect(isParkedAppKey('groups')).toBe(true)
    expect(isParkedAppKey('communities')).toBe(true)
    expect(isParkedAppKey('match')).toBe(true)
    expect(isParkedAppKey('reels')).toBe(false)
    expect(isParkedAppKey('shop')).toBe(false)
    expect([...parkedAppKeys()].sort()).toEqual(['ask', 'communities', 'doorstep', 'feast', 'groups', 'match', 'memories', 'pages'])
  })
})

describe('the Explore launcher offers no parked product', () => {
  test('Groups, Communities, Ask, Pages, Feast, Pulse and Memories are gone', () => {
    for (const key of ['groups', 'communities', 'ask', 'pages', 'feast', 'match', 'memories']) {
      expect(keys(APP_LAUNCHER)).not.toContain(key)
    }
    for (const name of ['Groups', 'Communities', 'Ask', 'Pages', 'Feast', 'Pulse', 'Memories', 'Doorstep']) {
      expect(APP_LAUNCHER.some((t) => t.name === name)).toBe(false)
    }
    for (const t of APP_LAUNCHER) {
      expect(PARKED_ROUTES.some((r) => r.startsWith(t.href + '/') && t.href !== '/')).toBe(false)
    }
  })

  test('the launched products stay, in registry order', () => {
    expect(keys(APP_LAUNCHER)).toEqual(['home', 'reels', 'tube', 'connections', 'messenger', 'live', 'shop', 'trending', 'saved', 'notifications', 'ride'])
  })

  test('searching cannot reach a parked tile', () => {
    for (const q of ['group', 'communit', 'question', 'pages', 'food', 'pulse', 'meet', 'memories', 'on this day']) {
      expect(keys(filterAppLauncher(q)).filter((k) => isParkedAppKey(k))).toEqual([])
    }
    // Words only a parked tile uses find nothing at all.
    for (const q of ['group', 'food', 'pulse', 'memories']) expect(filterAppLauncher(q)).toEqual([])
  })

  test('unparking brings a tile back in its old place; the pages were never removed', () => {
    const parked = new Set(PARKED_NAV_IDS)
    parked.delete('Groups')
    const tiles = keys(launchedTiles(ALL_APP_LAUNCHER, parked))
    expect(tiles.slice(0, 5)).toEqual(['home', 'reels', 'tube', 'groups', 'communities'])
    expect(keys(launchedTiles(ALL_APP_LAUNCHER, new Set()))).toEqual(keys(ALL_APP_LAUNCHER))
    for (const href of ['/groups', '/communities', '/qa', '/pages', '/feast', '/dating', '/memories', '/doorstep']) {
      expect(existsSync(join(process.cwd(), 'src/app', href, 'page.tsx'))).toBe(true)
    }
  })
})

describe('a parked product has no per-app rail', () => {
  test('every parked route gets the ordinary rail (null), so no "Create group" or "Ask a question"', () => {
    for (const route of PARKED_ROUTES) expect(resolveAppNavigation(route)).toBeNull()
  })

  test('the launched apps keep theirs', () => {
    expect(resolveAppNavigation('/reels')?.[0].label).toBe('Reels')
    expect(resolveAppNavigation('/posttube')?.[0].label).toBe('PostTube')
    expect(resolveAppNavigation('/shop')?.[0].label).toBe('MStore')
    expect(resolveAppNavigation('/live')?.some((i) => i.href === '/live/new')).toBe(true)
  })

  test('no launched app rail links into a parked product', () => {
    const parkedPrefixes = APP_BRANDS.filter((b) => isParkedAppKey(b.key)).flatMap((b) => b.prefixes)
    for (const brand of APP_BRANDS) {
      const items = resolveAppNavigation(brand.prefixes[0]) ?? []
      for (const item of items) {
        expect(parkedPrefixes.some((p) => item.href === p || item.href.startsWith(p + '/'))).toBe(false)
      }
    }
  })

  test('with nothing parked, Groups and Ask get their entries back', () => {
    expect(resolveAppNavigation('/groups/abc', new Set())?.some((i) => i.href === '/groups/create')).toBe(true)
    expect(resolveAppNavigation('/qa', new Set())?.some((i) => i.href === '/qa/ask')).toBe(true)
  })
})

import { describe, expect, test } from 'bun:test'
import { ALL_MORE_ITEMS, ALL_PRIMARY_ITEMS, PARKED_NAV_IDS, launchedItems, moreItems, primaryItems } from '@/components/sidebarNav'

const ids = (items: readonly { id: string }[]) => items.map((i) => i.id)

describe('launch navigation', () => {
  test('the rail offers Social and Shorts, without Groups', () => {
    expect(ids(primaryItems)).toEqual(['Home', 'Feed', 'Reels', 'Circle'])
  })

  test('More keeps the launch products and chat, and no parked product', () => {
    expect(ids(moreItems)).toEqual(['Trending', 'Messenger', 'Notifications', 'PostTube', 'GoLive', 'Shop', 'Saved'])
    for (const label of ['Ask', 'Pages', 'Feast', 'Doorstep', 'Pulse', 'Memories', 'Groups']) {
      expect(moreItems.some((i) => i.label === label)).toBe(false)
      expect(primaryItems.some((i) => i.label === label)).toBe(false)
    }
  })

  test('one list parks them, and every parked id is a real entry', () => {
    expect([...PARKED_NAV_IDS].sort()).toEqual(['Ask', 'Doorstep', 'Feast', 'Groups', 'Memories', 'Pages', 'PostMatch'])
    const all = new Set(ids([...ALL_PRIMARY_ITEMS, ...ALL_MORE_ITEMS]))
    for (const id of PARKED_NAV_IDS) expect(all.has(id)).toBe(true)
  })

  test('unparking brings an entry back in its old place, pages untouched', () => {
    const parked = new Set(PARKED_NAV_IDS)
    parked.delete('Feast')
    const more = launchedItems(ALL_MORE_ITEMS, parked)
    expect(ids(more)).toEqual(['Trending', 'Messenger', 'Notifications', 'PostTube', 'GoLive', 'Shop', 'Feast', 'Saved'])
    expect(more.find((i) => i.id === 'Feast')?.href).toBe('/feast')
    expect(ids(launchedItems(ALL_PRIMARY_ITEMS, new Set()))).toContain('Groups')
  })
})

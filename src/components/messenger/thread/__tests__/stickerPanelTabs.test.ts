import { describe, expect, test } from 'bun:test'

import type { StickerPack } from '@/lib/chat/contract'
import { activeTab, panelTabs } from '../stickerPanelTabs'

const pack = (id: string, n = 1): StickerPack => ({
  id,
  name: `Pack ${id}`,
  stickers: Array.from({ length: n }, (_, i) => ({ id: `${id}-${i}`, url: `https://cdn/${id}/${i}.webp`, width: 128, height: 128 })),
})

describe('composer panel tabs', () => {
  test('with the Giphy key: GIF, Stickers, then each catalogue pack', () => {
    const tabs = panelTabs({ giphyEnabled: true, packs: [pack('a'), pack('b')] })
    expect(tabs.map((t) => t.label)).toEqual(['GIF', 'Stickers', 'Pack a', 'Pack b'])
    expect(tabs[1]).toMatchObject({ kind: 'giphy', giphy: 'stickers' })
    expect(tabs[0]).toMatchObject({ kind: 'giphy', giphy: 'gifs' })
  })

  test('no key: only catalogue packs; an empty or repeated pack has no tab', () => {
    const tabs = panelTabs({ giphyEnabled: false, packs: [pack('a'), pack('e', 0), pack('a')] })
    expect(tabs.map((t) => t.id)).toEqual(['pack:a'])
  })

  test('nothing at all: no tabs, so no panel', () => {
    expect(panelTabs({ giphyEnabled: false, packs: [] })).toEqual([])
    expect(activeTab([], null)).toBeNull()
  })

  test('the picked tab stays while it exists, else the first', () => {
    const tabs = panelTabs({ giphyEnabled: true, packs: [pack('a')] })
    expect(activeTab(tabs, 'stickers')?.id).toBe('stickers')
    expect(activeTab(tabs, 'pack:a')?.id).toBe('pack:a')
    expect(activeTab(tabs, 'pack:gone')?.id).toBe('gif')
    expect(activeTab(tabs, null)?.id).toBe('gif')
  })
})

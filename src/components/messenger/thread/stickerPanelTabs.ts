/*
  The composer panel's tabs (founder, fix pass 2): "GIF" and "Stickers" both
  come from Giphy's web SDK (stickers = Giphy's whole sticker library) and
  exist only when this build has the Giphy key; each non-empty pack of our
  own catalogue (/v1/chat/stickers) adds a tab after them. Pure, so the
  order and the hiding rules have tests.
*/

import type { StickerPack } from '@/lib/chat/contract'

export type PanelTab =
  | { id: 'gif'; kind: 'giphy'; giphy: 'gifs'; label: 'GIF' }
  | { id: 'stickers'; kind: 'giphy'; giphy: 'stickers'; label: 'Stickers' }
  | { id: `pack:${string}`; kind: 'pack'; packId: string; label: string }

export function panelTabs(opts: { giphyEnabled: boolean; packs: readonly StickerPack[] }): PanelTab[] {
  const tabs: PanelTab[] = []
  if (opts.giphyEnabled) {
    tabs.push({ id: 'gif', kind: 'giphy', giphy: 'gifs', label: 'GIF' })
    tabs.push({ id: 'stickers', kind: 'giphy', giphy: 'stickers', label: 'Stickers' })
  }
  const seen = new Set<string>()
  for (const p of opts.packs) {
    if (p.stickers.length === 0 || seen.has(p.id)) continue
    seen.add(p.id)
    tabs.push({ id: `pack:${p.id}`, kind: 'pack', packId: p.id, label: p.name })
  }
  return tabs
}

/** The tab on screen: the one picked while it still exists, else the first. */
export function activeTab(tabs: readonly PanelTab[], chosen: string | null): PanelTab | null {
  return tabs.find((t) => t.id === chosen) ?? tabs[0] ?? null
}

export const GIPHY_SEARCH_PLACEHOLDER: Record<'gifs' | 'stickers', string> = {
  gifs: 'Search GIFs',
  stickers: 'Search stickers',
}

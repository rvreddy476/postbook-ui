'use client'

/*
  The composer's stickers-and-GIFs panel (CONTRACT §2.7, fix pass 2). Tabs:
  "GIF" and "Stickers" from Giphy's web SDK in the browser (stickers =
  Giphy's whole sticker library), shown only when this build has the key
  (NEXT_PUBLIC_GIPHY_SDK_KEY); then one tab per non-empty pack of our own
  catalogue. With none of them, the panel (and the composer button that
  opens it) is not shown. There is no server GIF route.

  The panel closes on Escape and on a press outside it. A press on the
  composer's own toggle button is not "outside" if that button carries
  `data-sticker-gif-toggle`, so the button can toggle it shut without the
  panel reopening.
*/

import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LoaderCircle, Search, X } from 'lucide-react'
import type { Sticker, StickerPack } from '@/lib/chat/contract'
import { fetchStickerPacks } from '@/services/chatParityApi'
import { giphyKey, type GifSendPayload, type GiphyKind } from '@/lib/chat/giphy'
import { GIPHY_SEARCH_PLACEHOLDER, activeTab, panelTabs } from './stickerPanelTabs'

const GiphyGrid = lazy(() => import('./GiphyGrid'))

const STICKERS_KEY = ['chat', 'stickers'] as const
const GIF_SEARCH_DEBOUNCE_MS = 300
/** The panel is 352 wide; the grid sits inside an 8 px gutter. */
const GIF_GRID_WIDTH = 336

export function useStickerGifAvailability(): { stickers: StickerPack[]; gifsEnabled: boolean; loading: boolean; available: boolean } {
  const stickers = useQuery({
    queryKey: STICKERS_KEY,
    queryFn: fetchStickerPacks,
    staleTime: 10 * 60_000,
    retry: 1,
  })
  const packs = stickers.data ?? []
  // A build without the Giphy key has no GIF tab.
  const gifsEnabled = giphyKey() !== ''
  return {
    stickers: packs,
    gifsEnabled,
    loading: stickers.isLoading,
    available: packs.length > 0 || gifsEnabled,
  }
}

export interface StickerGifPanelProps {
  onPickSticker(s: Sticker): void
  onPickGif(g: GifSendPayload): void
  onClose(): void
}

export function StickerGifPanel({ onPickSticker, onPickGif, onClose }: StickerGifPanelProps): JSX.Element | null {
  const { stickers, gifsEnabled, loading, available } = useStickerGifAvailability()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [chosenTab, setChosenTab] = useState<string | null>(null)

  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })

  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Element | null
      if (!target || rootRef.current?.contains(target)) return
      if (typeof target.closest === 'function' && target.closest('[data-sticker-gif-toggle]')) return
      closeRef.current()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const tabs = panelTabs({ giphyEnabled: gifsEnabled, packs: stickers })
  // The picked tab, unless it has gone away; otherwise the first.
  const tab = activeTab(tabs, chosenTab)
  const pack = tab?.kind === 'pack' ? stickers.find((p) => p.id === tab.packId) ?? null : null

  const frame = 'flex h-[380px] w-[352px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-brand-divider bg-brand-card shadow-xl'

  if (loading && !available) {
    return (
      <div ref={rootRef} className={`${frame} items-center justify-center`} role="status">
        <LoaderCircle className="h-5 w-5 animate-spin text-brand-text/40" strokeWidth={1.75} />
        <span className="sr-only">Loading stickers and GIFs</span>
      </div>
    )
  }
  if (!available || tab === null) return null

  return (
    <div ref={rootRef} className={frame} role="dialog" aria-label="Stickers and GIFs">
      <div className="flex shrink-0 items-center gap-1 border-b border-brand-divider px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" role="tablist" aria-label="Stickers and GIFs">
          {tabs.map((t) => (
            <TabButton
              key={t.id}
              active={t.id === tab.id}
              onClick={() => setChosenTab(t.id)}
              icon={t.kind === 'pack' ? stickers.find((p) => p.id === t.packId)?.stickers[0]?.url : undefined}
            >
              {t.label}
            </TabButton>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-brand-text/50 transition-colors hover:bg-brand-secondary hover:text-brand-text"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
      {tab.kind === 'giphy' ? (
        // A new kind is a new grid and a fresh search box.
        <GiphyTab key={tab.giphy} kind={tab.giphy} onPick={onPickGif} />
      ) : pack ? (
        <PackGrid pack={pack} onPick={onPickSticker} />
      ) : null}
    </div>
  )
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick(): void; icon?: string; children: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${active ? 'bg-brand-secondary text-brand-text' : 'text-brand-text/60 hover:text-brand-text'}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {icon ? <img src={icon} alt="" className="h-4 w-4 object-contain" loading="lazy" /> : null}
      <span className="max-w-[96px] truncate">{children}</span>
    </button>
  )
}

function PackGrid({ pack, onPick }: { pack: StickerPack; onPick(s: Sticker): void }) {
  return (
    <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-4 gap-1 overflow-y-auto p-2">
      {pack.stickers.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onPick(s)}
          aria-label={`Send sticker from ${pack.name}`}
          className="flex aspect-square items-center justify-center rounded-xl p-1.5 transition-colors hover:bg-brand-secondary active:scale-95"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.url} alt="" width={s.width} height={s.height} className="h-full w-full object-contain" loading="lazy" draggable={false} />
        </button>
      ))}
    </div>
  )
}

function GiphyTab({ kind, onPick }: { kind: GiphyKind; onPick(g: GifSendPayload): void }) {
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), GIF_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [text])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-2 pt-2">
        <label className="flex items-center gap-2 rounded-full bg-brand-secondary px-3 py-1.5">
          <Search className="h-4 w-4 shrink-0 text-brand-text/50" strokeWidth={1.75} />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={GIPHY_SEARCH_PLACEHOLDER[kind]}
            aria-label={GIPHY_SEARCH_PLACEHOLDER[kind]}
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-[13px] text-brand-text outline-hidden placeholder:text-brand-text/40"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center" role="status">
              <LoaderCircle className="h-5 w-5 animate-spin text-brand-text/40" strokeWidth={1.75} />
              <span className="sr-only">{kind === 'stickers' ? 'Loading stickers' : 'Loading GIFs'}</span>
            </div>
          }
        >
          <GiphyGrid apiKey={giphyKey()} kind={kind} query={query} width={GIF_GRID_WIDTH} onPick={onPick} />
        </Suspense>
      </div>

      <div className="shrink-0 border-t border-brand-divider px-3 py-1.5 text-center text-[11px] font-medium text-brand-text/50">
        Powered by GIPHY
      </div>
    </div>
  )
}

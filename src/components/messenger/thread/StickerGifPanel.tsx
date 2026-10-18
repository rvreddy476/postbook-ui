'use client'

/*
  The composer's stickers-and-GIFs panel (CONTRACT §2.7). Each tab only
  exists when there is something for it: no sticker packs hides Stickers;
  no Giphy key in this build (NEXT_PUBLIC_GIPHY_SDK_KEY) hides GIFs. With
  neither, the panel (and the composer button that opens it) is not shown.
  GIFs come from Giphy's web SDK in the browser (founder decision 18 Oct);
  there is no server GIF route.

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
import { giphyKey, type GifSendPayload } from '@/lib/chat/giphy'

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

type Tab = 'stickers' | 'gifs'

export interface StickerGifPanelProps {
  onPickSticker(s: Sticker): void
  onPickGif(g: GifSendPayload): void
  onClose(): void
}

export function StickerGifPanel({ onPickSticker, onPickGif, onClose }: StickerGifPanelProps): JSX.Element | null {
  const { stickers, gifsEnabled, loading, available } = useStickerGifAvailability()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [chosenTab, setChosenTab] = useState<Tab | null>(null)

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

  const hasStickers = stickers.length > 0
  // The picked tab, unless it has gone away; otherwise whichever exists.
  const tab: Tab | null =
    chosenTab === 'stickers' && hasStickers ? 'stickers'
      : chosenTab === 'gifs' && gifsEnabled ? 'gifs'
        : hasStickers ? 'stickers' : gifsEnabled ? 'gifs' : null

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
      <div className="flex shrink-0 items-center gap-1 border-b border-brand-divider px-2 py-1.5" role="tablist">
        {hasStickers && (
          <TabButton active={tab === 'stickers'} onClick={() => setChosenTab('stickers')}>Stickers</TabButton>
        )}
        {gifsEnabled && (
          <TabButton active={tab === 'gifs'} onClick={() => setChosenTab('gifs')}>GIFs</TabButton>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-brand-text/50 transition-colors hover:bg-brand-secondary hover:text-brand-text"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
      {tab === 'stickers' ? <StickersTab packs={stickers} onPick={onPickSticker} /> : <GifsTab onPick={onPickGif} />}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick(): void; children: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${active ? 'bg-brand-secondary text-brand-text' : 'text-brand-text/60 hover:text-brand-text'}`}
    >
      {children}
    </button>
  )
}

function StickersTab({ packs, onPick }: { packs: StickerPack[]; onPick(s: Sticker): void }) {
  const [packId, setPackId] = useState<string | null>(null)
  const pack = packs.find((p) => p.id === packId) ?? packs[0]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {packs.length > 1 && (
        <div className="flex shrink-0 gap-1.5 overflow-x-auto px-2 py-2" role="tablist" aria-label="Sticker packs">
          {packs.map((p) => {
            const active = p.id === pack.id
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPackId(p.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors ${active ? 'border-primary-ink bg-primary-tint text-primary-ink' : 'border-brand-divider text-brand-text/70 hover:text-brand-text'}`}
              >
                <img src={p.stickers[0].url} alt="" className="h-4 w-4 object-contain" loading="lazy" />
                <span className="max-w-[96px] truncate">{p.name}</span>
              </button>
            )
          })}
        </div>
      )}
      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-4 gap-1 overflow-y-auto p-2">
        {pack.stickers.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s)}
            aria-label={`Send sticker from ${pack.name}`}
            className="flex aspect-square items-center justify-center rounded-xl p-1.5 transition-colors hover:bg-brand-secondary active:scale-95"
          >
            <img src={s.url} alt="" width={s.width} height={s.height} className="h-full w-full object-contain" loading="lazy" draggable={false} />
          </button>
        ))}
      </div>
    </div>
  )
}

function GifsTab({ onPick }: { onPick(g: GifSendPayload): void }) {
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
            placeholder="Search GIFs"
            aria-label="Search GIFs"
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
              <span className="sr-only">Loading GIFs</span>
            </div>
          }
        >
          <GiphyGrid apiKey={giphyKey()} query={query} width={GIF_GRID_WIDTH} onPick={onPick} />
        </Suspense>
      </div>

      <div className="shrink-0 border-t border-brand-divider px-3 py-1.5 text-center text-[11px] font-medium text-brand-text/50">
        Powered by GIPHY
      </div>
    </div>
  )
}

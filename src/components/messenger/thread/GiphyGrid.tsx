'use client'

/*
  The GIF and Stickers tabs' grid, straight from Giphy's web SDK in the
  browser (no server route, no proxy, no cache — Giphy's terms). `kind`
  picks the library: GIFs, or Giphy's sticker library (all packs). Loaded
  lazily by StickerGifPanel so the SDK (and styled-components it renders
  with) only ships to someone who opens one of those tabs.
*/

import { useMemo } from 'react'
import { Grid } from '@giphy/react-components'
import { GiphyFetch } from '@giphy/js-fetch-api'

import { GIPHY_RATING, gifPayloadFromGiphy, type GifSendPayload, type GiphyKind } from '@/lib/chat/giphy'

const PAGE = 12

export default function GiphyGrid({
  apiKey,
  kind = 'gifs',
  query,
  width,
  onPick,
}: {
  apiKey: string
  kind?: GiphyKind
  query: string
  width: number
  onPick(g: GifSendPayload): void
}) {
  const gf = useMemo(() => new GiphyFetch(apiKey), [apiKey])
  const fetchGifs = (offset: number) =>
    query
      ? gf.search(query, { offset, limit: PAGE, rating: GIPHY_RATING, type: kind })
      : gf.trending({ offset, limit: PAGE, rating: GIPHY_RATING, type: kind })

  return (
    <Grid
      // A new query or library is a new grid (the SDK keys its paging on the instance).
      key={`${kind}:${query || '__trending'}`}
      width={width}
      columns={kind === 'stickers' ? 3 : 2}
      gutter={6}
      fetchGifs={fetchGifs}
      noLink
      hideAttribution
      borderRadius={8}
      // Stickers are transparent: no placeholder colour block behind them.
      backgroundColor={kind === 'stickers' ? 'transparent' : undefined}
      noResultsMessage={<p className="py-8 text-center text-[13px] text-brand-text/60">{kind === 'stickers' ? 'No stickers found.' : 'No GIFs found.'}</p>}
      onGifClick={(gif, e) => {
        e.preventDefault()
        const payload = gifPayloadFromGiphy(gif, kind)
        if (payload) onPick(payload)
      }}
    />
  )
}

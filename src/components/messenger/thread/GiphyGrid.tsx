'use client'

/*
  The GIF tab's grid, straight from Giphy's web SDK in the browser (no
  server route, no proxy, no cache — Giphy's terms). Loaded lazily by
  StickerGifPanel so the SDK (and styled-components it renders with) only
  ships to someone who opens the GIF tab.
*/

import { useMemo } from 'react'
import { Grid } from '@giphy/react-components'
import { GiphyFetch } from '@giphy/js-fetch-api'

import { GIPHY_RATING, gifPayloadFromGiphy, type GifSendPayload } from '@/lib/chat/giphy'

const PAGE = 12

export default function GiphyGrid({ apiKey, query, width, onPick }: { apiKey: string; query: string; width: number; onPick(g: GifSendPayload): void }) {
  const gf = useMemo(() => new GiphyFetch(apiKey), [apiKey])
  const fetchGifs = (offset: number) =>
    query
      ? gf.search(query, { offset, limit: PAGE, rating: GIPHY_RATING })
      : gf.trending({ offset, limit: PAGE, rating: GIPHY_RATING })

  return (
    <Grid
      // A new query is a new grid (the SDK keys its paging on the instance).
      key={query || '__trending'}
      width={width}
      columns={2}
      gutter={6}
      fetchGifs={fetchGifs}
      noLink
      hideAttribution
      borderRadius={8}
      noResultsMessage={<p className="py-8 text-center text-[13px] text-brand-text/60">No GIFs found.</p>}
      onGifClick={(gif, e) => {
        e.preventDefault()
        const payload = gifPayloadFromGiphy(gif)
        if (payload) onPick(payload)
      }}
    />
  )
}

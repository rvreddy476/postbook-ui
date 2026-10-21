/*
  GIFs come from Giphy's own web SDK, called from the browser (founder
  decision 18 Oct; Giphy's terms: search from the client, no proxying, no
  caching). There is no server GIF route. The key is public and build-time:
  NEXT_PUBLIC_GIPHY_SDK_KEY. Empty key = no GIF tab.

  On pick, the message carries what the SDK returned, untouched:
  type "gif", gif {provider:"giphy", id, url, width, height, still_url}.
  URLs are kept exactly as Giphy returned them (their query params included).
*/

export const GIPHY_RATING = 'g' as const

/** The public SDK key, or "" when this build has none. */
export function giphyKey(env: Record<string, string | undefined> = { NEXT_PUBLIC_GIPHY_SDK_KEY: process.env.NEXT_PUBLIC_GIPHY_SDK_KEY }): string {
  return (env.NEXT_PUBLIC_GIPHY_SDK_KEY ?? '').trim()
}

export interface GifSendPayload {
  provider: 'giphy'
  id: string
  url: string
  width: number
  height: number
  still_url: string | null
  /** Present (true) only for a pick from the Stickers tab; a plain GIF omits it. */
  is_sticker?: true
}

/** Which Giphy library a grid searches: GIFs, or its sticker library (all packs). */
export type GiphyKind = 'gifs' | 'stickers'

interface Rendition {
  url?: unknown
  width?: unknown
  height?: unknown
}

/** The subset of the SDK's IGif this needs (kept structural so tests need no SDK). */
export interface GiphyGifLike {
  id: string | number
  images?: Partial<Record<'fixed_width' | 'original' | 'fixed_width_still' | 'original_still', Rendition>>
  /** The SDK's own flag on sticker results. */
  is_sticker?: unknown
}

const dim = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

const urlOf = (r: Rendition | undefined): string | null => (typeof r?.url === 'string' && r.url ? r.url : null)

/**
 * What to send for a picked GIF: fixed_width (made for chat bubbles), else
 * original; the still from the matching still rendition. Null when the SDK
 * gave no usable URL. A pick from the Stickers tab (or one the SDK flags as
 * a sticker) carries `is_sticker: true` so it is drawn without a bubble.
 */
export function gifPayloadFromGiphy(gif: GiphyGifLike, kind: GiphyKind = 'gifs'): GifSendPayload | null {
  const images = gif.images ?? {}
  const main = urlOf(images.fixed_width) ? images.fixed_width : urlOf(images.original) ? images.original : undefined
  const url = urlOf(main)
  if (!url || gif.id === undefined || gif.id === null || String(gif.id) === '') return null
  const sticker = kind === 'stickers' || gif.is_sticker === true || gif.is_sticker === 1
  return {
    provider: 'giphy',
    id: String(gif.id),
    url,
    width: dim(main?.width),
    height: dim(main?.height),
    still_url: urlOf(images.fixed_width_still) ?? urlOf(images.original_still),
    ...(sticker ? { is_sticker: true as const } : {}),
  }
}

/** The JSON `gif` object of a send (CONTRACT change 18 Oct + fix pass 2). */
export function gifWireBody(gif: GifSendPayload): Record<string, unknown> {
  return {
    provider: gif.provider,
    id: gif.id,
    url: gif.url,
    width: gif.width,
    height: gif.height,
    still_url: gif.still_url,
    ...(gif.is_sticker ? { is_sticker: true } : {}),
  }
}

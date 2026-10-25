import { describe, expect, test } from 'bun:test'

import { gifPayloadFromGiphy, giphyKey } from '../giphy'

const fixed = 'https://media2.giphy.com/media/abc/200w.gif?cid=ecf05e47x&ep=v1_gifs&rid=200w.gif&ct=g'
const still = 'https://media2.giphy.com/media/abc/200w_s.gif?cid=ecf05e47x&rid=200w_s.gif&ct=g'

describe('Giphy SDK pick → gif message payload', () => {
  test('fixed_width with its still; URLs exactly as returned; numbers for size', () => {
    const p = gifPayloadFromGiphy({
      id: 'abc',
      images: {
        fixed_width: { url: fixed, width: 200, height: 150 },
        fixed_width_still: { url: still, width: 200, height: 150 },
        original: { url: 'https://media2.giphy.com/media/abc/giphy.gif?cid=1', width: 480, height: 360 },
      },
    })
    expect(p).toEqual({ provider: 'giphy', id: 'abc', url: fixed, width: 200, height: 150, still_url: still })
  })
  test('falls back to original (and original_still); string sizes are read', () => {
    const p = gifPayloadFromGiphy({ id: 7, images: { original: { url: 'https://g/o.gif?x=1', width: '480', height: '270' }, original_still: { url: 'https://g/o_s.gif' } } })
    expect(p).toEqual({ provider: 'giphy', id: '7', url: 'https://g/o.gif?x=1', width: 480, height: 270, still_url: 'https://g/o_s.gif' })
  })
  test('no usable url or id → nothing to send', () => {
    expect(gifPayloadFromGiphy({ id: 'x', images: {} })).toBeNull()
    expect(gifPayloadFromGiphy({ id: '', images: { fixed_width: { url: fixed } } })).toBeNull()
  })
  test('still is null when the SDK gave none', () => {
    expect(gifPayloadFromGiphy({ id: 'x', images: { fixed_width: { url: fixed, width: 1, height: 1 } } })?.still_url).toBeNull()
  })
  test('the key: empty or blank means no GIF tab', () => {
    expect(giphyKey({})).toBe('')
    expect(giphyKey({ NEXT_PUBLIC_GIPHY_SDK_KEY: '  ' })).toBe('')
    expect(giphyKey({ NEXT_PUBLIC_GIPHY_SDK_KEY: 'k1' })).toBe('k1')
  })
})

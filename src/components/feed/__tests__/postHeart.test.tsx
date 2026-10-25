import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { postReactionName } from '@/lib/reactions'
import { heartRequest, heartView, isPostLiked, postActionErrorText } from '../postHeart'
import PostHeartButton from '../PostHeartButton'

/*
  Founder, 24 Oct 2026: a post takes one reaction, the like, shown as a
  TikTok-style heart with its count. Any older reaction reads as liked.
  Comments keep their six reactions.
*/

const ROOT = join(import.meta.dir, '..', '..', '..', '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

describe('who has liked a post', () => {
  test('any reaction counts as liked, including the retired ones', () => {
    for (const r of ['like', 'love', 'haha', 'wow', 'sad', 'angry', { type: 'love' }, { type: 'like' }]) expect(isPostLiked(r)).toBe(true)
  })
  test('nothing, an empty string (Go zero value) or an empty object is not liked', () => {
    for (const r of [null, undefined, '', '  ', {}, { type: '' }, 0, false]) expect(isPostLiked(r)).toBe(false)
  })
})

describe('the heart toggle', () => {
  test('the server answer shows as it is', () => {
    expect(heartView(null, 4)).toEqual({ liked: false, count: 4 })
    expect(heartView('love', 4)).toEqual({ liked: true, count: 4 })
  })
  test('a tap on an unliked post shows liked and one more at once', () => {
    expect(heartView(null, 4, true)).toEqual({ liked: true, count: 5 })
  })
  test('a tap on a liked post shows unliked and one fewer at once, never below zero', () => {
    expect(heartView('like', 4, false)).toEqual({ liked: false, count: 3 })
    expect(heartView('wow', 0, false)).toEqual({ liked: false, count: 0 })
  })
  test('a pending state equal to the answer changes nothing (the answer has landed)', () => {
    expect(heartView('like', 4, true)).toEqual({ liked: true, count: 4 })
    expect(heartView(null, 4, false)).toEqual({ liked: false, count: 4 })
  })
  test('a missing or broken count reads as zero', () => {
    expect(heartView(null, undefined)).toEqual({ liked: false, count: 0 })
    expect(heartView(null, Number.NaN)).toEqual({ liked: false, count: 0 })
    expect(heartView(null, -3)).toEqual({ liked: false, count: 0 })
  })
  test('the request: like when unliked, remove when liked — and the wire always says like', () => {
    expect(heartRequest(false)).toEqual({ next: 'like', current: null })
    expect(heartRequest(true)).toEqual({ next: null, current: 'like' })
    for (const liked of [false, true]) {
      const { next, current } = heartRequest(liked)
      expect(postReactionName(next ?? current ?? 'like')).toBe('like')
    }
  })
  test('the new refusals read as sentences', () => {
    expect(postActionErrorText('REACTION_NOT_ALLOWED')).toMatch(/like only/i)
    expect(postActionErrorText('REPOST_NOT_ALLOWED')).toMatch(/cannot be reposted/i)
    expect(postActionErrorText('SOMETHING_ELSE')).toBeNull()
  })
})

function render(post: { viewer_reaction?: unknown; likes: number }, variant: 'row' | 'pillar') {
  const qc = new QueryClient()
  return renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <PostHeartButton post={{ id: 'p1', viewer_reaction: post.viewer_reaction as never, counts: { likes: post.likes, comments: 0 } }} variant={variant} />
    </QueryClientProvider>,
  )
}

describe('the heart button', () => {
  test('row: Like, or Liked (pressed) for any earlier reaction; no picker', () => {
    const off = render({ likes: 2 }, 'row')
    expect(off).toContain('aria-pressed="false"')
    expect(off).toContain('>Like<')
    const on = render({ viewer_reaction: 'love', likes: 2 }, 'row')
    expect(on).toContain('aria-pressed="true"')
    expect(on).toContain('>Liked<')
    for (const html of [off, on]) for (const gone of ['Choose reaction', 'reaction-picker', 'Love', 'Angry']) expect(html).not.toContain(gone)
  })
  test('pillar (a reel on its permalink): the heart and the like count', () => {
    const html = render({ viewer_reaction: 'like', likes: 1200 }, 'pillar')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('1.2K')
    expect(html).toContain('Unlike')
  })
})

describe('no reaction picker on posts', () => {
  test('the post picker components are gone; groups keep their own control', () => {
    expect(existsSync(join(ROOT, 'src/components/reactions/FeedReactionControl.tsx'))).toBe(false)
    expect(existsSync(join(ROOT, 'src/components/ReactionPicker.tsx'))).toBe(false)
    for (const file of ['src/components/PostCard.tsx', 'src/components/EmbedCard.tsx']) {
      const src = read(file)
      expect(src).not.toContain('ReactionControl')
      expect(src).not.toContain('ReactionPicker')
    }
    expect(read('src/components/PostCard.tsx')).toContain('<PostHeartButton')
  })
  test('the dead multi-reaction post hooks are gone', async () => {
    const hooks = await import('@/hooks/usePostReaction')
    expect(Object.keys(hooks).sort()).toEqual(['useToggleLike'])
  })
})

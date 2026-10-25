import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { canRepostContentType, isReelContentType, shareOptions } from '../shareOptions'
import { moreRows, type MoreRowsInput } from '@/features/video-shell/moreRows'

/*
  Founder, 24 Oct 2026: reels take no repost and no quote repost; feed posts
  keep both; long videos are unchanged for now.
*/

const ROOT = join(import.meta.dir, '..', '..', '..', '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

describe('who may be reposted', () => {
  test('a reel (short, reel, flick) or a reel cross-posted to the feed cannot', () => {
    for (const t of ['short', 'reel', 'flick', 'flick_embed']) {
      expect(isReelContentType(t)).toBe(true)
      expect(canRepostContentType(t)).toBe(false)
    }
  })
  test('feed posts can, and long videos are unchanged', () => {
    for (const t of ['text', 'photo', 'image', 'video', 'poll', 'video_embed', 'long_video', '', null, undefined]) {
      expect(canRepostContentType(t)).toBe(true)
    }
  })
})

describe('the Share dialog rows', () => {
  test('a reel: Send in Messages and Copy link only', () => {
    expect(shareOptions({ canMessage: true, allowRepost: false })).toEqual(['message', 'copy-link'])
    expect(shareOptions({ canMessage: false, allowRepost: false })).toEqual(['copy-link'])
  })
  test('a feed post keeps Repost and Quote', () => {
    expect(shareOptions({ canMessage: true, allowRepost: true })).toEqual(['message', 'repost', 'quote', 'copy-link'])
    expect(shareOptions({ canMessage: false, allowRepost: true })).toEqual(['repost', 'quote', 'copy-link'])
  })
  test('every card that opens the dialog says whether its post may be reposted', () => {
    for (const file of ['src/components/PostCard.tsx', 'src/components/EmbedCard.tsx']) {
      expect(read(file)).toContain('allowRepost={canRepostContentType(post.content_type)}')
    }
    const dialog = read('src/components/ShareDialog.tsx')
    expect(dialog).toContain("options.includes('repost')")
    expect(dialog).toContain("options.includes('quote')")
    expect(dialog).toContain('postActionErrorText(code)')
  })
})

describe('the reel More menu', () => {
  const input = (isOwner: boolean): MoreRowsInput => ({
    surface: 'reels',
    post: { channelName: 'Ada', hasDescription: true, shareHidden: false, downloadAllowed: true, audioTrackCount: 2, hasCaptions: true, renditionCount: 3, usableSound: true },
    viewer: { isOwner },
    can: { offline: true, edit: true, delete: true, manageAudio: true },
  })
  test('offers no Repost and no Quote, for a viewer or the owner', () => {
    for (const own of [false, true]) {
      const rows = moreRows(input(own))
      expect(rows.length).toBeGreaterThan(3)
      for (const row of rows) {
        expect(row.label).not.toMatch(/repost|quote/i)
        expect(row.key).not.toMatch(/repost|quote/)
      }
    }
  })
  test('the reels share sheet has no repost target either', () => {
    expect(read('src/features/reels/components/ShareSheet.tsx')).not.toMatch(/repost|quote/i)
  })
})

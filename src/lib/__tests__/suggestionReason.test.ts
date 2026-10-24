import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FOLLOWS_YOU_LABEL, followsYou, suggestionMetaLine } from '../suggestionReason'

const ROOT = join(import.meta.dir, '..', '..', '..')

describe('People-you-may-know meta line', () => {
  test('a follower the viewer has not followed back reads "Follows you"', () => {
    expect(FOLLOWS_YOU_LABEL).toBe('Follows you')
    expect(suggestionMetaLine({ reason_codes: ['FOLLOWS_YOU'] }, '@ravi')).toBe('Follows you')
    expect(suggestionMetaLine({ reason_codes: ['FOLLOWS_YOU', 'MUTUAL_FRIENDS'], mutual_friend_count: 2 }, '@ravi')).toBe('Follows you · 2 mutual friends')
    expect(suggestionMetaLine({ reason_codes: ['MUTUAL_FRIENDS', 'FOLLOWS_YOU'], mutual_friend_count: 1 }, '@ravi')).toBe('Follows you · 1 mutual friend')
  })

  test('other suggestions keep the mutual-friend count, then the fallback', () => {
    expect(suggestionMetaLine({ reason_codes: ['MUTUAL_FRIENDS'], mutual_friend_count: 3 }, '@ravi')).toBe('3 mutual friends')
    expect(suggestionMetaLine({ reason_codes: ['SAME_CITY'], mutual_friend_count: 0 }, '@ravi')).toBe('@ravi')
    expect(suggestionMetaLine({}, 'Suggested for you')).toBe('Suggested for you')
  })

  test('only the reason code turns it on', () => {
    expect(followsYou({ reason_codes: ['FOLLOWS_YOU'] })).toBe(true)
    expect(followsYou({ reason_codes: ['MUTUAL_FOLLOW'] })).toBe(false)
    expect(followsYou({ reason_codes: undefined })).toBe(false)
    expect(suggestionMetaLine({ reason_codes: ['follows_you'] }, '@ravi')).toBe('@ravi')
  })

  test('both People-you-may-know cards render the line from the reason code', () => {
    for (const file of ['src/components/PeopleYouMayKnowStrip.tsx', 'src/components/RightPanel.tsx']) {
      const src = readFileSync(join(ROOT, file), 'utf8')
      expect(src, file).toContain('suggestionMetaLine(')
      // The old inline line only knew mutual friends, so "Follows you" never showed.
      expect(src, file).not.toContain('mutual friend${')
    }
  })
})

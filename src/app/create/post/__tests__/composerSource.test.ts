import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The composer page is one large client component; these guard two fixes in its source.
const source = readFileSync(join(import.meta.dir, '..', 'page.tsx'), 'utf8')

describe('post composer', () => {
  test('the preview shows the card actions without made-up counts', () => {
    const start = source.indexOf('data-preview-actions')
    expect(start).toBeGreaterThan(0)
    const row = source.slice(start, source.indexOf('</div>', start))
    for (const word of ['Like', 'Comment', 'Share']) expect(row).toContain(word)
    expect(row).not.toMatch(/\/>\s*0\s*</)
    expect(row).not.toMatch(/>\s*0\s*</)
  })

  test('suggestions go through the real ai-service routes and say when they fail', () => {
    for (const dead of ['/v1/ai/caption-suggestions', '/v1/ai/hashtag-suggestions']) expect(source).not.toContain(dead)
    expect(source).toContain('suggestCaptions(aiHttp, content)')
    expect(source).toContain('suggestHashtags(aiHttp, content)')
    expect(source).toContain('setCaptionNote(err instanceof AISuggestionError')
    expect(source).toContain('setHashtagNote(err instanceof AISuggestionError')
  })
})

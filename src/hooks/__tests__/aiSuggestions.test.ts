import { describe, expect, test } from 'bun:test'
import {
  AISuggestionError,
  AI_ROUTES,
  aiErrorCopy,
  decodeSuggestionList,
  suggestCaptions,
  suggestHashtags,
  suggestSmartReplies,
  type AIHttp,
} from '@/hooks/useAI'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function fake(answer: unknown, fail?: unknown) {
  const calls: { path: string; body: Record<string, unknown> }[] = []
  const http: AIHttp = {
    post: async (path, body) => {
      calls.push({ path, body: body as Record<string, unknown> })
      if (fail !== undefined) throw fail
      return answer
    },
  }
  return { http, calls }
}

describe('ai routes', () => {
  test('the paths ai-service serves under /v1/ai, as the gateway passes them through', () => {
    expect(AI_ROUTES).toEqual({
      caption: '/v1/ai/caption/suggest',
      hashtags: '/v1/ai/hashtag/suggest',
      smartReply: '/v1/ai/smart-reply',
    })
    for (const dead of ['caption-suggestions', 'hashtag-suggestions', 'smart-replies']) {
      expect(Object.values(AI_ROUTES).some((p) => p.includes(dead))).toBe(false)
    }
  })

  test('captions: draft_id (a fresh uuid) and text', async () => {
    const { http, calls } = fake({ data: { suggestions: ['One', 'Two'], cached: false } })
    expect(await suggestCaptions(http, 'my day')).toEqual(['One', 'Two'])
    expect(calls[0].path).toBe('/v1/ai/caption/suggest')
    expect(Object.keys(calls[0].body).sort()).toEqual(['draft_id', 'text'])
    expect(calls[0].body.text).toBe('my day')
    expect(calls[0].body.draft_id).toMatch(UUID)
    await suggestCaptions(http, 'my day')
    // A new id each time: the server caches per draft_id.
    expect(calls[1].body.draft_id).not.toBe(calls[0].body.draft_id)
  })

  test('hashtags: draft_id and content', async () => {
    const { http, calls } = fake({ data: { hashtags: ['#a', '#b'] } })
    expect(await suggestHashtags(http, 'beach', '11111111-1111-4111-8111-111111111111')).toEqual(['#a', '#b'])
    expect(calls[0]).toEqual({ path: '/v1/ai/hashtag/suggest', body: { draft_id: '11111111-1111-4111-8111-111111111111', content: 'beach' } })
  })

  test('smart replies: conversation_id and last_messages', async () => {
    const { http, calls } = fake({ data: { replies: ['Sure'] } })
    expect(await suggestSmartReplies(http, 'c1', ['hi'])).toEqual(['Sure'])
    expect(calls[0]).toEqual({ path: '/v1/ai/smart-reply', body: { conversation_id: 'c1', last_messages: ['hi'] } })
  })
})

describe('decoding', () => {
  test('reads the list under data, trims, drops blanks, repeats and non-strings', () => {
    expect(decodeSuggestionList({ data: { suggestions: [' a ', '', 'a', 3, 'b'] } }, 'suggestions')).toEqual(['a', 'b'])
    expect(decodeSuggestionList({ hashtags: ['#x'] }, 'hashtags')).toEqual(['#x'])
  })

  test('a body without the list is an error, never a silent empty result', () => {
    expect(() => decodeSuggestionList({ data: { captions: ['old shape'] } }, 'suggestions')).toThrow(AISuggestionError)
    expect(() => decodeSuggestionList(null, 'replies')).toThrow(AISuggestionError)
  })
})

describe('errors', () => {
  test('a refused request rejects with a short sentence', async () => {
    const { http } = fake(null, { isAxiosError: true, response: { status: 404 } })
    const err = await suggestCaptions(http, 'x').catch((e) => e)
    expect(err).toBeInstanceOf(AISuggestionError)
    expect(err.message).toBe('Suggestions aren’t available right now.')
  })

  test('each kind of failure has its own line', () => {
    expect(aiErrorCopy({ isAxiosError: true })).toContain('connection')
    expect(aiErrorCopy({ response: { status: 401 } })).toContain('Sign in')
    expect(aiErrorCopy({ response: { status: 429 } })).toContain('Too many')
    expect(aiErrorCopy({ response: { status: 400 } })).toContain('couldn’t be made')
    expect(aiErrorCopy({ response: { status: 503 } })).toContain('Try again in a moment')
    expect(aiErrorCopy(new Error('x'))).toBe('Suggestions couldn’t be loaded. Try again.')
  })
})

import { describe, expect, test } from 'bun:test'
import axios, { AxiosError } from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { GROUP_REACTIONS, currentGroupReaction, parseGroupReactionState, writeGroupReaction } from '@/lib/groupReactions'
import { commitGroupReaction } from '@/hooks/useGroupReaction'
import { applyGroupFeedPatch, type GroupFeedCache } from '../patchGroupFeed'
import GroupReactionControl, { GroupReactionSummary } from '../GroupReactionControl'
import type { GroupPostV2, GroupReactionState } from '@/types/groups'

const post = { id: 'p', group_id: 'g', spark_count: 5, viewer_sparked: true, viewer_reaction: 'like', reaction_counts: { like: 1 }, echo_count: 7 } as GroupPostV2
const state: GroupReactionState = { post_id: 'p', reaction: 'love', spark_count: 5, reaction_counts: { love: 1 }, viewer_sparked: true }
const keys = [['group-feed-v2', 'g'], ['group-post-search', 'g', 'one'], ['group-post-search', 'g', 'two'], ['myspace-feed']] as const
function seeded() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  for (const key of keys) qc.setQueryData(key, { pages: [{ data: [{ ...post, group: { name: 'Keep me' } }, { ...post, id: 'other' }], offset: 20 }], pageParams: [20] })
  qc.setQueryData(['group-post-v2', 'g', 'p'], { ...post })
  qc.setQueryData(['group-feed-v2', 'different'], { pages: [{ data: [{ ...post, group_id: 'different' }], offset: 0 }], pageParams: [0] })
  return qc
}
function first(qc: QueryClient, key: readonly unknown[] = keys[0]) { return qc.getQueryData<GroupFeedCache>(key)!.pages[0].data[0] }

describe('group reaction wire contract', () => {
  test('all six choices use exact PUT bytes and removal sends DELETE without a body', async () => {
    const calls: unknown[] = []
    const transport = axios.create({ adapter: async config => {
      calls.push([config.method, config.url, config.data])
      const reaction = config.method === 'delete' ? null : JSON.parse(config.data).reaction
      return { data: { data: { ...state, reaction, viewer_sparked: reaction !== null } }, status: 200, statusText: 'OK', headers: {}, config }
    } })
    for (const option of GROUP_REACTIONS) await writeGroupReaction(transport, 'g', 'p', option.value)
    await writeGroupReaction(transport, 'g', 'p', null)
    expect(calls).toEqual([...GROUP_REACTIONS.map(option => ['put', '/v1/groups/g/posts/v2/p/reaction', JSON.stringify({ reaction: option.value })]), ['delete', '/v1/groups/g/posts/v2/p/reaction', undefined]])
  })
  test('invalid choices are refused before transport, not forwarded as 422s', async () => {
    let calls = 0
    const transport = axios.create({ adapter: async () => { calls++; throw new Error('must not run') } })
    await expect(writeGroupReaction(transport, 'g', 'p', 'heart' as never)).rejects.toThrow('Invalid reaction')
    expect(calls).toBe(0)
  })
  test('weighted total remains independent from emoji people counts', () => {
    expect(parseGroupReactionState({ data: state }, 'p')).toEqual(state)
    expect(currentGroupReaction({ ...post, viewer_reaction: undefined })).toBe('like')
    expect(currentGroupReaction({ ...post, viewer_reaction: null, viewer_sparked: false })).toBeNull()
  })
  test('bad envelopes, mismatched targets and invalid counts cannot alter a card', () => {
    for (const body of [{}, { data: null }, { error: {}, data: state }, { data: { ...state, post_id: 'other' } }, { data: { ...state, reaction_counts: null } }, { data: { ...state, reaction_counts: { heart: 1 } } }, { data: { ...state, spark_count: -1 } }, { data: { ...state, viewer_sparked: false } }]) {
      expect(() => parseGroupReactionState(body, 'p')).toThrow()
    }
  })
})

describe('authoritative reaction cache updates', () => {
  test('all pages/searches/cross-group and single-post copies use the response and retain metadata', () => {
    const qc = seeded()
    applyGroupFeedPatch(qc, 'g', 'p', state)
    applyGroupFeedPatch(qc, 'g', 'p', state) // idempotent acknowledgement
    for (const key of keys) {
      expect(first(qc, key)).toMatchObject({ viewer_reaction: 'love', spark_count: 5, reaction_counts: { love: 1 }, viewer_sparked: true, echo_count: 7, group: { name: 'Keep me' } })
      const cache = qc.getQueryData<GroupFeedCache>(key)!
      expect(cache.pageParams).toEqual([20])
      expect(cache.pages[0].data[1].viewer_reaction).toBe('like')
    }
    expect(qc.getQueryData(['group-post-v2', 'g', 'p'])).toMatchObject({ viewer_reaction: 'love', spark_count: 5 })
    expect(first(qc, ['group-feed-v2', 'different']).viewer_reaction).toBe('like')
    qc.clear()
  })
  test('pending requests never compute counts and duplicate in-flight writes are refused', async () => {
    const qc = seeded()
    let release!: () => void
    let entered!: () => void
    const started = new Promise<void>(resolve => { entered = resolve })
    const transport = axios.create({ adapter: async config => {
      entered()
      await new Promise<void>(resolve => { release = resolve })
      return { data: { data: state }, status: 200, statusText: 'OK', headers: {}, config }
    } })
    const writing = commitGroupReaction(qc, transport, 'g', 'p', 'love')
    await started
    expect(first(qc)).toMatchObject({ viewer_reaction: 'like', spark_count: 5 })
    await expect(commitGroupReaction(qc, transport, 'g', 'p', 'angry')).rejects.toThrow('already being saved')
    release()
    await writing
    expect(first(qc)).toMatchObject({ viewer_reaction: 'love', spark_count: 5 })
    qc.clear()
  })
  test.each([403, 404, 422, 503])('HTTP %i leaves every cached count unchanged and permits a later retry', async status => {
    const qc = seeded()
    const transport = axios.create({ adapter: async config => { throw new AxiosError('Refused', undefined, config, undefined, { status, statusText: 'Refused', config, headers: {}, data: { error: { code: 'FORBIDDEN' } } }) } })
    await expect(commitGroupReaction(qc, transport, 'g', 'p', 'love')).rejects.toThrow('Refused')
    for (const key of keys) expect(first(qc, key).viewer_reaction).toBe('like')
    transport.defaults.adapter = async config => ({ data: { data: state }, status: 200, statusText: 'OK', headers: {}, config })
    await commitGroupReaction(qc, transport, 'g', 'p', 'love')
    expect(first(qc).viewer_reaction).toBe('love')
    qc.clear()
  })
  test('DELETE uses the returned total, including the removal of a weighted legacy reaction', async () => {
    const qc = seeded()
    const transport = axios.create({ adapter: async config => ({ data: { data: { ...state, reaction: null, viewer_sparked: false, spark_count: 0, reaction_counts: {} } }, status: 200, statusText: 'OK', headers: {}, config }) })
    await commitGroupReaction(qc, transport, 'g', 'p', null)
    await commitGroupReaction(qc, transport, 'g', 'p', null)
    expect(first(qc)).toMatchObject({ viewer_reaction: null, viewer_sparked: false, spark_count: 0, reaction_counts: {} })
    qc.clear()
  })
  test('a stale read begun during the mutation cannot overwrite the acknowledged reaction', async () => {
    const qc = seeded()
    let releaseWrite!: () => void
    let entered!: () => void
    const started = new Promise<void>(resolve => { entered = resolve })
    const transport = axios.create({ adapter: async config => {
      entered()
      await new Promise<void>(resolve => { releaseWrite = resolve })
      return { data: { data: state }, status: 200, statusText: 'OK', headers: {}, config }
    } })
    const writing = commitGroupReaction(qc, transport, 'g', 'p', 'love')
    await started
    let releaseRead!: (value: GroupFeedCache) => void
    const stale = qc.getQueryData<GroupFeedCache>(keys[0])!
    const reading = qc.fetchQuery({ queryKey: keys[0], queryFn: () => new Promise<GroupFeedCache>(resolve => { releaseRead = resolve }), staleTime: 0 }).catch(() => undefined)
    releaseWrite()
    await writing
    releaseRead(stale)
    await reading
    expect(first(qc)).toMatchObject({ viewer_reaction: 'love', spark_count: 5 })
    qc.clear()
  })
})

test('reaction rendering shows authoritative tallies and the current selection', () => {
  const qc = seeded()
  const value = { ...post, viewer_reaction: 'love' as const, reaction_counts: { love: 1, smile: 2 }, spark_count: 7 }
  const html = renderToStaticMarkup(<QueryClientProvider client={qc}><GroupReactionSummary post={value} /><GroupReactionControl post={value} groupId="g" /></QueryClientProvider>)
  expect(html).toContain('aria-label="Love: 1"')
  expect(html).toContain('aria-label="Smile: 2"')
  expect(html).toContain('aria-label="Remove Love reaction"')
  expect(html).toContain('aria-label="Total reactions">7</span>')
  qc.clear()
})

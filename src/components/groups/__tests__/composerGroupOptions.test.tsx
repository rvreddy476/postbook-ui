import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import AnonymousPostControl from '../AnonymousPostControl'
import { groupSelectionUnavailable } from '../composerGroups'
import { loadMyGroups } from '@/lib/groupMemberships'
import type { Group } from '@/types/groups'

const group = (id: string, fields: Partial<Group> = {}) => ({ id, name: `Group ${id}`, ...fields }) as Group
describe('complete composer group picker', () => {
  test('loads beyond page one and uses the actual limit/offset contract', async () => {
    const calls: number[][] = []
    const groups = await loadMyGroups(async (offset, limit) => {
      calls.push([offset, limit])
      return { data: offset === 0 ? Array.from({ length: 100 }, (_, i) => group(`${i}`)) : [group('last')] }
    })
    expect(calls).toEqual([[0, 100], [100, 100]])
    expect(groups).toHaveLength(101)
    expect(groups[100].id).toBe('last')
  })
  test('empty account is empty, malformed/failed pages are errors and repeated pages cannot loop', async () => {
    expect(await loadMyGroups(async () => ({ data: [] }))).toEqual([])
    for (const result of [{}, { data: null }, { error: 'no', data: [] }, { data: [{ name: 'no id' }] }]) {
      await expect(loadMyGroups(async () => result)).rejects.toThrow()
    }
    await expect(loadMyGroups(async () => ({ data: Array.from({ length: 100 }, (_, i) => group(`${i}`)) }))).rejects.toThrow('did not advance')
  })
  test('an exactly full page needs one final empty page, not a total or has_more field', async () => {
    const offsets: number[] = []
    const groups = await loadMyGroups(async (offset, limit) => {
      offsets.push(offset)
      expect(limit).toBe(100)
      return { data: offset === 0 ? Array.from({ length: 100 }, (_, i) => group(`${i}`)) : [] }
    })
    expect(offsets).toEqual([0, 100])
    expect(groups).toHaveLength(100)
  })
  test('a later failure rejects the whole load rather than silently showing only page one', async () => {
    await expect(loadMyGroups(async offset => {
      if (offset) throw new Error('Service unavailable')
      return { data: Array.from({ length: 100 }, (_, i) => group(`${i}`)) }
    })).rejects.toThrow('Service unavailable')
  })
  test('overlapping pages are deduplicated while offset follows raw page length', async () => {
    const groups = await loadMyGroups(async offset => ({ data: offset === 0
      ? Array.from({ length: 100 }, (_, i) => group(`${i}`))
      : [group('99'), group('100')] }))
    expect(groups).toHaveLength(101)
    expect(groups[100].id).toBe('100')
  })
  test('sidebar and picker share the complete, account-scoped cancellable query', () => {
    const source = (path: string) => readFileSync(resolve(import.meta.dir, path), 'utf8')
    const hooks = source('../../../hooks/useGroups.ts')
    const query = hooks.slice(hooks.indexOf('export function useMyGroups'), hooks.indexOf('export function useGroupDetails'))
    expect(query).toContain('loadMyGroups(')
    expect(query).toContain('params: { offset, limit }, signal')
    expect(query).toContain('queryKey: ["my-groups", user?.id]')
    expect(source('../CrossPostPicker.tsx')).toContain('useMyGroups(open)')
    expect(source('../GroupsWorkspace.tsx')).toContain('useMyGroups()')
    expect(source('../GroupsWorkspace.tsx')).toContain('Your groups could not load.')
    expect(source('../GroupsWorkspace.tsx')).toContain('groups.refetch()')
  })
  test('current, archived, anonymous-ineligible and restricted groups cannot be newly selected', () => {
    expect(groupSelectionUnavailable(group('current'), 'current', false)).toContain('already included')
    expect(groupSelectionUnavailable(group('a', { is_archived: true }), 'current', false)).toContain('Unavailable')
    expect(groupSelectionUnavailable(group('a'), 'current', true)).toContain('Anonymous')
    expect(groupSelectionUnavailable(group('a', { allow_anonymous_posts: true }), 'current', true)).toBeNull()
    expect(groupSelectionUnavailable(group('a', { who_can_post: 'admins_only', viewer_role: 'member' }), 'current', false)).toContain('admins')
    expect(groupSelectionUnavailable(group('a', { who_can_post: 'admins_only', viewer_role: 'owner' }), 'current', false)).toBeNull()
    expect(groupSelectionUnavailable(group('a', { who_can_post: 'admins_only' }), 'current', false)).toBeNull()
  })
})
describe('anonymous controls', () => {
  test('the switch and info action are visible; a group that has not opted in cannot be enabled', () => {
    const html = renderToStaticMarkup(<AnonymousPostControl allowed={false} checked={false} disabled={false} onChange={() => {}} />)
    expect(html).toContain('role="switch"')
    expect(html).toContain('disabled=""')
    expect(html).toContain('Not enabled in this group')
    expect(html).toContain('About anonymous posting')
    expect(html).not.toContain('Your name is hidden from other members.')
    const enabled = renderToStaticMarkup(<AnonymousPostControl allowed checked disabled={false} onChange={() => {}} />)
    expect(enabled).toContain('checked=""')
    expect(enabled).not.toContain('disabled=""')
  })
  test('child popup Escape cannot close the editor; revoked anonymity refuses before uploading', () => {
    const source = (name: string) => readFileSync(resolve(import.meta.dir, '..', name), 'utf8')
    expect(source('GroupPostDialog.tsx')).toContain("closest('dialog') !== event.currentTarget")
    const editor = source('../CreatePortal.tsx')
    expect(editor).not.toContain('if (!allowAnonymous && isAnonymous) setIsAnonymous(false)')
    expect(source('ComposerPopup.tsx')).toContain('onKeyDown={event => event.stopPropagation()}')
    const submit = editor.slice(editor.indexOf('const handleSubmit'))
    expect(submit.indexOf('if (isGroupMode && isAnonymous && group?.allow_anonymous_posts !== true)')).toBeGreaterThanOrEqual(0)
    expect(submit.indexOf('if (isGroupMode && isAnonymous && group?.allow_anonymous_posts !== true)')).toBeLessThan(submit.indexOf('uploadMedia'))
    expect(submit).toContain('Turn it off only if you want to post with your profile.')
  })
})

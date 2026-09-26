import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { availableGroupPeople, parsePeopleSearch, parseAddPeopleResult, personReason } from '../groupPeople'
import { GroupNavigation } from '../GroupsWorkspace'
import type { Group } from '@/types/groups'

const person = (id: string) => ({ user_id: id, display_name: id, username: id })
describe('group people wire boundaries', () => {
  test('real search envelope returns people, not the old first-50 local list', () => {
    const result = parsePeopleSearch(JSON.parse('{"data":{"items":[{"user_id":"u1","display_name":"Ravi","username":"ravi"}]}}'))
    expect(result[0].user_id).toBe('u1')
    expect(result[0].display_name).toBe('Ravi')
    expect(parsePeopleSearch({ items: [person('u2')] })[0].user_id).toBe('u2')
    expect(parsePeopleSearch({ data: { items: [] } })).toEqual([])
  })
  test('failed or malformed searches cannot masquerade as no matching users', () => {
    for (const body of [null, {}, { data: null }, { error: { code: 'UNAVAILABLE' }, items: [] }]) {
      expect(() => parsePeopleSearch(body)).toThrow()
    }
    expect(parsePeopleSearch({ items: [{ display_name: 'Missing identifier' }, null] })).toEqual([])
  })
  test('self, known members and duplicate candidates are excluded', () => {
    expect(availableGroupPeople([person('self'), person('member'), person('new'), person('new')], 'self', ['member']).map(p => p.user_id)).toEqual(['new'])
  })
  test('only server reason codes become labels, not inferred private facts', () => {
    expect(personReason({ ...person('u'), reason_codes: ['SAME_CITY', 'SAME_SCHOOL'] })).toBe('Same town or city · School in common')
    expect(personReason({ ...person('u'), reason_codes: ['SAME_COMPANY'] })).toBe('Workplace in common')
    expect(personReason({ ...person('u'), reason_codes: ['private value'] })).toBe('Suggested for you')
    expect(personReason({ ...person('u'), reason_codes: ['POPULAR'] })).toBe('Suggested for you')
    const noCode = { ...person('u'), explain_text: 'Studied at Private School' }
    expect(personReason(noCode)).toBe('Suggested for you')
  })
  test('add and invitation counts must be explicit, complete and non-negative', () => {
    expect(parseAddPeopleResult({ data: { added: 1, invited: 2, skipped: 1 } }, 4)).toEqual({ added: 1, invited: 2, skipped: 1 })
    for (const data of [{ status: 'invited' }, { added: 0, invited: 0, skipped: 0 }, { added: -1, invited: 5, skipped: 0 }, { added: 0.5, invited: 3.5, skipped: 0 }]) {
      expect(() => parseAddPeopleResult({ data }, 4)).toThrow()
    }
  })
})

describe('shared group navigation', () => {
  const groups = [{ id: 'g1', handle: 'family', name: 'Family' }, { id: 'g2', name: 'School friends' }] as Group[]
  test('Feed explicitly selects the feed view and each group opens its real feed route', () => {
    const html = renderToStaticMarkup(<GroupNavigation groups={groups} query="" onQuery={() => {}} />)
    expect(html).toMatch(/<a\b(?=[^>]*href="\/groups\?view=feed")(?=[^>]*aria-current="page")[^>]*>/)
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    expect(html).toContain('href="/groups/family"')
    expect(html).toContain('href="/groups/g2"')
    expect(html).not.toContain('?tab=members')
  })
  test('a handle or UUID selects the corresponding group; group search is local', () => {
    for (const activeGroup of ['g1', 'family']) {
      const html = renderToStaticMarkup(<GroupNavigation groups={groups} activeGroup={activeGroup} query="fam" onQuery={() => {}} />)
      expect(html).toMatch(/<a\b(?=[^>]*href="\/groups\/family")(?=[^>]*aria-current="page")[^>]*>/)
      expect(html.match(/aria-current="page"/g)).toHaveLength(1)
      expect(html).not.toContain('School friends')
    }
  })
})

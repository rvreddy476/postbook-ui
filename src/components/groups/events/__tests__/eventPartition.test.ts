import { describe, expect, test } from 'bun:test'
import { canManageEvents, isGroupMember, partitionEvents } from '../../tabs/GroupEventsTab'
import type { GroupEvent } from '@/types/groups'

/**
 * The events tab exists to answer "what is on next".
 *
 * group-service answers a different question. ListGroupEvents runs
 * `ORDER BY start_at ASC`, so the rows arrive OLDEST FIRST — last year's
 * meetup ahead of next week's. And for a group with no events at all it returns
 * `"data": null`, because the handler passes a nil `var events []GroupEvent`
 * straight to the JSON encoder with no guard.
 *
 * Both of those reach the client as ordinary-looking JSON. These tests hold the
 * line where they are corrected.
 */

const NOW = new Date('2026-09-25T12:00:00Z')

function event(overrides: Partial<GroupEvent> & { id: string; start_at: string }): GroupEvent {
  return {
    group_id: 'g1',
    creator_id: 'u1',
    title: 'An event',
    timezone: 'UTC',
    is_all_day: false,
    location_type: 'physical',
    rsvp_enabled: true,
    max_attendees: 0,
    going_count: 0,
    maybe_count: 0,
    status: 'upcoming',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('partitionEvents — the server hands back null for an empty group', () => {
  test('null does not reach .map', () => {
    // ListGroupEvents: `var events []GroupEvent` + no appends + no nil guard
    // = `"data": null` on the wire. Without this the tab throws on first paint
    // for every group that has never held an event.
    expect(partitionEvents(null)).toEqual({ upcoming: [], past: [] })
  })

  test('undefined — react-query before the first response — behaves the same', () => {
    expect(partitionEvents(undefined)).toEqual({ upcoming: [], past: [] })
  })

  test('an empty array is also empty, not an error', () => {
    expect(partitionEvents([])).toEqual({ upcoming: [], past: [] })
  })
})

describe('partitionEvents — past-first server order is corrected', () => {
  test('the oldest event the server sends first does NOT head the page', () => {
    // Exactly the shape ListGroupEvents returns: ascending by start_at, so the
    // past events come out of the database before the future ones.
    const serverOrder = [
      event({ id: 'ancient', start_at: '2024-03-01T10:00:00Z' }),
      event({ id: 'lastMonth', start_at: '2026-08-20T10:00:00Z' }),
      event({ id: 'nextWeek', start_at: '2026-10-02T10:00:00Z' }),
      event({ id: 'nextYear', start_at: '2027-01-15T10:00:00Z' }),
    ]

    const { upcoming, past } = partitionEvents(serverOrder, NOW)

    expect(upcoming.map((e) => e.id)).toEqual(['nextWeek', 'nextYear'])
    expect(past.map((e) => e.id)).toEqual(['lastMonth', 'ancient'])

    // The concrete failure this guards: rendering the raw array put 'ancient'
    // first. Nothing in Upcoming may be one of the events the server led with.
    expect(upcoming[0]!.id).not.toBe(serverOrder[0]!.id)
  })

  test('Upcoming reads soonest-first even if the server order were disturbed', () => {
    const shuffled = [
      event({ id: 'far', start_at: '2027-01-15T10:00:00Z' }),
      event({ id: 'soon', start_at: '2026-09-26T10:00:00Z' }),
      event({ id: 'mid', start_at: '2026-11-01T10:00:00Z' }),
    ]
    expect(partitionEvents(shuffled, NOW).upcoming.map((e) => e.id)).toEqual([
      'soon',
      'mid',
      'far',
    ])
  })

  test('Past reads most-recent-first, the reverse of what the server sends', () => {
    const serverOrder = [
      event({ id: 'oldest', start_at: '2023-01-01T10:00:00Z' }),
      event({ id: 'middle', start_at: '2025-06-01T10:00:00Z' }),
      event({ id: 'recent', start_at: '2026-09-01T10:00:00Z' }),
    ]
    expect(partitionEvents(serverOrder, NOW).past.map((e) => e.id)).toEqual([
      'recent',
      'middle',
      'oldest',
    ])
  })

  test('every event lands in exactly one list', () => {
    const all = [
      event({ id: 'a', start_at: '2020-01-01T00:00:00Z' }),
      event({ id: 'b', start_at: '2030-01-01T00:00:00Z' }),
      event({ id: 'c', start_at: '2026-09-25T11:59:00Z' }),
    ]
    const { upcoming, past } = partitionEvents(all, NOW)
    expect(upcoming.length + past.length).toBe(3)
    expect([...upcoming, ...past].map((e) => e.id).sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('partitionEvents — the boundary is the END of the event', () => {
  test('an event that started an hour ago and runs for three stays Upcoming', () => {
    // It is happening right now. Sliding it into Past the moment it begins
    // makes the most relevant thing on the page look cancelled.
    const inProgress = event({
      id: 'running',
      start_at: '2026-09-25T11:00:00Z',
      end_at: '2026-09-25T14:00:00Z',
    })
    expect(partitionEvents([inProgress], NOW).upcoming.map((e) => e.id)).toEqual(['running'])
  })

  test('an event whose end has passed is Past even though it has an end_at', () => {
    const finished = event({
      id: 'finished',
      start_at: '2026-09-25T08:00:00Z',
      end_at: '2026-09-25T10:00:00Z',
    })
    expect(partitionEvents([finished], NOW).past.map((e) => e.id)).toEqual(['finished'])
  })

  test('with no end_at the start alone decides', () => {
    const before = event({ id: 'before', start_at: '2026-09-25T11:59:00Z' })
    const after = event({ id: 'after', start_at: '2026-09-25T12:01:00Z' })
    const { upcoming, past } = partitionEvents([before, after], NOW)
    expect(past.map((e) => e.id)).toEqual(['before'])
    expect(upcoming.map((e) => e.id)).toEqual(['after'])
  })
})

describe('partitionEvents — dates the unvalidated POST route let through', () => {
  test("Go's zero time sinks to the bottom of Past, never the top of Upcoming", () => {
    // An empty POST body creates an event starting 0001-01-01. There is no
    // update route, so that row is permanent; the least it can do is not lead
    // the page.
    const junk = event({ id: 'zeroTime', start_at: '0001-01-01T00:00:00Z' })
    const real = event({ id: 'real', start_at: '2026-10-01T10:00:00Z' })
    const { upcoming, past } = partitionEvents([junk, real], NOW)
    expect(upcoming.map((e) => e.id)).toEqual(['real'])
    expect(past.map((e) => e.id)).toEqual(['zeroTime'])
  })

  test('an unparseable date is treated as Past rather than thrown or promoted', () => {
    const broken = event({ id: 'broken', start_at: 'not a date at all' })
    const { upcoming, past } = partitionEvents([broken], NOW)
    expect(upcoming).toEqual([])
    expect(past.map((e) => e.id)).toEqual(['broken'])
  })

  test('an unparseable end_at does not drag a future event into Past silently', () => {
    // end_at is what the boundary reads, so a broken one has to be caught.
    const broken = event({
      id: 'brokenEnd',
      start_at: '2027-01-01T10:00:00Z',
      end_at: 'garbage',
    })
    expect(partitionEvents([broken], NOW).past.map((e) => e.id)).toEqual(['brokenEnd'])
  })

  test('a list of nothing but junk dates still sorts without throwing', () => {
    const junk = [
      event({ id: 'x', start_at: 'nope' }),
      event({ id: 'y', start_at: '0001-01-01T00:00:00Z' }),
      event({ id: 'z', start_at: 'also nope' }),
    ]
    expect(() => partitionEvents(junk, NOW)).not.toThrow()
    expect(partitionEvents(junk, NOW).past).toHaveLength(3)
  })
})

describe('canManageEvents', () => {
  test('only the three roles the service accepts can create or cancel', () => {
    // CreateGroupEvent and DeleteGroupEvent both 403 anyone else, so showing a
    // member the button hands them an error they cannot act on.
    expect(canManageEvents('owner')).toBe(true)
    expect(canManageEvents('admin')).toBe(true)
    expect(canManageEvents('moderator')).toBe(true)
  })

  test('a plain member, and everyone below, cannot', () => {
    expect(canManageEvents('member')).toBe(false)
    expect(canManageEvents('pending')).toBe(false)
    expect(canManageEvents('outsider')).toBe(false)
    expect(canManageEvents('banned')).toBe(false)
  })

  test('an absent or unknown role is not a manager', () => {
    // viewer_role is optional on Group, so an older server build sends nothing.
    expect(canManageEvents(undefined)).toBe(false)
    expect(canManageEvents('')).toBe(false)
    expect(canManageEvents('some_new_role')).toBe(false)
  })
})

describe('isGroupMember', () => {
  test('the four roles that carry an active member row may RSVP', () => {
    // RSVPGroupEvent runs CheckMembership first and 403s on failure, so the
    // buttons must not appear for anyone it would refuse.
    expect(isGroupMember('owner')).toBe(true)
    expect(isGroupMember('admin')).toBe(true)
    expect(isGroupMember('moderator')).toBe(true)
    expect(isGroupMember('member')).toBe(true)
  })

  test('a pending request is not yet membership', () => {
    expect(isGroupMember('pending')).toBe(false)
  })

  test('an outsider, a banned user and an unknown role may not', () => {
    expect(isGroupMember('outsider')).toBe(false)
    expect(isGroupMember('banned')).toBe(false)
    expect(isGroupMember(undefined)).toBe(false)
    expect(isGroupMember('')).toBe(false)
  })
})

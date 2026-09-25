import { describe, expect, test } from 'bun:test'
import {
  MAX_TITLE_LENGTH,
  draftToPayload,
  emptyDraft,
  validateEventDraft,
  wallClockToInstant,
  type EventDraft,
} from '../EventComposer'

/**
 * `POST /v1/groups/:groupId/events` validates nothing at all.
 *
 * The handler does `c.ShouldBindJSON(&event)` into `store.GroupEvent`, which
 * carries no `binding:` tags on any field, and CreateGroupEvent only fills
 * defaults for timezone, location_type and status. An empty body therefore gets
 * a 201 for an event titled `""` starting 0001-01-01 — and since group-service
 * exposes no PUT or PATCH for an event, that row can never be corrected, only
 * cancelled.
 *
 * So validateEventDraft is not a convenience in front of server checks. It is
 * the only validation in the entire path, and each test below stands for a row
 * that would otherwise be permanent.
 */

const NOW = new Date('2026-09-25T12:00:00Z')

function draft(overrides: Partial<EventDraft> = {}): EventDraft {
  return {
    ...emptyDraft(),
    title: 'Monthly meetup',
    startAt: '2026-10-02T18:30',
    endAt: '',
    timezone: 'UTC',
    locationType: 'physical',
    address: '14 Brigade Road, Bengaluru',
    onlineLink: '',
    maxAttendees: '',
    ...overrides,
  }
}

describe('validateEventDraft — a valid draft', () => {
  test('passes with no errors at all', () => {
    expect(validateEventDraft(draft(), NOW)).toEqual({})
  })

  test('an online event with a link passes', () => {
    const d = draft({ locationType: 'online', address: '', onlineLink: 'https://meet.example/x' })
    expect(validateEventDraft(d, NOW)).toEqual({})
  })
})

describe('validateEventDraft — title', () => {
  test('an empty title is refused', () => {
    // The exact row an empty POST body creates: title "".
    expect(validateEventDraft(draft({ title: '' }), NOW).title).toBeTruthy()
  })

  test('whitespace is not a title', () => {
    // Trim first, or "   " becomes a card with a blank heading forever.
    expect(validateEventDraft(draft({ title: '   \n\t ' }), NOW).title).toBeTruthy()
  })

  test('a title at the column limit is allowed', () => {
    expect(validateEventDraft(draft({ title: 'a'.repeat(MAX_TITLE_LENGTH) }), NOW).title).toBeUndefined()
  })

  test('a title past the column limit is refused before Postgres refuses it', () => {
    // group_events.title is VARCHAR(200). One character more is a 500 from the
    // database, not a 400 from the handler.
    expect(validateEventDraft(draft({ title: 'a'.repeat(MAX_TITLE_LENGTH + 1) }), NOW).title).toBeTruthy()
  })
})

describe('validateEventDraft — start', () => {
  test('a missing start is refused', () => {
    // Left blank, the struct binds Go's zero time and the event starts in
    // year 1 — which is how a "0001-01-01" row gets created.
    expect(validateEventDraft(draft({ startAt: '' }), NOW).startAt).toBeTruthy()
  })

  test('a start in the past is refused', () => {
    expect(validateEventDraft(draft({ startAt: '2026-09-24T18:30' }), NOW).startAt).toBeTruthy()
  })

  test('a start exactly now is refused — an event nobody can still come to', () => {
    expect(validateEventDraft(draft({ startAt: '2026-09-25T12:00' }), NOW).startAt).toBeTruthy()
  })

  test('a start a minute from now is accepted', () => {
    expect(validateEventDraft(draft({ startAt: '2026-09-25T12:01' }), NOW).startAt).toBeUndefined()
  })

  test('a start that is not a date at all is refused', () => {
    expect(validateEventDraft(draft({ startAt: 'tomorrow-ish' }), NOW).startAt).toBeTruthy()
  })

  test('the future is judged in the EVENT’s zone, not the reader’s', () => {
    // 07:00 on the 26th in Asia/Kolkata is 01:30Z on the 26th — still ahead of
    // NOW. Read as UTC wall clock it is also ahead, so use a case where the
    // zone is what decides: 16:00 on the 25th in Asia/Kolkata is 10:30Z, which
    // is in the PAST relative to NOW even though the wall clock reads later
    // than noon.
    const kolkata = draft({ timezone: 'Asia/Kolkata', startAt: '2026-09-25T16:00' })
    expect(validateEventDraft(kolkata, NOW).startAt).toBeTruthy()

    const utc = draft({ timezone: 'UTC', startAt: '2026-09-25T16:00' })
    expect(validateEventDraft(utc, NOW).startAt).toBeUndefined()
  })
})

describe('validateEventDraft — end', () => {
  test('no end at all is fine; end_at is nullable', () => {
    expect(validateEventDraft(draft({ endAt: '' }), NOW).endAt).toBeUndefined()
  })

  test('an end before the start is refused', () => {
    const d = draft({ startAt: '2026-10-02T18:30', endAt: '2026-10-02T17:00' })
    expect(validateEventDraft(d, NOW).endAt).toBeTruthy()
  })

  test('an end on an earlier day is refused', () => {
    const d = draft({ startAt: '2026-10-02T18:30', endAt: '2026-09-30T20:00' })
    expect(validateEventDraft(d, NOW).endAt).toBeTruthy()
  })

  test('an end equal to the start is allowed — a zero-length slot, not a contradiction', () => {
    const d = draft({ startAt: '2026-10-02T18:30', endAt: '2026-10-02T18:30' })
    expect(validateEventDraft(d, NOW).endAt).toBeUndefined()
  })

  test('an end after the start is allowed', () => {
    const d = draft({ startAt: '2026-10-02T18:30', endAt: '2026-10-02T21:00' })
    expect(validateEventDraft(d, NOW).endAt).toBeUndefined()
  })

  test('an end that is not a date is refused', () => {
    expect(validateEventDraft(draft({ endAt: 'later' }), NOW).endAt).toBeTruthy()
  })
})

describe('validateEventDraft — where', () => {
  test('a physical event with no address is refused', () => {
    // Otherwise members get an event with a place and no way to reach it.
    const d = draft({ locationType: 'physical', address: '' })
    expect(validateEventDraft(d, NOW).address).toBeTruthy()
  })

  test('whitespace is not an address', () => {
    expect(validateEventDraft(draft({ locationType: 'physical', address: '   ' }), NOW).address).toBeTruthy()
  })

  test('an online event with no link is refused', () => {
    const d = draft({ locationType: 'online', address: '', onlineLink: '' })
    expect(validateEventDraft(d, NOW).onlineLink).toBeTruthy()
  })

  test('whitespace is not a link', () => {
    const d = draft({ locationType: 'online', address: '', onlineLink: '  \t ' })
    expect(validateEventDraft(d, NOW).onlineLink).toBeTruthy()
  })

  test('the requirement follows the kind: an online event needs no address', () => {
    const d = draft({ locationType: 'online', address: '', onlineLink: 'https://meet.example/x' })
    const errors = validateEventDraft(d, NOW)
    expect(errors.address).toBeUndefined()
    expect(errors.onlineLink).toBeUndefined()
  })

  test('and a physical event needs no link', () => {
    const d = draft({ locationType: 'physical', address: 'Somewhere real', onlineLink: '' })
    const errors = validateEventDraft(d, NOW)
    expect(errors.onlineLink).toBeUndefined()
    expect(errors.address).toBeUndefined()
  })
})

describe('validateEventDraft — attendee limit', () => {
  test('blank is fine — max_attendees 0 means no stated limit', () => {
    expect(validateEventDraft(draft({ maxAttendees: '' }), NOW).maxAttendees).toBeUndefined()
  })

  test('a whole number is fine', () => {
    expect(validateEventDraft(draft({ maxAttendees: '40' }), NOW).maxAttendees).toBeUndefined()
  })

  test('a negative limit is refused', () => {
    expect(validateEventDraft(draft({ maxAttendees: '-5' }), NOW).maxAttendees).toBeTruthy()
  })

  test('a fraction is refused — the column is INTEGER', () => {
    expect(validateEventDraft(draft({ maxAttendees: '12.5' }), NOW).maxAttendees).toBeTruthy()
  })

  test('words are refused rather than sent as NaN', () => {
    expect(validateEventDraft(draft({ maxAttendees: 'lots' }), NOW).maxAttendees).toBeTruthy()
  })
})

describe('validateEventDraft — the empty form', () => {
  test('an untouched draft reports every required field at once', () => {
    // This is precisely the body that the server would accept with a 201.
    const errors = validateEventDraft(emptyDraft(), NOW)
    expect(errors.title).toBeTruthy()
    expect(errors.startAt).toBeTruthy()
    expect(errors.address).toBeTruthy()
  })
})

describe('wallClockToInstant', () => {
  test('a UTC wall clock is that instant', () => {
    expect(wallClockToInstant('2026-10-02T18:30', 'UTC')?.toISOString()).toBe(
      '2026-10-02T18:30:00.000Z',
    )
  })

  test('a zone with a half-hour offset is handled', () => {
    // +05:30 — the offset that catches implementations that assume whole hours.
    expect(wallClockToInstant('2026-10-02T18:30', 'Asia/Kolkata')?.toISOString()).toBe(
      '2026-10-02T13:00:00.000Z',
    )
  })

  test('the offset is read at the event’s own date, not today’s', () => {
    // New York in July is -04:00 and in January -05:00. A single-offset
    // implementation gets one of these wrong.
    expect(wallClockToInstant('2026-07-15T12:00', 'America/New_York')?.toISOString()).toBe(
      '2026-07-15T16:00:00.000Z',
    )
    expect(wallClockToInstant('2026-01-15T12:00', 'America/New_York')?.toISOString()).toBe(
      '2026-01-15T17:00:00.000Z',
    )
  })

  test('midnight does not roll into the next day', () => {
    // hourCycle h23: with hour12:false some engines render midnight as "24",
    // which would push the date forward.
    expect(wallClockToInstant('2026-10-02T00:00', 'UTC')?.toISOString()).toBe(
      '2026-10-02T00:00:00.000Z',
    )
  })

  test('a string that is not a wall clock is null, which is what the validator reads', () => {
    expect(wallClockToInstant('', 'UTC')).toBeNull()
    expect(wallClockToInstant('soon', 'UTC')).toBeNull()
    expect(wallClockToInstant('2026-10-02', 'UTC')).toBeNull()
  })

  test('a timezone Intl refuses falls back instead of throwing', () => {
    // timezone is an unvalidated VARCHAR(50), so anything can be in there.
    expect(() => wallClockToInstant('2026-10-02T18:30', 'Mars/Olympus')).not.toThrow()
    expect(wallClockToInstant('2026-10-02T18:30', 'Mars/Olympus')).toBeInstanceOf(Date)
  })
})

describe('draftToPayload', () => {
  test('sends only the location field that matches the kind', () => {
    const physical = draftToPayload(draft({ locationType: 'physical', address: ' Somewhere ' }))
    expect(physical.address).toBe('Somewhere')
    expect(physical.online_link).toBeUndefined()

    const online = draftToPayload(
      draft({ locationType: 'online', address: 'stale', onlineLink: 'https://x.example' }),
    )
    expect(online.online_link).toBe('https://x.example')
    expect(online.address).toBeUndefined()
  })

  test('a blank limit becomes 0, the column default meaning no limit', () => {
    expect(draftToPayload(draft({ maxAttendees: '' })).max_attendees).toBe(0)
    expect(draftToPayload(draft({ maxAttendees: '25' })).max_attendees).toBe(25)
  })

  test('a blank description is omitted rather than sent as an empty string', () => {
    expect(draftToPayload(draft({ description: '  ' })).description).toBeUndefined()
  })

  test('start_at goes out as an instant, converted out of the event’s zone', () => {
    const payload = draftToPayload(draft({ timezone: 'Asia/Kolkata', startAt: '2026-10-02T18:30' }))
    expect(payload.start_at).toBe('2026-10-02T13:00:00.000Z')
    expect(payload.timezone).toBe('Asia/Kolkata')
  })

  test('no end means no end_at key', () => {
    expect(draftToPayload(draft({ endAt: '' })).end_at).toBeUndefined()
  })
})

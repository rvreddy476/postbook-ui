import { describe, expect, test } from 'bun:test'
import {
  ANONYMOUS_EXPLAINER,
  MAX_ADDITIONAL_GROUPS,
  MAX_CROSS_POST_TARGETS,
  MAX_HASHTAGS,
  anonymousCrossPostWarning,
  buildGroupTypePayload,
  canAddAnotherGroup,
  crossPostCapReason,
  crossPostOutcomeMessage,
  effectiveIsAnonymous,
  hasGroupPostMeta,
  interpretCreateGroupPostResponse,
  moodLine,
  normalizeCrossPostResult,
  normalizeCrossPostTargets,
  readGroupPostMeta,
  summariseCrossPost,
  type CrossPostResult,
} from '../groupComposer'

/* ═════════════════ buildGroupTypePayload ═════════════════ */

describe('buildGroupTypePayload', () => {
  test('carries the four things the composer used to drop on the floor', () => {
    /*
      THE BUG THIS MODULE EXISTS FOR. useCreateGroupPost forwarded only
      body/title/content_type/attachments, so a place, a feeling, an activity
      and hashtags were collected, discarded, and confirmed with a success
      toast.
    */
    expect(
      buildGroupTypePayload({
        feeling: 'excited',
        location: 'Hyderabad',
        hashtags: ['Design', 'ship'],
      }),
    ).toEqual({ feeling: 'excited', location: 'Hyderabad', hashtags: ['design', 'ship'] })
  })

  test('an activity keeps its detail', () => {
    expect(
      buildGroupTypePayload({ activity: 'Listening to', activityDetail: 'Radiohead' }),
    ).toEqual({ activity: 'Listening to', activity_detail: 'Radiohead' })
  })

  test('nothing collected sends no type_payload at all, not an empty object', () => {
    // `{}` would be stored, handed back on every read, and make every plain
    // post look as though it carried metadata.
    expect(buildGroupTypePayload({})).toBeUndefined()
    expect(buildGroupTypePayload({ feeling: '', location: '   ', hashtags: [] })).toBeUndefined()
  })

  test('empty values are omitted, never sent as "" or []', () => {
    const payload = buildGroupTypePayload({
      feeling: '  ',
      activity: null,
      location: 'Goa',
      hashtags: ['  ', '#'],
    })
    expect(payload).toEqual({ location: 'Goa' })
    expect(Object.keys(payload!)).not.toContain('feeling')
    expect(Object.keys(payload!)).not.toContain('hashtags')
  })

  test('a detail with no activity is dropped rather than carried as an orphan', () => {
    // "Radiohead" with no verb is not something the card can draw.
    expect(buildGroupTypePayload({ activityDetail: 'Radiohead' })).toBeUndefined()
    expect(buildGroupTypePayload({ activityDetail: 'Radiohead', location: 'Goa' })).toEqual({
      location: 'Goa',
    })
  })

  test('hashtags are normalized, deduped case-insensitively, and order is kept', () => {
    expect(
      buildGroupTypePayload({ hashtags: ['#Ship', 'ship!', ' SHIP ', 'design'] })?.hashtags,
    ).toEqual(['ship', 'design'])
  })

  test('hashtags are capped so the wire cannot exceed the composer', () => {
    const many = Array.from({ length: MAX_HASHTAGS + 12 }, (_, i) => `tag${i}`)
    expect(buildGroupTypePayload({ hashtags: many })?.hashtags).toHaveLength(MAX_HASHTAGS)
  })

  test('values are trimmed, so a stray group is not stored as part of a place', () => {
    expect(buildGroupTypePayload({ location: '  Hyderabad  ' })?.location).toBe('Hyderabad')
  })
})

/* ═════════════════ readGroupPostMeta ═════════════════ */

describe('readGroupPostMeta', () => {
  test('round-trips what the composer built', () => {
    const built = buildGroupTypePayload({
      feeling: 'excited',
      location: 'Hyderabad',
      hashtags: ['ship'],
    })
    const meta = readGroupPostMeta(built)
    expect(meta.feeling).toBe('excited')
    expect(meta.location).toBe('Hyderabad')
    expect(meta.hashtags).toEqual(['ship'])
    expect(hasGroupPostMeta(meta)).toBe(true)
  })

  test('a post with no payload renders nothing rather than throwing', () => {
    for (const input of [undefined, null, '', 'not json', 42, [], { }]) {
      const meta = readGroupPostMeta(input)
      expect(hasGroupPostMeta(meta)).toBe(false)
      expect(meta.hashtags).toEqual([])
    }
  })

  test('a shape written by another client cannot blank out the feed', () => {
    // type_payload is an opaque column: a poll row, an older build and a
    // different client all live in it.
    const meta = readGroupPostMeta({ question: 'tabs or groups', options: ['tabs'], feeling: 7 })
    expect(meta.feeling).toBeNull()
    expect(hasGroupPostMeta(meta)).toBe(false)
  })

  test('a double-encoded payload is still read', () => {
    const meta = readGroupPostMeta(JSON.stringify({ location: 'Goa' }))
    expect(meta.location).toBe('Goa')
  })

  test('moodLine prefers the activity and its detail over a feeling', () => {
    expect(moodLine(readGroupPostMeta({ activity: 'Listening to', activity_detail: 'Radiohead' })))
      .toBe('Listening to Radiohead')
    expect(moodLine(readGroupPostMeta({ activity: 'Travelling' }))).toBe('Travelling')
    expect(moodLine(readGroupPostMeta({ feeling: 'excited' }))).toBe('Feeling excited')
    expect(moodLine(readGroupPostMeta({}))).toBeNull()
  })
})

/* ═════════════════ the target cap ═════════════════ */

describe('normalizeCrossPostTargets', () => {
  test('the cap counts the group being posted to, so only four more may be added', () => {
    /*
      group-service builds `targets := []uuid.UUID{primaryGroupID}` and then
      appends also_post_to, refusing when the list exceeds MaxCrossPostTargets.
      Five EXTRA groups is six targets and a 400 before anything is written —
      which is exactly the "told 5 max by an error" this guard prevents.
    */
    expect(MAX_CROSS_POST_TARGETS).toBe(5)
    expect(MAX_ADDITIONAL_GROUPS).toBe(4)

    const picked = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6']
    const targets = normalizeCrossPostTargets(picked, 'primary')
    expect(targets).toHaveLength(MAX_ADDITIONAL_GROUPS)
    expect(1 + targets.length).toBeLessThanOrEqual(MAX_CROSS_POST_TARGETS)
  })

  test('the group being posted to is dropped, not left to spend a slot', () => {
    expect(normalizeCrossPostTargets(['primary', 'g1'], 'primary')).toEqual(['g1'])
  })

  test('duplicates are one target, as the server counts them', () => {
    expect(normalizeCrossPostTargets(['g1', 'g1', 'g2'], 'primary')).toEqual(['g1', 'g2'])
  })

  test('order is the order they were picked', () => {
    expect(normalizeCrossPostTargets(['g3', 'g1', 'g2'], 'p')).toEqual(['g3', 'g1', 'g2'])
  })

  test('blank ids never reach the wire as targets', () => {
    expect(normalizeCrossPostTargets(['', '   ', 'g1'], 'p')).toEqual(['g1'])
  })

  test('canAddAnotherGroup closes the picker before the server refuses', () => {
    expect(canAddAnotherGroup(0)).toBe(true)
    expect(canAddAnotherGroup(MAX_ADDITIONAL_GROUPS - 1)).toBe(true)
    expect(canAddAnotherGroup(MAX_ADDITIONAL_GROUPS)).toBe(false)
  })

  test('the cap is explained in terms of the limit the user would hit', () => {
    expect(crossPostCapReason()).toContain('5 groups')
    expect(crossPostCapReason()).toContain('4 more')
  })
})

/* ═════════════════ outcome wording ═════════════════ */

describe('crossPostOutcomeMessage', () => {
  test('every outcome the server can send has words', () => {
    for (const outcome of [
      'published',
      'pending_approval',
      'not_a_member',
      'banned',
      'not_permitted',
      'anonymous_not_allowed',
      'blocked_content',
      'unavailable',
    ]) {
      expect(crossPostOutcomeMessage(outcome).length).toBeGreaterThan(0)
    }
  })

  test('unavailable stays vague, so cross-posting cannot probe for private groups', () => {
    /*
      The server collapses missing / deleted / archived / private-and-not-a-
      member into one answer on purpose. Any wording that distinguishes them
      rebuilds the probe on the client.
    */
    const msg = crossPostOutcomeMessage('unavailable').toLowerCase()
    expect(msg).toBe('not available')
    for (const leak of ['delet', 'archiv', 'private', 'does not exist', 'no such']) {
      expect(msg).not.toContain(leak)
    }
  })

  test('an outcome this build has never heard of gets the vague answer, not the raw token', () => {
    const msg = crossPostOutcomeMessage('shadowbanned_by_topic')
    expect(msg).toBe('not available')
    expect(msg).not.toContain('shadowbanned')
  })

  test('anonymous_not_allowed says skipped, because it is never downgraded', () => {
    expect(crossPostOutcomeMessage('anonymous_not_allowed')).toContain('skipped')
  })
})

/* ═════════════════ the partial-success summary ═════════════════ */

function batch(outcomes: string[]): CrossPostResult {
  const targets = outcomes.map((outcome, i) => ({ group_id: `g${i}`, outcome }))
  return {
    published: targets.filter((t) => t.outcome === 'published').length,
    pending: targets.filter((t) => t.outcome === 'pending_approval').length,
    skipped: targets.filter((t) => !['published', 'pending_approval'].includes(t.outcome)).length,
    targets,
  }
}

const NAMES: Record<string, string> = { g0: 'Weekend Riders', g1: 'Book Club', g2: 'Design Chat' }
const nameOf = (id: string) => NAMES[id]

describe('summariseCrossPost', () => {
  test('a partial success is visible, and names the group that refused', () => {
    // "Posted to 2 of 3 groups" — the thing a success toast used to hide.
    const s = summariseCrossPost(batch(['published', 'published', 'not_a_member']), nameOf)
    expect(s.title).toBe('Posted to 2 of 3 groups')
    expect(s.description).toContain('Design Chat')
    expect(s.description).toContain('you are not a member')
    expect(s.ok).toBe(false)
  })

  test('a group held for approval counts as landed but is still reported', () => {
    const s = summariseCrossPost(batch(['published', 'pending_approval']), nameOf)
    expect(s.title).toBe('Posted to 2 groups')
    expect(s.description).toContain('Book Club')
    expect(s.description).toContain('approve')
    expect(s.ok).toBe(false)
  })

  test('total failure is never reported as a success', () => {
    const s = summariseCrossPost(batch(['banned', 'unavailable']), nameOf)
    expect(s.title).toBe('Could not post to any of the 2 groups')
    expect(s.ok).toBe(false)
    expect(s.description.split('\n')).toHaveLength(2)
  })

  test('a clean run says so and has nothing to add', () => {
    const s = summariseCrossPost(batch(['published', 'published']), nameOf)
    expect(s.title).toBe('Posted to 2 groups')
    expect(s.description).toBe('')
    expect(s.ok).toBe(true)
  })

  test('one refused group names itself rather than counting to one', () => {
    const s = summariseCrossPost(batch(['blocked_content']), nameOf)
    expect(s.title).toBe('Could not post')
    expect(s.description).toContain('Weekend Riders')
  })

  test('a group the client cannot name is still listed', () => {
    // Losing a refusal is worse than printing a placeholder.
    const s = summariseCrossPost(batch(['published', 'banned']), () => undefined)
    expect(s.title).toBe('Posted to 1 of 2 groups')
    expect(s.description).toContain('Another group')
  })

  test('an unreadable answer is not reported as a silent success', () => {
    const s = summariseCrossPost({ published: 0, pending: 0, skipped: 0, targets: [] }, nameOf)
    expect(s.ok).toBe(false)
    expect(s.title).toContain('could not be read')
  })
})

/* ═════════════════ the compatibility hinge ═════════════════ */

describe('interpretCreateGroupPostResponse', () => {
  test('no targets sent means the bare post, even if the body looks like a batch', () => {
    /*
      THE HINGE. The response shape depends on the REQUEST: bare post without
      also_post_to, batch result with it. Sniffing the body for `targets` would
      make the client's reading depend on server fields instead of its own
      intent, and the bare shape is what the mobile app reads.
    */
    const looksLikeBatch = { published: 1, pending: 0, skipped: 0, targets: [] }
    const out = interpretCreateGroupPostResponse(0, looksLikeBatch)
    expect(out.kind).toBe('single')
  })

  test('targets sent means the batch answer', () => {
    const out = interpretCreateGroupPostResponse(2, batch(['published', 'banned']))
    expect(out.kind).toBe('batch')
    expect(out.kind === 'batch' && out.result.targets).toHaveLength(2)
  })

  test('a bare post is handed back untouched', () => {
    const post = { id: 'p1', group_id: 'g1', body: 'hello' }
    const out = interpretCreateGroupPostResponse(0, post)
    expect(out.kind === 'single' && out.post.id).toBe('p1')
  })
})

describe('normalizeCrossPostResult', () => {
  test('a count Go omitted reads as 0, never NaN', () => {
    const r = normalizeCrossPostResult({ published: 2, targets: [] })
    expect(r.pending).toBe(0)
    expect(r.skipped).toBe(0)
    expect(Number.isNaN(r.pending)).toBe(false)
  })

  test('a null targets array does not throw', () => {
    expect(normalizeCrossPostResult({ targets: null }).targets).toEqual([])
    expect(normalizeCrossPostResult(undefined).targets).toEqual([])
  })

  test('a malformed target is dropped rather than rendered as "undefined — "', () => {
    const r = normalizeCrossPostResult({
      targets: [{ group_id: 'g1', outcome: 'published' }, { outcome: 'banned' }, null],
    })
    expect(r.targets).toHaveLength(1)
  })
})

/* ═════════════════ anonymity wording ═════════════════ */

describe('anonymity', () => {
  test('the promise is pseudonymity against other members, and nothing more', () => {
    /*
      A product decision already taken. "Nobody can tell it was you" is a
      promise the product cannot keep: in a three-person group, timing and
      content still correlate.
    */
    expect(ANONYMOUS_EXPLAINER).toContain('hidden from other members')
    const lower = ANONYMOUS_EXPLAINER.toLowerCase()
    for (const overclaim of ['nobody can tell', 'no one can tell', 'untraceable', 'completely anonymous']) {
      expect(lower).not.toContain(overclaim)
    }
  })

  test('anonymity is only sent to a group that opted in', () => {
    /*
      The server refuses is_anonymous for a group that has not opted in, and
      the author reads a 403 as having lost their post. An absent field and a
      false one both mean "not opted in": Go marshals the unset case as false,
      and a server build older than the feature omits it entirely.
    */
    expect(effectiveIsAnonymous(true, true)).toBe(true)
    expect(effectiveIsAnonymous(true, false)).toBe(false)
    expect(effectiveIsAnonymous(true, undefined)).toBe(false)
    expect(effectiveIsAnonymous(false, true)).toBe(false)
  })

  test('an anonymous cross-post warns that groups may be skipped', () => {
    const warning = anonymousCrossPostWarning(true, 2)
    expect(warning).toContain('skipped')
    // Never a hint that the name might be shown instead — the server has an
    // explicit test that no path downgrades an anonymous post to a named one.
    expect(warning?.toLowerCase()).not.toContain('posted with your name')
  })

  test('no warning when there is nothing to skip', () => {
    expect(anonymousCrossPostWarning(true, 0)).toBeNull()
    expect(anonymousCrossPostWarning(false, 3)).toBeNull()
  })
})

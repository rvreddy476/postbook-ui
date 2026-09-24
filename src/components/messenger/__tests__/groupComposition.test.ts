import { describe, expect, test } from 'bun:test'
import {
    addPeopleSummary,
    createBlock,
    filterCandidates,
    toggleSelected,
    MAX_PEOPLE,
    type Candidate,
} from '../groupComposition'

function person(over: Partial<Candidate> = {}): Candidate {
    return { user_id: 'u1', display_name: 'Ada Lovelace', username: 'ada', ...over }
}

describe('createBlock', () => {
    test('a group can be created with nobody in it', () => {
        /*
          There is no minimum, deliberately. A required member locked out the
          accounts most likely to want a group: a new one has no connections,
          so the gate turned "create a group" into "first get someone to accept
          a message request". People are added from inside the group instead.
        */
        expect(createBlock('Weekend Riders', 0)).toEqual({ ok: true })
    })

    test('picking people is still allowed, just not required', () => {
        expect(createBlock('Weekend Riders', 1)).toEqual({ ok: true })
        expect(createBlock('Weekend Riders', 12)).toEqual({ ok: true })
    })

    test('the name is the only thing actually required', () => {
        expect(createBlock('', 0)).toEqual({ ok: false, reason: 'Give the group a name' })
        expect(createBlock('', 5)).toEqual({ ok: false, reason: 'Give the group a name' })
    })

    test('a too-short name is named as such, not reported as missing', () => {
        const r = createBlock('ab', 1)
        expect(r.ok).toBe(false)
        expect(r.ok === false && r.reason).toContain('3 characters')
    })

    test('whitespace is not a name', () => {
        expect(createBlock('   ', 1)).toEqual({ ok: false, reason: 'Give the group a name' })
    })

    test('the server refuses more than 50, so the dialog does too', () => {
        expect(createBlock('Big', MAX_PEOPLE)).toEqual({ ok: true })
        const over = createBlock('Big', MAX_PEOPLE + 1)
        expect(over.ok).toBe(false)
        expect(over.ok === false && over.reason).toContain('50')
    })

    test('every refusal carries a reason a person can act on', () => {
        for (const [name, count] of [['', 0], ['ab', 1], ['fine', 51]] as const) {
            const r = createBlock(name, count)
            expect(r.ok).toBe(false)
            expect(r.ok === false && r.reason.length).toBeGreaterThan(0)
        }
    })
})

describe('filterCandidates', () => {
    const people = [
        person({ user_id: 'a', display_name: 'Ada Lovelace', username: 'ada' }),
        person({ user_id: 'b', display_name: 'Grace Hopper', username: 'ghopper' }),
    ]

    test('an empty query keeps everyone', () => {
        expect(filterCandidates(people, '')).toHaveLength(2)
        expect(filterCandidates(people, '   ')).toHaveLength(2)
    })

    test('matches the display name, ignoring case', () => {
        expect(filterCandidates(people, 'GRACE').map((p) => p.user_id)).toEqual(['b'])
    })

    test('matches the handle too, since that is what people remember', () => {
        expect(filterCandidates(people, 'ghop').map((p) => p.user_id)).toEqual(['b'])
    })

    test('no match is empty, not everyone', () => {
        expect(filterCandidates(people, 'zzz')).toEqual([])
    })
})

describe('toggleSelected', () => {
    test('adds then removes, and does not mutate the input', () => {
        const start: string[] = []
        const one = toggleSelected(start, 'a')
        expect(one).toEqual(['a'])
        expect(start).toEqual([])
        expect(toggleSelected(one, 'a')).toEqual([])
    })

    test('selecting twice does not duplicate', () => {
        const twice = toggleSelected(toggleSelected(['a'], 'b'), 'b')
        expect(twice).toEqual(['a'])
    })
})

describe('addPeopleSummary', () => {
    test('added and invited are kept apart, because they mean different things', () => {
        // Added: in the group. Invited: not in it until they accept. Collapsing
        // these into "3 added" is how a creator ends up staring at a group of
        // one and concluding the product is broken.
        expect(addPeopleSummary({ added: 2, invited: 1, skipped: 0 })).toBe(
            '2 people added and 1 person invited.',
        )
    })

    test('singular and plural both read correctly', () => {
        expect(addPeopleSummary({ added: 1, invited: 0, skipped: 0 })).toBe('1 person added.')
        expect(addPeopleSummary({ added: 0, invited: 2, skipped: 0 })).toBe('2 people invited.')
    })

    test('skipped people are counted but never explained', () => {
        const s = addPeopleSummary({ added: 1, invited: 0, skipped: 2 })
        expect(s).toBe('1 person added, 2 people could not be added.')
        // Why they were skipped is withheld on purpose — saying "blocked"
        // would tell the creator who blocked them.
        expect(s).not.toContain('block')
        expect(s).not.toContain('privacy')
    })

    test('nobody getting in is never silent', () => {
        // The failure mode that matters: the creator picked people, the group
        // has only them, and the dialog said nothing.
        expect(addPeopleSummary({ added: 0, invited: 0, skipped: 3 })).toBe(
            'Nobody could be added right now — 3 people could not be reached.',
        )
        expect(addPeopleSummary({ added: 0, invited: 0, skipped: 0 })).toBe('Nobody was added.')
    })

    test('it never reports more than actually happened', () => {
        // Counting the people picked rather than the counts returned is the
        // easy mistake; the summary can only see the server's answer.
        const s = addPeopleSummary({ added: 1, invited: 0, skipped: 4 })
        expect(s?.startsWith('1 person added')).toBe(true)
        expect(s).not.toContain('5 people added')
    })
})

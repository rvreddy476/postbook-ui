/**
 * Who goes in a new group, and what to say about it afterwards.
 *
 * Separated from the dialog so the rules can be tested without a DOM. The
 * summary in particular is worth pinning: the server answers in counts, and
 * the temptation is to report the number of people picked rather than the
 * number actually added — which is how a dialog ends up saying "3 added" over
 * a group with one member.
 */

/** A person who can be put in a group, as the connections list serves them. */
export interface Candidate {
    user_id: string
    display_name: string
    username: string
    avatar_media_id?: string
}

/** What group-service reports after adding people. Counts, never names. */
export interface AddPeopleResult {
    added: number
    invited: number
    skipped: number
}

export const NAME_MIN = 3
export const NAME_MAX = 60
export const DESCRIPTION_MAX = 300
/** group-service refuses more than this in one call. */
export const MAX_PEOPLE = 50

export type CreateBlock =
    | { ok: true }
    | { ok: false; reason: string }

/**
 * Whether the group can be created yet, and if not, why in the user's words.
 *
 * A reason rather than a bare false: a disabled button with no explanation is
 * the thing people report as "the button does nothing".
 */
export function createBlock(name: string, selectedCount: number): CreateBlock {
    const trimmed = name.trim()
    if (trimmed.length === 0) return { ok: false, reason: 'Give the group a name' }
    if (trimmed.length < NAME_MIN) {
        return { ok: false, reason: `The name needs at least ${NAME_MIN} characters` }
    }
    // A group of one is a note to self. The founder's rule: at least one other
    // person before it exists.
    if (selectedCount === 0) return { ok: false, reason: 'Add at least one person' }
    if (selectedCount > MAX_PEOPLE) {
        return { ok: false, reason: `You can add up to ${MAX_PEOPLE} people at once` }
    }
    return { ok: true }
}

/** Case-insensitive match on either the display name or the handle. */
export function filterCandidates(people: Candidate[], query: string): Candidate[] {
    const q = query.trim().toLowerCase()
    if (!q) return people
    return people.filter(
        (p) =>
            p.display_name.toLowerCase().includes(q) ||
            p.username.toLowerCase().includes(q),
    )
}

export function toggleSelected(selected: readonly string[], userId: string): string[] {
    return selected.includes(userId)
        ? selected.filter((id) => id !== userId)
        : [...selected, userId]
}

/**
 * What actually happened, in plain words.
 *
 * Three outcomes have to stay distinguishable, because they mean different
 * things to the person who just picked people:
 *
 *   - added   — they are in the group now
 *   - invited — they have been asked and have not answered
 *   - skipped — they could not be added, and WHY is deliberately not said
 *
 * The skipped count is reported without naming anyone: the server withholds
 * the names precisely so that a block cannot be read off the response, and
 * repeating a name here would undo that. Saying nothing at all is worse — the
 * creator would be left wondering where someone went.
 *
 * Returns null when there is nothing worth saying (everyone went in cleanly),
 * so the caller can stay quiet rather than confirm the obvious.
 */
export function addPeopleSummary(result: AddPeopleResult): string | null {
    const { added, invited, skipped } = result
    const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`

    const parts: string[] = []
    if (added > 0) parts.push(`${people(added)} added`)
    if (invited > 0) parts.push(`${people(invited)} invited`)

    if (parts.length === 0) {
        // Nobody got in. This must never be silent: the creator picked people
        // and the group has only them in it.
        return skipped > 0
            ? `Nobody could be added right now — ${people(skipped)} could not be reached.`
            : 'Nobody was added.'
    }

    let sentence = parts.join(' and ')
    if (skipped > 0) {
        sentence += `, ${people(skipped)} could not be added`
    }
    return `${sentence}.`
}

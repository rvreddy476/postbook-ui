import { describe, expect, test } from 'bun:test'
import type { ChannelUpdate } from '@/types/channels'
import { formatCount, monthBuckets, overviewStats, recentPosts } from '../overviewStats'

/**
 * The Overview tab shows these numbers to a channel owner as facts, so each
 * one is pinned here. The cases that matter are the ones a plausible-looking
 * dashboard gets wrong quietly: a rate with no denominator, two Septembers a
 * year apart landing in one bucket, and a Go zero value read as "absent".
 */

function update(over: Partial<ChannelUpdate> = {}): ChannelUpdate {
    return {
        id: over.id || 'u1',
        channel_id: 'c1',
        author_id: 'a1',
        update_type: 'announcement',
        body: 'body',
        media_ids: [],
        is_pinned: false,
        status: 'published',
        view_count: 0,
        reaction_count: 0,
        comment_count: 0,
        forward_count: 0,
        created_at: '2026-09-20T10:00:00Z',
        ...over,
    }
}

const NOW = new Date(2026, 8, 24) // 24 September 2026, local time

describe('overviewStats', () => {
    test('engagement rate is null with no views, not 0%', () => {
        const s = overviewStats([update({ reaction_count: 3 })], NOW)
        // A channel nobody has viewed has no engagement RATE. Reporting 0%
        // would read as "people saw it and ignored it", which is a different
        // and untrue statement.
        expect(s.engagementRate).toBeNull()
        expect(s.engagements).toBe(3)
    })

    test('rate is engagements over views, expressed as a percentage', () => {
        const s = overviewStats(
            [update({ view_count: 200, reaction_count: 30, comment_count: 10 })],
            NOW,
        )
        expect(s.views).toBe(200)
        expect(s.engagements).toBe(40)
        expect(s.engagementRate).toBeCloseTo(20, 5)
    })

    test('counts only the calendar month containing now', () => {
        const s = overviewStats(
            [
                update({ id: 'a', published_at: '2026-09-02T00:00:00Z' }),
                update({ id: 'b', published_at: '2026-09-23T00:00:00Z' }),
                update({ id: 'c', published_at: '2026-08-31T00:00:00Z' }),
                update({ id: 'd', published_at: '2025-09-15T00:00:00Z' }),
            ],
            NOW,
        )
        expect(s.thisMonth).toBe(2)
        expect(s.total).toBe(4)
    })

    test('published_at wins over created_at; a missing one falls back', () => {
        const s = overviewStats(
            [
                // Drafted in August, published in September: it counts as a
                // September post, because that is when anybody could see it.
                update({ created_at: '2026-08-01T00:00:00Z', published_at: '2026-09-10T00:00:00Z' }),
                // Never published: created_at is all there is.
                update({ id: 'x', created_at: '2026-09-11T00:00:00Z' }),
            ],
            NOW,
        )
        expect(s.thisMonth).toBe(2)
    })

    test('an empty published_at string falls through to created_at', () => {
        // Go serialises an unset string as "", not by omitting the field, so
        // `??` would take "" as a value and every date would be Invalid.
        const s = overviewStats(
            [update({ published_at: '', created_at: '2026-09-12T00:00:00Z' })],
            NOW,
        )
        expect(s.thisMonth).toBe(1)
    })

    test('an unparseable date is not counted and does not poison the totals', () => {
        const s = overviewStats(
            [update({ published_at: 'not-a-date', view_count: 5, reaction_count: 2 })],
            NOW,
        )
        expect(s.thisMonth).toBe(0)
        expect(s.views).toBe(5)
        expect(s.engagements).toBe(2)
        expect(s.engagementRate).toBeCloseTo(40, 5)
    })

    test('no posts gives zeros and no rate', () => {
        const s = overviewStats([], NOW)
        expect(s).toEqual({
            thisMonth: 0,
            total: 0,
            views: 0,
            engagements: 0,
            engagementRate: null,
        })
    })
})

describe('monthBuckets', () => {
    test('six buckets ending with the current month, oldest first', () => {
        const b = monthBuckets([], NOW)
        expect(b).toHaveLength(6)
        expect(b[0].key).toBe('2026-3') // April
        expect(b[5].key).toBe('2026-8') // September
    })

    test('the same month a year apart does not share a bucket', () => {
        const b = monthBuckets(
            [
                update({ id: 'now', published_at: '2026-09-05T00:00:00Z' }),
                update({ id: 'old', published_at: '2025-09-05T00:00:00Z' }),
            ],
            NOW,
        )
        const september = b.find((m) => m.key === '2026-8')
        expect(september?.count).toBe(1) // not 2
        expect(b.reduce((n, m) => n + m.count, 0)).toBe(1)
    })

    test('a month with no posts stays at zero rather than being dropped', () => {
        const b = monthBuckets([update({ published_at: '2026-09-05T00:00:00Z' })], NOW)
        expect(b.filter((m) => m.count === 0)).toHaveLength(5)
    })

    test('buckets cross a year boundary correctly', () => {
        const b = monthBuckets([], new Date(2026, 1, 15)) // February 2026
        expect(b[0].key).toBe('2025-8') // September 2025
        expect(b[5].key).toBe('2026-1') // February 2026
    })
})

describe('recentPosts', () => {
    test('newest first, capped, and the input is not mutated', () => {
        const input = [
            update({ id: 'old', published_at: '2026-09-01T00:00:00Z' }),
            update({ id: 'new', published_at: '2026-09-23T00:00:00Z' }),
            update({ id: 'mid', published_at: '2026-09-10T00:00:00Z' }),
        ]
        const out = recentPosts(input, 2)
        expect(out.map((u) => u.id)).toEqual(['new', 'mid'])
        expect(input.map((u) => u.id)).toEqual(['old', 'new', 'mid'])
    })

    test('an unparseable date sorts last instead of scrambling the order', () => {
        const out = recentPosts([
            update({ id: 'broken', published_at: 'nope' }),
            update({ id: 'a', published_at: '2026-09-01T00:00:00Z' }),
            update({ id: 'b', published_at: '2026-09-20T00:00:00Z' }),
        ])
        expect(out.map((u) => u.id)).toEqual(['b', 'a', 'broken'])
    })
})

describe('formatCount', () => {
    test('thresholds', () => {
        expect(formatCount(0)).toBe('0')
        expect(formatCount(999)).toBe('999')
        expect(formatCount(1_000)).toBe('1.0K')
        expect(formatCount(12_400)).toBe('12.4K')
        expect(formatCount(1_000_000)).toBe('1.0M')
        expect(formatCount(3_250_000)).toBe('3.3M')
    })

    test('NaN renders as 0, never as "NaN" on the card', () => {
        expect(formatCount(Number.NaN)).toBe('0')
    })
})

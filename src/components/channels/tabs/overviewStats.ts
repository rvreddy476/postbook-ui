import type { ChannelUpdate } from '@/types/channels'

/**
 * The Overview tab's arithmetic, separated from its rendering.
 *
 * These are the numbers an owner will read as facts about their channel, so
 * they are worth testing without a DOM. Each one is derived only from updates
 * the client already holds — there is no stats endpoint on channel-service, and
 * inventing one client-side is the point at which a dashboard starts lying.
 */

/** A month bucket of posting activity, oldest first. */
export interface MonthBucket {
    key: string
    label: string
    count: number
}

export interface OverviewStats {
    /** Posts published in the calendar month containing `now`. */
    thisMonth: number
    total: number
    views: number
    /** Reactions plus comments across every loaded post. */
    engagements: number
    /**
     * Engagements as a percentage of views, or null when there are no views.
     *
     * Against VIEWS, not members: a rate against the member count would divide
     * by a number that has nothing to do with how many people saw the post, and
     * would read as over 100% on a channel whose posts get forwarded.
     *
     * null rather than 0 so the caller can show "—" instead of claiming a
     * channel with no views has 0% engagement.
     */
    engagementRate: number | null
}

/** The timestamp a post is filed under: when it went out, else when it was made. */
function publishedAt(u: ChannelUpdate): number {
    const raw = u.published_at || u.created_at
    const t = new Date(raw).getTime()
    return Number.isNaN(t) ? NaN : t
}

export function overviewStats(updates: ChannelUpdate[], now: Date = new Date()): OverviewStats {
    let thisMonth = 0
    let views = 0
    let engagements = 0

    for (const u of updates) {
        const t = publishedAt(u)
        if (!Number.isNaN(t)) {
            const d = new Date(t)
            if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
                thisMonth++
            }
        }
        // Go's zero values arrive as 0, and an older server build omits the
        // field entirely, so both have to fall through to 0.
        views += u.view_count || 0
        engagements += (u.reaction_count || 0) + (u.comment_count || 0)
    }

    return {
        thisMonth,
        total: updates.length,
        views,
        engagements,
        engagementRate: views > 0 ? (engagements / views) * 100 : null,
    }
}

/**
 * Six month buckets ending with the month containing `now`, oldest first.
 *
 * Bucketed on year AND month, not month alone: keying on the month number
 * would fold last September's posts into this September's bar.
 */
export function monthBuckets(
    updates: ChannelUpdate[],
    now: Date = new Date(),
    months = 6,
): MonthBucket[] {
    const buckets: MonthBucket[] = []
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        buckets.push({
            key: `${d.getFullYear()}-${d.getMonth()}`,
            label: d.toLocaleDateString(undefined, { month: 'short' }),
            count: 0,
        })
    }
    const index = new Map(buckets.map((b, i) => [b.key, i]))
    for (const u of updates) {
        const t = publishedAt(u)
        if (Number.isNaN(t)) continue
        const d = new Date(t)
        const i = index.get(`${d.getFullYear()}-${d.getMonth()}`)
        if (i !== undefined) buckets[i].count++
    }
    return buckets
}

/** The newest `limit` posts, newest first. Does not mutate the input. */
export function recentPosts(updates: ChannelUpdate[], limit = 5): ChannelUpdate[] {
    return [...updates]
        .sort((a, b) => {
            const bt = publishedAt(b)
            const at = publishedAt(a)
            // An unparseable date sorts last rather than poisoning the
            // comparison, which NaN arithmetic would do.
            if (Number.isNaN(at) && Number.isNaN(bt)) return 0
            if (Number.isNaN(at)) return 1
            if (Number.isNaN(bt)) return -1
            return bt - at
        })
        .slice(0, limit)
}

export function formatCount(n: number): string {
    if (!Number.isFinite(n)) return '0'
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(Math.trunc(n))
}

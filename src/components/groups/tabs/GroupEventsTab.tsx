'use client'

import React, { useMemo, useState } from 'react'
import { CalendarPlus, CalendarX } from 'lucide-react'
import { useGroupEvents } from '@/hooks/useGroupEvents'
import EventCard from '@/components/groups/events/EventCard'
import EventComposer from '@/components/groups/events/EventComposer'
import type { GroupEvent } from '@/types/groups'

/** The roles group-service accepts on POST and DELETE for an event. */
const MANAGER_ROLES = ['owner', 'admin', 'moderator'] as const

export type GroupEventsViewerRole =
  | 'owner'
  | 'admin'
  | 'moderator'
  | 'member'
  | 'pending'
  | 'outsider'
  | 'banned'

export function canManageEvents(viewerRole: string | undefined): boolean {
  return MANAGER_ROLES.includes(viewerRole as (typeof MANAGER_ROLES)[number])
}

/** The roles that correspond to an active member row, which is exactly what
 *  RSVPGroupEvent's CheckMembership test asks about. 'pending' is a join
 *  request, 'outsider' and 'banned' are not in the group, and none of the three
 *  may be offered RSVP buttons that would come back 403. */
const MEMBER_ROLES = ['owner', 'admin', 'moderator', 'member'] as const

export function isGroupMember(viewerRole: string | undefined): boolean {
  return MEMBER_ROLES.includes(viewerRole as (typeof MEMBER_ROLES)[number])
}

export interface PartitionedEvents {
  /** Soonest first. */
  upcoming: GroupEvent[]
  /** Most recent first. */
  past: GroupEvent[]
}

/**
 * Split the server's list into what is still to come and what already happened.
 *
 * This is not presentation polish; it is a correction. ListGroupEvents runs
 * `ORDER BY start_at ASC`, so the FIRST rows it returns are the OLDEST events
 * the group ever held. Rendering the array in the order it arrives puts last
 * year's meetup at the top of the tab and next week's above the fold only once
 * the group has no history — exactly backwards from what an events tab is for.
 *
 * An event counts as past once it has FINISHED, not once it has started: a
 * three-hour meetup an hour in is the most relevant thing on the page, and
 * dropping it into Past mid-session would make it look cancelled. So the
 * comparison uses `end_at` when the event has one and falls back to `start_at`
 * when it does not.
 *
 * `events` is typed nullable on purpose. ListGroupEvents builds
 * `var events []GroupEvent`, appends nothing for a group with no events, and
 * the handler hands that nil slice straight to the encoder — which emits
 * `"data": null`. The hook already coalesces, and this function tolerates it
 * too rather than depending on a caller remembering.
 */
export function partitionEvents(
  events: GroupEvent[] | null | undefined,
  now: Date = new Date(),
): PartitionedEvents {
  const upcoming: GroupEvent[] = []
  const past: GroupEvent[] = []
  const nowMs = now.getTime()

  for (const event of events ?? []) {
    const endMs = new Date(event.end_at ?? event.start_at).getTime()
    // A date the platform cannot read — and the unvalidated POST route means a
    // stored start_at is whatever a client once sent — must not be promoted to
    // Upcoming, where it would sit above real events forever.
    if (Number.isNaN(endMs) || endMs < nowMs) {
      past.push(event)
    } else {
      upcoming.push(event)
    }
  }

  const startMs = (e: GroupEvent) => {
    const ms = new Date(e.start_at).getTime()
    return Number.isNaN(ms) ? 0 : ms
  }

  // Ascending for Upcoming (the server order, made explicit rather than
  // assumed) and descending for Past, so each list opens on the event closest
  // to today from its own side.
  upcoming.sort((a, b) => startMs(a) - startMs(b))
  past.sort((a, b) => startMs(b) - startMs(a))

  return { upcoming, past }
}

interface GroupEventsTabProps {
  groupId: string
  /**
   * The viewer's role in this group, and the whole basis of what this tab
   * offers. CreateGroupEvent and DeleteGroupEvent 403 anyone who is not
   * owner / admin / moderator, so a member shown the "Create event" button
   * would fill in the entire form and only then be told no, with nothing they
   * can do about it. Membership alone cannot gate that — only the role can.
   */
  viewerRole: GroupEventsViewerRole | undefined
  /**
   * Whether the viewer may RSVP. Optional because the role already answers it:
   * RSVPGroupEvent's membership test passes for exactly the four roles that
   * carry an active member row. Pass it only to override that.
   */
  isMember?: boolean
}

export default function GroupEventsTab({ groupId, viewerRole, isMember }: GroupEventsTabProps) {
  const [composing, setComposing] = useState(false)
  const { data, isLoading, isError, refetch } = useGroupEvents(groupId)

  const canManage = canManageEvents(viewerRole)
  const viewerCanRSVP = isMember ?? isGroupMember(viewerRole)
  const { upcoming, past } = useMemo(() => partitionEvents(data), [data])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-brand-secondary" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-semibold text-brand-text/55">Events could not be loaded.</p>
        <button
          onClick={() => refetch()}
          className="mt-3 rounded-xl border border-brand-divider bg-brand-card px-5 py-2 text-xs font-bold text-brand-text"
        >
          Try again
        </button>
      </div>
    )
  }

  const hasAny = upcoming.length > 0 || past.length > 0

  return (
    <div className="space-y-5">
      {canManage && (
        <div>
          {composing ? (
            <EventComposer groupId={groupId} onClose={() => setComposing(false)} />
          ) : (
            <button
              onClick={() => setComposing(true)}
              className="bg-primary-grad flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold text-white transition-all hover:shadow-md active:scale-[0.98]"
            >
              <CalendarPlus className="h-4 w-4" />
              Create event
            </button>
          )}
        </div>
      )}

      {!hasAny && (
        <div className="py-20 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-secondary">
            <CalendarX className="h-8 w-8 text-brand-text/20" />
          </div>
          <p className="text-sm font-semibold text-brand-text/55">No events yet</p>
          <p className="mt-1 text-xs text-brand-text/55">
            {canManage
              ? 'Create one and it will show up here for every member.'
              : 'Admins and moderators of this group can add one.'}
          </p>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-brand-text/55">
            Upcoming · {upcoming.length}
          </h2>
          {upcoming.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              groupId={groupId}
              isMember={viewerCanRSVP}
              canManage={canManage}
            />
          ))}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-brand-text/55">
            Past · {past.length}
          </h2>
          {/* Dimmed rather than hidden: a past event is still the record of
              something the group did, and RSVP counts stay readable on it. */}
          <div className="space-y-3 opacity-60">
            {past.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                groupId={groupId}
                isMember={viewerCanRSVP}
                canManage={canManage}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

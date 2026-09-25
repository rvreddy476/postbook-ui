'use client'

import React, { useState } from 'react'
import {
  Calendar,
  Check,
  CircleSlash,
  Globe,
  HelpCircle,
  Link as LinkIcon,
  MapPin,
  Trash2,
  Users,
} from 'lucide-react'
import { useDeleteGroupEvent, useRSVPGroupEvent } from '@/hooks/useGroupEvents'
import type { GroupEvent, GroupEventRSVPStatus } from '@/types/groups'

/**
 * Build a formatter pinned to the EVENT's zone, never the reader's.
 *
 * A group event happens at a place. "Saturday 10am" in Bengaluru is the same
 * event whether it is read in Bengaluru or in Berlin, and shifting it into the
 * reader's offset turns it into a different sentence about a different morning.
 *
 * `timezone` arrives from an unconstrained VARCHAR(50) that the create handler
 * never validated, so it can be a string Intl refuses. A RangeError here would
 * take down the whole tab, so an unusable zone degrades to the reader's own
 * offset — visibly labelled, because that formatter still prints its zone name.
 */
function zonedFormatter(timeZone: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat(undefined, { ...opts, timeZone })
  } catch {
    return new Intl.DateTimeFormat(undefined, opts)
  }
}

function parse(iso: string | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * The event's start, and its end when it has one, as one line in the event's
 * own zone. An all-day event never shows a clock — that is the whole point of
 * the flag — and a same-day end shows only the closing time.
 */
export function formatEventWhen(event: GroupEvent): string {
  const start = parse(event.start_at)
  if (!start) return 'Date unavailable'

  const dateOpts: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }
  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }

  const dayOf = zonedFormatter(event.timezone, dateOpts)
  if (event.is_all_day) {
    const end = parse(event.end_at)
    if (end && dayOf.format(end) !== dayOf.format(start)) {
      return `${dayOf.format(start)} – ${dayOf.format(end)} · all day`
    }
    return `${dayOf.format(start)} · all day`
  }

  const clock = zonedFormatter(event.timezone, timeOpts)
  const head = `${dayOf.format(start)}, ${clock.format(start)}`
  const end = parse(event.end_at)
  if (!end) return head
  if (dayOf.format(end) === dayOf.format(start)) {
    // Same day: the closing time alone, without repeating the zone name.
    const bare = zonedFormatter(event.timezone, { hour: 'numeric', minute: '2-digit' })
    return `${head} – ${bare.format(end)}`
  }
  return `${head} – ${dayOf.format(end)}, ${clock.format(end)}`
}

interface EventCardProps {
  event: GroupEvent
  groupId: string
  /** RSVP is members-only server-side, so the buttons are hidden otherwise. */
  isMember: boolean
  /** owner / admin / moderator — the only roles DELETE accepts. */
  canManage: boolean
}

const RSVP_CHOICES: { status: GroupEventRSVPStatus; label: string; icon: React.ReactNode }[] = [
  { status: 'going', label: 'Going', icon: <Check className="h-3.5 w-3.5" /> },
  { status: 'maybe', label: 'Maybe', icon: <HelpCircle className="h-3.5 w-3.5" /> },
  { status: 'not_going', label: "Can't go", icon: <CircleSlash className="h-3.5 w-3.5" /> },
]

export default function EventCard({ event, groupId, isMember, canManage }: EventCardProps) {
  /**
   * The RSVP the viewer picked DURING THIS SESSION, and nothing more.
   *
   * There is no `viewer_rsvp` on the wire: the list query does not join
   * group_event_rsvps and no route reads your own RSVP back. So after a reload
   * this app cannot know which option you chose, and it must not pretend to —
   * mirroring the choice into localStorage would show "Going" on a device whose
   * RSVP had since been changed elsewhere, or after the event was cancelled and
   * recreated. That is a confident lie, which is worse than an honest blank.
   *
   * The counts below are the durable truth and come from the server on every
   * refetch. This state only lights up the button you just pressed.
   */
  const [sessionRSVP, setSessionRSVP] = useState<GroupEventRSVPStatus | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const rsvp = useRSVPGroupEvent()
  const remove = useDeleteGroupEvent()

  const isPhysical = event.location_type === 'physical'
  const isOnline = event.location_type === 'online'

  const submitRSVP = (status: GroupEventRSVPStatus) => {
    setSessionRSVP(status)
    rsvp.mutate(
      { groupId, eventId: event.id, status },
      // Server refused it — drop the highlight rather than leave a choice
      // showing that was never recorded.
      { onError: () => setSessionRSVP(null) },
    )
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-card">
      {event.cover_media_id && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/v1/media/${event.cover_media_id}/serve`}
          alt=""
          loading="lazy"
          className="h-40 w-full object-cover"
        />
      )}

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* An unvalidated POST can store an empty title, so say so rather
                than rendering a nameless card. */}
            <h3 className="truncate text-sm font-bold text-brand-text">
              {event.title.trim() || 'Untitled event'}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-brand-text/55">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{formatEventWhen(event)}</span>
            </p>
          </div>

          {canManage && (
            // No Edit button: group-service exposes no PUT or PATCH for an
            // event. Cancel and recreate is the only way to change one.
            <div className="shrink-0">
              {confirmDelete ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => remove.mutate({ groupId, eventId: event.id })}
                    disabled={remove.isPending}
                    className="rounded-lg px-2 py-1 text-[11px] font-bold text-danger hover:bg-brand-secondary disabled:opacity-50"
                  >
                    {remove.isPending ? 'Cancelling…' : 'Cancel event'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-lg px-2 py-1 text-[11px] font-semibold text-brand-text/55 hover:bg-brand-secondary"
                  >
                    Keep
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  aria-label="Cancel this event"
                  className="rounded-lg p-1.5 text-brand-text/55 hover:bg-brand-secondary hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {event.description?.trim() && (
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-brand-text/55">
            {event.description}
          </p>
        )}

        <div className="space-y-1.5 text-xs text-brand-text/55">
          {isPhysical && event.address?.trim() && (
            <p className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{event.address}</span>
            </p>
          )}
          {isOnline && event.online_link?.trim() && (
            <p className="flex items-start gap-1.5">
              <LinkIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <a
                href={event.online_link}
                target="_blank"
                rel="noreferrer noopener"
                className="truncate text-brand-text underline hover:text-primary-ink"
              >
                {event.online_link}
              </a>
            </p>
          )}
          {!isPhysical && !isOnline && (
            <p className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 shrink-0" />
              <span>{event.location_type || 'Location not set'}</span>
            </p>
          )}
        </div>

        {/* Counts, and only the two the server actually keeps. A not_going RSVP
            is recorded but adjusts no counter, so there is no third number to
            show and inventing one would misreport attendance. */}
        <div className="flex items-center gap-3 border-t border-brand-divider pt-3 text-xs">
          <span className="flex items-center gap-1.5 font-bold text-success">
            <Users className="h-3.5 w-3.5" />
            {event.going_count} going
          </span>
          <span className="font-semibold text-warning">{event.maybe_count} maybe</span>
          {event.max_attendees > 0 && (
            // Stated capacity, not a gate: nothing server-side compares this to
            // going_count before recording an RSVP.
            <span className="text-brand-text/55">cap {event.max_attendees}</span>
          )}
        </div>

        {isMember && event.rsvp_enabled && (
          <div className="flex flex-wrap items-center gap-2">
            {RSVP_CHOICES.map((choice) => {
              const active = sessionRSVP === choice.status
              return (
                <button
                  key={choice.status}
                  onClick={() => submitRSVP(choice.status)}
                  disabled={rsvp.isPending}
                  aria-pressed={active}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-50 ${
                    active
                      ? 'bg-primary-tint text-primary-ink'
                      : 'bg-brand-secondary text-brand-text/55 hover:text-brand-text'
                  }`}
                >
                  {choice.icon}
                  {choice.label}
                </button>
              )
            })}
            {rsvp.isError && (
              <span className="text-[11px] font-semibold text-danger">
                That did not save. Try again.
              </span>
            )}
          </div>
        )}

        {isMember && !event.rsvp_enabled && (
          <p className="text-[11px] font-semibold text-brand-text/55">
            RSVPs are closed for this event.
          </p>
        )}
      </div>
    </article>
  )
}

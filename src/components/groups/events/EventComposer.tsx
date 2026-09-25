'use client'

import React, { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { useCreateGroupEvent } from '@/hooks/useGroupEvents'
import { uploadMedia } from '@/lib/mediaUpload'
import type { GroupEventCreateInput, GroupEventLocationType } from '@/types/groups'

/** media-service's own ceiling for an image. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/** `group_events.title` is VARCHAR(200); a longer string is a Postgres error, not a 400. */
export const MAX_TITLE_LENGTH = 200

/**
 * What the form holds. Strings throughout, because that is what the inputs
 * give: `startAt` and `endAt` are `datetime-local` values, i.e. a WALL CLOCK
 * reading with no offset attached, which is exactly right — the author is
 * saying "3pm in the event's zone", not "3pm where I happen to be sitting".
 */
export interface EventDraft {
  title: string
  description: string
  /** 'YYYY-MM-DDTHH:mm' — wall clock in `timezone`. */
  startAt: string
  endAt: string
  timezone: string
  isAllDay: boolean
  locationType: GroupEventLocationType
  address: string
  onlineLink: string
  rsvpEnabled: boolean
  /** Blank or '0' means no stated limit. */
  maxAttendees: string
}

export type EventDraftField =
  | 'title'
  | 'startAt'
  | 'endAt'
  | 'address'
  | 'onlineLink'
  | 'maxAttendees'

export type EventDraftErrors = Partial<Record<EventDraftField, string>>

/**
 * How far off the timezone at `utcMs` is from UTC, in minutes.
 *
 * Intl is the only thing in the platform that knows an IANA zone's offset at a
 * given instant, and it will only tell us by formatting. So: format the instant
 * as that zone's wall clock, read it back as if it were UTC, and the difference
 * is the offset. `hourCycle: 'h23'` matters — with `hour12: false` some engines
 * print midnight as "24", which would push the date forward a day.
 */
function zoneOffsetMinutes(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  const asIfUTC = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return (asIfUTC - utcMs) / 60_000
}

/**
 * Turn a wall clock in a named zone into the instant the server should store.
 *
 * Two passes, not one. The first pass guesses the offset using the offset that
 * applies at the *naive* instant; near a DST boundary that guess can be an hour
 * wrong, so the second pass re-reads the offset at the guessed instant and
 * corrects. Anything Intl cannot use as a zone falls back to the browser's own
 * offset, since refusing to submit over a bad `timezone` string would be worse
 * than being an hour out.
 *
 * Returns null for a value that is not a wall clock at all — which is how the
 * validator distinguishes "no date given" from "a date I can work with".
 */
export function wallClockToInstant(value: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim())
  if (!m) return null
  const naive = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))
  if (Number.isNaN(naive)) return null

  try {
    let guess = naive - zoneOffsetMinutes(naive, timeZone) * 60_000
    guess = naive - zoneOffsetMinutes(guess, timeZone) * 60_000
    return new Date(guess)
  } catch {
    // Not a zone Intl recognises. Read the wall clock as local time.
    const local = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
    )
    return Number.isNaN(local.getTime()) ? null : local
  }
}

/**
 * Every rule that stands between this form and the database.
 *
 * `POST /v1/groups/:groupId/events` validates NOTHING. The handler does
 * `c.ShouldBindJSON(&event)` into `store.GroupEvent`, a struct carrying no
 * `binding:` tags at all, and the store only fills in defaults for timezone,
 * location_type and status. An empty body is a 201 for an event titled `""`
 * that starts on 0001-01-01 — a permanent row in the group's events tab that
 * nobody can edit, because there is no update route. So these checks are not a
 * convenience layer over server validation; they are the only validation that
 * exists anywhere in the path.
 */
export function validateEventDraft(draft: EventDraft, now: Date = new Date()): EventDraftErrors {
  const errors: EventDraftErrors = {}

  const title = draft.title.trim()
  if (!title) {
    errors.title = 'Give the event a title.'
  } else if (title.length > MAX_TITLE_LENGTH) {
    errors.title = `Keep the title to ${MAX_TITLE_LENGTH} characters or fewer.`
  }

  const start = wallClockToInstant(draft.startAt, draft.timezone)
  if (!start) {
    errors.startAt = 'Pick when the event starts.'
  } else if (start.getTime() <= now.getTime()) {
    errors.startAt = 'The start has to be in the future.'
  }

  // The end is optional. Given, it must not precede the start — an event that
  // finishes before it begins renders as a negative span and sorts nowhere.
  if (draft.endAt.trim()) {
    const end = wallClockToInstant(draft.endAt, draft.timezone)
    if (!end) {
      errors.endAt = 'That end time is not a date.'
    } else if (start && end.getTime() < start.getTime()) {
      errors.endAt = 'The end cannot be before the start.'
    }
  }

  // A place needs an address and a call needs a link; either one missing leaves
  // attendees with an event they cannot actually attend.
  if (draft.locationType === 'physical' && !draft.address.trim()) {
    errors.address = 'Add the address people should come to.'
  }
  if (draft.locationType === 'online' && !draft.onlineLink.trim()) {
    errors.onlineLink = 'Add the link people should join.'
  }

  if (draft.maxAttendees.trim()) {
    const cap = Number(draft.maxAttendees.trim())
    if (!Number.isInteger(cap) || cap < 0) {
      errors.maxAttendees = 'A limit has to be a whole number, or blank for none.'
    }
  }

  return errors
}

/** The payload for a draft that has already passed validateEventDraft. */
export function draftToPayload(draft: EventDraft, coverMediaId?: string): GroupEventCreateInput {
  const start = wallClockToInstant(draft.startAt, draft.timezone)
  const end = draft.endAt.trim() ? wallClockToInstant(draft.endAt, draft.timezone) : null
  const cap = Number(draft.maxAttendees.trim() || '0')

  return {
    title: draft.title.trim(),
    description: draft.description.trim() || undefined,
    cover_media_id: coverMediaId,
    // Non-null by construction: a draft without a usable start never gets here.
    start_at: (start ?? new Date()).toISOString(),
    end_at: end ? end.toISOString() : undefined,
    timezone: draft.timezone,
    is_all_day: draft.isAllDay,
    location_type: draft.locationType,
    address: draft.locationType === 'physical' ? draft.address.trim() : undefined,
    online_link: draft.locationType === 'online' ? draft.onlineLink.trim() : undefined,
    rsvp_enabled: draft.rsvpEnabled,
    max_attendees: Number.isInteger(cap) && cap > 0 ? cap : 0,
  }
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function emptyDraft(): EventDraft {
  return {
    title: '',
    description: '',
    startAt: '',
    endAt: '',
    timezone: browserTimezone(),
    isAllDay: false,
    locationType: 'physical',
    address: '',
    onlineLink: '',
    rsvpEnabled: true,
    maxAttendees: '',
  }
}

interface EventComposerProps {
  groupId: string
  onClose: () => void
}

const FIELD = 'w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2 text-sm text-brand-text outline-none focus:border-primary-ink'
const LABEL = 'mb-1 block text-xs font-bold text-brand-text'

export default function EventComposer({ groupId, onClose }: EventComposerProps) {
  const [draft, setDraft] = useState<EventDraft>(emptyDraft)
  const [errors, setErrors] = useState<EventDraftErrors>({})
  const [coverId, setCoverId] = useState<string | undefined>(undefined)
  const [uploading, setUploading] = useState(false)
  const [coverError, setCoverError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const create = useCreateGroupEvent()
  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const pickCover = async (file: File | undefined) => {
    if (!file) return
    setCoverError(null)
    if (file.size > MAX_IMAGE_BYTES) {
      setCoverError('That image is over 10 MB, which media-service will refuse.')
      return
    }
    setUploading(true)
    try {
      setCoverId(await uploadMedia(file, 'image', 'cover'))
    } catch {
      setCoverError('The cover did not upload. The event can still be created without one.')
    } finally {
      setUploading(false)
    }
  }

  const submit = () => {
    const found = validateEventDraft(draft)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    create.mutate({ groupId, ...draftToPayload(draft, coverId) }, { onSuccess: onClose })
  }

  const err = (field: EventDraftField) =>
    errors[field] ? (
      <p className="mt-1 text-[11px] font-semibold text-danger">{errors[field]}</p>
    ) : null

  return (
    <div className="space-y-4 rounded-2xl border border-brand-divider bg-brand-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-brand-text">New event</h3>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-1.5 text-brand-text/55 hover:bg-brand-secondary hover:text-brand-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label className={LABEL} htmlFor="event-title">Title</label>
        <input
          id="event-title"
          className={FIELD}
          value={draft.title}
          maxLength={MAX_TITLE_LENGTH}
          onChange={(e) => set('title', e.target.value)}
          placeholder="What is happening?"
        />
        {err('title')}
      </div>

      <div>
        <label className={LABEL} htmlFor="event-description">Description</label>
        <textarea
          id="event-description"
          className={`${FIELD} min-h-20 resize-y`}
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Optional details"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="event-start">Starts</label>
          <input
            id="event-start"
            type="datetime-local"
            className={FIELD}
            value={draft.startAt}
            onChange={(e) => set('startAt', e.target.value)}
          />
          {err('startAt')}
        </div>
        <div>
          <label className={LABEL} htmlFor="event-end">Ends (optional)</label>
          <input
            id="event-end"
            type="datetime-local"
            className={FIELD}
            value={draft.endAt}
            onChange={(e) => set('endAt', e.target.value)}
          />
          {err('endAt')}
        </div>
      </div>

      <div>
        <label className={LABEL} htmlFor="event-timezone">Timezone</label>
        <input
          id="event-timezone"
          className={FIELD}
          value={draft.timezone}
          onChange={(e) => set('timezone', e.target.value)}
          placeholder="Asia/Kolkata"
        />
        <p className="mt-1 text-[11px] text-brand-text/55">
          The times above are read in this zone, and everyone sees the event in it.
        </p>
      </div>

      <label className="flex items-center gap-2 text-xs font-semibold text-brand-text">
        <input
          type="checkbox"
          checked={draft.isAllDay}
          onChange={(e) => set('isAllDay', e.target.checked)}
        />
        All day
      </label>

      <div>
        <span className={LABEL}>Where</span>
        <div className="flex gap-2">
          {(['physical', 'online'] as const).map((kind) => (
            <button
              key={kind}
              onClick={() => set('locationType', kind)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                draft.locationType === kind
                  ? 'bg-primary-tint text-primary-ink'
                  : 'bg-brand-secondary text-brand-text/55 hover:text-brand-text'
              }`}
            >
              {kind === 'physical' ? 'In person' : 'Online'}
            </button>
          ))}
        </div>
      </div>

      {draft.locationType === 'physical' ? (
        <div>
          <label className={LABEL} htmlFor="event-address">Address</label>
          <input
            id="event-address"
            className={FIELD}
            value={draft.address}
            onChange={(e) => set('address', e.target.value)}
          />
          {err('address')}
        </div>
      ) : (
        <div>
          <label className={LABEL} htmlFor="event-link">Link</label>
          <input
            id="event-link"
            className={FIELD}
            value={draft.onlineLink}
            onChange={(e) => set('onlineLink', e.target.value)}
            placeholder="https://…"
          />
          {err('onlineLink')}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-brand-text">
          <input
            type="checkbox"
            checked={draft.rsvpEnabled}
            onChange={(e) => set('rsvpEnabled', e.target.checked)}
          />
          Let members RSVP
        </label>
        <div>
          <label className={LABEL} htmlFor="event-cap">Attendee limit (optional)</label>
          <input
            id="event-cap"
            className={FIELD}
            value={draft.maxAttendees}
            onChange={(e) => set('maxAttendees', e.target.value)}
            placeholder="No limit"
          />
          {/* Honest about what the number does: the server stores it and never
              checks it, so it reads as a stated size, not a closed door. */}
          <p className="mt-1 text-[11px] text-brand-text/55">
            Shown to members. RSVPs are not blocked when it is reached.
          </p>
          {err('maxAttendees')}
        </div>
      </div>

      <div>
        <span className={LABEL}>Cover image</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickCover(e.target.files?.[0])}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2 text-xs font-bold text-brand-text disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {coverId ? 'Replace cover' : 'Add a cover'}
          </button>
          {coverId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/v1/media/${coverId}/serve`}
              alt=""
              className="h-10 w-16 rounded-lg object-cover"
            />
          )}
        </div>
        {coverError && <p className="mt-1 text-[11px] font-semibold text-warning">{coverError}</p>}
      </div>

      {create.isError && (
        <p className="text-[11px] font-semibold text-danger">
          The event was not created. Only owners, admins and moderators can add one.
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-brand-divider pt-3">
        <button
          onClick={onClose}
          className="rounded-full px-4 py-2 text-xs font-bold text-brand-text/55 hover:text-brand-text"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={create.isPending || uploading}
          className="bg-primary-grad rounded-full px-5 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {create.isPending ? 'Creating…' : 'Create event'}
        </button>
      </div>
    </div>
  )
}

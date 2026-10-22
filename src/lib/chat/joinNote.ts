/*
  The "you joined" note at the top of a group chat (founder, 22 Oct 2026).

  A group newcomer sees only the messages sent after they joined, as on
  WhatsApp. Above the oldest message (or alone in an empty chat) one small
  centred line says how they got in, and a second says why nothing earlier
  is there:

    invite link   You joined using this group's invite link · 22 Oct
    added         Asha added you · 22 Oct        (Someone, when unknown)
    invitation    You joined · 22 Oct

  The date is the viewer's locale, day and short month; the year is added
  only when it is not this year.
*/

import type { MyJoin } from '@/services/messageService'

/** The second line under the join note. */
export const JOIN_NOTE_HISTORY_TEXT = "Messages sent before you joined aren't shown."

/** "22 Oct" in the viewer's locale (with the year when it is not this year); '' for a bad date. */
export function joinNoteDate(iso: string, locale?: string, now: Date = new Date()): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  if (at.getFullYear() !== now.getFullYear()) opts.year = 'numeric'
  try {
    return new Intl.DateTimeFormat(locale, opts).format(at)
  } catch {
    // An unknown locale tag: the runtime default rather than nothing.
    return new Intl.DateTimeFormat(undefined, opts).format(at)
  }
}

/** The note's first line for my join; adderName is the adder's display name (blank → "Someone"). */
export function joinNoteText(myJoin: MyJoin, adderName: string | null | undefined, locale?: string, now: Date = new Date()): string {
  let lead: string
  switch (myJoin.method) {
    case 'invite_link':
      lead = "You joined using this group's invite link"
      break
    case 'added':
      lead = `${adderName?.trim() || 'Someone'} added you`
      break
    default:
      lead = 'You joined'
  }
  const date = joinNoteDate(myJoin.joinedAt, locale, now)
  return date ? `${lead} · ${date}` : lead
}

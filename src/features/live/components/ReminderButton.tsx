"use client"

import Link from "next/link"
import { Bell, BellRing } from "lucide-react"

import { useGlobalToast } from "@/contexts/ToastContext"
import { useStreamReminder } from "@/hooks/useLiveV2"
import { reminderErrorCopy, type ReminderState } from "../discovery"
import "../surfaces.css"

export const REMINDER_LABELS = { off: "Notify me", on: "Reminder set" } as const

/** The button alone: Notify me ↔ Reminder set. */
export function ReminderButtonView({ on, busy = false, onToggle }: { on: boolean; busy?: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="live-remind" aria-pressed={on} disabled={busy} onClick={onToggle}>
      {on ? <BellRing aria-hidden="true" /> : <Bell aria-hidden="true" />}
      {on ? REMINDER_LABELS.on : REMINDER_LABELS.off}
    </button>
  )
}

/**
 * Notify me on a scheduled stream. The row changes the instant it is
 * pressed and goes back if the server refuses. Signed out, the button is a
 * link to sign in that returns here.
 */
export function ReminderButton({
  streamId,
  state,
  signedIn,
  returnTo,
}: {
  streamId: string
  state: ReminderState
  signedIn: boolean
  /** Where sign-in returns to. */
  returnTo: string
}) {
  const toast = useGlobalToast()
  const reminder = useStreamReminder()
  if (!signedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="live-remind">
        <Bell aria-hidden="true" />
        {REMINDER_LABELS.off}
      </Link>
    )
  }
  const toggle = () => {
    reminder.mutate(
      { streamId, on: !state.reminder_set, current: state },
      { onError: (err) => toast({ type: "error", title: reminderErrorCopy(err) }) },
    )
  }
  return <ReminderButtonView on={state.reminder_set} busy={reminder.isPending} onToggle={toggle} />
}

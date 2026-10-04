"use client"

/*
  The slot picker: a date strip across the city's horizon and a grid of the
  OPEN slots of the chosen day (GET /slots). Taken slots are never drawn; the
  list refreshes every 30 s, and a picked slot that became taken is dropped.
*/

import { CalendarX2 } from "lucide-react"
import { useEffect, useState } from "react"

import type { SlotQuery } from "../api/client"
import { useSlots } from "../hooks/queries"
import { dateStrip, dayParts, firstOpenDate, formatTime, openSlots, slotStillOpen, SLOTS_REFRESH_MS } from "../model/slots"
import { ErrorState, Skel, StateBlock } from "./parts"

export function SlotPicker({ query, enabled, value, onChange }: { query: SlotQuery; enabled: boolean; value: string | null; onChange: (start: string | null) => void }) {
  const slots = useSlots(query, enabled, SLOTS_REFRESH_MS)
  const [day, setDay] = useState<string | null>(null)
  const data = slots.data

  // Start on the first day with an open slot.
  useEffect(() => {
    if (!data) return
    if (!day || !data.days.some((d) => d.date === day)) setDay(firstOpenDate(data))
  }, [data, day])

  // A picked slot that someone else took disappears from the selection.
  useEffect(() => {
    if (data && value && !slotStillOpen(data, value)) onChange(null)
  }, [data, value, onChange])

  if (!enabled) return <p className="ds-note">Choose an address to see slots.</p>
  if (slots.isLoading) {
    return (
      <div className="ds-stack">
        <Skel h={52} />
        <Skel h={80} />
      </div>
    )
  }
  if (slots.isError) return <ErrorState error={slots.error} what="Slots" onRetry={() => void slots.refetch()} />
  if (!data) return null

  const strip = dateStrip(data)
  const zone = data.timezone
  const current = data.days.find((d) => d.date === day)
  const open = openSlots(current)

  if (!strip.some((d) => d.open > 0)) {
    return <StateBlock icon={<CalendarX2 size={22} />} title="No slots right now" text="Every professional near you is booked for the coming days. Check again later." />
  }

  return (
    <div className="ds-stack">
      <ul className="ds-days" aria-label="Day">
        {strip.map((d) => {
          const p = dayParts(d.date)
          return (
            <li key={d.date}>
              <button type="button" className="ds-day" aria-pressed={d.date === day} disabled={!d.open} onClick={() => setDay(d.date)} aria-label={`${p.weekday} ${p.day} ${p.month}${d.open ? "" : ", fully booked"}`}>
                <span>{p.weekday}</span>
                <strong>{p.day}</strong>
                <span>{p.month}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {open.length ? (
        <ul className="ds-slots" aria-label="Time">
          {open.map((s) => (
            <li key={s.start}>
              <button type="button" className="ds-slot" aria-pressed={value !== null && Date.parse(value) === Date.parse(s.start)} onClick={() => onChange(s.start)}>
                {formatTime(s.start, zone)}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ds-note">This day is fully booked. Pick another day.</p>
      )}
      <p className="ds-note">Times are in Hyderabad time. Availability is confirmed when you submit.</p>
    </div>
  )
}

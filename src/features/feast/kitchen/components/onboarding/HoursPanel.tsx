"use client"

import { Moon, Plus, X } from "lucide-react"
import { useEffect, useState } from "react"

import { fetchHours, putHours } from "../../api/client"
import { toFailure, type ApiFailure } from "../../model/errors"
import { DAY_NAMES, isOvernight, MAX_WINDOWS_PER_DAY, toEditDays, toWindowsBody, type EditDay } from "../../model/hours"
import { FailureNotice, Notice, Pill, useAction } from "../ui"

const EMPTY: EditDay[] = DAY_NAMES.map(() => ({ closed: true, windows: [] }))

/** Weekly hours in India time. A close earlier than the open runs past midnight. */
export function HoursPanel({ restaurantId, onSaved }: { restaurantId: string; onSaved: () => void }) {
  const [days, setDays] = useState<EditDay[]>(EMPTY)
  const [openNow, setOpenNow] = useState<boolean | null>(null)
  const [loadFailure, setLoadFailure] = useState<ApiFailure | null>(null)
  const [local, setLocal] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const action = useAction()

  useEffect(() => {
    let live = true
    fetchHours(restaurantId)
      .then((h) => {
        if (!live) return
        setDays(toEditDays(h.windows))
        setOpenNow(h.isOpenNow)
      })
      .catch((e) => {
        const f = toFailure(e)
        if (live && f.code !== "FOOD_ONBOARDING_STEP_NOT_SAVED") setLoadFailure(f)
      })
    return () => {
      live = false
    }
  }, [restaurantId])

  const update = (day: number, next: EditDay) => setDays((ds) => ds.map((d, i) => (i === day ? next : d)))

  const copyToAll = (day: number) => setDays((ds) => ds.map(() => ({ closed: ds[day].closed, windows: ds[day].windows.map((w) => ({ ...w })) })))

  const save = async () => {
    setSaved(false)
    const body = toWindowsBody(days)
    if (!body.ok) return setLocal(body.message)
    setLocal(null)
    const h = await action.run(() => putHours(restaurantId, body.windows))
    if (h) {
      setDays(toEditDays(h.windows))
      setOpenNow(h.isOpenNow)
      setSaved(true)
      onSaved()
    }
  }

  return (
    <div className="kit-form">
      <p className="kit-meta" style={{ margin: 0 }}>
        All times are India Standard Time (Asia/Kolkata), 24-hour.{" "}
        {openNow === null ? null : <Pill tone={openNow ? "positive" : "neutral"}>{openNow ? "Open now" : "Closed now"}</Pill>}
      </p>
      <FailureNotice failure={loadFailure} />
      <div>
        {days.map((d, day) => (
          <div className="kit-day" key={DAY_NAMES[day]}>
            <div className="kit-form" style={{ gap: 4 }}>
              <strong>{DAY_NAMES[day]}</strong>
              <label className="kit-check">
                <input
                  type="checkbox"
                  checked={!d.closed}
                  onChange={(e) => update(day, e.target.checked ? { closed: false, windows: d.windows.length ? d.windows : [{ opensAt: "11:00", closesAt: "23:00" }] } : { closed: true, windows: [] })}
                />
                Open
              </label>
            </div>
            <div className="kit-form" style={{ gap: 6 }}>
              {d.closed ? <span className="kit-meta">Closed</span> : null}
              {d.windows.map((w, i) => (
                <div className="kit-window" key={i}>
                  <input
                    className="kit-input"
                    type="time"
                    aria-label={`${DAY_NAMES[day]} opens`}
                    value={w.opensAt}
                    onChange={(e) => update(day, { ...d, windows: d.windows.map((x, j) => (j === i ? { ...x, opensAt: e.target.value } : x)) })}
                  />
                  <span className="kit-meta">to</span>
                  <input
                    className="kit-input"
                    type="time"
                    aria-label={`${DAY_NAMES[day]} closes`}
                    value={w.closesAt}
                    onChange={(e) => update(day, { ...d, windows: d.windows.map((x, j) => (j === i ? { ...x, closesAt: e.target.value } : x)) })}
                  />
                  {isOvernight(w) ? (
                    <Pill>
                      <Moon size={11} aria-hidden /> past midnight
                    </Pill>
                  ) : null}
                  <button
                    type="button"
                    className="kit-btn kit-btn--ghost kit-btn--sm"
                    aria-label="Remove this window"
                    onClick={() => {
                      const windows = d.windows.filter((_, j) => j !== i)
                      update(day, { closed: windows.length === 0, windows })
                    }}
                  >
                    <X size={14} aria-hidden />
                  </button>
                </div>
              ))}
              {!d.closed ? (
                <div className="kit-row">
                  <button
                    type="button"
                    className="kit-btn kit-btn--ghost kit-btn--sm"
                    disabled={d.windows.length >= MAX_WINDOWS_PER_DAY}
                    onClick={() => update(day, { ...d, windows: [...d.windows, { opensAt: "18:00", closesAt: "23:00" }] })}
                  >
                    <Plus size={14} aria-hidden /> Add a window
                  </button>
                  <button type="button" className="kit-btn kit-btn--ghost kit-btn--sm" onClick={() => copyToAll(day)}>
                    Copy to every day
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {local ? <Notice tone="danger">{local}</Notice> : null}
      <FailureNotice failure={action.failure} />
      {saved ? <Notice tone="success">Hours saved.</Notice> : null}
      <div className="kit-row kit-row--end">
        <button type="button" className="kit-btn kit-btn--primary" onClick={save} disabled={action.busy}>
          {action.busy ? "Saving…" : "Save hours"}
        </button>
      </div>
    </div>
  )
}

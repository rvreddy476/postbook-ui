"use client"
import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { partnerApi } from "./api"
import { validateHours, type HoursWindow } from "./model"
import { Field, ReadPanel, SaveForm, usePartnerRead } from "./ui"
import { applyHoursToDays, DAY_PRESETS, WEEK_DAYS } from "./hoursRules"

export function HoursEditor() {
  const query = usePartnerRead("hours-editor", partnerApi.hours)
  return <ReadPanel query={query}>{saved => <HoursForm saved={saved} />}</ReadPanel>
}
export function HoursForm({ saved }: { saved: HoursWindow[] }) {
  const [items, setItems] = useState(saved)
  const [days, setDays] = useState<number[]>([1,2,3,4,5])
  const [start, setStart] = useState("09:00"), [end, setEnd] = useState("18:00")
  const [error, setError] = useState(""), [notice, setNotice] = useState("")
  const [custom, setCustom] = useState(false)
  const [unapplied, setUnapplied] = useState(false)
  const change = () => { setUnapplied(true); setNotice(""); setError("") }
  const update = (index: number, patch: Partial<HoursWindow>) => setItems(items.map((w,i) => i === index ? {...w,...patch} : w))
  return <SaveForm save={() => {
    if (unapplied) throw Error("Apply the updated hours to your selected days before saving.")
    if (!items.length) throw Error("Apply hours to your working days first.")
    const invalid = validateHours(items); if (invalid) throw Error(invalid)
    return partnerApi.saveHours(items)
  }}>
    <p className="ds-sub">Set your usual hours once, then choose the days. All times are India time (IST).</p>
    <section className="ds-hours-builder" aria-label="Set hours for multiple days">
      <div className="ds-row ds-wrap">{Object.entries(DAY_PRESETS).map(([label, preset]) => <button type="button" className="ds-btn ds-btn--outline" key={label} onClick={() => { change(); setDays([...preset]) }}>{label}</button>)}</div>
      <div className="ds-hours-days" role="group" aria-label="Working days">{WEEK_DAYS.map((day,i) => <button type="button" key={day} aria-label={day} aria-pressed={days.includes(i)} onClick={() => { change(); setDays(days.includes(i) ? days.filter(d => d !== i) : [...days,i]) }}>{day.slice(0,3)}</button>)}</div>
      <div className="ds-hours-times"><Field label="Start time"><input className="ds-input" type="time" value={start} onChange={e => { change(); setStart(e.target.value) }} /></Field><Field label="End time"><input className="ds-input" type="time" value={end} onChange={e => { change(); setEnd(e.target.value) }} /></Field></div>
      <button type="button" className="ds-btn ds-btn--outline" onClick={() => { try { setItems(applyHoursToDays(items,days,start,end)); setUnapplied(false); setError(""); setNotice("Hours applied to your selected days. Submit the form to save.") } catch(e) { setError((e as Error).message) } }}>Apply to selected days</button>
      <p className="ds-note">Replaces hours on selected days only. Other days stay unchanged.</p>
      {error && <p className="ds-alert" role="alert">{error}</p>}{notice && <p className="ds-ok" role="status">{notice}</p>}
    </section>
    <section aria-label="Weekly schedule"><h3 className="ds-h2">Your week</h3><ul className="ds-hours-summary">{WEEK_DAYS.map((day,i) => <li key={day}><strong>{day}</strong><span>{items.filter(w => w.weekday === i).map(w => w.start+" – "+w.end).join(", ") || "Day off"}</span></li>)}</ul></section>
    <button type="button" className="ds-link" aria-expanded={custom} onClick={() => setCustom(!custom)}>Customize individual days or add split shifts</button>
    {custom && <div className="ds-stack">{items.map((w,i) => <div className="ds-partner-shift" key={i}><Field label="Day"><select className="ds-input" value={w.weekday} onChange={e => update(i,{weekday:Number(e.target.value)})}>{WEEK_DAYS.map((day,d) => <option value={d} key={day}>{day}</option>)}</select></Field><Field label="Start"><input className="ds-input" type="time" value={w.start} onChange={e => update(i,{start:e.target.value})} /></Field><Field label="End"><input className="ds-input" type="time" value={w.end} onChange={e => update(i,{end:e.target.value})} /></Field><button type="button" className="ds-btn ds-btn--ghost" aria-label={"Remove shift "+(i+1)} onClick={() => setItems(items.filter((_,n) => i !== n))}><Trash2 size={18}/></button></div>)}<button type="button" className="ds-btn ds-btn--outline" disabled={items.length >= 42} onClick={() => setItems([...items,{weekday:1,start:"09:00",end:"18:00"}])}><Plus size={18}/>Add shift</button></div>}
  </SaveForm>
}

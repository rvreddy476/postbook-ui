"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { listTickets, openTicket, toDoorstepError } from "../api/client"
import { refusalLine } from "../model/refusals"

export function SupportPanel({ bookingId }: { bookingId: string }) {
  const tickets = useQuery({ queryKey: ["doorstep", "tickets"], queryFn: listTickets })
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState("quality")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    if (busy || !subject.trim() || !body.trim()) return
    setBusy(true); setError(null)
    try {
      await openTicket({ booking_id: bookingId, category, subject: subject.trim(), body: body.trim() })
      setSubject(""); setBody(""); setOpen(false); await tickets.refetch()
    } catch (e) { setError(refusalLine(toDoorstepError(e))) }
    finally { setBusy(false) }
  }
  return <section className="ds-card" aria-labelledby="ds-support">
    <div className="ds-row"><h2 className="ds-h2 ds-grow" id="ds-support">Visit support</h2><button type="button" className="ds-btn ds-btn--outline ds-btn--sm" onClick={() => setOpen(!open)}>Ask for help</button></div>
    <p className="ds-note">For an emergency, call 112. Support requests are not an emergency response.</p>
    {tickets.isError ? <p className="ds-alert" role="alert">Support requests could not load. <button type="button" onClick={() => void tickets.refetch()}>Try again</button></p> : null}
    {tickets.data?.filter(t => t.bookingId === bookingId).map(t => <details key={t.id}><summary>{t.subject} · {t.status.replaceAll("_", " ")}</summary><p>{t.body}</p></details>)}
    {open ? <form className="ds-stack" onSubmit={e => { e.preventDefault(); void submit() }}>
      <label className="ds-field">Topic<select className="ds-input" value={category} onChange={e => setCategory(e.target.value)}>{["payment","quality","safety","damage","professional","other"].map(c => <option key={c} value={c}>{c}</option>)}</select></label>
      <label className="ds-field">Subject (required)<input className="ds-input" required maxLength={160} value={subject} onChange={e => setSubject(e.target.value)} /></label>
      <label className="ds-field">What happened? (required)<textarea className="ds-input" required maxLength={4000} value={body} onChange={e => setBody(e.target.value)} /></label>
      {error ? <p className="ds-alert" role="alert">{error}</p> : null}
      <button type="submit" className="ds-btn ds-btn--primary" disabled={busy || !subject.trim() || !body.trim()}>{busy ? "Sending…" : "Send request"}</button>
    </form> : null}
  </section>
}

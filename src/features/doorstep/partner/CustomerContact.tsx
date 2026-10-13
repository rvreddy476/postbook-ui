"use client"

import { Phone } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { partnerApi } from "./api"

// UI hint only; the server checks the current accepted assignment on every read.
export function canContactCustomer(status: string): boolean {
  return ["assigned", "en_route", "arrived", "in_progress", "awaiting_extras_payment"].includes(status)
}

export function CustomerContact({ bookingId }: { bookingId: string }) {
  const [phone, setPhone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => { request.current?.abort() }, [])
  useEffect(() => {
    if (!phone) return
    const hide = () => setPhone(null)
    const timer = window.setTimeout(hide, 30_000)
    window.addEventListener("blur", hide)
    return () => { window.clearTimeout(timer); window.removeEventListener("blur", hide) }
  }, [phone])
  async function reveal() {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true); setError("")
    try {
      const result = await partnerApi.customerContact(bookingId, controller.signal)
      if (!controller.signal.aborted) setPhone(result)
    } catch {
      if (!controller.signal.aborted) setError("Contact is unavailable. Refresh the job or contact support.")
    } finally {
      request.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  return <div className="dsp-customer-contact">
    {phone ? <><a className="ds-btn ds-btn--outline ds-btn--sm" href={`tel:${phone}`}><Phone size={14} aria-hidden />Call {phone}</a><button type="button" className="ds-link" onClick={() => setPhone(null)}>Hide number</button></> : <button type="button" className="ds-btn ds-btn--outline ds-btn--sm" disabled={busy} onClick={() => void reveal()}><Phone size={14} aria-hidden />{busy ? "Loading contact…" : "Call customer"}</button>}
    <small>For directions and service coordination only.</small>
    {error && <p role="alert">{error}</p>}
  </div>
}

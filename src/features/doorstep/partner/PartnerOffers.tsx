"use client"

import { useQueryClient } from "@tanstack/react-query"
import { CalendarClock, MapPin } from "lucide-react"
import { useState } from "react"
import { useAuthUser } from "@/store/auth"
import { formatPaise } from "../model/money"
import { useNow } from "../components/HoldCountdown"
import { partnerApi } from "./api"
import { partnerKey, ReadPanel, usePartnerRead } from "./ui"
import { partnerDate } from "./workspaceView"

export function PartnerOffers() {
 const offers = usePartnerRead("offers", partnerApi.offers, 10_000)
 const user = useAuthUser()
 const qc = useQueryClient()
 const now = useNow(1_000)
 const [busy, setBusy] = useState<string | null>(null)
 const [message, setMessage] = useState<string | null>(null)
 const [error, setError] = useState<string | null>(null)
 const respond = async (id: string, accept: boolean) => {
  if (busy) return
  setBusy(id); setError(null); setMessage(null)
  try {
   await partnerApi.respondOffer(id, accept)
   setMessage(accept ? "Request accepted. Check Your jobs for payment and appointment status." : "Request declined.")
  } catch (e) { setError(e instanceof Error ? e.message : "The request could not be updated. Please refresh.") }
  finally { setBusy(null); void qc.invalidateQueries({ queryKey: partnerKey(user?.id ?? "") }) }
 }
 return <section className="ds-card dsp-offers" aria-label="New service requests"><h2 className="ds-h2">New requests</h2>
  {message && <p className="ds-info" role="status">{message}</p>}{error && <p className="ds-alert" role="alert">{error}</p>}
  <ReadPanel query={offers}>{items => {
   const live = items.filter(o => o.status === "open" && Date.parse(o.expires_at) > now)
   return live.length ? <div className="ds-stack">{live.map(o => <article key={o.id} className="dsp-offer"><div><h3 className="ds-h2">{o.service_name}</h3><p><MapPin size={14} aria-hidden /> {o.locality}</p><p><CalendarClock size={14} aria-hidden /> {partnerDate(o.slot_start)} IST</p><p className="ds-meta">Estimated earning · {formatPaise(o.earning_estimate_paise)}</p></div><div><span className="ds-meta">Respond within {Math.max(1, Math.ceil((Date.parse(o.expires_at) - now) / 1000))}s</span><div className="ds-row"><button type="button" className="ds-btn ds-btn--primary" disabled={Boolean(busy)} onClick={() => void respond(o.id, true)}>{busy === o.id ? "Updating…" : "Accept request"}</button><button type="button" className="ds-btn ds-btn--outline" disabled={Boolean(busy)} onClick={() => void respond(o.id, false)}>Decline</button></div></div></article>)}</div> : <p className="ds-sub">No new requests right now. Available requests appear here automatically.</p>
  }}</ReadPanel></section>
}

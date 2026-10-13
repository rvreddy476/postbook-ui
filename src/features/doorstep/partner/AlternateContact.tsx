"use client"

import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { useAuthUser } from "@/store/auth"
import { partnerError, partnerKey } from "./ui"
import { decodeAlternateChallenge, decodeAlternateResult, type Partner } from "./model"
import { LENIENT, envelopeData } from "../model/decode"

export function AlternateContact({ partner }: { partner: Partner }) {
  const user = useAuthUser(), client = useQueryClient()
  const [sent, setSent] = useState(false), [code, setCode] = useState(""), [busy, setBusy] = useState(false)
  const [verified, setVerified] = useState(false), [error, setError] = useState(""), [cooldown, setCooldown] = useState(0)
  const [development, setDevelopment] = useState(false)
  const locked = useRef(false)
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(v => Math.max(0, v - 1)), 1000); return () => clearTimeout(timer) }, [cooldown])
  const application = partner.application
  if (!application?.alternate_phone_last4) return null
  async function act(verify: boolean) {
    if (locked.current) return
    if (verify && !/^\d{6}$/.test(code)) { setError("Enter the six-digit code."); return }
    locked.current = true; setBusy(true); setError("")
    try {
      const response = await api.post(`/v1/doorstep/pro/me/alternate-phone/${verify ? "verify" : "request"}`, verify ? { code } : {})
      const raw = envelopeData(response.data, LENIENT)
      if (verify) {
        if (!decodeAlternateResult(raw, LENIENT).verified) throw new Error("Verification was not confirmed. Please retry.")
        setVerified(true); setCode("")
        await client.invalidateQueries({ queryKey: partnerKey(user?.id ?? "signed-out") })
      } else { const data = decodeAlternateChallenge(raw, LENIENT); setSent(true); setCode(""); setDevelopment(data.delivery === "development_log"); setCooldown(data.resend_after) }
    } catch (cause) { setError(partnerError(cause)) }
    finally { locked.current = false; setBusy(false) }
  }
  return <section className="ds-card ds-application-wizard ds-stack"><h2 className="ds-h2">Alternate contact</h2><p className="ds-note">Mobile ending {application.alternate_phone_last4}</p>
    {verified || application.alternate_phone_verified_at ? <p className="ds-ok">Verified</p> : <>
      {sent && <form className="ds-stack" onSubmit={event => { event.preventDefault(); void act(true) }}>
        {development && <p className="ds-info">Development testing: the code is in the server logs. No SMS was sent.</p>}
        <label className="ds-field">Verification code<input className="ds-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} disabled={busy} /></label>
        <button className="ds-btn ds-btn--primary" disabled={busy}>{busy ? "Please wait…" : "Verify contact"}</button>
      </form>}
      <button type="button" className="ds-btn ds-btn--outline" disabled={busy || cooldown > 0} onClick={() => void act(false)}>{cooldown > 0 ? `Resend in ${cooldown}s` : sent ? "Resend code" : "Verify alternate contact"}</button>
    </>}{error && <p className="ds-alert" role="alert">{error}</p>}
  </section>
}

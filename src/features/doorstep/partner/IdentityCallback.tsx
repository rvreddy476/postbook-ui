"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { getSession } from "@/services/authService"
import { partnerApi } from "./api"
import { partnerError } from "./ui"
import { Busy } from "../components/parts"

export function IdentityCallback() {
  const started = useRef(false)
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading")
  const [error, setError] = useState("")
  useEffect(() => {
    if (started.current) return
    started.current = true
    const params = new URLSearchParams(window.location.search)
    const code = params.get("code"), state = params.get("state")
    // Strip OAuth credentials immediately, before another navigation or API
    // request. Never store them or include them in a login return URL.
    window.history.replaceState(null, "", window.location.pathname)
    if (!getSession() || !code || !state || params.has("error")) {
      setError("Verification could not be completed. Sign in to your partner account and start identity verification again.")
      setStatus("error"); return
    }
    void partnerApi.finishIdentity(code, state).then(() => setStatus("done")).catch(e => { setError(partnerError(e)); setStatus("error") })
  }, [])
  return <section className="ds-card"><h1 className="ds-title">Identity verification</h1>{status === "loading" ? <Busy label="Confirming verification…" /> : status === "done" ? <p className="ds-ok">Identity verification is saved. Return to your application to see the remaining checks.</p> : <p className="ds-alert" role="alert">{error}</p>}<Link className="ds-btn ds-btn--primary" href="/doorstep/partner">Return to partner application</Link></section>
}

"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react"
import { ArrowRight, ShieldCheck } from "lucide-react"
import { AuthAlert, AuthShell } from "./AuthShell"
import { AuthSessionStore } from "@/services/auth/AuthSessionStore"
import { mapAuthResponse } from "@/services/auth/responseMapper"
import { verify2FA, verifyStepUpEmail, verifyStepUp2FA } from "@/services/authService"
import { TERMS_VERSION } from "@/lib/legal"
import { partnerReturnPath } from "./partnerPortal"
import { openPartnerWorkspace, requestPartnerPhone as phoneRequest } from "./partnerSignIn"
import "./partnerPortal.css"

export function PartnerPhoneExperience({ mode }: { mode: "login" | "register" }) {
  return <Suspense fallback={<AuthShell mode={mode} partnerPortal><p role="status">Loading…</p></AuthShell>}><PhoneForm mode={mode} /></Suspense>
}
function getPartnerDeviceId() { const key="postbook_device_id"; let id=localStorage.getItem(key); if(!id){id=crypto.randomUUID();localStorage.setItem(key,id)} return id }
export function partnerMobileError(phone: string) { return /^[6-9]\d{9}$/.test(phone) ? null : "Enter a valid 10-digit mobile number." }
function PhoneForm({ mode }: { mode: "login" | "register" }) {
  const search = useSearchParams()
  const destination = mode === "register" ? "/partners" : partnerReturnPath(search.get("redirect"))
  const [firstName, setFirst] = useState("")
  const [lastName, setLast] = useState("")
  const [gender, setGender] = useState("")
  const [phone, setPhone] = useState("")
  const [terms, setTerms] = useState(false)
  const [challenge, setChallenge] = useState("")
  const [code, setCode] = useState("")
  const [cooldown, setCooldown] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [signedIn, setSignedIn] = useState(false)
  const completed = useRef(false)
  const [extra, setExtra] = useState<{ token: string; user: string; method: "2fa" | "totp" | "email" } | null>(null)
  const locked = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (challenge) input.current?.focus() }, [challenge, extra])
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(c => c - 1), 1000); return () => clearTimeout(timer) }, [cooldown])
  async function request() {
    const invalid = partnerMobileError(phone)
    if (invalid) throw new Error(invalid)
    const result = await phoneRequest("request", { mode, phone: `+91${phone}`, first_name: firstName.trim(), last_name: lastName.trim(), gender, accepted_terms: terms, terms_version: TERMS_VERSION })
    setChallenge(result.data.challenge_id); setCooldown(result.data.resend_after ?? 60); setCode("")
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (locked.current || completed.current) return
    locked.current = true; setBusy(true); setError("")
    try {
      if (!challenge) { await request(); return }
      if (extra) {
        const result = extra.method === "2fa" ? await verify2FA(extra.user, code, extra.token) : extra.method === "email" ? await verifyStepUpEmail(extra.token, code) : await verifyStepUp2FA(extra.token, code)
        if (!result.success) throw new Error(result.error ?? "The security code could not be verified.")
        complete(); return
      }
      const result = await phoneRequest("verify", { challenge_id: challenge, code, device_id: getPartnerDeviceId(), platform: "web" })
      const data = result.data
      if (data.requires_2fa || data.requires_step_up) {
        setExtra({ token: data.pending_token, user: data.user?.user_id ?? data.user?.id ?? "", method: data.requires_2fa ? "2fa" : data.step_up_methods?.includes("totp") ? "totp" : "email" }); setCode(""); return
      }
      const session = mapAuthResponse(result, `+91${phone}`)
      if (!session.accessToken) throw new Error("Sign-in did not finish. Please request a new code.")
      if (mode === "register" && session.user) session.user = {...session.user, firstName, lastName, name: `${firstName} ${lastName}`, gender: gender === "male" ? "Male" : gender === "female" ? "Female" : "Others"}
      new AuthSessionStore().save(session)
      complete()
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again.") }
    finally { if (!completed.current) { locked.current = false; setBusy(false) } }
  }
  function complete() {
    completed.current = true
    setSignedIn(true)
    openPartnerWorkspace(destination)
  }
  return <AuthShell mode={mode} partnerPortal redirectTo={destination}>
    {signedIn ? <div className="auth-form-heading"><h1 className="auth-title">You’re signed in.</h1><p className="auth-description" role="status">Opening your partner workspace…</p><a className="auth-primary" href={destination}>Continue to workspace<ArrowRight size={18} aria-hidden="true" /></a></div> : <>
    <div className="auth-form-heading"><span className="auth-step-label">CLEE PARTNERS</span><h1 className="auth-title">{extra ? "One more security check" : challenge ? "Verify your mobile" : mode === "register" ? "Let’s get you started." : "Welcome back, partner."}</h1><p className="auth-description">{extra ? "Enter your existing account’s security code to continue." : challenge ? `Enter the six-digit code for +91 ${phone}.` : mode === "register" ? "Create your account first. Then choose your services and send your application for review." : "Use your registered mobile number to access your applications and workspace."}</p></div>
    {error && <AuthAlert>{error}</AuthAlert>}
    <form className="auth-form" onSubmit={submit} aria-busy={busy}>
      <fieldset className="auth-form min-w-0" disabled={busy}>
        <legend className="sr-only">Partner {challenge ? "verification" : "account details"}</legend>
        {!challenge ? <>
          {mode === "register" && <><div className="auth-name-row"><label className="auth-field"><span className="auth-label">First name <span aria-hidden="true">*</span></span><input className="auth-input" value={firstName} onChange={e => setFirst(e.target.value)} autoComplete="given-name" required maxLength={50} /></label><label className="auth-field"><span className="auth-label">Last name <span aria-hidden="true">*</span></span><input className="auth-input" value={lastName} onChange={e => setLast(e.target.value)} autoComplete="family-name" required maxLength={50} /></label></div>
          <fieldset className="partner-gender"><legend className="auth-label">Gender *</legend>{[["male", "Male"], ["female", "Female"], ["others", "Other"]].map(([value, label]) => <label key={value}><input type="radio" name="gender" value={value} checked={gender === value} onChange={() => setGender(value)} required />{label}</label>)}</fieldset></>}
          <label className="auth-field"><span className="auth-label">Mobile number *</span><span className="partner-phone-input"><span>+91</span><input className="auth-input" type="tel" autoComplete="tel-national" inputMode="numeric" placeholder="10-digit mobile number" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} required pattern="[6-9][0-9]{9}" maxLength={10} /></span></label>
          {mode === "register" && <label className="partner-consent"><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} required /><span>I accept the <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.</span></label>}
        </> : <label className="auth-field"><span className="auth-label">{extra ? "Security code" : "Verification code"}</span><input ref={input} className="auth-input partner-otp" autoComplete="one-time-code" inputMode="numeric" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required pattern="[0-9]{6}" maxLength={6} /></label>}
        <button className="auth-primary" disabled={busy}>{busy ? "Please wait…" : challenge ? "Verify & continue" : "Get verification code"}<ArrowRight size={18} aria-hidden="true" /></button>
      </fieldset>
      {challenge && !extra && <div className="partner-phone-actions"><button type="button" className="auth-link" disabled={busy || cooldown > 0} onClick={async () => { if (locked.current) return; locked.current = true; setBusy(true); setError(""); try { await request() } catch (e) { setError(e instanceof Error ? e.message : "Please try again.") } finally { locked.current = false; setBusy(false) } }}>{cooldown ? `Resend in ${cooldown}s` : "Resend code"}</button><button type="button" className="auth-link" disabled={busy} onClick={() => { setChallenge(""); setCode(""); setError("") }}>Change mobile number</button></div>}
      <p className="partner-development-note"><ShieldCheck size={18} aria-hidden="true" /><span>Development verification: the code is available in local server logs. No SMS is sent in this environment.</span></p>
    </form>
    </>}
  </AuthShell>
}

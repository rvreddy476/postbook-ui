"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createContext, useContext, useRef, useState, type FormEvent, type ReactNode } from "react"
import { useAuthUser } from "@/store/auth"
import { DoorstepApiError } from "../api/client"
import { Busy } from "../components/parts"
import Link from "next/link"
import { partnerKey } from "./profileQuery"

export const PartnerReviewRequired = createContext(false)
export const PartnerStepSaved = createContext<(() => void) | undefined>(undefined)
export { partnerKey } from "./profileQuery"
export function PartnerErrorState({error,onRetry}:{error:unknown;onRetry:()=>void;what?:string}) {return <div className="ds-partner-error ds-stack" role="alert"><h2 className="ds-h2">We couldn’t load your partner details</h2><p className="ds-sub">{error instanceof DoorstepApiError && error.status===404 ? "Partner applications are temporarily unavailable. This is not a service-availability result for your town." : partnerError(error)}</p><div className="ds-row"><button className="ds-btn ds-btn--outline" onClick={onRetry}>Try again</button>{error instanceof DoorstepApiError && error.status === 401 && <Link className="ds-link" href="/partners/login">Partner sign-in</Link>}</div></div>}
export function usePartnerRead<T>(name: string, fn: () => Promise<T>, interval: number | false = false) {
  const user = useAuthUser()
  return useQuery({ queryKey: [...partnerKey(user?.id ?? "signed-out"), name], queryFn: fn, enabled: Boolean(user), retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false, refetchInterval: interval })
}
export function usePartnerRefresh() {
  const qc = useQueryClient()
  const user = useAuthUser()
  return async () => { if (user) await qc.invalidateQueries({ queryKey: partnerKey(user.id) }) }
}
export function partnerError(error: unknown): string {
  if (error instanceof DoorstepApiError) {
    if (error.code === "DOORSTEP_DIGILOCKER_UNAVAILABLE") return "DigiLocker is not available yet. Your application is saved; you can complete other steps and return to identity verification later."
    if (error.code === "DOORSTEP_PII_UNAVAILABLE") return "Secure document storage is not configured yet. These details have not been saved. Please try again later."
    if (error.status === 401) return "Your session has expired. Sign in again to continue."
    if (error.status >= 500) return "We couldn’t load or save these details right now. Please try again. Your existing information is unchanged."
    return error.message
  }
  return error instanceof Error ? error.message : "We couldn’t save this. Please try again."
}
export function LoadingPanel() { return <div className="ds-card"><Busy label="Loading your saved details…" /></div> }
export function ReadPanel<T>({ query, children }: { query: { isPending: boolean; isError: boolean; error: unknown; data?: T; refetch: () => unknown }; children: (data: T) => ReactNode }) {
  if (query.isPending) return <LoadingPanel />
  if (query.isError) return <PartnerErrorState error={query.error} onRetry={() => void query.refetch()} />
  if (query.data === undefined) return null
  return <>{children(query.data)}</>
}
export function SaveForm({ children, save, label = "Save & continue", disabled = false, onSaved }: { children: ReactNode; save: () => Promise<unknown>; label?: string; disabled?: boolean; onSaved?: () => void }) {
  const refresh = usePartnerRefresh()
  const nextStep = useContext(PartnerStepSaved)
  const reviewRequired = useContext(PartnerReviewRequired)
  const withdrawing = label.toLowerCase().includes("withdraw")
  const submitLabel = reviewRequired && !withdrawing && !label.toLowerCase().includes("submit") ? "Submit for review" : label
  const locked = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (locked.current || disabled) return
    locked.current = true
    setBusy(true); setError(""); setDone(false)
    try { await save(); setDone(true); onSaved?.(); await refresh(); if (label === "Save & continue") nextStep?.() }
    catch (e) { setError(partnerError(e)) }
    finally { locked.current = false; setBusy(false) }
  }
  return <form onSubmit={submit} className="ds-stack">
    <fieldset className="ds-partner-fields" disabled={busy || disabled}>{children}</fieldset>
    {error && <p className="ds-alert" role="alert">{error}</p>}
    {done && <p className="ds-ok" role="status">{withdrawing ? "Pending request withdrawn. Approved details are unchanged." : reviewRequired ? "Submitted for admin review. Your approved details are unchanged." : "Changes saved."}</p>}
    <div className="ds-partner-form-footer"><p className="ds-note">{withdrawing ? "Your approved price stays unchanged." : reviewRequired ? "Changes take effect after admin approval." : "Changes are saved to your partner account."}</p><button className="ds-btn ds-btn--primary" disabled={busy || disabled}>{busy ? <Busy label="Saving…" /> : submitLabel}</button></div>
  </form>
}
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="ds-field"><span>{label}</span>{children}{hint && <span className="ds-note">{hint}</span>}</label>
}
export const statusWords = (status: string) => ({ draft: "Application in progress", pending_verification: "Awaiting review", approved: "Approved", rejected: "Application rejected", suspended: "Account paused", blocked: "Account blocked", pending: "Awaiting review", verified: "Verified", withdrawn: "Withdrawn" }[status] ?? status.replaceAll("_", " "))

"use client"

import { Check, MapPin, ShieldCheck } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useAuthUser } from "@/store/auth"
import { PartnerErrorState as ErrorState } from "./ui"
import { PartnerApplication, SubmittedApplication } from "./PartnerApplication"
import { AlternateContact } from "./AlternateContact"
import { PartnerNotifications } from "./PartnerNotifications"
import { PartnerChanges } from "./PartnerChanges"
import { PartnerSetupNotice, type SetupState } from "./PartnerSetupNotice"
import { PartnerReviewRequired } from "./ui"
import { partnerApi } from "./api"
import { partnerProfileOptions } from "./profileQuery"
import { PartnerEditor } from "./PartnerEditor"
import { PartnerDashboard, PartnerEarnings, PartnerJobs, PartnerPrices } from "./PartnerWorkspace"
import { PARTNER_VIEWS, partnerView, type PartnerView } from "./workspaceView"
import { canEditPartner, PARTNER_STEPS, stepState, type Partner, type Readiness, type StepCode } from "./model"
import { LoadingPanel, PartnerStepSaved, ReadPanel, statusWords, usePartnerRead } from "./ui"

export function PartnerScreen() {
  const user = useAuthUser()
  const search = useSearchParams()
  const me = useQuery(partnerProfileOptions(user?.id, partnerApi.me))
  if (user && search.get("tab") === "notifications") return <div className="ds-partner"><PartnerNotifications key={user.id} /></div>
  if (!user || me.isPending) return <LoadingPanel />
  if (me.data === null || (me.data?.status === "draft" && !me.data.application)) return <div className="ds-partner"><PartnerApplication key={user.id} /></div>
  if (me.data?.application && me.data.status === "pending_verification") return <div className="ds-partner"><SubmittedApplication partner={me.data} /></div>
  if (me.data) return <div className="ds-partner"><PartnerAccount key={user.id} partner={me.data} /></div>
  return <div className="ds-card"><ErrorState error={me.error} onRetry={() => void me.refetch()} /></div>
}
function PartnerAccount({ partner }: { partner: Partner }) {
  const search = useSearchParams()
  const router = useRouter()
  const tab = partnerView(search.get("tab"))
  const step = PARTNER_STEPS.find(s => s.code === search.get("step"))?.code ?? "profile"
  const setStep = (code: StepCode) => router.replace(`/doorstep/partner?tab=setup&step=${code}`, { scroll: false })
  const readiness = usePartnerRead("readiness", partnerApi.readiness, 30_000)
  const docs = usePartnerRead("documents", partnerApi.documents, 30_000)
  const skills = usePartnerRead("my-skills", partnerApi.mySkills, 30_000)
  const area = usePartnerRead("saved-area", partnerApi.area)
  const bank = usePartnerRead("bank-editor", partnerApi.bank, 30_000)
  const changes = usePartnerRead("changes", partnerApi.changes, 30_000)
  const changeKinds: Partial<Record<StepCode,string>> = {profile:"profile",skills:"skills",service_area:"area",weekly_hours:"hours",pan:"pan"}
  const stateFor = (code: StepCode, r: Readiness) => changes.data?.some(c => c.status === "pending" && c.kind === changeKinds[code]) ? "review" : stepState(code, r, docs.data ?? [], skills.data ?? [], area.data, bank.data)
  const editable = canEditPartner(partner.status)
  return <PartnerReviewRequired.Provider value={partner.status === "approved" || partner.status === "suspended"}>
    <PartnerAccountHeader partner={partner} view={tab} />
    {partner.status !== "approved" && <div className="ds-partner-status"><ShieldCheck size={20} aria-hidden="true" /><div className="ds-grow"><strong>{partner.status === "approved" ? "Verified" : statusWords(partner.status)}</strong><p className="ds-sub">{partner.status === "approved" ? "Your identity is verified. Complete work settings and add approved prices to receive bookings." : editable ? "Complete your setup. Doorstep reviews your documents and skills before approval." : "Your account cannot be edited right now. Contact Doorstep support for review."}</p></div></div>}
    {tab === "setup" && <ReadPanel query={readiness}>{r => <div className="ds-partner-setup"><PartnerSetupChecklist states={Object.fromEntries(PARTNER_STEPS.map(s => [s.code, stateFor(s.code, r)])) as Record<StepCode, SetupState>} step={step} onStep={setStep} /><section className="ds-card ds-partner-editor" aria-label="Application step"><header><p className="ds-partner-eyebrow">STEP {PARTNER_STEPS.findIndex(s => s.code === step) + 1} OF {PARTNER_STEPS.length}</p><h2 className="ds-title">{PARTNER_STEPS.find(s => s.code === step)?.label}</h2></header>{docs.isPending || skills.isPending ? <LoadingPanel /> : docs.isError || skills.isError ? <ErrorState error={docs.error ?? skills.error} what="Review status" onRetry={() => { void docs.refetch(); void skills.refetch() }} /> : !editable ? <p className="ds-info">Your application is {statusWords(partner.status).toLowerCase()}. Setup changes are unavailable.</p> : <PartnerStepSaved.Provider value={() => { const next = PARTNER_STEPS[PARTNER_STEPS.findIndex(s => s.code === step) + 1]; if (next) setStep(next.code) }}><PartnerEditor key={step} step={step} partner={partner} readiness={r} documents={docs.data ?? []} /></PartnerStepSaved.Provider>}</section></div>}</ReadPanel>}
    {tab === "prices" && <PartnerPrices editable={editable} />}
    {tab === "setup" && editable && <AlternateContact partner={partner} />}
    {tab === "jobs" && <PartnerJobs />}
    {tab === "earnings" && <PartnerEarnings />}
    {tab === "dashboard" && <ReadPanel query={readiness}>{r => <>{[bank, area, docs, skills, changes].some(q => q.isPending) ? <LoadingPanel /> : [bank, area, docs, skills, changes].some(q => q.isError) ? <ErrorState error={[bank, area, docs, skills, changes].find(q => q.isError)?.error} onRetry={() => { void bank.refetch(); void area.refetch(); void docs.refetch(); void skills.refetch(); void changes.refetch() }} /> : <PartnerSetupNotice readiness={r} states={Object.fromEntries(PARTNER_STEPS.map(s => [s.code, stateFor(s.code,r)])) as Record<StepCode, SetupState>} onReview={() => router.push("/doorstep/partner?tab=setup")} />}<PartnerDashboard partner={partner} readiness={r} /></>}</ReadPanel>}
    {(tab === "dashboard" || tab === "setup") && <PartnerChanges />}
  </PartnerReviewRequired.Provider>
}

export function PartnerAccountHeader({ partner, view }: { partner: Partner; view: PartnerView }) {
  return <header className="dsp-page-heading"><div><p className="dsp-eyebrow">HOME SERVICES · PARTNER</p><h1>{view === "dashboard" ? `Welcome, ${partner.display_name}` : PARTNER_VIEWS[view].title}</h1><p>{PARTNER_VIEWS[view].description}</p></div><div className="dsp-page-badges">{partner.status === "approved" && <span className="ds-partner-verified"><ShieldCheck size={15} aria-hidden />Verified partner</span>}<span className="dsp-locality"><MapPin size={14} aria-hidden />{partner.application ? `${partner.application.town}, ${partner.application.state_name}` : partner.city_code || "Location not set"}</span></div></header>
}

export function PartnerSetupChecklist({ states, step, onStep }: { states: Record<StepCode, SetupState>; step: StepCode; onStep: (step: StepCode) => void }) {
  const complete = PARTNER_STEPS.filter(s => states[s.code] === "complete").length
  return <aside className="ds-card ds-partner-checklist"><h2 className="ds-h2">Your setup</h2><p className="ds-meta">{complete} of {PARTNER_STEPS.length} checks complete</p><progress className="ds-partner-progress" aria-label="Setup progress" max={PARTNER_STEPS.length} value={complete} /><label className="dsp-step-select"><span>Setup section</span><select className="ds-input" value={step} onChange={event => onStep(event.target.value as StepCode)}>{PARTNER_STEPS.map(s => <option key={s.code} value={s.code}>{s.label} · {states[s.code] === "complete" ? "Complete" : states[s.code] === "review" ? "In review" : states[s.code] === "saved" ? "Saved" : "To do"}</option>)}</select></label><ol>{PARTNER_STEPS.map((s, i) => {
    const state = states[s.code]
    return <li key={s.code}><button type="button" data-state={state} aria-current={step === s.code ? "step" : undefined} onClick={() => onStep(s.code)}><span className={`ds-partner-step-number is-${state}`}>{state === "complete" || state === "saved" ? <Check size={18} aria-hidden /> : i + 1}</span><span className="ds-grow"><strong>{s.label}</strong><small>{state === "complete" ? "Complete" : state === "saved" ? "Saved · coverage pending" : state === "review" ? "Awaiting review" : s.hint}</small></span></button></li>
  })}</ol></aside>
}

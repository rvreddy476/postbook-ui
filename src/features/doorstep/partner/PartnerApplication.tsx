"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Check, CheckCircle2, LockKeyhole } from "lucide-react"
import { useAuthUser } from "@/store/auth"
import { useQueryClient } from "@tanstack/react-query"
import { ServiceTypePicker } from "./ServiceTypePicker"
import { TownPicker } from "./TownPicker"
import { BankDetails, ApplicationField, bankBody, bankErrors, emptyBank } from "./BankDetails"
import { AlternateContact } from "./AlternateContact"
import { ApplicationCorrections } from "./ApplicationCorrections"
import { partnerApi, uploadPartnerImage } from "./api"
import { partnerError, partnerKey, ReadPanel, usePartnerRead } from "./ui"
import { validateImage, type Partner } from "./model"
import { IntroductionFields, selfieError, uploadIntroduction, validateIntroduction, waitForPartnerMedia } from "@/features/partners/IntroductionFields"

export const APPLICATION_STEPS = ["Services", "Personal", "Documents", "Bank details", "Review"]
const STEPS = APPLICATION_STEPS
export function PartnerApplication() {
  const user = useAuthUser()
  const client = useQueryClient()
  const states = usePartnerRead("application-states", partnerApi.states)
  const services = usePartnerRead("skills", partnerApi.skills)
  const [step, setStep] = useState(0)
  const [first, setFirst] = useState(user?.firstName ?? "")
  const [last, setLast] = useState(user?.lastName ?? "")
  const [gender, setGender] = useState(user?.gender?.toLowerCase() ?? "")
  const [state, setState] = useState("")
  const [town, setTown] = useState("")
  const [alternate, setAlternate] = useState("")
  const [skills, setSkills] = useState<string[]>([])
  const [kind, setKind] = useState("passport")
  const [pan, setPan] = useState("")
  const [identity, setIdentity] = useState<File | null>(null)
  const [experience, setExperience] = useState<File | null>(null)
  const [selfie, setSelfie] = useState<File | null>(null)
  const [introduction, setIntroduction] = useState<File | null>(null)
  const [bank, setBank] = useState({ ...emptyBank })
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState("")
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  const previousStep = useRef(0)
  useEffect(() => {
    if (previousStep.current === step) return
    previousStep.current = step
    form.current?.scrollIntoView({ block: "start", behavior: "instant" })
  }, [step])
  const uploads = useRef(new Map<File, string>())
  const [submitted, setSubmitted] = useState<Partner | null>(null)
  const stateName = states.data?.find(s => s.code === state)?.name ?? ""
  async function upload(file: File, video = false) {
    const saved = uploads.current.get(file)
    if (saved) { await waitForPartnerMedia(saved); return saved }
    const id = await (video ? uploadIntroduction(file) : uploadPartnerImage(file))
    uploads.current.set(file, id)
    await waitForPartnerMedia(id)
    return id
  }
  function validate(index: number): Record<string, string> {
    const e: Record<string, string> = {}
    if (index === 1) {
      if (!first.trim()) e.first = "Enter your first name."
      if (!last.trim()) e.last = "Enter your last name."
      if (!["male", "female", "others"].includes(gender)) e.gender = "Select your gender."
      if (alternate && !/^[6-9]\d{9}$/.test(alternate)) e.alternate = "Enter a valid 10-digit mobile number."
    }
    if (index === 0) {
      if (!skills.length || skills.length > 20) e.skills = "Choose between 1 and 20 services."
      if (!stateName) e.state = "Select your state."
      if (town.trim().length < 2) e.town = "Select or enter your town."
    }
    if (index === 2) {
      const invalidSelfie = selfieError(selfie); if(invalidSelfie)e.selfie=invalidSelfie
      if (!/^[A-Z]{3}P[A-Z][0-9]{4}[A-Z]$/.test(pan)) e.pan = "Enter a valid individual PAN."
      if (!identity) e.identity = "Upload your identity proof."
      else { const invalid = validateImage(identity); if (invalid) e.identity = invalid }
      if (experience) { const invalid = validateImage(experience); if (invalid) e.experience = invalid }
    }
    if (index === 3) return bankErrors(bank)
    if (index === 4 && !consent) e.consent = "Confirm your details and consent to verification."
    return e
  }
  function showErrors(index: number, e: Record<string, string>) {
    setStep(index); setErrors(e)
    requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (locked.current) return
    if(step === 2 && introduction) {
      try { await validateIntroduction(introduction) } catch(error) { showErrors(2,{introduction:error instanceof Error?error.message:"Choose a valid video."});return }
    }
    const e = validate(step)
    if (Object.keys(e).length) { showErrors(step, e); return }
    setErrors({}); setFailure("")
    if (step < 4) { setStep(step + 1); return }
    for (let i = 0; i < 4; i++) { const invalid = validate(i); if (Object.keys(invalid).length) { showErrors(i, invalid); return } }
    locked.current = true; setBusy(true)
    try {
      const identityId = await upload(identity!)
      const selfieId = await upload(selfie!)
      const introductionId = introduction ? await upload(introduction,true) : ""
      const experienceId = experience ? await upload(experience) : ""
      const bankId = await upload(bank.proof!)
      const result = await partnerApi.submitApplication({
        review_consent: consent, first_name: first.trim(), last_name: last.trim(), gender, state_code: state,
        town: town.trim(), alternate_phone: alternate, skill_codes: skills, identity_kind: kind,
        identity_media_id: identityId, selfie_media_id: selfieId, introduction_media_id: introductionId, experience_media_id: experienceId, pan, bank: bankBody(bank, bankId),
      })
      uploads.current.clear(); setPan(""); setBank({ ...emptyBank }); setIdentity(null); setExperience(null)
      setSubmitted(result)
      setSelfie(null);setIntroduction(null)
      await client.invalidateQueries({ queryKey: partnerKey(user?.id ?? "signed-out") })
    } catch (error) { setFailure(partnerError(error)) }
    finally { locked.current = false; setBusy(false) }
  }
  if (submitted) return <SubmittedApplication partner={submitted} />
  return <section className="ds-card ds-application-wizard">
    <header><p className="ds-partner-eyebrow">JOIN DOORSTEP</p><h1 className="ds-title">Put your skills to work.</h1><p className="ds-note">One application. Your services, documents and payout details.</p></header>
    <ol className="ds-intake-steps" aria-label="Application progress">{STEPS.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined}><button type="button" disabled={busy || index > step} onClick={() => { setStep(index); setErrors({}); setFailure("") }}><span>{index < step ? <Check size={14} /> : index + 1}</span>{label}</button></li>)}</ol>
    <form ref={form} noValidate onSubmit={submit} className="ds-stack">
      <fieldset className="ds-partner-fields" disabled={busy}>
        {step === 1 && <div className="ds-stack"><h2 className="ds-h2">Personal details</h2>
          <div className="ds-application-row">
            <ApplicationField label="First name *" error={errors.first}>{props => <input {...props} className="ds-input" autoComplete="given-name" maxLength={50} value={first} onChange={e => setFirst(e.target.value)} />}</ApplicationField>
            <ApplicationField label="Last name *" error={errors.last}>{props => <input {...props} className="ds-input" autoComplete="family-name" maxLength={50} value={last} onChange={e => setLast(e.target.value)} />}</ApplicationField>
          </div>
          <fieldset className="ds-application-gender"><legend>Gender *</legend>{[["male", "Male"], ["female", "Female"], ["others", "Other"]].map(([value, label]) => <label key={value}><input type="radio" name="application-gender" aria-invalid={Boolean(errors.gender)} checked={gender === value} onChange={() => setGender(value)} />{label}</label>)}</fieldset>
          {errors.gender && <p className="ds-field-error">{errors.gender}</p>}
          <p className="ds-note">Use your mobile-verified partner account. <Link href="/partners/login?redirect=%2Fdoorstep%2Fpartner">Change account</Link></p>
          <ApplicationField label="Alternate contact number (optional)" error={errors.alternate} hint="Verify this number later.">{props => <input {...props} className="ds-input" type="tel" inputMode="numeric" maxLength={10} value={alternate} onChange={e => setAlternate(e.target.value.replace(/\D/g, ""))} />}</ApplicationField>
        </div>}
        {step === 0 && <div className="ds-stack"><h2 className="ds-h2">What work would you like to do?</h2>
          <ReadPanel query={services}>{items => <ServiceTypePicker items={items} selected={skills} onChange={setSkills} onRetry={() => { void services.refetch() }} />}</ReadPanel>
          {errors.skills && <p className="ds-field-error">{errors.skills}</p>}
          <div className="ds-application-row">
            <ReadPanel query={states}>{items => <ApplicationField label="State / union territory *" error={errors.state}>{props => <select {...props} className="ds-input" value={state} onChange={e => { setState(e.target.value); setTown("") }}><option value="">Select your state</option>{[...items].sort((a, b) => a.name.localeCompare(b.name)).map(s => <option key={s.code} value={s.code}>{s.name}</option>)}</select>}</ApplicationField>}</ReadPanel>
            <TownPicker key={state} state={stateName} value={town} onChange={setTown} />
          </div>
          {errors.town && <p className="ds-field-error">{errors.town}</p>}
        </div>}
        {step === 2 && <div className="ds-stack"><h2 className="ds-h2">Identity & documents</h2>
          <IntroductionFields selfie={selfie} video={introduction} onSelfie={setSelfie} onVideo={setIntroduction} errors={errors} disabled={busy}/>
          <ApplicationField label="PAN number *" error={errors.pan} hint="Number only. No PAN card upload.">{props => <input {...props} className="ds-input" autoComplete="off" maxLength={10} value={pan} onChange={e => setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />}</ApplicationField>
          <ApplicationField label="Identity document *">{props => <select {...props} className="ds-input" value={kind} onChange={e => { setKind(e.target.value); setIdentity(null) }}><option value="passport">Passport</option><option value="voter_id">Voter ID</option><option value="driving_license">Driving Licence</option></select>}</ApplicationField>
          <ApplicationField label="Upload identity proof *" error={errors.identity} hint={identity?.name || "JPG, PNG or WebP · up to 10 MB. No Aadhaar or PAN images."}>{props => <input {...props} key={kind} className="ds-partner-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setIdentity(e.target.files?.[0] ?? null)} />}</ApplicationField>
          <ApplicationField label="Experience or course certificate (optional)" error={errors.experience} hint={experience?.name || "JPG, PNG or WebP · up to 10 MB."}>{props => <input {...props} className="ds-partner-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setExperience(e.target.files?.[0] ?? null)} />}</ApplicationField>
          <p className="ds-note">Optional. Certificates help our team understand your experience and recommend suitable assignments.</p>
        </div>}
        {step === 3 && <div className="ds-stack"><h2 className="ds-h2">Bank & payout details</h2><BankDetails value={bank} onChange={setBank} errors={errors} /><p className="ds-note"><LockKeyhole size={14} aria-hidden="true" /> Encrypted details. Private documents. Admin-reviewed.</p></div>}
        {step === 4 && <div className="ds-stack"><h2 className="ds-h2">Review your application</h2>
          <dl className="ds-intake-review"><dt>Name</dt><dd>{first} {last}</dd><dt>Working location</dt><dd>{town}, {stateName}</dd><dt>Services</dt><dd>{services.data?.filter(s => skills.includes(s.code)).map(s => s.name).join(", ")}</dd><dt>Identity</dt><dd>{kind.replaceAll("_", " ")} · Selected</dd><dt>PAN</dt><dd>••••••{pan.slice(-4)}</dd><dt>Bank account</dt><dd>{bank.bankName} · ••••{bank.number.slice(-4)}</dd><dt>Bank proof</dt><dd>{bank.proofKind.replaceAll("_", " ")} · Selected</dd></dl>
          <label className="ds-application-consent"><input type="checkbox" checked={consent} aria-invalid={Boolean(errors.consent)} onChange={e => setConsent(e.target.checked)} /><span>These details and documents belong to me. I consent to verification.</span></label>
          {errors.consent && <p className="ds-field-error">{errors.consent}</p>}
        </div>}
      </fieldset>
      {(failure || Object.keys(errors).length > 0) && <p className="ds-alert" role="alert">{failure || "Please check the highlighted fields."}</p>}
      <footer className="ds-partner-form-footer"><button type="button" className="ds-btn ds-btn--outline" disabled={busy || step === 0} onClick={() => { setStep(step - 1); setErrors({}); setFailure("") }}><ArrowLeft size={16} /> Back</button><button className="ds-btn ds-btn--primary" disabled={busy}>{busy ? "Submitting…" : step === 4 ? "Submit for verification" : "Continue"}{!busy && <ArrowRight size={16} />}</button></footer>
    </form>
  </section>
}

export function ApplicationReceipt({ partner }: { partner: Partner }) {
  return <section className="ds-card ds-application-receipt" aria-live="polite"><span className="ds-partner-mark"><CheckCircle2 size={28} /></span><h1 className="ds-title">Application received</h1><p className="ds-sub">Thank you, {partner.application?.first_name ?? partner.display_name}. Your request is awaiting verification.</p><p className="ds-note">Your services, identity and bank details were submitted together. No separate submission is needed.</p><p className="ds-note">Your account will show Verified after approval.</p><Link className="ds-btn ds-btn--outline" href="/partners">My businesses</Link></section>
}

export function SubmittedApplication({ partner }: { partner: Partner }) {
  const documents=usePartnerRead("documents",partnerApi.documents,30_000)
  return <div className="ds-stack"><ApplicationReceipt partner={partner} />
    <ReadPanel query={documents}>{items=><ApplicationCorrections documents={items}/>}</ReadPanel>
    <AlternateContact partner={partner} /></div>
}

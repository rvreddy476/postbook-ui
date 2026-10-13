"use client"

import { CheckCircle2, ExternalLink } from "lucide-react"
import { useRef, useState } from "react"
import { BankDetails, bankBody, bankErrors, emptyBank, type BankDraft } from "./BankDetails"
import { BankRecords } from "./BankRecords"
import { partnerApi, uploadPartnerImage } from "./api"
import { applicationBody, safeVerificationURL, validateImage, type Partner, type PartnerDocument, type Readiness, type StepCode } from "./model"
import { Field, partnerError, ReadPanel, SaveForm, statusWords, usePartnerRead } from "./ui"

import { HoursEditor } from "./HoursEditor"
import { WorkingArea } from "./WorkingArea"
import { ServiceTypePicker } from "./ServiceTypePicker"
type EditorProps = { step: StepCode; partner: Partner; readiness: Readiness; documents: PartnerDocument[] }
export function PartnerEditor({ step, partner, readiness, documents }: EditorProps) {
  switch (step) {
    case "profile": return <ProfileForm partner={partner} />
    case "identity_review": return <div className="ds-stack"><p className="ds-info">{readiness.completed_steps.includes(step) ? "An admin has completed your identity review." : "Save your PAN number and submit a selfie. An admin will review your identity and salon eligibility before approval."}</p><p className="ds-sub">No Aadhaar or DigiLocker is needed. Uploading evidence is not approval. PAN is collected as a number only.</p></div>
    case "selfie_face_match": return <DocumentForm kind="selfie" documents={documents} />
    case "skills": return <SkillsForm documents={documents} />
    case "service_area": return <WorkingArea />
    case "weekly_hours": return <HoursEditor />
    case "bank": return <BankLoader />
    case "pan": return <PanForm complete={readiness.completed_steps.includes("pan")} />
  }
}
function useImage() {
  const [file, setFile] = useState<File | null>(null)
  const [media, setMedia] = useState<string | null>(null)
  const [error, setError] = useState("")
  function choose(next: File | null) {
    setMedia(null); setError(next ? validateImage(next) ?? "" : ""); setFile(next)
  }
  async function resolve() {
    if (media) return media
    if (!file) throw new Error("Choose an image first.")
    const invalid = validateImage(file)
    if (invalid) throw new Error(invalid)
    const id = await uploadPartnerImage(file)
    setMedia(id)
    return id
  }
  return { file, media, error, choose, resolve }
}
function ImagePicker({ image, selfie = false }: { image: ReturnType<typeof useImage>; selfie?: boolean }) {
  return <Field label={selfie ? "Selfie photo *" : "Image *"} hint="JPG, PNG or WebP · up to 10 MB. Upload a clear, readable image."><input className="ds-partner-file" type="file" accept="image/jpeg,image/png,image/webp" capture={selfie ? "user" : undefined} onChange={e => image.choose(e.target.files?.[0] ?? null)} />{image.error && <span role="alert" className="ds-field__error">{image.error}</span>}{image.media && <span className="ds-note">Image uploaded. If it is still processing, retry Save in a moment; it won’t upload again.</span>}</Field>
}
function ProfileForm({ partner }: { partner: Partner }) {
  const [editing, setEditing] = useState(partner.status !== "approved")
  const [name, setName] = useState(partner.display_name)
  const image = useImage()
  if (!editing) return <div className="ds-stack"><Field label="Professional name"><input className="ds-input" value={partner.display_name} readOnly /></Field><p className="ds-sub">Your profile is verified. Name and photo changes require admin approval.</p><button type="button" className="ds-btn ds-btn--outline" onClick={() => setEditing(true)}>Request a profile change</button></div>
  return <SaveForm save={async () => {
    const { display_name } = applicationBody(name)
    const photo_media_id = image.file ? await image.resolve() : undefined
    if (!photo_media_id && !partner.photo_media_id) throw new Error("Add a profile photo to complete this step.")
    return partnerApi.profile({ display_name, ...(photo_media_id ? { photo_media_id } : {}) })
  }}><p className="ds-sub">Customers will see this name and profile photo after your application is approved.</p><Field label="Professional display name *"><input required className="ds-input" autoComplete="name" minLength={2} maxLength={60} value={name} onChange={e => setName(e.target.value)} /></Field>{partner.photo_media_id && <p className="ds-ok"><CheckCircle2 size={14} aria-hidden="true" /> A profile photo is saved. Choose a new image only to replace it.</p>}<ImagePicker image={image} /></SaveForm>
}
function IdentityForm({ complete }: { complete: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  return <div className="ds-stack"><p className="ds-sub">Verify your identity through DigiLocker. Do not upload an Aadhaar number or enter gender here.</p>{complete ? <p className="ds-ok">Identity verification is complete.</p> : <><p className="ds-info">You’ll leave Doorstep for the verification provider, then return to your application. This step requires an enabled DigiLocker integration.</p><button className="ds-btn ds-btn--primary" type="button" disabled={busy} onClick={async () => {
    if (busy) return
    setBusy(true); setError("")
    try { const result = await partnerApi.startIdentity(); window.location.assign(safeVerificationURL(result.authorization_url)) }
    catch (e) { setError(partnerError(e)); setBusy(false) }
  }}>{busy ? "Opening verification…" : "Continue to DigiLocker"}<ExternalLink size={15} aria-hidden="true" /></button></>}{error && <p role="alert" className="ds-alert">{error}</p>}</div>
}
export function DocumentForm({ kind, skill, documents, enabled = true }: { kind: "selfie" | "police_certificate" | "trade_certificate"; skill?: string; documents: PartnerDocument[]; enabled?: boolean }) {
  const image = useImage()
  const [issued, setIssued] = useState("")
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
  const relevant = documents.filter(d => d.kind === kind && (!skill || d.skill_code === skill))
  const pending = relevant.some(d => d.status === "pending")
  return <SaveForm disabled={!enabled || pending} label={kind === "selfie" ? "Submit selfie for review" : "Submit certificate for review"} save={async () => {
    const media_id = await image.resolve()
    if (kind === "selfie") return partnerApi.selfie(media_id)
    if (!issued || issued > today) throw new Error("Choose the date the certificate was issued; it cannot be in the future.")
    return partnerApi.certificate({ media_id, issued_on: issued }, skill)
  }}>
    <p className="ds-sub">{kind === "selfie" ? "Take a clear, well-lit photo of your face. Your selfie goes through identity review; uploading is not approval." : kind === "police_certificate" ? "Upload your police clearance certificate, issued within the last 12 months. A reviewer will check it before clearance is recorded." : "Upload an experience, course or trade certificate supporting this skill. An admin will review it; the upload does not verify your skill."}</p>
    {!enabled && <p className="ds-info">Complete the required earlier step before submitting.</p>}
    {relevant.map(d => <div className={d.status === "rejected" ? "ds-alert" : "ds-info"} key={d.id}><strong>{statusWords(d.status)}</strong>{d.reason && <p>{d.reason}</p>}{d.expires_on && <p className="ds-note">Valid until {d.expires_on}</p>}</div>)}
    {pending ? <p className="ds-note">Your document is awaiting review. A second submission is not needed.</p> : <><ImagePicker image={image} selfie={kind === "selfie"} />{kind !== "selfie" && <Field label="Certificate issue date *"><input className="ds-input" type="date" required max={today} value={issued} onChange={e => setIssued(e.target.value)} /></Field>}</>}
  </SaveForm>
}
export function SkillsForm({ documents }: { documents: PartnerDocument[] }) {
  const query = usePartnerRead("skill-editor", async () => ({ catalogue: await partnerApi.skills(), mine: await partnerApi.mySkills() }))
  return <ReadPanel query={query}>{data => <SkillChoices data={data} documents={documents} onRetry={() => { void query.refetch() }} />}</ReadPanel>
}
function SkillChoices({ data, documents, onRetry }: { data: { catalogue: Awaited<ReturnType<typeof partnerApi.skills>>; mine: Awaited<ReturnType<typeof partnerApi.mySkills>> }; documents: PartnerDocument[]; onRetry: () => void }) {
  const [selected, setSelected] = useState(data.mine.map(s => s.skill_code))
  return <div className="ds-stack"><SaveForm save={() => { if (!selected.length || selected.length > 20) throw new Error("Choose between 1 and 20 services."); return partnerApi.saveSkills(selected) }} label="Save services"><p className="ds-sub">Select the work you offer. Changes go to our team for review.</p><ServiceTypePicker items={data.catalogue} selected={selected} onChange={setSelected} onRetry={onRetry} />{data.mine.length > 0 && <div className="ds-partner-choices" aria-label="Service review status">{data.mine.map(skill => <p className="ds-note" key={skill.skill_code}>{data.catalogue.find(item => item.code === skill.skill_code)?.name ?? skill.skill_code} · {statusWords(skill.status)}</p>)}</div>}</SaveForm>{data.catalogue.filter(s => data.mine.some(m => m.skill_code === s.code)).map(s => <details className="ds-card" key={s.code}><summary>Experience / course certificate (optional) · {s.name}</summary><DocumentForm kind="trade_certificate" skill={s.code} documents={documents} /></details>)}</div>
}
export function BankLoader() {
  const query = usePartnerRead("bank-editor", partnerApi.bank)
  return <ReadPanel query={query}>{data => data ? <div className="ds-stack"><BankRecords bank={data} /><details className="ds-card"><summary>Update bank details</summary><BankForm bank={data} /></details></div> : <BankForm bank={data} />}</ReadPanel>
}
function BankForm({ bank }: { bank: Awaited<ReturnType<typeof partnerApi.bank>> }) {
  const [draft, setDraft] = useState<BankDraft>({ ...emptyBank, holder: bank?.account_holder ?? "", ifsc: bank?.ifsc ?? "", bankName: bank?.bank_name ?? "", branchName: bank?.branch_name ?? "" })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const uploaded = useRef<{ file: File; id: string } | null>(null)
  return <SaveForm label="Submit bank details" onSaved={() => { setDraft({ ...emptyBank }); uploaded.current = null }} save={async () => {
    const invalid = bankErrors(draft); setErrors(invalid)
    if (Object.keys(invalid).length) throw new Error("Check the highlighted bank details.")
    if (!uploaded.current || uploaded.current.file !== draft.proof) uploaded.current = { file: draft.proof!, id: await uploadPartnerImage(draft.proof!) }
    return partnerApi.saveBank(bankBody(draft, uploaded.current.id))
  }}>
    {bank && <p className="ds-info">Account ending {bank.account_last4} · {bank.status === "failed" ? "Changes required" : bank.status === "verified" ? "Verified" : "Pending review"}{bank.reason && <span> — {bank.reason}</span>}</p>}
    <BankDetails value={draft} onChange={setDraft} errors={errors} />
  </SaveForm>
}
function PanForm({ complete }: { complete: boolean }) {
  const [pan, setPan] = useState("")
  return <SaveForm label="Save PAN" onSaved={() => setPan("")} save={() => {
    if (!/^[A-Z]{3}P[A-Z][0-9]{4}[A-Z]$/.test(pan.trim())) throw new Error("Enter an individual PAN, such as ABCPE1234F. The fourth character must be P.")
    return partnerApi.pan(pan.trim())
  }}><p className="ds-sub">Enter your individual PAN number; no card upload is needed. It is required for your application and is not stored in this browser. Saving PAN is not government verification.</p>{complete && <p className="ds-ok">PAN is already saved. Replacing it requires a new identity review.</p>}<Field label="Individual PAN *"><input className="ds-input" required type="password" maxLength={10} autoComplete="off" value={pan} onChange={e => setPan(e.target.value.toUpperCase())} /></Field></SaveForm>
}

"use client"

// /shop/sell/onboarding: basic → storefront → documents → fulfilment → payout
// → readiness → Submit. Every step is its own PUT; the readiness step reads
// GET /onboarding/readiness and the submit maps the server's refusal back
// onto the steps. Nothing here ever asks for an Aadhaar NUMBER.

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Upload } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useGlobalToast } from "@/contexts/ToastContext"
import { uploadSellerImage } from "../api/sellMedia"
import {
  useSaveBasic,
  useSaveDocuments,
  useSaveFulfillmentStep,
  useSavePayout,
  useSaveStorefront,
  useSellerReadiness,
  useSellerStatus,
  useSubmitApplication,
} from "../hooks/sell"
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABEL,
  DISPATCH_SLA_OPTIONS,
  DOCUMENT_TYPE_LABEL,
  MISSING_CODES,
  WIZARD_STEPS,
  WIZARD_STEP_LABEL,
  apiMessage,
  completedSteps,
  documentTypeOptions,
  documentsPayload,
  firstOpenStep,
  fulfillmentPayload,
  mapMissing,
  maskAccountNumber,
  missingFromSubmitError,
  payoutPayload,
  pickupAddressPayload,
  sellerStatusBanner,
  stepUnlocked,
  validateDocuments,
  validatePayout,
  validatePickupAddress,
  type DocumentDraft,
  type DocumentType,
  type PayoutDraft,
  type PickupAddressDraft,
  type SellerWire,
  type WizardStep,
} from "../model/sell"
import { IMAGE_ACCEPT_ATTR } from "../model/sellListing"
import { Field, Notice, PageHead, Panel, RowsSkeleton, Select, StepRail, TextField, Textarea } from "../components/sell/primitives"
import { StatusBanner } from "../components/sell/SellerShell"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function OnboardingWizardScreen() {
  const status = useSellerStatus()
  const seller = status.data ?? null
  const readiness = useSellerReadiness(!!seller)
  const done = useMemo(() => completedSteps(readiness.data), [readiness.data])
  const [step, setStep] = useState<WizardStep | null>(null)

  useEffect(() => {
    if (step === null && readiness.data) setStep(firstOpenStep(completedSteps(readiness.data)))
  }, [step, readiness.data])

  if (!seller || readiness.isPending) return <RowsSkeleton rows={5} />
  if (readiness.isError && !readiness.data) {
    return <Notice tone="danger">The application could not be loaded. Reload to try again.</Notice>
  }

  const banner = sellerStatusBanner(seller)
  const editable = seller.status === "draft" || seller.status === "changes_required"
  const current = step ?? firstOpenStep(done)

  return (
    <div className="shop-sell-wizard">
      <PageHead title="Your application" sub={editable ? "Save each step as you go. You can come back any time." : undefined} />
      <StatusBanner seller={seller} />
      {!editable ? (
        <Notice tone="muted">
          {banner.canTrade ? "Your shop is approved; these details are read-only here." : "The application is with the reviewers, so it cannot be edited now."}{" "}
          <Link href="/shop/sell" className="shop-sell-link">
            Go to the dashboard
          </Link>
        </Notice>
      ) : (
        <div className="shop-sell-wizard__grid">
          <StepRail steps={WIZARD_STEPS} labels={WIZARD_STEP_LABEL} current={current} done={done} unlocked={(s) => stepUnlocked(s, done)} onPick={setStep} />
          <div>
            {current === "basic" ? <BasicStep seller={seller} onDone={() => setStep("storefront")} /> : null}
            {current === "storefront" ? <StorefrontStep seller={seller} onDone={() => setStep("documents")} /> : null}
            {current === "documents" ? <DocumentsStep onDone={() => setStep("fulfillment")} /> : null}
            {current === "fulfillment" ? <FulfillmentStep seller={seller} onDone={() => setStep("payout")} /> : null}
            {current === "payout" ? <PayoutStep hasAccount={done.has("payout")} onDone={() => setStep("readiness")} /> : null}
            {current === "readiness" ? <ReadinessStep onFix={setStep} /> : null}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Basic ───────────────────────────────────────────────────────

function BasicStep({ seller, onDone }: { seller: SellerWire; onDone: () => void }) {
  const save = useSaveBasic()
  const [storeName, setStoreName] = useState(seller.store_name || "")
  const [ownerName, setOwnerName] = useState(seller.owner_name || "")
  const [businessType, setBusinessType] = useState(seller.business_type || "individual")
  const [email, setEmail] = useState(seller.email || "")
  const [phone, setPhone] = useState(seller.phone || "")
  const [description, setDescription] = useState(seller.description || "")
  const [attempted, setAttempted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const errors = {
    storeName: storeName.trim().length < 2 ? "Name your store." : null,
    ownerName: ownerName.trim().length < 2 ? "Enter the owner's name as on the documents." : null,
    email: !EMAIL_RE.test(email.trim()) ? "Enter a valid email." : null,
  }

  async function submit() {
    setAttempted(true)
    setError(null)
    if (errors.storeName || errors.ownerName || errors.email) return
    try {
      await save.mutateAsync({
        store_name: storeName.trim(),
        owner_name: ownerName.trim(),
        business_type: businessType,
        seller_type: seller.seller_type || "individual",
        email: email.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      })
      onDone()
    } catch (err) {
      setError(apiMessage(err, "The details could not be saved."))
    }
  }

  return (
    <Panel title="Basic details" sub="Who this shop is and how to reach you.">
      <form noValidate className="shop-sell-form" onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <TextField id="basic-store" label="Store name" required value={storeName} onChange={setStoreName} error={attempted ? errors.storeName : null} maxLength={120} />
        <TextField id="basic-owner" label="Owner name" required value={ownerName} onChange={setOwnerName} error={attempted ? errors.ownerName : null} maxLength={120} autoComplete="name" />
        <Field id="basic-type" label="Business type" required>
          <Select id="basic-type" value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {BUSINESS_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <TextField id="basic-email" label="Contact email" required type="email" inputMode="email" value={email} onChange={setEmail} error={attempted ? errors.email : null} autoComplete="email" />
        <TextField id="basic-phone" label="Phone" type="tel" inputMode="tel" value={phone} onChange={setPhone} autoComplete="tel" />
        <Field id="basic-desc" label="About the store" help="Shown on your storefront.">
          <Textarea id="basic-desc" rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <div className="shop-sell-actions">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save and continue"}
          </Button>
        </div>
      </form>
    </Panel>
  )
}

// ── Storefront ──────────────────────────────────────────────────

function StorefrontStep({ seller, onDone }: { seller: SellerWire; onDone: () => void }) {
  const save = useSaveStorefront()
  const [brandName, setBrandName] = useState(seller.brand_name || "")
  const [tagline, setTagline] = useState(seller.tagline || "")
  const [supportEmail, setSupportEmail] = useState(seller.support_email || "")
  const [supportPhone, setSupportPhone] = useState(seller.support_phone || "")
  const [error, setError] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)
  const emailError = supportEmail.trim() && !EMAIL_RE.test(supportEmail.trim()) ? "Enter a valid email, or leave it blank." : null

  async function submit() {
    setAttempted(true)
    setError(null)
    if (emailError) return
    try {
      await save.mutateAsync({
        ...(brandName.trim() ? { brand_name: brandName.trim() } : {}),
        ...(tagline.trim() ? { tagline: tagline.trim() } : {}),
        ...(supportEmail.trim() ? { support_email: supportEmail.trim() } : {}),
        ...(supportPhone.trim() ? { support_phone: supportPhone.trim() } : {}),
      })
      onDone()
    } catch (err) {
      setError(apiMessage(err, "The storefront could not be saved."))
    }
  }

  return (
    <Panel title="Storefront" sub="Optional. What buyers see on your shop page.">
      <form noValidate className="shop-sell-form" onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <TextField id="sf-brand" label="Brand name" value={brandName} onChange={setBrandName} maxLength={120} />
        <TextField id="sf-tagline" label="Tagline" value={tagline} onChange={setTagline} maxLength={160} />
        <TextField id="sf-email" label="Support email" type="email" inputMode="email" value={supportEmail} onChange={setSupportEmail} error={attempted ? emailError : null} />
        <TextField id="sf-phone" label="Support phone" type="tel" inputMode="tel" value={supportPhone} onChange={setSupportPhone} />
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <div className="shop-sell-actions">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save and continue"}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Skip for now
          </Button>
        </div>
      </form>
    </Panel>
  )
}

// ── Documents ───────────────────────────────────────────────────

interface DocRow extends DocumentDraft {
  key: string
  fileName: string
  uploading: boolean
  error: string | null
}

let docSeq = 0
const newDoc = (type: DocumentType = "pan_card"): DocRow => ({ key: `d${++docSeq}`, document_type: type, media_id: "", document_number: "", fileName: "", uploading: false, error: null })

function DocumentsStep({ onDone }: { onDone: () => void }) {
  const save = useSaveDocuments()
  const [rows, setRows] = useState<DocRow[]>([newDoc("pan_card")])
  const [error, setError] = useState<string | null>(null)
  const options = useMemo(() => documentTypeOptions(), [])
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})

  function patch(key: string, next: Partial<DocRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...next } : r)))
  }

  async function pick(key: string, file: File) {
    patch(key, { uploading: true, fileName: file.name, error: null, media_id: "" })
    try {
      const mediaId = await uploadSellerImage(file, "kyc")
      patch(key, { uploading: false, media_id: mediaId })
    } catch (err) {
      patch(key, { uploading: false, fileName: "", error: err instanceof Error ? err.message : "The upload failed." })
    }
  }

  async function submit() {
    setError(null)
    if (rows.some((r) => r.uploading)) {
      setError("A document is still uploading.")
      return
    }
    const problem = validateDocuments(rows)
    if (problem) {
      setError(problem)
      return
    }
    try {
      await save.mutateAsync(documentsPayload(rows))
      onDone()
    } catch (err) {
      setError(apiMessage(err, "The documents could not be saved."))
    }
  }

  return (
    <Panel title="Documents" sub="A person checks these before your shop opens. Upload a clear photo or scan (JPEG, PNG or WebP). At least one document is required.">
      <div className="shop-sell-form">
        {rows.map((row) => (
          <div key={row.key} className="shop-sell-doc">
            <Field id={`doc-type-${row.key}`} label="Document">
              <Select id={`doc-type-${row.key}`} value={row.document_type} onChange={(e) => patch(row.key, { document_type: e.target.value as DocumentType, document_number: "" })}>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            {row.document_type === "aadhaar" ? (
              <p className="shop-sell-field__help">Upload the document only. An Aadhaar number is never asked for or stored.</p>
            ) : row.document_type === "cancelled_cheque" || row.document_type === "other" || row.document_type === "address_proof" ? null : (
              <TextField
                id={`doc-number-${row.key}`}
                label={`${DOCUMENT_TYPE_LABEL[row.document_type]} number`}
                value={row.document_number}
                onChange={(v) => patch(row.key, { document_number: v })}
                help="Optional."
                maxLength={40}
              />
            )}
            <div className="shop-sell-doc__file">
              <input
                ref={(el) => {
                  inputs.current[row.key] = el
                }}
                type="file"
                accept={IMAGE_ACCEPT_ATTR}
                className="sr-only"
                id={`doc-file-${row.key}`}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void pick(row.key, f)
                  e.target.value = ""
                }}
              />
              <Button type="button" variant="outline" size="sm" disabled={row.uploading} onClick={() => inputs.current[row.key]?.click()}>
                <Upload className="h-4 w-4" aria-hidden="true" />
                {row.media_id ? "Replace file" : row.uploading ? "Uploading…" : "Choose file"}
              </Button>
              <span className="shop-sell-doc__name">{row.media_id ? `${row.fileName || "Uploaded"} — ready` : row.uploading ? row.fileName : "No file yet"}</span>
              {rows.length > 1 ? (
                <button type="button" className="shop-sell-iconbtn" aria-label="Remove this document" onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
            {row.error ? <p className="shop-sell-field__error" role="alert">{row.error}</p> : null}
          </div>
        ))}
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setRows((prev) => [...prev, newDoc("other")])}>
            Add another document
          </Button>
        </div>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <div className="shop-sell-actions">
          <Button type="button" disabled={save.isPending} onClick={() => void submit()}>
            {save.isPending ? "Saving…" : "Save and continue"}
          </Button>
        </div>
      </div>
    </Panel>
  )
}

// ── Fulfilment ──────────────────────────────────────────────────

function FulfillmentStep({ seller, onDone }: { seller: SellerWire; onDone: () => void }) {
  const save = useSaveFulfillmentStep()
  const [address, setAddress] = useState<PickupAddressDraft>({
    contact_name: seller.owner_name || "",
    phone: seller.phone || "",
    address_line_1: "",
    address_line_2: "",
    city: seller.city || "",
    state: seller.state || "",
    postal_code: seller.postal_code || "",
  })
  const [sla, setSla] = useState<number>(48)
  const [returns, setReturns] = useState(true)
  const [returnDays, setReturnDays] = useState("7")
  const [attempted, setAttempted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errors = validatePickupAddress(address)
  const set = (k: keyof PickupAddressDraft) => (v: string) => setAddress((a) => ({ ...a, [k]: v }))

  async function submit() {
    setAttempted(true)
    setError(null)
    if (Object.keys(errors).length > 0) return
    try {
      await save.mutateAsync({
        address: pickupAddressPayload(address),
        fulfillment: fulfillmentPayload({ dispatch_sla_hours: sla, return_supported: returns, return_window_days: Number(returnDays) || 7 }),
      })
      onDone()
    } catch (err) {
      setError(apiMessage(err, "The pickup details could not be saved."))
    }
  }

  return (
    <Panel title="Fulfilment" sub="Where the courier collects from. The PIN code and state also decide GST on every sale. Orders are prepaid only; cash on delivery is not offered.">
      <form noValidate className="shop-sell-form" onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <TextField id="pk-name" label="Contact name" required value={address.contact_name} onChange={set("contact_name")} error={attempted ? errors.contact_name : null} autoComplete="name" />
        <TextField id="pk-phone" label="Phone" required type="tel" inputMode="tel" value={address.phone} onChange={set("phone")} error={attempted ? errors.phone : null} autoComplete="tel" />
        <TextField id="pk-l1" label="Address line 1" required value={address.address_line_1} onChange={set("address_line_1")} error={attempted ? errors.address_line_1 : null} autoComplete="address-line1" />
        <TextField id="pk-l2" label="Address line 2" value={address.address_line_2} onChange={set("address_line_2")} autoComplete="address-line2" />
        <div className="shop-sell-form__row">
          <TextField id="pk-city" label="City" required value={address.city} onChange={set("city")} error={attempted ? errors.city : null} autoComplete="address-level2" />
          <TextField id="pk-state" label="State" required value={address.state} onChange={set("state")} error={attempted ? errors.state : null} autoComplete="address-level1" />
          <TextField id="pk-pin" label="PIN code" required inputMode="numeric" value={address.postal_code} onChange={set("postal_code")} error={attempted ? errors.postal_code : null} autoComplete="postal-code" maxLength={6} />
        </div>
        <Field id="pk-sla" label="Dispatch within">
          <Select id="pk-sla" value={String(sla)} onChange={(e) => setSla(Number(e.target.value))}>
            {DISPATCH_SLA_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {h} hours
              </option>
            ))}
          </Select>
        </Field>
        <label className="shop-sell-check">
          <input type="checkbox" checked={returns} onChange={(e) => setReturns(e.target.checked)} />
          <span>Accept returns</span>
        </label>
        {returns ? <TextField id="pk-return" label="Return window (days)" inputMode="numeric" value={returnDays} onChange={setReturnDays} maxLength={2} /> : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <div className="shop-sell-actions">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save and continue"}
          </Button>
        </div>
      </form>
    </Panel>
  )
}

// ── Payout ──────────────────────────────────────────────────────

function PayoutStep({ hasAccount, onDone }: { hasAccount: boolean; onDone: () => void }) {
  const save = useSavePayout()
  const [draft, setDraft] = useState<PayoutDraft>({ account_holder_name: "", account_number: "", ifsc_code: "", bank_name: "", upi_id: "" })
  const [attempted, setAttempted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** The masked read-back after a save. The full number is not kept. */
  const [saved, setSaved] = useState<string | null>(null)
  const [editing, setEditing] = useState(!hasAccount)
  const errors = validatePayout(draft)
  const set = (k: keyof PayoutDraft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }))

  async function submit() {
    setAttempted(true)
    setError(null)
    if (Object.keys(errors).length > 0) return
    try {
      await save.mutateAsync(payoutPayload(draft))
      setSaved(maskAccountNumber(draft.account_number))
      setDraft({ account_holder_name: "", account_number: "", ifsc_code: "", bank_name: "", upi_id: "" })
      setEditing(false)
    } catch (err) {
      setError(apiMessage(err, "The payout account could not be saved."))
    }
  }

  return (
    <Panel title="Payout" sub="Where your sales are paid. The account number is stored sealed; only its last four digits are ever shown again.">
      {!editing ? (
        <div className="shop-sell-form">
          <Notice tone="success">{saved ? `Account ending ${saved} saved.` : "A payout account is on file."}</Notice>
          <div className="shop-sell-actions">
            <Button type="button" onClick={onDone}>
              Continue
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
              Replace account
            </Button>
          </div>
        </div>
      ) : (
        <form noValidate className="shop-sell-form" onSubmit={(e) => { e.preventDefault(); void submit() }}>
          <TextField id="po-holder" label="Account holder name" required value={draft.account_holder_name} onChange={set("account_holder_name")} error={attempted ? errors.account_holder_name : null} autoComplete="off" />
          <TextField id="po-number" label="Account number" required inputMode="numeric" value={draft.account_number} onChange={set("account_number")} error={attempted ? errors.account_number : null} autoComplete="off" maxLength={18} />
          <TextField id="po-ifsc" label="IFSC" required value={draft.ifsc_code} onChange={set("ifsc_code")} error={attempted ? errors.ifsc_code : null} autoComplete="off" maxLength={11} />
          <TextField id="po-bank" label="Bank name" value={draft.bank_name} onChange={set("bank_name")} maxLength={80} />
          <TextField id="po-upi" label="UPI id" value={draft.upi_id} onChange={set("upi_id")} error={attempted ? errors.upi_id : null} help="Optional." autoComplete="off" />
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <div className="shop-sell-actions">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save and continue"}
            </Button>
            {hasAccount ? (
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Keep the account on file
              </Button>
            ) : null}
          </div>
        </form>
      )}
    </Panel>
  )
}

// ── Readiness and submit ────────────────────────────────────────

function ReadinessStep({ onFix }: { onFix: (step: WizardStep) => void }) {
  const router = useRouter()
  const toast = useGlobalToast()
  const readiness = useSellerReadiness(true)
  const submit = useSubmitApplication()
  const [serverMissing, setServerMissing] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const missing = mapMissing(serverMissing ?? readiness.data?.missing ?? [])
  const ready = !readiness.isPending && missing.length === 0 && readiness.data?.ready !== false

  async function send() {
    setError(null)
    setServerMissing(null)
    try {
      await submit.mutateAsync()
      toast({ type: "success", title: "Application submitted", description: "A person will check your documents. You will see the status change on your dashboard." })
      router.replace("/shop/sell")
    } catch (err) {
      const fromServer = missingFromSubmitError(err)
      if (fromServer) {
        setServerMissing(fromServer)
        void readiness.refetch()
        return
      }
      setError(apiMessage(err, "The application could not be submitted."))
    }
  }

  return (
    <Panel title="Review and submit" sub="A person reviews hand-uploaded documents, so approval takes a little time. You will see the status change here.">
      {readiness.isPending ? (
        <RowsSkeleton rows={3} />
      ) : (
        <div className="shop-sell-form">
          <ul className="shop-sell-checklist">
            {Object.entries(MISSING_CODES).map(([code, meta]) => {
              const gap = missing.find((m) => m.code === code)
              return (
                <li key={code} className={gap ? "is-missing" : "is-done"}>
                  <span>{meta.label}</span>
                  {gap ? (
                    <button type="button" className="shop-sell-link" onClick={() => onFix(gap.step)}>
                      Add in {WIZARD_STEP_LABEL[gap.step]}
                    </button>
                  ) : (
                    <span className="shop-sell-checklist__ok">Done</span>
                  )}
                </li>
              )
            })}
          </ul>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <div className="shop-sell-actions">
            <Button type="button" disabled={!ready || submit.isPending} onClick={() => void send()}>
              {submit.isPending ? "Submitting…" : "Submit for review"}
            </Button>
          </div>
        </div>
      )}
    </Panel>
  )
}

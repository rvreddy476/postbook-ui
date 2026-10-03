"use client"

/*
  Tax category, legal name, PAN and GSTIN. The client checks format and the
  GSTIN checksum (mirroring shared/kyc) to catch typos; the server decides,
  and its 422 message is shown as it says. PAN is never shown back in full:
  the saved state shows the server's mask.
*/

import { useEffect, useState } from "react"

import { fetchCompliance, putCompliance } from "../../api/client"
import { checkCompliance, TAX_CATEGORIES, taxCategory, type ComplianceForm } from "../../model/compliance"
import { toFailure, type ApiFailure } from "../../model/errors"
import { todayIST } from "../../model/hours"
import type { Compliance } from "../../model/wire"
import { FailureNotice, Field, Notice, Pill, useAction } from "../ui"

const BLANK: ComplianceForm = { taxCategory: "", legalName: "", pan: "", gstin: "", specifiedPremisesDeclaredAt: "" }

export function CompliancePanel({ restaurantId, legalName, onSaved }: { restaurantId: string; legalName: string | null; onSaved: () => void }) {
  const [saved, setSaved] = useState<Compliance | null>(null)
  const [form, setForm] = useState<ComplianceForm>({ ...BLANK, legalName: legalName ?? "" })
  const [errors, setErrors] = useState<Partial<Record<keyof ComplianceForm, string>>>({})
  const [loadFailure, setLoadFailure] = useState<ApiFailure | null>(null)
  const [done, setDone] = useState(false)
  const action = useAction()

  useEffect(() => {
    let live = true
    fetchCompliance(restaurantId)
      .then((c) => {
        if (!live) return
        setSaved(c)
        // PAN and GSTIN are re-entered to change them: the PAN comes back masked.
        setForm((f) => ({ ...f, taxCategory: c.taxCategory, legalName: c.legalName, gstin: c.gstin ?? "", specifiedPremisesDeclaredAt: c.specifiedPremisesDeclaredAt ?? "" }))
      })
      .catch((e) => {
        const f = toFailure(e)
        if (live && f.code !== "FOOD_ONBOARDING_STEP_NOT_SAVED") setLoadFailure(f)
      })
    return () => {
      live = false
    }
  }, [restaurantId])

  const cat = taxCategory(form.taxCategory)
  const set = (k: keyof ComplianceForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((x) => ({ ...x, [k]: undefined }))
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setDone(false)
    const check = checkCompliance(form, todayIST())
    if (!check.ok) return setErrors({ [check.field]: check.message })
    setErrors({})
    const c = await action.run(() => putCompliance(restaurantId, check.body))
    if (c) {
      setSaved(c)
      setForm((f) => ({ ...f, pan: "" }))
      setDone(true)
      onSaved()
    }
  }

  // A 422 names the field: show it there as well as above.
  const serverField = action.failure?.field
  const fieldError = (k: keyof ComplianceForm, wire: string) => errors[k] ?? (serverField === wire ? action.failure?.message : undefined)

  return (
    <form className="kit-form kit-form--2" onSubmit={save} noValidate>
      <FailureNotice failure={loadFailure} />
      {saved ? (
        <div className="kit-span">
          <Notice>
            On file: {taxCategory(saved.taxCategory)?.label ?? saved.taxCategory} · PAN {saved.panMasked}
            {saved.gstin ? ` · GSTIN ${saved.gstin}` : ""} ·{" "}
            <Pill tone={saved.gstLiability === "SUPPLIER" ? "warning" : "neutral"}>
              {saved.gstLiability === "SUPPLIER" ? "You charge and pay GST" : "Feast pays GST on food (s.9(5))"}
            </Pill>
          </Notice>
        </div>
      ) : null}
      <Field label="Tax category" span error={fieldError("taxCategory", "tax_category")} hint={cat ? (cat.gstinRequired ? "GSTIN required for this category." : "GSTIN optional for this category.") : undefined}>
        <select className="kit-select" value={form.taxCategory} onChange={set("taxCategory")}>
          <option value="">Choose…</option>
          {TAX_CATEGORIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Legal name" span error={fieldError("legalName", "legal_name")} hint="As on the PAN.">
        <input className="kit-input" value={form.legalName} onChange={set("legalName")} maxLength={200} />
      </Field>
      <Field label={saved ? "PAN (re-enter to save changes)" : "PAN"} error={fieldError("pan", "pan")}>
        <input className="kit-input" value={form.pan} onChange={set("pan")} maxLength={10} autoComplete="off" spellCheck={false} style={{ textTransform: "uppercase" }} />
      </Field>
      <Field label={cat?.gstinRequired ? "GSTIN" : "GSTIN (optional)"} error={fieldError("gstin", "gstin")}>
        <input className="kit-input" value={form.gstin} onChange={set("gstin")} maxLength={15} autoComplete="off" spellCheck={false} style={{ textTransform: "uppercase" }} />
      </Field>
      {cat?.specifiedPremises ? (
        <Field label="Specified-premises declaration date" error={fieldError("specifiedPremisesDeclaredAt", "specified_premises_declared_at")}>
          <input className="kit-input" type="date" max={todayIST()} value={form.specifiedPremisesDeclaredAt} onChange={set("specifiedPremisesDeclaredAt")} />
        </Field>
      ) : null}
      <div className="kit-span kit-form">
        <FailureNotice failure={action.failure} />
        {done ? <Notice tone="success">Tax details saved.</Notice> : null}
        <div className="kit-row kit-row--end">
          <button type="submit" className="kit-btn kit-btn--primary" disabled={action.busy}>
            {action.busy ? "Saving…" : "Save tax details"}
          </button>
        </div>
      </div>
    </form>
  )
}

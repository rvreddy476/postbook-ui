/*
  The restaurant tax categories (shared/gst rates.go, Supplier RESTAURANT)
  and the client-side compliance check that mirrors
  onboarding.ValidateCompliance. The server decides `gstin_required` from its
  rate table; this table is only for the form's hints and early checks.
*/

import { gstinMatchesPAN, validateGSTIN, validatePAN } from "./kyc"

export interface TaxCategory {
  code: string
  label: string
  /** The restaurant is liable (not s.9(5)): a GSTIN is required. */
  gstinRequired: boolean
  /** Needs a specified-premises declaration date. */
  specifiedPremises: boolean
}

/** Alphabetical by label. */
export const TAX_CATEGORIES: readonly TaxCategory[] = [
  { code: "CLOUD_KITCHEN_TAKEAWAY", label: "Cloud kitchen / takeaway", gstinRequired: false, specifiedPremises: false },
  { code: "OUTDOOR_CATERING", label: "Outdoor catering", gstinRequired: true, specifiedPremises: false },
  { code: "OUTDOOR_CATERING_SPECIFIED_PREMISES", label: "Outdoor catering at specified premises", gstinRequired: true, specifiedPremises: true },
  { code: "RESTAURANT_STANDALONE", label: "Restaurant (standalone)", gstinRequired: false, specifiedPremises: false },
  { code: "RESTAURANT_SPECIFIED_PREMISES", label: "Restaurant in specified premises (hotel)", gstinRequired: true, specifiedPremises: true },
].slice().sort((a, b) => a.label.localeCompare(b.label))

export function taxCategory(code: string): TaxCategory | null {
  return TAX_CATEGORIES.find((c) => c.code === code) ?? null
}

export interface ComplianceForm {
  taxCategory: string
  legalName: string
  pan: string
  gstin: string
  specifiedPremisesDeclaredAt: string
}

export interface ComplianceBody {
  tax_category: string
  legal_name: string
  pan: string
  gstin: string
  specified_premises_declared_at: string
}

export type ComplianceCheck = { ok: true; body: ComplianceBody } | { ok: false; field: keyof ComplianceForm; message: string }

export function checkCompliance(form: ComplianceForm, today: string): ComplianceCheck {
  const cat = taxCategory(form.taxCategory)
  if (!cat) return { ok: false, field: "taxCategory", message: "Choose a tax category." }
  const legalName = form.legalName.trim()
  if (!legalName || legalName.length > 200) return { ok: false, field: "legalName", message: "Enter the legal name, up to 200 characters." }
  const pan = validatePAN(form.pan)
  if (!pan.ok) return { ok: false, field: "pan", message: pan.message }
  let gstin = ""
  if (form.gstin.trim()) {
    const g = validateGSTIN(form.gstin)
    if (!g.ok) return { ok: false, field: "gstin", message: g.message }
    if (!gstinMatchesPAN(g.value, pan.value)) return { ok: false, field: "gstin", message: "The PAN inside the GSTIN does not match the PAN above." }
    gstin = g.value.normalized
  } else if (cat.gstinRequired) {
    return { ok: false, field: "gstin", message: "This tax category makes you liable for GST, so a GSTIN is required." }
  }
  let declared = ""
  if (cat.specifiedPremises) {
    declared = form.specifiedPremisesDeclaredAt.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(declared)) return { ok: false, field: "specifiedPremisesDeclaredAt", message: "Enter the declaration date." }
    if (declared > today) return { ok: false, field: "specifiedPremisesDeclaredAt", message: "The declaration date can't be in the future." }
  }
  return { ok: true, body: { tax_category: cat.code, legal_name: legalName, pan: pan.value, gstin, specified_premises_declared_at: declared } }
}

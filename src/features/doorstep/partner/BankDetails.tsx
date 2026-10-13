"use client"

import { useId, type ReactNode } from "react"
import { validateBank, validateImage } from "./model"

export type BankDraft = { holder: string; number: string; confirm: string; ifsc: string; bankName: string; branchName: string; proofKind: string; proof: File | null }
export const emptyBank: BankDraft = { holder: "", number: "", confirm: "", ifsc: "", bankName: "", branchName: "", proofKind: "cancelled_cheque", proof: null }
export const bankProofTypes = [["cancelled_cheque", "Cancelled cheque"], ["bank_statement", "Bank statement"], ["passbook", "Passbook"]] as const
export function bankErrors(bank: BankDraft): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!/^[\p{L} .'-]{2,100}$/u.test(bank.holder.trim())) errors.holder = "Enter the name shown on your bank account."
  if (!/^\d{9,18}$/.test(bank.number)) errors.number = "Enter a 9–18 digit account number."
  if (bank.number !== bank.confirm) errors.confirm = "Account numbers do not match."
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bank.ifsc.trim().toUpperCase())) errors.ifsc = "Enter a valid 11-character IFSC."
  if (bank.bankName.trim().length < 2 || bank.bankName.trim().length > 100) errors.bankName = "Enter your bank name (2–100 characters)."
  if (bank.branchName.trim() && (bank.branchName.trim().length < 2 || bank.branchName.trim().length > 100)) errors.branchName = "Enter a branch name of 2–100 characters."
  if (!bankProofTypes.some(([key]) => key === bank.proofKind)) errors.proofKind = "Choose a proof type."
  if (!bank.proof) errors.proof = "Upload your bank proof."
  else { const invalid = validateImage(bank.proof); if (invalid) errors.proof = invalid }
  return errors
}
export function bankBody(bank: BankDraft, proofMediaId: string) {
  const invalid = validateBank(bank.holder, bank.number, bank.confirm, bank.ifsc)
  if (invalid) throw new Error(invalid)
  return { account_holder: bank.holder.trim(), account_number: bank.number, ifsc: bank.ifsc.trim().toUpperCase(), bank_name: bank.bankName.trim(), branch_name: bank.branchName.trim(), proof_kind: bank.proofKind, proof_media_id: proofMediaId }
}
export function ApplicationField({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: (props: { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined }) => ReactNode }) {
  const id = useId()
  return <div className="ds-field"><label htmlFor={id}>{label}</label>{children({ id, "aria-invalid": Boolean(error), "aria-describedby": error || hint ? id + "-help" : undefined })}{(error || hint) && <span id={id + "-help"} className={error ? "ds-field-error" : "ds-note"}>{error || hint}</span>}</div>
}
export function BankDetails({ value, onChange, errors = {} }: { value: BankDraft; onChange: (bank: BankDraft) => void; errors?: Record<string, string> }) {
  const currentErrors = bankErrors(value)
  errors = Object.fromEntries(Object.entries(errors).filter(([field]) => currentErrors[field]))
  const change = (key: keyof BankDraft, v: string | File | null) => onChange({ ...value, [key]: v })
  return <div className="ds-stack">
    <ApplicationField label="Account holder name *" error={errors.holder} hint="As shown on your bank account.">{props => <input {...props} className="ds-input" autoComplete="off" maxLength={100} value={value.holder} onChange={e => change("holder", e.target.value)} />}</ApplicationField>
    <div className="ds-application-row">
      <ApplicationField label="Account number *" error={errors.number}>{props => <input {...props} className="ds-input" type="password" inputMode="numeric" autoComplete="off" maxLength={18} value={value.number} onChange={e => change("number", e.target.value.replace(/\D/g, ""))} />}</ApplicationField>
      <ApplicationField label="Confirm account number *" error={errors.confirm}>{props => <input {...props} className="ds-input" type="password" inputMode="numeric" autoComplete="off" maxLength={18} value={value.confirm} onChange={e => change("confirm", e.target.value.replace(/\D/g, ""))} />}</ApplicationField>
    </div>
    <div className="ds-application-row">
      <ApplicationField label="IFSC *" error={errors.ifsc}>{props => <input {...props} className="ds-input" autoComplete="off" maxLength={11} value={value.ifsc} onChange={e => change("ifsc", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />}</ApplicationField>
      <ApplicationField label="Bank name *" error={errors.bankName}>{props => <input {...props} className="ds-input" maxLength={100} value={value.bankName} onChange={e => change("bankName", e.target.value)} />}</ApplicationField>
    </div>
    <ApplicationField label="Branch (optional)" error={errors.branchName}>{props => <input {...props} className="ds-input" maxLength={100} value={value.branchName} onChange={e => change("branchName", e.target.value)} />}</ApplicationField>
    <ApplicationField label="Proof type *" error={errors.proofKind}>{props => <select {...props} className="ds-input" value={value.proofKind} onChange={e => onChange({ ...value, proofKind: e.target.value, proof: null })}>{bankProofTypes.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>}</ApplicationField>
    <ApplicationField label="Bank proof *" error={errors.proof} hint={value.proof?.name || "JPG, PNG or WebP · up to 10 MB. Show name, account number and IFSC; hide transactions."}>{props => <input {...props} key={value.proofKind} className="ds-partner-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => change("proof", e.target.files?.[0] ?? null)} />}</ApplicationField>
  </div>
}

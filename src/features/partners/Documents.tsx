"use client"

import { useRef, useState, type FormEvent } from "react"
import { useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { uploadPartnerImage } from "@/features/doorstep/partner/api"
import { validateImage } from "@/features/doorstep/partner/model"
import { partnerFailure } from "./api"
import type { TransportModule } from "./model"

const TYPES = [
  { value: "DRIVING_LICENCE", ride: "driving_license", label: "Driving licence (required)", number: true },
  { value: "PASSPORT", ride: "passport", label: "Passport", number: false },
  { value: "VOTER_ID", ride: "voter_id", label: "Voter ID", number: false },
  { value: "PAN", ride: "pan", label: "PAN card", number: false },
  { value: "VEHICLE_RC", ride: "vehicle_rc", label: "Vehicle registration certificate", number: true },
] as const

export function identityDocumentBody(module: TransportModule, kind: string, number: string, mediaId: string) {
  const type = TYPES.find(choice => choice.value === kind)
  if (!type) throw new Error("Choose a passport, voter ID, driving licence or PAN card.")
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mediaId)) throw new Error("Upload the document image first.")
  if (type.number && (!number.trim() || number.trim().length > 24)) throw new Error("Enter the licence or registration number printed on the document.")
  return { document_type: module === "delivery" ? type.value : type.ride, ...(type.number ? { document_number: number.trim() } : {}), media_id: mediaId, ...(module === "ride" ? { file_url: `/v1/media/${encodeURIComponent(mediaId)}/serve` } : {}) }
}

export function PartnerDocuments({ module, userId }: { module: TransportModule; userId: string }) {
  const [kind, setKind] = useState<string>("DRIVING_LICENCE")
  const [number, setNumber] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const uploaded = useRef<{ file: File; id: string } | null>(null)
  const query = useQueryClient()
  const selected = TYPES.find(type => type.value === kind)!
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current) return
    setError(""); setStatus("")
    if (!file) return setError("Choose a clear image of the document first.")
    const invalid = validateImage(file)
    if (invalid) return setError(invalid)
    if (selected.number && !number.trim()) return setError("Enter the driving-licence number printed on the document.")
    lock.current = true; setBusy(true)
    try {
      const mediaId = uploaded.current?.file === file ? uploaded.current.id : await uploadPartnerImage(file)
      uploaded.current = { file, id: mediaId }
      const body = identityDocumentBody(module, kind, number, mediaId)
      await api.post(module === "delivery" ? "/v1/food/delivery/documents" : "/v1/rider/partners/me/documents", body)
      setStatus(`${selected.label.replace(" (required)", "")} submitted for admin review. Uploading is not approval.`)
      setNumber(""); setFile(null); uploaded.current = null
      await query.invalidateQueries({ queryKey: ["partner", module, userId] })
    } catch (cause) { setError(partnerFailure(cause)) }
    finally { lock.current = false; setBusy(false) }
  }
  return <form className="transport-partner__card" onSubmit={submit}>
    <h2>Identity documents · manual review</h2>
    <p>Every rider must upload a driving licence. An approved licence also counts as identity. Passport, voter ID and PAN are additional identity options. No Aadhaar or DigiLocker is required.</p>
    <fieldset disabled={busy} className="transport-partner__fields">
      <label>Document type *<select value={kind} onChange={event => { setKind(event.target.value); setNumber(""); setFile(null); uploaded.current = null; setError("") }}>{TYPES.filter(type => module === "delivery" || type.value !== "VEHICLE_RC").map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
      {selected.number && <label>{kind === "VEHICLE_RC" ? "Vehicle registration" : "Licence number"} *<input required autoComplete="off" maxLength={24} value={number} onChange={event => setNumber(event.target.value.toUpperCase())} /></label>}
      <label>Document image *<input key={kind} required type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { setFile(event.target.files?.[0] ?? null); uploaded.current = null; setError("") }} /></label>
    </fieldset>
    <p>JPG, PNG or WebP · up to 10 MB. Only submit your own readable document. Vehicle, selfie and payout checks remain separate.</p>
    {error && <p role="alert" className="transport-partner__error">{error}</p>}
    {status && <p role="status">{status}</p>}
    <button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit for review"}</button>
  </form>
}

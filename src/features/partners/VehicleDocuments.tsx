"use client"

import { useRef, useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { uploadPartnerImage } from "@/features/doorstep/partner/api"
import { validateImage } from "@/features/doorstep/partner/model"
import { partnerFailure, rideVehicles } from "./api"

export const VEHICLE_DOCUMENTS = [
  ["vehicle_rc", "Registration certificate"], ["vehicle_insurance", "Insurance"],
  ["pollution_certificate", "Pollution certificate (PUC)"], ["permit", "Permit"],
  ["fitness_certificate", "Fitness certificate"],
] as const
export function vehicleDocumentBody(kind: string, number: string, mediaId: string, expiry: string) {
  if (!VEHICLE_DOCUMENTS.some(([value]) => value === kind)) throw new Error("Choose a vehicle document.")
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(mediaId)) throw new Error("Upload the document first.")
  if (!number.trim() || number.trim().length > 64) throw new Error("Enter the document number (up to 64 characters).")
  if (kind !== "vehicle_rc" && !expiry) throw new Error("Enter the expiry date printed on the document.")
  const date = expiry ? new Date(`${expiry}T23:59:59+05:30`) : null
  if (date && (!Number.isFinite(date.getTime()) || date <= new Date())) throw new Error("Upload a document that has not expired.")
  return { document_type: kind, document_number: number.trim(), media_id: mediaId, file_url: `/v1/media/${mediaId}/serve`, ...(date ? { expires_at: date.toISOString() } : {}) }
}

export function VehicleDocuments({ userId }: { userId: string }) {
  const client = useQueryClient()
  const vehicles = useQuery({ queryKey: ["partner", "ride", userId, "vehicles"], queryFn: ({ signal }) => rideVehicles(signal), retry: false, gcTime: 0 })
  const [vehicle, setVehicle] = useState(""), [kind, setKind] = useState("vehicle_rc"), [number, setNumber] = useState("")
  const [expiry, setExpiry] = useState(""), [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false)
  const [error, setError] = useState(""), [message, setMessage] = useState("")
  const locked = useRef(false), upload = useRef<{ file: File; id: string } | null>(null)
  async function submit(event: FormEvent) {
    event.preventDefault(); if (locked.current) return
    setError(""); setMessage("")
    if (!vehicles.data?.some(v => v.id === vehicle)) { setError("Select your vehicle first."); return }
    if (!file) { setError("Upload a clear document image."); return }
    const invalid = validateImage(file); if (invalid) { setError(invalid); return }
    locked.current = true; setBusy(true)
    try {
      // Validate the fields before starting an upload.
      vehicleDocumentBody(kind, number, "00000000-0000-4000-8000-000000000001", expiry)
      const id = upload.current?.file === file ? upload.current.id : await uploadPartnerImage(file)
      upload.current = { file, id }
      await api.post(`/v1/rider/vehicles/${encodeURIComponent(vehicle)}/documents`, vehicleDocumentBody(kind, number, id, expiry))
      setMessage("Document submitted for admin review."); setFile(null); upload.current = null
      await client.invalidateQueries({ queryKey: ["partner", "ride", userId] })
    } catch (cause) { setError(partnerFailure(cause)) }
    finally { locked.current = false; setBusy(false) }
  }
  return <form className="transport-partner__card" onSubmit={submit}><h2>Vehicle documents</h2><p>Upload registration, current insurance and certificates applicable to your vehicle.</p>
    {vehicles.isError && <p role="alert">Could not load vehicles. <button type="button" onClick={() => void vehicles.refetch()}>Try again</button></p>}
    {!vehicles.isPending && !vehicles.isError && !vehicles.data?.length && <p>Add your vehicle first.</p>}
    <fieldset className="transport-partner__fields" disabled={busy || !vehicles.data?.length}>
      <label>Vehicle *<select required value={vehicle} onChange={e => setVehicle(e.target.value)}><option value="">Select vehicle</option>{vehicles.data?.map(v => <option key={v.id} value={v.id}>{v.registration}</option>)}</select></label>
      <label>Document *<select value={kind} onChange={e => { setKind(e.target.value); setNumber(""); setExpiry(""); setFile(null); upload.current = null }} >{VEHICLE_DOCUMENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Document number *<input required maxLength={64} autoComplete="off" value={number} onChange={e => setNumber(e.target.value)} /></label>
      <label>Expiry date {kind === "vehicle_rc" ? "(if applicable)" : "*"}<input type="date" required={kind !== "vehicle_rc"} value={expiry} onChange={e => setExpiry(e.target.value)} /></label>
      <label>Document image *<input key={`${kind}-${message}`} type="file" required accept="image/jpeg,image/png,image/webp" onChange={e => { setFile(e.target.files?.[0] ?? null); upload.current = null }} /></label>
    </fieldset>
    {error && <p className="transport-partner__error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <button disabled={busy || !vehicles.data?.length}>{busy ? "Submitting…" : "Submit document"}</button>
  </form>
}

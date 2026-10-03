"use client"

/*
  FSSAI licence: number, expiry (after today, IST) and a photo of the
  licence through the web's media upload flow (init → PUT → confirm).
  media-service takes images only, so a PDF licence must be photographed.
*/

import { Upload } from "lucide-react"
import { useEffect, useState } from "react"

import { fetchFssai, putFssai, uploadImage } from "../../api/client"
import { toFailure, type ApiFailure } from "../../model/errors"
import { isFutureDateIST, todayIST } from "../../model/hours"
import { looksLikeAadhaar, validateFSSAILicence } from "../../model/kyc"
import type { Fssai } from "../../model/wire"
import { FailureNotice, Field, formatDate, Notice, Pill, useAction } from "../ui"

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPT = "image/jpeg,image/png,image/webp"

export function FssaiPanel({ restaurantId, onSaved }: { restaurantId: string; onSaved: () => void }) {
  const [current, setCurrent] = useState<Fssai | null>(null)
  const [licence, setLicence] = useState("")
  const [expires, setExpires] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [local, setLocal] = useState<string | null>(null)
  const [loadFailure, setLoadFailure] = useState<ApiFailure | null>(null)
  const [stage, setStage] = useState<"idle" | "uploading" | "saving">("idle")
  const [done, setDone] = useState(false)
  const action = useAction()

  useEffect(() => {
    let live = true
    fetchFssai(restaurantId)
      .then((f) => {
        if (!live) return
        setCurrent(f)
        setLicence(f.licenceNumber ?? "")
        setExpires(f.expiresAt ?? "")
      })
      .catch((e) => {
        const f = toFailure(e)
        if (live && f.code !== "FOOD_ONBOARDING_STEP_NOT_SAVED" && f.code !== "FOOD_NOT_FOUND") setLoadFailure(f)
      })
    return () => {
      live = false
    }
  }, [restaurantId])

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setLocal(null)
    if (f && !ACCEPT.split(",").includes(f.type)) {
      setFile(null)
      return setLocal("Choose a photo (JPG, PNG or WebP) of the licence.")
    }
    if (f && f.size > MAX_BYTES) {
      setFile(null)
      return setLocal("That photo is larger than 10 MB. Choose a smaller one.")
    }
    setFile(f)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setDone(false)
    if (looksLikeAadhaar(licence)) return setLocal("That looks like an Aadhaar number. Enter the 14-digit FSSAI licence number.")
    const l = validateFSSAILicence(licence)
    if (!l.ok) return setLocal(l.message)
    if (!isFutureDateIST(expires)) return setLocal("The expiry date must be after today.")
    if (!file) return setLocal("Add a photo of the licence.")
    setLocal(null)
    setStage("uploading")
    const result = await action.run(async () => {
      const mediaId = await uploadImage(file)
      setStage("saving")
      return putFssai(restaurantId, { licence_number: l.value, expires_at: expires, media_id: mediaId })
    })
    setStage("idle")
    if (result) {
      setCurrent(result)
      setFile(null)
      setDone(true)
      onSaved()
    }
  }

  const status = current?.documentStatus ?? null
  const tone = status === "APPROVED" ? "positive" : status === "REJECTED" ? "danger" : status ? "warning" : "neutral"

  return (
    <form className="kit-form kit-form--2" onSubmit={save} noValidate>
      <FailureNotice failure={loadFailure} />
      {current?.document ? (
        <div className="kit-span">
          <Notice tone={status === "REJECTED" ? "danger" : "info"}>
            Licence on file, expires {formatDate(current.expiresAt)} · <Pill tone={tone}>{status === "APPROVED" ? "Approved" : status === "REJECTED" ? "Rejected" : "In review"}</Pill>
            {status === "REJECTED" && current.reviewReason ? <div style={{ marginTop: 4 }}>Reason: {current.reviewReason}. Upload a new photo below.</div> : null}
          </Notice>
        </div>
      ) : null}
      <Field label="FSSAI licence number" hint="14 digits, as printed on the licence.">
        <input className="kit-input" inputMode="numeric" value={licence} onChange={(e) => setLicence(e.target.value)} maxLength={20} autoComplete="off" />
      </Field>
      <Field label="Expires on">
        <input className="kit-input" type="date" min={todayIST()} value={expires} onChange={(e) => setExpires(e.target.value)} />
      </Field>
      <Field label="Photo of the licence" span hint="A clear photo of the whole licence. JPG, PNG or WebP, up to 10 MB.">
        <input className="kit-input" type="file" accept={ACCEPT} onChange={pick} style={{ paddingTop: 6 }} />
      </Field>
      <div className="kit-span kit-form">
        {local ? <Notice tone="danger">{local}</Notice> : null}
        <FailureNotice failure={action.failure} />
        {done ? <Notice tone="success">Licence sent for review.</Notice> : null}
        <div className="kit-row kit-row--end">
          <button type="submit" className="kit-btn kit-btn--primary" disabled={action.busy}>
            <Upload size={14} aria-hidden />
            {stage === "uploading" ? "Uploading photo…" : stage === "saving" ? "Saving…" : "Upload and save"}
          </button>
        </div>
      </div>
    </form>
  )
}

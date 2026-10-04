"use client"

/*
  /doorstep/addresses — Doorstep's own visit addresses: list, add, make
  default, remove.

  The pin: a rationale first, then ONE browser location read on the
  customer's tap, used only to pin this address. Declining is fine: the pin
  can be pasted by hand as "lat, lng" from any maps app. Before saving,
  POST /serviceability says whether the pin is in an area we serve (the
  server checks again on save).
*/

import { Crosshair, LocateFixed, MapPin, MapPinOff, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"

import { checkServiceability, toDoorstepError } from "../api/client"
import { ErrorState, Skel, StateBlock } from "../components/parts"
import { useChosenAddress, useCreateAddress, useDeleteAddress, useMakeDefault } from "../hooks/queries"
import { addressLine, EMPTY_FORM, formatPin, formBody, parsePin, sortAddresses, validateForm, type AddressForm, type FormErrors } from "../model/address"
import { refusalLine } from "../model/refusals"
import type { Serviceability } from "../model/wire"

type LocState = { kind: "idle" } | { kind: "asking" } | { kind: "locating" } | { kind: "failed"; message: string }
type Check = { kind: "idle" } | { kind: "checking" } | { kind: "done"; result: Serviceability } | { kind: "error"; message: string }

function Field({ label, name, values, errors, onEdit, span, ...rest }: { label: string; name: keyof AddressForm; values: AddressForm; errors: FormErrors; onEdit: (name: keyof AddressForm, value: string) => void; span?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "value" | "onChange" | "form">) {
  const error = errors[name]
  return (
    <label className={span ? "ds-field ds-span" : "ds-field"}>
      {label}
      <input className="ds-input" value={String(values[name] ?? "")} aria-invalid={error ? true : undefined} onChange={(e) => onEdit(name, e.target.value)} {...rest} />
      {error ? <span className="ds-field__error">{error}</span> : null}
    </label>
  )
}

function AddAddress({ onDone, first }: { onDone: (id: string) => void; first: boolean }) {
  const create = useCreateAddress()
  const [form, setForm] = useState<AddressForm>({ ...EMPTY_FORM, isDefault: first })
  const [errors, setErrors] = useState<FormErrors>({})
  const [loc, setLoc] = useState<LocState>({ kind: "idle" })
  const [check, setCheck] = useState<Check>({ kind: "idle" })
  const [refusal, setRefusal] = useState<string | null>(null)
  const pin = parsePin(form.pin)

  // Check the pin whenever it changes.
  useEffect(() => {
    if (!pin) {
      setCheck({ kind: "idle" })
      return
    }
    let gone = false
    setCheck({ kind: "checking" })
    const t = setTimeout(() => {
      checkServiceability(pin.lat, pin.lng)
        .then((result) => !gone && setCheck({ kind: "done", result }))
        .catch((e) => !gone && setCheck({ kind: "error", message: refusalLine(toDoorstepError(e)) }))
    }, 400)
    return () => {
      gone = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin?.lat, pin?.lng])

  const edit = (name: keyof AddressForm, value: string) => {
    setForm((f) => ({ ...f, [name]: value }))
    if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }))
  }

  const locate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLoc({ kind: "failed", message: "This browser can't share a location. Paste the pin instead." })
      return
    }
    setLoc({ kind: "locating" })
    navigator.geolocation.getCurrentPosition(
      (p) => {
        edit("pin", formatPin({ lat: p.coords.latitude, lng: p.coords.longitude }))
        setLoc({ kind: "idle" })
      },
      () => setLoc({ kind: "failed", message: "We couldn't get your location. Paste the pin instead." }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    )
  }

  const outside = check.kind === "done" && !check.result.serviceable

  const save = () => {
    const e = validateForm(form)
    setErrors(e)
    const body = formBody(form)
    if (!body || outside) return
    setRefusal(null)
    create.mutate(body, {
      onSuccess: (a) => onDone(a.id),
      onError: (err) => setRefusal(refusalLine(toDoorstepError(err))),
    })
  }

  return (
    <section className="ds-card" aria-labelledby="ds-add">
      <h2 id="ds-add" className="ds-h2">
        New address
      </h2>

      <div className="ds-stack" style={{ gap: 8 }}>
        {loc.kind === "asking" ? (
          <div className="ds-info">
            <p style={{ margin: "0 0 8px" }}>We use your location once, only to pin this address so we can tell which professionals can reach you. It isn&apos;t tracked or kept apart from the address.</p>
            <div className="ds-row">
              <button type="button" className="ds-btn ds-btn--primary ds-btn--sm" onClick={locate}>
                Use my location
              </button>
              <button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" onClick={() => setLoc({ kind: "idle" })}>
                Not now
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="ds-btn ds-btn--outline ds-btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => setLoc({ kind: "asking" })} disabled={loc.kind === "locating"}>
            <LocateFixed size={14} aria-hidden="true" />
            {loc.kind === "locating" ? "Finding you…" : "Pin with my location"}
          </button>
        )}
        {loc.kind === "failed" ? <p className="ds-note">{loc.message}</p> : null}
      </div>

      <div className="ds-form">
        <Field label="Pin (lat, lng)" name="pin" values={form} errors={errors} onEdit={edit} span placeholder="17.440100, 78.348900" inputMode="decimal" />
        <div className="ds-span">
          {check.kind === "checking" ? <p className="ds-note">Checking the area…</p> : null}
          {check.kind === "done" && check.result.serviceable ? (
            <p className="ds-ok">
              <Crosshair size={12} aria-hidden="true" /> We serve {check.result.zone?.name ?? "this area"}
              {check.result.city ? `, ${check.result.city.name}` : ""}.
            </p>
          ) : null}
          {outside ? (
            <p className="ds-alert">
              <MapPinOff size={12} aria-hidden="true" /> This pin is outside the area we serve.
            </p>
          ) : null}
          {check.kind === "error" ? <p className="ds-note">{check.message}</p> : null}
        </div>
        <Field label="Name" name="label" values={form} errors={errors} onEdit={edit} placeholder="Home" maxLength={40} />
        <Field label="Pincode" name="pincode" values={form} errors={errors} onEdit={edit} inputMode="numeric" maxLength={6} />
        <Field label="House or flat, street" name="line1" values={form} errors={errors} onEdit={edit} span autoComplete="address-line1" />
        <Field label="Area (optional)" name="line2" values={form} errors={errors} onEdit={edit} autoComplete="address-line2" />
        <Field label="Landmark (optional)" name="landmark" values={form} errors={errors} onEdit={edit} />
        <Field label="Locality" name="locality" values={form} errors={errors} onEdit={edit} span placeholder="Gachibowli" />
        <label className="ds-switch ds-span">
          <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} />
          Make this my default
        </label>
      </div>
      <p className="ds-note">A professional sees only the locality until they accept your booking.</p>
      {refusal ? (
        <p className="ds-alert" role="alert">
          {refusal}
        </p>
      ) : null}
      <button type="button" className="ds-btn ds-btn--primary" style={{ alignSelf: "flex-start" }} onClick={save} disabled={create.isPending || outside}>
        {create.isPending ? "Saving…" : "Save address"}
      </button>
    </section>
  )
}

export function AddressesScreen() {
  const { addresses, chosen, choose } = useChosenAddress()
  const makeDefault = useMakeDefault()
  const remove = useDeleteAddress()
  const [adding, setAdding] = useState(false)
  const list = sortAddresses(addresses.data ?? [])

  return (
    <>
      <div className="ds-head">
        <div>
          <h1 className="ds-title">Addresses</h1>
          <p className="ds-sub">Where professionals come to you.</p>
        </div>
        {!adding ? (
          <button type="button" className="ds-btn ds-btn--outline ds-btn--sm" onClick={() => setAdding(true)}>
            <Plus size={14} aria-hidden="true" /> Add address
          </button>
        ) : null}
      </div>

      <div className="ds-stack">
        {adding || (!addresses.isLoading && !addresses.isError && !list.length) ? (
          <AddAddress
            first={!list.length}
            onDone={(id) => {
              choose(id)
              setAdding(false)
            }}
          />
        ) : null}

        {addresses.isLoading ? (
          <Skel h={80} />
        ) : addresses.isError ? (
          <ErrorState error={addresses.error} what="Your addresses" onRetry={() => void addresses.refetch()} />
        ) : !list.length ? (
          <StateBlock icon={<MapPin size={22} />} title="No address yet" text="Add one above to see slots near you." />
        ) : (
          list.map((a) => (
            <section key={a.id} className={chosen?.id === a.id ? "ds-choice is-on" : "ds-choice"} aria-label={a.label}>
              <input type="radio" name="chosen" checked={chosen?.id === a.id} onChange={() => choose(a.id)} aria-label={`Use ${a.label}`} />
              <span className="ds-grow">
                <strong>{a.label}</strong> {a.isDefault ? <span className="ds-tag">Default</span> : null}
                <span className="ds-meta" style={{ display: "block" }}>
                  {addressLine(a)}
                </span>
              </span>
              <span className="ds-row" style={{ flex: "none" }}>
                {!a.isDefault ? (
                  <button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" disabled={makeDefault.isPending} onClick={() => makeDefault.mutate(a)}>
                    Make default
                  </button>
                ) : null}
                <button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" aria-label={`Remove ${a.label}`} disabled={remove.isPending} onClick={() => window.confirm(`Remove ${a.label}?`) && remove.mutate(a.id)}>
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </span>
            </section>
          ))
        )}
        {makeDefault.isError || remove.isError ? (
          <p className="ds-alert" role="alert">
            {refusalLine(toDoorstepError(makeDefault.error ?? remove.error))}
          </p>
        ) : null}
      </div>
    </>
  )
}

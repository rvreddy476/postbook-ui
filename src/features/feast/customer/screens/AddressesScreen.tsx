"use client"

/*
  /feast/addresses — list, add, make default, delete.

  Location: a rationale first, then ONE browser geolocation read on the
  customer's tap, used only to pin this address (the pin is what lets the
  server check who delivers). Declining is fine: the address is typed in by
  hand and simply has no pin. There is no map key, so a calm placeholder
  stands where a map would be.
*/

import { Crosshair, LocateFixed, MapPin, Plus, Trash2 } from "lucide-react"
import { useState } from "react"

import { useGlobalToast } from "@/contexts/ToastContext"

import { toFeastError } from "../api/client"
import { Skel, StateBlock } from "../components/parts"
import { useChosenAddress, useCreateAddress, useDeleteAddress, useMakeDefault } from "../hooks/queries"
import { addressLine, addressTitle, EMPTY_FORM, formBody, pinOf, validateForm, type AddressForm, type FormErrors } from "../model/address"
import { mapsLink } from "../model/tracking"

type LocState = { kind: "idle" } | { kind: "asking" } | { kind: "locating" } | { kind: "pinned" } | { kind: "failed"; message: string }

function Field({
  label,
  name,
  values,
  errors,
  onEdit,
  span,
  ...rest
}: {
  label: string
  name: keyof AddressForm
  values: AddressForm
  errors: FormErrors
  onEdit: (name: keyof AddressForm, value: string) => void
  span?: boolean
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "value" | "onChange" | "form">) {
  const error = errors[name]
  return (
    <label className={span ? "fc-field fc-span" : "fc-field"}>
      {label}
      <input
        className="fc-input"
        value={String(values[name] ?? "")}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onEdit(name, e.target.value)}
        {...rest}
      />
      {error ? <span className="fc-field__error">{error}</span> : null}
    </label>
  )
}

function AddAddress({ onDone, first }: { onDone: (id: string) => void; first: boolean }) {
  const toast = useGlobalToast()
  const create = useCreateAddress()
  const [form, setForm] = useState<AddressForm>({ ...EMPTY_FORM, makeDefault: first })
  const [errors, setErrors] = useState<FormErrors>({})
  const [loc, setLoc] = useState<LocState>({ kind: "idle" })

  const change = (name: keyof AddressForm, value: string) => setForm((f) => ({ ...f, [name]: value }))

  const locate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLoc({ kind: "failed", message: "This browser can't share a location. Type the address instead." })
      return
    }
    setLoc({ kind: "locating" })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }))
        setLoc({ kind: "pinned" })
      },
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? "Location is off for this site. You can still type the address; it just won't have a pin."
            : "Your location couldn't be found. Try again, or type the address."
        setLoc({ kind: "failed", message })
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    )
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const found = validateForm(form)
    setErrors(found)
    if (Object.keys(found).length) return
    create.mutate(formBody(form), {
      onSuccess: (a) => {
        toast({ type: "success", title: "Address saved" })
        onDone(a.id)
      },
    })
  }

  const pinLink = mapsLink({ latitude: form.latitude, longitude: form.longitude })

  return (
    <form className="fc-card" onSubmit={submit} noValidate aria-labelledby="fc-add-title">
      <h2 id="fc-add-title" className="fc-h2">New address</h2>

      <div className="fc-map">
        {loc.kind === "pinned" && form.latitude !== null && form.longitude !== null ? (
          <>
            <LocateFixed size={22} aria-hidden="true" />
            <span>
              Pinned at {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
            </span>
            {pinLink ? (
              <a className="fc-link" href={pinLink} target="_blank" rel="noopener noreferrer">
                Check it on a map
              </a>
            ) : null}
            <button type="button" className="fc-btn fc-btn--ghost fc-btn--sm" onClick={() => { setForm((f) => ({ ...f, latitude: null, longitude: null })); setLoc({ kind: "idle" }) }}>
              Remove pin
            </button>
          </>
        ) : loc.kind === "asking" ? (
          <>
            <Crosshair size={22} aria-hidden="true" />
            <span>
              Feast reads your location once, now, to pin this address so we can check which restaurants deliver to it. It isn&apos;t tracked or shared.
            </span>
            <div className="fc-row">
              <button type="button" className="fc-btn fc-btn--primary fc-btn--sm" onClick={locate}>
                Continue
              </button>
              <button type="button" className="fc-btn fc-btn--ghost fc-btn--sm" onClick={() => setLoc({ kind: "idle" })}>
                Not now
              </button>
            </div>
          </>
        ) : loc.kind === "locating" ? (
          <span role="status">Finding you…</span>
        ) : (
          <>
            <MapPin size={22} aria-hidden="true" />
            <span>{loc.kind === "failed" ? loc.message : "Add a pin so we can check who delivers here."}</span>
            <button type="button" className="fc-btn fc-btn--outline fc-btn--sm" onClick={() => setLoc({ kind: "asking" })}>
              Use my location
            </button>
          </>
        )}
      </div>

      <div className="fc-form">
        <Field label="Name this address" name="label" values={form} errors={errors} onEdit={change} placeholder="Home, Work…" maxLength={40} />
        <Field label="Receiver" name="receiverName" values={form} errors={errors} onEdit={change} autoComplete="name" maxLength={80} />
        <Field label="House, flat, street" name="addressLine1" values={form} errors={errors} onEdit={change} span autoComplete="address-line1" maxLength={200} />
        <Field label="Area (optional)" name="addressLine2" values={form} errors={errors} onEdit={change} autoComplete="address-line2" maxLength={200} />
        <Field label="Landmark (optional)" name="landmark" values={form} errors={errors} onEdit={change} maxLength={120} />
        <Field label="City" name="city" values={form} errors={errors} onEdit={change} autoComplete="address-level2" maxLength={80} />
        <Field label="State (optional)" name="state" values={form} errors={errors} onEdit={change} autoComplete="address-level1" maxLength={80} />
        <Field label="Pincode (optional)" name="postalCode" values={form} errors={errors} onEdit={change} inputMode="numeric" autoComplete="postal-code" maxLength={6} />
        <Field label="Phone (optional)" name="phone" values={form} errors={errors} onEdit={change} inputMode="tel" autoComplete="tel" maxLength={16} />
        <label className="fc-opt fc-span">
          <input type="checkbox" checked={form.makeDefault} onChange={(e) => setForm((f) => ({ ...f, makeDefault: e.target.checked }))} />
          <span>Make this my default address</span>
        </label>
      </div>

      {create.isError ? (
        <p className="fc-alert" role="alert">
          {toFeastError(create.error).message}
        </p>
      ) : null}
      <div className="fc-row">
        <button type="submit" className="fc-btn fc-btn--primary" disabled={create.isPending}>
          {create.isPending ? "Saving…" : "Save address"}
        </button>
      </div>
    </form>
  )
}

export function AddressesScreen() {
  const { addresses, chosen, choose } = useChosenAddress()
  const makeDefault = useMakeDefault()
  const remove = useDeleteAddress()
  const [adding, setAdding] = useState(false)

  const list = [...(addresses.data ?? [])].sort((a, b) => addressTitle(a).localeCompare(addressTitle(b)))
  const writeError = makeDefault.error || remove.error

  return (
    <>
      <div className="fc-head">
        <div>
          <h1 className="fc-title">Delivery addresses</h1>
          <p className="fc-sub">The chosen address decides which restaurants can deliver.</p>
        </div>
        {!adding && list.length ? (
          <button type="button" className="fc-btn fc-btn--outline fc-btn--sm" onClick={() => setAdding(true)}>
            <Plus size={14} aria-hidden="true" /> Add address
          </button>
        ) : null}
      </div>

      <div className="fc-stack">
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
          <>
            <Skel h={64} />
            <Skel h={64} />
          </>
        ) : addresses.isError ? (
          <StateBlock
            icon={<MapPin size={22} />}
            title="Your addresses couldn't be loaded"
            text={toFeastError(addresses.error).message}
            action={
              <button type="button" className="fc-btn fc-btn--outline fc-btn--sm" onClick={() => addresses.refetch()}>
                Try again
              </button>
            }
          />
        ) : (
          list.map((a) => (
            <div key={a.id} className={chosen?.id === a.id ? "fc-choice is-on" : "fc-choice"} style={{ cursor: "default" }}>
              <MapPin size={16} aria-hidden="true" style={{ marginTop: 2, flex: "none" }} />
              <div className="fc-grow">
                <div className="fc-row" style={{ flexWrap: "wrap" }}>
                  <strong>{addressTitle(a)}</strong>
                  {a.isDefault ? <span className="fc-tag">Default</span> : null}
                  {chosen?.id === a.id ? <span className="fc-tag">Delivering here</span> : null}
                </div>
                <div className="fc-meta">{addressLine(a)}</div>
                {!pinOf(a) ? <div className="fc-meta">No map pin</div> : null}
                <div className="fc-row" style={{ marginTop: 6, flexWrap: "wrap" }}>
                  {chosen?.id !== a.id ? (
                    <button type="button" className="fc-btn fc-btn--outline fc-btn--sm" onClick={() => choose(a.id)}>
                      Deliver here
                    </button>
                  ) : null}
                  {!a.isDefault ? (
                    <button type="button" className="fc-btn fc-btn--ghost fc-btn--sm" disabled={makeDefault.isPending} onClick={() => makeDefault.mutate(a)}>
                      Make default
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="fc-btn fc-btn--ghost fc-btn--sm"
                    disabled={remove.isPending}
                    aria-label={`Delete ${addressTitle(a)}`}
                    onClick={() => {
                      if (window.confirm(`Delete “${addressTitle(a)}”?`)) remove.mutate(a.id)
                    }}
                  >
                    <Trash2 size={14} aria-hidden="true" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
        {writeError ? (
          <p className="fc-alert" role="alert">
            {toFeastError(writeError).message}
          </p>
        ) : null}
      </div>
    </>
  )
}

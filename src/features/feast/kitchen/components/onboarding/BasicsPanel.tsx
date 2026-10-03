"use client"

import { useState } from "react"

import { patchBasics } from "../../api/client"
import { paiseToInput, parseRupeesInput } from "../../model/money"
import type { PartnerRestaurant } from "../../model/wire"
import { FailureNotice, Field, Notice, useAction } from "../ui"

/** Name, contact and the two restaurant-level charges. PATCH is partial server-side; we send the whole form. */
export function BasicsPanel({ restaurant, onSaved }: { restaurant: PartnerRestaurant; onSaved: (r: PartnerRestaurant) => void }) {
  const [name, setName] = useState(restaurant.name)
  const [displayName, setDisplayName] = useState(restaurant.displayName ?? restaurant.name)
  const [description, setDescription] = useState(restaurant.description ?? "")
  const [phone, setPhone] = useState(restaurant.phone ?? "")
  const [email, setEmail] = useState(restaurant.email ?? "")
  const [minOrder, setMinOrder] = useState(paiseToInput(restaurant.minOrderPaise))
  const [packaging, setPackaging] = useState(paiseToInput(restaurant.packagingFeePaise))
  const [local, setLocal] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const action = useAction()

  const minPaise = parseRupeesInput(minOrder)
  const packPaise = parseRupeesInput(packaging)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(false)
    if (!name.trim()) return setLocal("Enter the restaurant's name.")
    if (minPaise === null || packPaise === null) return setLocal("Amounts are rupees with up to two decimals, e.g. 99 or 10.50.")
    setLocal(null)
    const r = await action.run(() => patchBasics(restaurant.id, { name, displayName, description, phone, email, minOrderPaise: minPaise, packagingFeePaise: packPaise }))
    if (r) {
      setSaved(true)
      onSaved(r)
    }
  }

  return (
    <form className="kit-form kit-form--2" onSubmit={save} noValidate>
      <Field label="Restaurant name">
        <input className="kit-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required />
      </Field>
      <Field label="Name customers see">
        <input className="kit-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={200} />
      </Field>
      <Field label="Description" span hint="Cuisine and what you're known for.">
        <textarea className="kit-textarea" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
      </Field>
      <Field label="Phone">
        <input className="kit-input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
      </Field>
      <Field label="Email">
        <input className="kit-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </Field>
      <Field label="Minimum order (₹)" error={minPaise === null ? "Up to two decimals." : null}>
        <input className="kit-input" inputMode="decimal" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
      </Field>
      <Field label="Packaging charge per order (₹)" error={packPaise === null ? "Up to two decimals." : null}>
        <input className="kit-input" inputMode="decimal" value={packaging} onChange={(e) => setPackaging(e.target.value)} />
      </Field>
      <div className="kit-span kit-form">
        {local ? <Notice tone="danger">{local}</Notice> : null}
        <FailureNotice failure={action.failure} />
        {saved ? <Notice tone="success">Saved.</Notice> : null}
        <div className="kit-row kit-row--end">
          <button type="submit" className="kit-btn kit-btn--primary" disabled={action.busy}>
            {action.busy ? "Saving…" : "Save basics"}
          </button>
        </div>
      </div>
    </form>
  )
}

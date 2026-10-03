"use client"

/* Shown to a signed-in user who owns no restaurant: start one (status DRAFT). */

import { ChefHat } from "lucide-react"
import { useState } from "react"

import { createRestaurant, type NewRestaurant } from "../api/client"
import { FailureNotice, Field, Notice, useAction } from "./ui"

export function BecomePartner({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<NewRestaurant>({ name: "", displayName: "", legalName: "", phone: "", email: "", addressLine1: "", city: "" })
  const [local, setLocal] = useState<string | null>(null)
  const action = useAction()
  const set = (k: keyof NewRestaurant) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.addressLine1.trim() || !form.city.trim()) return setLocal("Name, address and city are needed to start.")
    if (!form.legalName.trim()) return setLocal("Enter the legal name of the business.")
    setLocal(null)
    const r = await action.run(() => createRestaurant(form))
    if (r) onCreated()
  }

  return (
    <div className="kit-card" style={{ maxWidth: 640, margin: "24px auto" }}>
      <div className="kit-row" style={{ marginBottom: 8 }}>
        <ChefHat size={20} aria-hidden />
        <h1 className="kit-title">Become a restaurant partner</h1>
      </div>
      <p className="kit-lede">
        Feast Kitchen is where restaurants take orders, run their menu and see their earnings. This account doesn&apos;t have a restaurant yet.
        Start one here; you&apos;ll finish location, hours, tax details, FSSAI licence and bank account next, then Feast reviews it.
      </p>
      {!open ? (
        <div className="kit-row" style={{ marginTop: 12 }}>
          <button type="button" className="kit-btn kit-btn--primary" onClick={() => setOpen(true)}>
            Start a restaurant
          </button>
        </div>
      ) : (
        <form className="kit-form kit-form--2" style={{ marginTop: 12 }} onSubmit={submit} noValidate>
          <Field label="Restaurant name">
            <input className="kit-input" value={form.name} onChange={set("name")} maxLength={200} autoFocus />
          </Field>
          <Field label="Legal name of the business" hint="As on the PAN.">
            <input className="kit-input" value={form.legalName} onChange={set("legalName")} maxLength={200} />
          </Field>
          <Field label="Address" span>
            <input className="kit-input" value={form.addressLine1} onChange={set("addressLine1")} maxLength={255} autoComplete="address-line1" />
          </Field>
          <Field label="City">
            <input className="kit-input" value={form.city} onChange={set("city")} maxLength={120} autoComplete="address-level2" />
          </Field>
          <Field label="Phone">
            <input className="kit-input" type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" />
          </Field>
          <Field label="Email" span>
            <input className="kit-input" type="email" value={form.email} onChange={set("email")} autoComplete="email" />
          </Field>
          <div className="kit-span kit-form">
            {local ? <Notice tone="danger">{local}</Notice> : null}
            <FailureNotice failure={action.failure} />
            <div className="kit-row kit-row--end">
              <button type="button" className="kit-btn kit-btn--ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="kit-btn kit-btn--primary" disabled={action.busy}>
                {action.busy ? "Creating…" : "Create restaurant"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}

"use client"

// /shop/sell/start: POST /onboarding/start {store_name, email, seller_type},
// then the wizard. The SellerShell already sends a caller who has a profile
// away from here.

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useStartOnboarding } from "../hooks/sell"
import { SELLER_TYPES, apiMessage, type SellerType } from "../model/sell"
import { Field, Notice, PageHead, Panel, Select, TextField } from "../components/sell/primitives"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function SellerStartScreen() {
  const router = useRouter()
  const start = useStartOnboarding()
  const [storeName, setStoreName] = useState("")
  const [email, setEmail] = useState("")
  const [sellerType, setSellerType] = useState<SellerType>("individual")
  const [attempted, setAttempted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameError = storeName.trim().length < 2 ? "Name your store." : null
  const emailError = !EMAIL_RE.test(email.trim()) ? "Enter the email buyers and reviewers can reach you on." : null

  async function submit() {
    setAttempted(true)
    setError(null)
    if (nameError || emailError) return
    try {
      await start.mutateAsync({ store_name: storeName.trim(), email: email.trim(), seller_type: sellerType })
      router.replace("/shop/sell/onboarding")
    } catch (err) {
      setError(apiMessage(err, "The application could not be started."))
    }
  }

  return (
    <div className="shop-sell-narrow">
      <PageHead title="Sell on MStore" sub="Open a shop in a few steps. A person reviews your documents before it goes live." />
      <Panel>
        <form
          noValidate
          className="shop-sell-form"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <TextField id="start-store" label="Store name" required value={storeName} onChange={setStoreName} error={attempted ? nameError : null} maxLength={120} autoComplete="organization" />
          <TextField id="start-email" label="Contact email" required type="email" inputMode="email" value={email} onChange={setEmail} error={attempted ? emailError : null} autoComplete="email" />
          <Field id="start-type" label="You are selling as">
            <Select id="start-type" value={sellerType} onChange={(e) => setSellerType(e.target.value as SellerType)}>
              {SELLER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === "individual" ? "An individual" : "A business"}
                </option>
              ))}
            </Select>
          </Field>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <div className="shop-sell-actions">
            <Button type="submit" disabled={start.isPending}>
              {start.isPending ? "Starting…" : "Start application"}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  )
}

"use client"

/*
  "Accepting orders" — pause and resume. The server decides: 422
  FOOD_FSSAI_REQUIRED (no approved, in-date licence) and
  FOOD_RESTAURANT_NOT_LIVE (not ACTIVE) are shown as plain reasons, and the
  switch shows what the server answered, never what was pressed.
*/

import { useState } from "react"

import { setAccepting } from "../api/client"
import { kitchenMessage, toFailure } from "../model/errors"
import type { PartnerRestaurant } from "../model/wire"
import { Switch } from "./ui"

export function AcceptingToggle({ restaurant, onChanged }: { restaurant: PartnerRestaurant; onChanged: (accepting: boolean, status: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = async (next: boolean) => {
    if (busy) return
    if (!next && !window.confirm("Pause new orders? Orders already placed still need to be prepared.")) return
    setBusy(true)
    setError(null)
    try {
      const r = await setAccepting(restaurant.id, next)
      onChanged(r.isAcceptingOrders, r.status)
    } catch (e) {
      setError(kitchenMessage(toFailure(e)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="kit-row" style={{ gap: 6 }}>
      <Switch checked={restaurant.isAcceptingOrders} disabled={busy} onChange={(n) => void toggle(n)} label={restaurant.isAcceptingOrders ? "Accepting orders" : "Paused"} />
      {error ? (
        <span className="kit-error" role="alert" style={{ maxWidth: 320 }}>
          {error}
        </span>
      ) : null}
    </div>
  )
}

"use client"

// "What will you sell?" (commerce migration 045): the two-way choice the
// start screen and the wizard's first step share, and the "Sell more
// categories" panel a books-only shop uses to add a GSTIN.

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useGlobalToast } from "@/contexts/ToastContext"
import { useUpgradeSellScope } from "../../hooks/sell"
import { apiMessage } from "../../model/sell"
import { SELL_SCOPES, SELL_SCOPE_HELP, SELL_SCOPE_LABEL, normaliseGSTIN, sellScopeFieldError, validateGSTIN, type SellScope } from "../../model/sellScope"
import { Notice, Panel, TextField } from "./primitives"

export function SellScopeChoice({ value, onChange, disabled }: { value: SellScope; onChange: (next: SellScope) => void; disabled?: boolean }) {
  return (
    <fieldset className="shop-sell-scope" disabled={disabled}>
      <legend className="shop-sell-scope__legend">What will you sell?</legend>
      {SELL_SCOPES.map((scope) => (
        <label key={scope} className={cn("shop-sell-scope__opt", value === scope && "is-chosen", disabled && "is-disabled")}>
          <input type="radio" name="sell-scope" value={scope} checked={value === scope} onChange={() => onChange(scope)} />
          <span>
            <span className="shop-sell-scope__title">
              {SELL_SCOPE_LABEL[scope]}
              {scope === "books_only" ? " (PAN is required)" : ""}
            </span>
            <span className="shop-sell-scope__help">{SELL_SCOPE_HELP[scope]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

/**
 * A books-only shop adds a GSTIN to sell in every category. The GSTIN must be
 * the one issued on the shop's own PAN — the server refuses any other
 * (GSTIN_PAN_MISMATCH) — so the form says so up front.
 */
export function SellMoreCategories({ panMasked }: { panMasked?: string }) {
  const upgrade = useUpgradeSellScope()
  const toast = useGlobalToast()
  const [open, setOpen] = useState(false)
  const [gstin, setGstin] = useState("")
  const [attempted, setAttempted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const localError = validateGSTIN(gstin)

  async function submit() {
    setAttempted(true)
    setError(null)
    if (localError) return
    try {
      await upgrade.mutateAsync(normaliseGSTIN(gstin))
      toast({ type: "success", title: "You can sell in every category now", description: "New listings in other categories still go to review." })
      setOpen(false)
      setGstin("")
    } catch (err) {
      setError(sellScopeFieldError(err)?.message ?? apiMessage(err, "The GSTIN could not be added."))
    }
  }

  return (
    <Panel title="Sell more categories" sub="Your shop sells books only. Add a GSTIN to list in every other category.">
      {!open ? (
        <div className="shop-sell-actions">
          <Button type="button" variant="outline" onClick={() => setOpen(true)}>
            Add a GSTIN
          </Button>
        </div>
      ) : (
        <form noValidate className="shop-sell-upgrade" onSubmit={(e) => { e.preventDefault(); void submit() }}>
          <TextField
            id="upgrade-gstin"
            label="GSTIN"
            required
            value={gstin}
            onChange={(v) => setGstin(v.toUpperCase())}
            error={attempted ? (localError ?? error) : error}
            help={panMasked ? `It must be registered to your PAN ending ${panMasked.slice(-4)}.` : "It must be registered to the PAN your shop was approved with."}
            maxLength={15}
            autoComplete="off"
          />
          <Notice tone="muted">Books stay on GST 0%. Listings in other categories charge the GST rate you choose for them.</Notice>
          <div className="shop-sell-actions">
            <Button type="submit" disabled={upgrade.isPending}>
              {upgrade.isPending ? "Adding…" : "Add GSTIN"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Panel>
  )
}

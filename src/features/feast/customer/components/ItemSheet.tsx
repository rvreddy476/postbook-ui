"use client"

/*
  The size + add-on sheet. Required groups and max_select are enforced here
  for UX (the server checks again); the total is a paise preview.
*/

import { Minus, Plus, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import {
  availableVariants,
  groupHint,
  initialSheet,
  MAX_QUANTITY,
  minimumFor,
  selectVariant,
  setQuantity,
  sheetProblems,
  sheetTotalPaise,
  sortedGroups,
  toggleAddon,
  type SheetState,
} from "../model/itemSheet"
import { formatPaise } from "../model/money"
import type { MenuItem } from "../model/wire"
import { VegMark } from "./parts"

export function ItemSheet({
  item,
  busy,
  error,
  blockedReason,
  onAdd,
  onClose,
}: {
  item: MenuItem
  busy: boolean
  error: string | null
  /** Set when the restaurant can't take this order; "Add" stays off. */
  blockedReason: string | null
  onAdd: (state: SheetState) => void
  onClose: () => void
}) {
  const [state, setState] = useState<SheetState>(() => initialSheet(item))
  const [tried, setTried] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  const problems = sheetProblems(item, state)
  const missing = new Set(problems.map((p) => p.groupId).filter(Boolean))
  const total = sheetTotalPaise(item, state)
  const variants = availableVariants(item)

  const submit = () => {
    setTried(true)
    if (problems.length || blockedReason || busy) return
    onAdd(state)
  }

  return (
    <div className="fc-sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fc-sheet" role="dialog" aria-modal="true" aria-labelledby="fc-sheet-title">
        <div className="fc-sheet__head">
          <VegMark foodType={item.foodType} />
          <div className="fc-grow">
            <h2 id="fc-sheet-title" className="fc-h2">{item.name}</h2>
            {item.description ? <p className="fc-sub">{item.description}</p> : null}
          </div>
          <button ref={closeRef} type="button" className="fc-btn fc-btn--ghost fc-btn--sm" onClick={onClose} aria-label="Close">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="fc-sheet__body">
          {item.variants.length ? (
            <fieldset className="fc-group" style={{ border: 0, margin: 0, padding: 0 }}>
              <div className="fc-group__head">
                <legend className="fc-h2">Size</legend>
                <span className="fc-meta fc-group__hint">Required · choose 1</span>
              </div>
              {item.variants
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((v) => {
                  const off = !variants.includes(v)
                  return (
                    <label key={v.id} className={off ? "fc-opt is-off" : "fc-opt"}>
                      <input type="radio" name="variant" checked={state.variantId === v.id} disabled={off} onChange={() => setState((s) => selectVariant(s, v.id))} />
                      <span className="fc-grow">{v.name}{off ? " · unavailable" : ""}</span>
                      <span className="fc-price">{formatPaise(v.pricePaise)}</span>
                    </label>
                  )
                })}
            </fieldset>
          ) : null}

          {sortedGroups(item).map((g) => {
            const picks = state.picks[g.id] ?? []
            const radio = g.maxSelect === 1 && minimumFor(g) === 1
            const full = g.maxSelect > 0 && picks.length >= g.maxSelect && g.maxSelect !== 1
            return (
              <fieldset key={g.id} className={tried && missing.has(g.id) ? "fc-group is-missing" : "fc-group"} style={{ border: 0, margin: "12px 0 0", padding: 0 }}>
                <div className="fc-group__head">
                  <legend className="fc-h2">{g.name}</legend>
                  <span className="fc-meta fc-group__hint">{groupHint(g)}</span>
                </div>
                {g.addons
                  .slice()
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((a) => {
                    const on = picks.includes(a.id)
                    const off = !a.isAvailable || (!on && full)
                    return (
                      <label key={a.id} className={off ? "fc-opt is-off" : "fc-opt"}>
                        <input
                          type={radio ? "radio" : "checkbox"}
                          name={`g-${g.id}`}
                          checked={on}
                          disabled={off}
                          onChange={() => setState((s) => toggleAddon(s, g, a.id))}
                        />
                        <span className="fc-grow">{a.name}{!a.isAvailable ? " · unavailable" : ""}</span>
                        <span className="fc-meta">+{formatPaise(a.pricePaise)}</span>
                      </label>
                    )
                  })}
              </fieldset>
            )
          })}

          {tried && problems.length ? (
            <p className="fc-alert" role="alert" style={{ marginTop: 12 }}>
              {problems[0].message}
            </p>
          ) : null}
          {blockedReason ? <p className="fc-alert" style={{ marginTop: 12 }}>{blockedReason}</p> : null}
          {error ? (
            <p className="fc-alert" role="alert" style={{ marginTop: 12 }}>
              {error}
            </p>
          ) : null}
        </div>

        <div className="fc-sheet__foot">
          <div className="fc-qty" role="group" aria-label="Quantity">
            <button type="button" aria-label="One fewer" disabled={state.quantity <= 1} onClick={() => setState((s) => setQuantity(s, s.quantity - 1))}>
              <Minus size={14} aria-hidden="true" />
            </button>
            <span aria-live="polite">{state.quantity}</span>
            <button type="button" aria-label="One more" disabled={state.quantity >= MAX_QUANTITY} onClick={() => setState((s) => setQuantity(s, s.quantity + 1))}>
              <Plus size={14} aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            className="fc-btn fc-btn--primary fc-grow"
            onClick={submit}
            disabled={busy || Boolean(blockedReason) || !item.isAvailable}
            aria-disabled={problems.length > 0}
          >
            {busy ? "Adding…" : `Add · ${formatPaise(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

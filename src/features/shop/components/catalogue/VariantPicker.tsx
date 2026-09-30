"use client"

import { optionState, type Selection, type Variant, type VariantAxis } from "../../model/catalogue"

/**
 * One row of buttons per axis (Colour, Size, …). A combination that does
 * not exist is disabled; one that exists with no stock is struck through
 * but still pressable, so the shopper can see it is sold out rather than
 * wonder why it is missing.
 */
export function VariantPicker({ axes, variants, selection, onSelect }: {
  axes: VariantAxis[]
  variants: Variant[]
  selection: Selection
  onSelect: (axis: string, value: string) => void
}) {
  if (axes.length === 0) return null
  return (
    <div className="shop-variants">
      {axes.map((axis) => (
        <fieldset key={axis.name} className="shop-variants__axis" style={{ border: 0, margin: 0, padding: 0 }}>
          <legend className="shop-variants__label">
            {axis.name}{selection[axis.name] ? <>: <b>{selection[axis.name]}</b></> : null}
          </legend>
          <div className="shop-variants__options">
            {axis.values.map((value) => {
              const state = optionState(variants, selection, axis.name, value)
              const pressed = selection[axis.name] === value
              return (
                <button
                  key={value}
                  type="button"
                  className={`shop-variants__option${state === "sold_out" ? " shop-variants__option--sold-out" : ""}`}
                  aria-pressed={pressed}
                  aria-label={state === "sold_out" ? `${value}, sold out` : state === "missing" ? `${value}, not available with this combination` : value}
                  disabled={state === "missing"}
                  onClick={() => onSelect(axis.name, value)}
                >
                  {value}
                </button>
              )
            })}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

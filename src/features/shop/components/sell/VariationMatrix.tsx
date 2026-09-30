"use client"

// Pick up to two axes, pick their values, price every combination. The grid
// and its rules live in ../../model/sellListing; this only draws them.

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  MAX_AXES,
  MAX_COMBINATIONS,
  applyToAll,
  candidateFor,
  countIfAdded,
  matrixRows,
  withRow,
  type AxisCandidate,
  type MatrixRow,
  type MatrixState,
  type RowProblems,
} from "../../model/sellListing"
import { Select } from "./primitives"

export function VariationMatrix({
  candidates,
  value,
  onChange,
  stem,
  problems,
  editing,
}: {
  candidates: AxisCandidate[]
  value: MatrixState
  onChange: (next: MatrixState) => void
  stem: string
  problems: RowProblems
  /** True on an existing product: axes cannot be removed once variants carry them. */
  editing: boolean
}) {
  const rows = matrixRows(value, stem)
  const count = rows.filter((r) => !r.stranded).length

  function setAxis(index: number, code: string) {
    const axes = [...value.axes]
    if (code === "") axes.splice(index, 1)
    else axes[index] = code
    const values = { ...value.values }
    for (const key of Object.keys(values)) if (!axes.includes(key)) delete values[key]
    onChange({ ...value, axes, values })
  }

  function toggleValue(axis: string, option: string) {
    const picked = value.values[axis] ?? []
    const next = picked.includes(option) ? picked.filter((v) => v !== option) : [...picked, option]
    onChange({ ...value, values: { ...value.values, [axis]: next } })
  }

  const usable = candidates.filter((c) => !c.unavailable)

  return (
    <div className="shop-sell-matrix">
      <div className="shop-sell-form__row">
        {Array.from({ length: Math.min(MAX_AXES, value.axes.length + 1) }, (_, i) => {
          const current = value.axes[i] ?? ""
          return (
            <Select key={i} aria-label={`Axis ${i + 1}`} value={current} disabled={editing && !!current} onChange={(e) => setAxis(i, e.target.value)}>
              <option value="">{i === 0 ? "No variants" : "No second axis"}</option>
              {usable
                .filter((c) => c.code === current || !value.axes.includes(c.code))
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
            </Select>
          )
        })}
      </div>
      {candidates.filter((c) => c.unavailable).map((c) => (
        <p key={c.code} className="shop-sell-muted">
          {c.unavailable}
        </p>
      ))}

      {value.axes.map((axis) => {
        const cand = candidateFor(candidates, axis)
        const picked = value.values[axis] ?? []
        return (
          <fieldset key={axis} className="shop-sell-matrix__axis">
            <legend>{cand?.label ?? axis}</legend>
            <div className="shop-sell-checks">
              {(cand?.options ?? []).map((o) => {
                const on = picked.includes(o.code)
                const over = !on && countIfAdded(value, axis, o.code) > MAX_COMBINATIONS
                return (
                  <label key={o.code} className={cn("shop-sell-check", over && "is-disabled")}>
                    <input type="checkbox" checked={on} disabled={over} onChange={() => toggleValue(axis, o.code)} />
                    {o.swatchHex ? <span className="shop-sell-swatch" style={{ background: o.swatchHex }} aria-hidden="true" /> : null}
                    <span>{o.label}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        )
      })}

      {value.axes.length > 0 ? (
        <>
          <p className="shop-sell-muted">
            {count} of at most {MAX_COMBINATIONS} combinations.
          </p>
          {rows.length > 0 ? (
            <div className="shop-sell-matrix__table">
              <table className="shop-sell-table">
                <thead>
                  <tr>
                    <th scope="col">Sell</th>
                    <th scope="col">Combination</th>
                    <th scope="col">SKU</th>
                    <th scope="col">MRP (₹)</th>
                    <th scope="col">Price (₹)</th>
                    <th scope="col">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="shop-sell-matrix__all">
                    <td />
                    <td>Apply to all</td>
                    <td />
                    {(["mrp", "price", "stock"] as const).map((field) => (
                      <td key={field}>
                        <ApplyAll label={field} onApply={(v) => onChange(applyToAll(value, stem, field, v))} />
                      </td>
                    ))}
                  </tr>
                  {rows.map((row) => (
                    <MatrixRowView key={row.key} row={row} axes={value.axes} candidates={candidates} problems={problems[row.key] ?? []} onChange={(next) => onChange(withRow(value, next))} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="shop-sell-muted">Pick at least one value on every axis.</p>
          )}
        </>
      ) : null}
    </div>
  )
}

function ApplyAll({ label, onApply }: { label: string; onApply: (v: string) => void }) {
  return (
    <form
      className="shop-sell-matrix__apply"
      onSubmit={(e) => {
        e.preventDefault()
        const input = (e.currentTarget.elements.namedItem("v") as HTMLInputElement | null)
        if (input && input.value.trim() !== "") onApply(input.value.trim())
      }}
    >
      <Input name="v" aria-label={`${label} for every row`} inputMode="decimal" placeholder="All rows" />
      <Button type="submit" size="sm" variant="ghost">
        Set
      </Button>
    </form>
  )
}

function MatrixRowView({ row, axes, candidates, problems, onChange }: { row: MatrixRow; axes: string[]; candidates: AxisCandidate[]; problems: string[]; onChange: (next: MatrixRow) => void }) {
  const combo = axes
    .map((axis) => {
      const cand = candidateFor(candidates, axis)
      const opt = cand?.options.find((o) => o.code === row.combo[axis])
      return opt?.label ?? row.combo[axis] ?? "?"
    })
    .join(" / ")
  const set = (field: "sku" | "mrp" | "price" | "stock") => (v: string) => onChange({ ...row, [field]: v, dirty: field === "stock" ? row.dirty : true })
  return (
    <>
      <tr className={cn(row.stranded && "is-stranded", !row.included && "is-excluded")}>
        <td>
          <input type="checkbox" aria-label={`Sell ${combo}`} checked={row.included} disabled={row.stranded} onChange={(e) => onChange({ ...row, included: e.target.checked })} />
        </td>
        <td>{row.stranded ? `${row.sku} (not in the grid)` : combo}</td>
        <td>
          <Input aria-label={`SKU for ${combo}`} value={row.sku} disabled={!row.included} onChange={(e) => set("sku")(e.target.value)} />
        </td>
        <td>
          <Input aria-label={`MRP for ${combo}`} inputMode="decimal" value={row.mrp} disabled={!row.included} onChange={(e) => set("mrp")(e.target.value)} />
        </td>
        <td>
          <Input aria-label={`Price for ${combo}`} inputMode="decimal" value={row.price} disabled={!row.included} onChange={(e) => set("price")(e.target.value)} />
        </td>
        <td>
          <Input aria-label={`Stock for ${combo}`} inputMode="numeric" value={row.stock} disabled={!row.included || !!row.variantId} title={row.variantId ? "Adjust stock on the Stock page." : undefined} onChange={(e) => set("stock")(e.target.value)} />
        </td>
      </tr>
      {problems.length > 0 ? (
        <tr className="shop-sell-matrix__problems">
          <td colSpan={6}>
            <p className="shop-sell-field__error">{problems.join(" ")}</p>
          </td>
        </tr>
      ) : null}
    </>
  )
}

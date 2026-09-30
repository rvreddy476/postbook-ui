"use client"

// One control per attribute data type, driven by the definition. The value
// is the tagged union in ../../model/attributes; the control never guesses
// the type from the JSON shape. Money is typed in rupees and held as paise
// through parseMinor; a third decimal is refused, never rounded.

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { formatMinor, parseMinor } from "../../money"
import { isKnownAttributeDataType, optionCode, type AttributeDefinition, type AttributeValue } from "../../model/attributes"
import { Field, Select, Textarea } from "./primitives"

export interface AttributeFieldProps {
  def: AttributeDefinition
  value: AttributeValue | null
  onChange: (next: AttributeValue | null) => void
  error: string | null
}

function optionsFor(def: AttributeDefinition) {
  return (def.values ?? [])
    .filter((v) => v.is_active !== false)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((v) => ({ value: optionCode(v), label: v.label || optionCode(v) }))
    .filter((o) => o.value !== "")
}

export function AttributeField({ def, value, onChange, error }: AttributeFieldProps) {
  const id = `attr-${def.code}`
  const help = def.help_text ?? null

  if (!isKnownAttributeDataType(def.data_type)) {
    return (
      <Field id={id} label={def.label} error={error} help={`This field (${def.data_type}) cannot be edited here yet. Its current value is kept.`} required={def.required}>
        <Input id={id} value={value?.type === "unknown" && value.value != null ? JSON.stringify(value.value) : ""} readOnly disabled />
      </Field>
    )
  }

  switch (def.data_type) {
    case "text":
    case "gtin":
      return (
        <Field id={id} label={def.label} error={error} help={help} required={def.required}>
          <Input
            id={id}
            inputMode={def.data_type === "gtin" ? "numeric" : undefined}
            placeholder={def.placeholder ?? undefined}
            maxLength={def.max_len ?? undefined}
            value={value && (value.type === "text" || value.type === "gtin") ? value.value : ""}
            aria-invalid={!!error}
            onChange={(e) => onChange(e.target.value === "" ? null : { type: def.data_type as "text" | "gtin", value: e.target.value })}
          />
        </Field>
      )
    case "long_text":
      return (
        <Field id={id} label={def.label} error={error} help={help} required={def.required}>
          <Textarea id={id} rows={4} maxLength={def.max_len ?? undefined} placeholder={def.placeholder ?? undefined} value={value?.type === "long_text" ? value.value : ""} aria-invalid={!!error} onChange={(e) => onChange(e.target.value === "" ? null : { type: "long_text", value: e.target.value })} />
        </Field>
      )
    case "boolean":
      return (
        <div className="shop-sell-field">
          <label className="shop-sell-check">
            <input id={id} type="checkbox" checked={value?.type === "boolean" ? value.value : false} onChange={(e) => onChange({ type: "boolean", value: e.target.checked })} />
            <span>{def.label}</span>
          </label>
          {help ? <p className="shop-sell-field__help">{help}</p> : null}
          {error ? <p className="shop-sell-field__error">{error}</p> : null}
        </div>
      )
    case "enum": {
      const options = optionsFor(def)
      if (options.length === 0) {
        return (
          <Field id={id} label={def.label} error={error} help={help ?? "Type the value; this list is looked up on the server."} required={def.required}>
            <Input id={id} value={value?.type === "enum" ? value.value : ""} aria-invalid={!!error} onChange={(e) => onChange(e.target.value === "" ? null : { type: "enum", value: e.target.value })} />
          </Field>
        )
      }
      return (
        <Field id={id} label={def.label} error={error} help={help} required={def.required}>
          <Select id={id} value={value?.type === "enum" ? value.value : ""} aria-invalid={!!error} onChange={(e) => onChange(e.target.value === "" ? null : { type: "enum", value: e.target.value })}>
            <option value="">Choose…</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      )
    }
    case "multi_enum": {
      const picked = value?.type === "multi_enum" ? value.value : []
      const max = def.max_values ?? null
      return (
        <div className="shop-sell-field">
          <span className="shop-sell-field__label">
            {def.label}
            {def.required ? " *" : ""}
          </span>
          <div className="shop-sell-checks" role="group" aria-labelledby={`${id}-label`}>
            {optionsFor(def).map((o) => {
              const on = picked.includes(o.value)
              const full = max !== null && !on && picked.length >= max
              return (
                <label key={o.value} className="shop-sell-check">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={full}
                    onChange={(e) => {
                      const next = e.target.checked ? [...picked, o.value] : picked.filter((v) => v !== o.value)
                      onChange(next.length === 0 ? null : { type: "multi_enum", value: next })
                    }}
                  />
                  <span>{o.label}</span>
                </label>
              )
            })}
          </div>
          {help ? <p className="shop-sell-field__help">{help}</p> : null}
          {error ? <p className="shop-sell-field__error">{error}</p> : null}
        </div>
      )
    }
    case "integer":
      return (
        <Field id={id} label={def.label} error={error} help={help} required={def.required}>
          <Input
            id={id}
            inputMode="numeric"
            value={value?.type === "integer" && Number.isFinite(value.value) ? String(value.value) : ""}
            aria-invalid={!!error}
            onChange={(e) => {
              const t = e.target.value.trim()
              if (t === "") return onChange(null)
              if (!/^-?\d+$/.test(t)) return
              onChange({ type: "integer", value: Number(t) })
            }}
          />
        </Field>
      )
    case "decimal":
      return (
        <Field id={id} label={def.label} error={error} help={help} required={def.required}>
          <Input id={id} inputMode="decimal" value={value?.type === "decimal" ? value.value : ""} aria-invalid={!!error} onChange={(e) => onChange(e.target.value === "" ? null : { type: "decimal", value: e.target.value })} />
        </Field>
      )
    case "money_minor":
      return <MoneyField id={id} def={def} value={value} onChange={onChange} error={error} />
    case "measure": {
      const unit = value?.type === "measure" ? value.unit : def.default_unit || def.units?.[0]?.code || ""
      return (
        <Field id={id} label={def.label} error={error} help={help} required={def.required}>
          <div className="shop-sell-form__row">
            <Input id={id} inputMode="decimal" value={value?.type === "measure" ? value.value : ""} aria-invalid={!!error} onChange={(e) => onChange(e.target.value === "" ? null : { type: "measure", value: e.target.value, unit })} />
            {def.units && def.units.length > 0 ? (
              <Select aria-label={`${def.label} unit`} value={unit} onChange={(e) => onChange({ type: "measure", value: value?.type === "measure" ? value.value : "", unit: e.target.value })}>
                {def.units.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.label || u.code}
                  </option>
                ))}
              </Select>
            ) : unit ? (
              <span className="shop-sell-muted">{unit}</span>
            ) : null}
          </div>
        </Field>
      )
    }
    case "date":
      return (
        <Field id={id} label={def.label} error={error} help={help} required={def.required}>
          <Input id={id} type="date" value={value?.type === "date" ? value.value : ""} aria-invalid={!!error} onChange={(e) => onChange(e.target.value === "" ? null : { type: "date", value: e.target.value })} />
        </Field>
      )
    case "media":
      return (
        <Field id={id} label={def.label} error={error} help={help ?? "Attach images in the Images step; this field takes media ids."} required={def.required}>
          <Input id={id} value={value?.type === "media" ? value.value.join(", ") : ""} aria-invalid={!!error} onChange={(e) => {
            const ids = e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
            onChange(ids.length === 0 ? null : { type: "media", value: ids })
          }} />
        </Field>
      )
  }
}

function MoneyField({ id, def, value, onChange, error }: { id: string } & AttributeFieldProps) {
  const [text, setText] = useState(value?.type === "money_minor" ? formatMinor(value.value) : "")
  const [local, setLocal] = useState<string | null>(null)
  return (
    <Field id={id} label={`${def.label} (₹)`} error={error ?? local} help={def.help_text ?? null} required={def.required}>
      <Input
        id={id}
        inputMode="decimal"
        value={text}
        aria-invalid={!!(error ?? local)}
        onChange={(e) => {
          const t = e.target.value
          setText(t)
          if (t.trim() === "") {
            setLocal(null)
            onChange(null)
            return
          }
          const minor = parseMinor(t)
          if (minor === null) {
            setLocal("Rupees with at most two decimals.")
            return
          }
          setLocal(null)
          onChange({ type: "money_minor", value: minor })
        }}
      />
    </Field>
  )
}

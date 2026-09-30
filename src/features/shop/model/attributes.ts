// The schema-driven attribute engine: the wire types of
// GET /v1/commerce/categories/:id/attribute-schema, the tagged working value a
// form holds per attribute, and the pure validation the listing editor runs
// before it asks the server. No React here, so every rule runs in a test.
//
// Ported from atpost-web-ui packages/form (validate/values/errors), then
// re-read against commerce-service internal/service/attributes.go: the
// definition's bounds travel as `min_num`/`max_num` (numbers, measures, money),
// `min_len`/`max_len` (text) and `max_values` (multi_enum, media). The
// reference read `min`/`max`, which the handler never writes, so its range
// checks could not fire. The rules below use the keys that exist.

// ── Wire: what the schema route sends ───────────────────────────

export type AttributeDataType =
  | "text"
  | "long_text"
  | "integer"
  | "decimal"
  | "money_minor"
  | "boolean"
  | "enum"
  | "multi_enum"
  | "date"
  | "measure"
  | "media"
  | "gtin"

export const ATTRIBUTE_DATA_TYPES: readonly AttributeDataType[] = [
  "text",
  "long_text",
  "integer",
  "decimal",
  "money_minor",
  "boolean",
  "enum",
  "multi_enum",
  "date",
  "measure",
  "media",
  "gtin",
]

/** The server owns the vocabulary; a type this build has never seen must still parse. */
export type AnyAttributeDataType = AttributeDataType | (string & {})

export function isKnownAttributeDataType(value: string): value is AttributeDataType {
  return (ATTRIBUTE_DATA_TYPES as readonly string[]).includes(value)
}

export type AttributeScope = "item" | "offer"

/** One option of an enum / multi_enum (service.AttributeOptionDoc). */
export interface AttributeEnumValue {
  code: string
  label: string
  sort_order?: number
  swatch_hex?: string | null
  swatch_media_id?: string | null
  /** Not on the wire today; read defensively so a retired option can be hidden if it ever is. */
  is_active?: boolean
}

/** postgres.AttributeUnit. */
export interface AttributeUnit {
  family?: string
  code: string
  label: string
  factor_to_base?: number
  sort_order?: number
}

/** service.AttributeFieldDoc. */
export interface AttributeDefinition {
  code: string
  label: string
  data_type: AnyAttributeDataType
  required: boolean
  scope: AttributeScope
  help_text?: string | null
  placeholder?: string | null
  regex?: string | null
  min_num?: number | null
  max_num?: number | null
  min_len?: number | null
  max_len?: number | null
  max_values?: number | null
  is_filterable?: boolean
  is_searchable?: boolean
  is_variant_axis: boolean
  sort_order?: number
  values?: AttributeEnumValue[]
  unit_family?: string | null
  default_unit?: string | null
  units?: AttributeUnit[]
  lookup_endpoint: string | null
}

export interface AttributeGroup {
  name: string
  sort_order: number
  attributes: AttributeDefinition[]
}

export interface AttributeSchema {
  category_id: string
  category_path: string[]
  schema_version: number
  variation_axes: string[]
  groups: AttributeGroup[]
}

// ── The form's working value ────────────────────────────────────

export type AttributeValue =
  | { type: "text"; value: string }
  | { type: "long_text"; value: string }
  | { type: "integer"; value: number }
  /** Exact decimal string, never a float. */
  | { type: "decimal"; value: string }
  /** Integer paise. */
  | { type: "money_minor"; value: number }
  | { type: "boolean"; value: boolean }
  | { type: "enum"; value: string }
  | { type: "multi_enum"; value: string[] }
  /** "yyyy-mm-dd". */
  | { type: "date"; value: string }
  | { type: "measure"; value: string; unit: string }
  /** Media ids in display order. */
  | { type: "media"; value: string[] }
  | { type: "gtin"; value: string }
  /** Carried verbatim so an edit round-trips a field this build cannot draw. */
  | { type: "unknown"; data_type: string; value: unknown }

export type AttributeValueMap = Record<string, AttributeValue | null | undefined>

// ── Errors ──────────────────────────────────────────────────────

export type FieldError =
  | { kind: "required" }
  | { kind: "too_short"; min: number; actual: number }
  | { kind: "too_long"; max: number; actual: number }
  | { kind: "out_of_range"; min: number | null; max: number | null; actual: string }
  | { kind: "pattern"; regex: string | null }
  | { kind: "not_in_enum"; allowed: string[]; received: string[] }
  | { kind: "type_mismatch"; expected: string; received: string }
  | { kind: "stale"; expected_version: number | null; actual_version: number | null }
  | { kind: "server"; message: string; code?: string }

export type FieldErrorMap = Record<string, FieldError>

export function fieldErrorMessage(error: FieldError, label = "This field"): string {
  switch (error.kind) {
    case "required":
      return `${label} is required`
    case "too_short":
      return `${label} must be at least ${error.min} (got ${error.actual})`
    case "too_long":
      return `${label} must be at most ${error.max} (got ${error.actual})`
    case "out_of_range": {
      if (error.min !== null && error.max !== null) return `${label} must be between ${error.min} and ${error.max}`
      if (error.min !== null) return `${label} must be at least ${error.min}`
      if (error.max !== null) return `${label} must be at most ${error.max}`
      return `${label} is out of range`
    }
    case "pattern":
      return `${label} is not in the expected format`
    case "not_in_enum":
      return `${label} has a choice that is no longer offered`
    case "type_mismatch":
      return `${label} expected ${error.expected} but received ${error.received}`
    case "stale":
      return "This category's form changed. Reload before submitting."
    case "server":
      return error.message
  }
}

/** The server's per-field refusals over the local verdicts; the server wins. */
export function mergeServerErrors(
  local: FieldErrorMap,
  server: Record<string, { message: string; code?: string }>,
): FieldErrorMap {
  const merged: FieldErrorMap = { ...local }
  for (const [code, detail] of Object.entries(server)) {
    merged[code] = { kind: "server", message: detail.message, code: detail.code }
  }
  return merged
}

// ── Values ──────────────────────────────────────────────────────

/** True when the field carries no answer. `false` on a boolean IS an answer. */
export function isEmptyValue(value: AttributeValue | null | undefined): boolean {
  if (value === null || value === undefined) return true
  switch (value.type) {
    case "text":
    case "long_text":
    case "enum":
    case "gtin":
    case "date":
    case "decimal":
    case "measure":
      return value.value.trim() === ""
    case "integer":
    case "money_minor":
      return !Number.isFinite(value.value)
    case "boolean":
      return false
    case "multi_enum":
    case "media":
      return value.value.length === 0
    case "unknown":
      return (
        value.value === null ||
        value.value === undefined ||
        (typeof value.value === "string" && value.value.trim() === "") ||
        (Array.isArray(value.value) && value.value.length === 0)
      )
  }
}

/** The blank an unfilled control holds. Numbers are null: NaN does not survive JSON. */
export function emptyValueFor(def: AttributeDefinition): AttributeValue | null {
  if (!isKnownAttributeDataType(def.data_type)) {
    return { type: "unknown", data_type: def.data_type, value: null }
  }
  switch (def.data_type) {
    case "text":
    case "long_text":
    case "enum":
    case "gtin":
    case "date":
    case "decimal":
      return { type: def.data_type, value: "" }
    case "measure":
      return { type: "measure", value: "", unit: def.default_unit || def.units?.[0]?.code || "" }
    case "integer":
    case "money_minor":
      return null
    case "boolean":
      return { type: "boolean", value: false }
    case "multi_enum":
      return { type: "multi_enum", value: [] }
    case "media":
      return { type: "media", value: [] }
  }
}

export function allDefinitions(groups: { attributes: AttributeDefinition[] }[]): AttributeDefinition[] {
  return groups.flatMap((g) => g.attributes ?? [])
}

export function expectedValueType(def: AttributeDefinition): string {
  return isKnownAttributeDataType(def.data_type) ? def.data_type : "unknown"
}

/** The option's identity as `options[].value` must carry it: the CODE. */
export function optionCode(value: AttributeEnumValue): string {
  return (value.code || "").trim()
}

// ── Validation ──────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const DECIMAL = /^-?(?:\d+)(?:\.\d+)?$/
const GTIN_LENGTHS = new Set([8, 12, 13, 14])

function isRealCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const [y, m, d] = value.split("-").map(Number)
  if (m < 1 || m > 12 || d < 1) return false
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return d <= lengths[m - 1]
}

/** GS1 mod-10 check digit. */
export function isValidGtin(value: string): boolean {
  if (!/^\d+$/.test(value) || !GTIN_LENGTHS.has(value.length)) return false
  const digits = value.split("").map(Number)
  const check = digits.pop() as number
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

function rangeError(def: AttributeDefinition, numeric: number, actual: string): FieldError | null {
  const min = num(def.min_num)
  const max = num(def.max_num)
  if (min !== null && numeric < min) return { kind: "out_of_range", min, max, actual }
  if (max !== null && numeric > max) return { kind: "out_of_range", min, max, actual }
  return null
}

function countError(def: AttributeDefinition, count: number): FieldError | null {
  const max = num(def.max_values)
  if (max !== null && count > max) return { kind: "too_long", max, actual: count }
  return null
}

function allowedOptions(def: AttributeDefinition): string[] | null {
  // No inline list: the options live behind `lookup_endpoint` and membership is the server's call.
  if (!def.values || def.values.length === 0) return null
  return def.values.map(optionCode).filter((v) => v !== "")
}

function textError(def: AttributeDefinition, text: string): FieldError | null {
  const min = num(def.min_len)
  const max = num(def.max_len)
  if (min !== null && text.length < min) return { kind: "too_short", min, actual: text.length }
  if (max !== null && text.length > max) return { kind: "too_long", max, actual: text.length }
  if (def.regex) {
    let re: RegExp
    try {
      re = new RegExp(def.regex)
    } catch {
      // A pattern this engine cannot compile is the server's problem; never block a submit on it.
      return null
    }
    if (!re.test(text)) return { kind: "pattern", regex: def.regex }
  }
  return null
}

export function validateField(def: AttributeDefinition, value: AttributeValue | null | undefined): FieldError | null {
  if (value === null || value === undefined) return def.required ? { kind: "required" } : null

  const expected = expectedValueType(def)
  if (value.type !== expected) return { kind: "type_mismatch", expected, received: value.type }

  if (isEmptyValue(value)) return def.required ? { kind: "required" } : null

  // An unknown data type is carried, not judged.
  if (!isKnownAttributeDataType(def.data_type)) return null

  switch (value.type) {
    case "text":
    case "long_text":
      return textError(def, value.value)
    case "gtin": {
      const text = value.value.trim()
      if (!isValidGtin(text)) return { kind: "pattern", regex: def.regex ?? null }
      return textError(def, text)
    }
    case "integer": {
      if (!Number.isInteger(value.value)) return { kind: "pattern", regex: null }
      return rangeError(def, value.value, String(value.value))
    }
    case "decimal": {
      const text = value.value.trim()
      if (!DECIMAL.test(text)) return { kind: "pattern", regex: def.regex ?? null }
      return rangeError(def, Number(text), text)
    }
    case "money_minor": {
      // min_num/max_num on a money attribute are minor units too.
      if (!Number.isSafeInteger(value.value)) return { kind: "pattern", regex: null }
      return rangeError(def, value.value, String(value.value))
    }
    case "boolean":
      return null
    case "enum": {
      const allowed = allowedOptions(def)
      if (allowed && !allowed.includes(value.value)) return { kind: "not_in_enum", allowed, received: [value.value] }
      return null
    }
    case "multi_enum": {
      const allowed = allowedOptions(def)
      if (allowed) {
        const stray = value.value.filter((v) => !allowed.includes(v))
        if (stray.length > 0) return { kind: "not_in_enum", allowed, received: stray }
      }
      return countError(def, value.value.length)
    }
    case "date":
      if (!isRealCalendarDate(value.value)) return { kind: "pattern", regex: ISO_DATE.source }
      return null
    case "measure": {
      const text = value.value.trim()
      if (!DECIMAL.test(text)) return { kind: "pattern", regex: def.regex ?? null }
      if (def.units && def.units.length > 0) {
        const codes = def.units.map((u) => u.code)
        if (!codes.includes(value.unit)) return { kind: "not_in_enum", allowed: codes, received: [value.unit] }
      }
      return rangeError(def, Number(text), text)
    }
    case "media":
      return countError(def, value.value.length)
    case "unknown":
      return null
  }
}

/** At most one error per field, keyed by code; an empty map means "can submit". */
export function validate(schema: AttributeSchema, values: AttributeValueMap): FieldErrorMap {
  const errors: FieldErrorMap = {}
  for (const group of schema.groups ?? []) {
    for (const def of group.attributes ?? []) {
      const error = validateField(def, values[def.code])
      if (error) errors[def.code] = error
    }
  }
  return errors
}

/** "3 of 5" per group. Only required attributes count, and only valid answers count as filled. */
export function groupProgress(
  group: AttributeGroup,
  values: AttributeValueMap,
): { filledRequired: number; totalRequired: number } {
  let filledRequired = 0
  let totalRequired = 0
  for (const def of group.attributes ?? []) {
    if (!def.required) continue
    totalRequired += 1
    const value = values[def.code]
    if (!isEmptyValue(value) && validateField(def, value) === null) filledRequired += 1
  }
  return { filledRequired, totalRequired }
}

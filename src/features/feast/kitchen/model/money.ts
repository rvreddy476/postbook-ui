/*
  Money in the Kitchen console is INTEGER PAISE, end to end.

  - Reading: every amount the console shows comes from a `*_paise` field.
    The float-rupee siblings food-service still sends (`base_price`,
    `final_amount`, …) are never read for display or arithmetic.
  - Typing: a partner types rupees ("225.50"); `parseRupeesInput` turns the
    TEXT into paise without ever going through a float.
  - Sending: the routes that only take float rupees (dish create/update,
    restaurant basics) get `paiseToWireRupees(paise)`, computed at the wire
    boundary from the integer. Variants and add-ons send `price_paise` only.
*/

export type Paise = number

export class MoneyError extends Error {}

/** Asserts an integer, non-negative paise amount. */
export function assertPaise(value: unknown, field = "amount"): Paise {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new MoneyError(`${field} must be a whole number of paise`)
  }
  return value
}

const RUPEES_INPUT = /^(\d{1,7})(?:\.(\d{1,2}))?$/

/**
 * "225", "225.5", "225.50", "₹ 1,225.50" → paise. Null for anything else
 * (three decimals, negatives, letters, empty). No floating point.
 */
export function parseRupeesInput(text: string): Paise | null {
  const cleaned = text.replace(/[₹,\s]/g, "")
  const m = RUPEES_INPUT.exec(cleaned)
  if (!m) return null
  const rupees = Number.parseInt(m[1], 10)
  const fraction = (m[2] ?? "").padEnd(2, "0")
  const paise = rupees * 100 + Number.parseInt(fraction || "0", 10)
  return Number.isSafeInteger(paise) ? paise : null
}

/** Paise → the text a partner edits ("225.50"). */
export function paiseToInput(paise: Paise): string {
  assertPaise(paise)
  const rupees = Math.floor(paise / 100)
  const rest = paise % 100
  return `${rupees}.${String(rest).padStart(2, "0")}`
}

/**
 * Paise → the float-rupee number a legacy route reads. Exact for every
 * integer paise value: n/100 has a shortest decimal form with at most two
 * fraction digits, which is what JSON.stringify writes.
 */
export function paiseToWireRupees(paise: Paise): number {
  assertPaise(paise)
  return paise / 100
}

/**
 * A float-rupee field from a route that has no `_paise` sibling yet
 * (restaurant min order and packaging fee) → paise, through its decimal TEXT
 * so 0.1 + 0.2 style drift never reaches a total. Null when it is not a
 * finite, non-negative amount with at most two decimals.
 */
export function wireRupeesToPaise(value: unknown): Paise | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null
  return parseRupeesInput(String(value))
}

const INR = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 64912 → "₹649.12". Grouping is Indian (₹1,00,000.00). */
export function formatPaise(paise: Paise): string {
  assertPaise(paise)
  const rupees = Math.floor(paise / 100)
  const rest = paise % 100
  // Format the rupee part as an integer and append the paise digits, so the
  // formatter never sees a fractional float.
  const whole = INR.format(rupees).replace(/\.00$/, "")
  return `₹${whole}.${String(rest).padStart(2, "0")}`
}

/** Signed variant for adjustments shown as deductions. */
export function formatDeduction(paise: Paise): string {
  return paise === 0 ? formatPaise(0) : `− ${formatPaise(paise)}`
}

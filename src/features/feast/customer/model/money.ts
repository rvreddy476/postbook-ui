/*
  Feast money is integer paise, end to end.

  food-service sends `*_paise` integers beside the legacy rupee decimals
  (`unit_price: 250`, `final_amount: 649.12`). The paise fields win whenever
  they are present. The few rupee-only fields (a restaurant's minimum order,
  its delivery-fee estimate) are converted through their decimal STRING, never
  `rupees * 100`: `12.34 * 100` is 1233.9999999999998.

  Nothing here adds tax. The server's `taxes_and_charges` and
  `final_amount_paise` are shown as sent; the only sums this file does are a
  selection preview (base + add-ons) before anything reaches the server.
*/

const DECIMAL = /^(-)?(\d+)(?:\.(\d{1,2}))?$/

/**
  A rupee decimal (as JSON gave it) in integer paise, or null when it is not
  a plain amount with at most two decimals. No float multiplication.
*/
export function rupeesToPaise(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  let s: string
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null
    s = String(raw)
  } else if (typeof raw === "string") {
    s = raw.trim()
  } else {
    return null
  }
  const m = DECIMAL.exec(s)
  if (!m) return null
  const whole = Number(m[2])
  const frac = Number((m[3] ?? "").padEnd(2, "0"))
  const paise = whole * 100 + frac
  if (!Number.isSafeInteger(paise)) return null
  return m[1] ? -paise : paise
}

/** True for a value that may stand for an amount: a safe integer. */
export function isPaise(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value)
}

/** Adds paise; throws rather than carry a float or an overflow into a total. */
export function addPaise(...values: number[]): number {
  let total = 0
  for (const v of values) {
    if (!isPaise(v)) throw new Error(`not a paise amount: ${String(v)}`)
    total += v
  }
  if (!Number.isSafeInteger(total)) throw new Error("paise overflow")
  return total
}

/** quantity × unit, both integers. */
export function timesPaise(unit: number, quantity: number): number {
  if (!isPaise(unit) || !Number.isSafeInteger(quantity)) throw new Error("not integers")
  const out = unit * quantity
  if (!Number.isSafeInteger(out)) throw new Error("paise overflow")
  return out
}

/** "₹649.12", "₹99" — Indian grouping, paise only when there are any. Integer arithmetic only. */
export function formatPaise(paise: number): string {
  if (!isPaise(paise)) return "₹—"
  const negative = paise < 0
  const abs = Math.abs(paise)
  const rupees = Math.floor(abs / 100)
  const rest = abs % 100
  const grouped = groupIndian(String(rupees))
  const body = rest ? `${grouped}.${String(rest).padStart(2, "0")}` : grouped
  return `${negative ? "−" : ""}₹${body}`
}

function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits
  const last3 = digits.slice(-3)
  let head = digits.slice(0, -3)
  const parts: string[] = []
  while (head.length > 2) {
    parts.unshift(head.slice(-2))
    head = head.slice(0, -2)
  }
  if (head) parts.unshift(head)
  return `${parts.join(",")},${last3}`
}

/*
  Doorstep money is integer paise end to end (`*_paise` on the wire).

  Customer prices include GST: the server's quote carries the split
  (taxable + tax) and the total, and the screens show those as sent. The only
  sums done here are a selection PREVIEW before the quote exists (option ×
  quantity + add-ons) and the extras totals on a booking; both refuse a
  float or an overflow rather than carry one into a total.
*/

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

/** unit × quantity, both integers. */
export function timesPaise(unit: number, quantity: number): number {
  if (!isPaise(unit) || !Number.isSafeInteger(quantity)) throw new Error("not integers")
  const out = unit * quantity
  if (!Number.isSafeInteger(out)) throw new Error("paise overflow")
  return out
}

/** "₹1,799", "₹2,248.50" — Indian grouping, paise only when there are any. Integer arithmetic only. */
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

/** "18%" from basis points, "5%" — "2.5%" when not whole. */
export function formatRateBps(bps: number): string {
  if (!Number.isSafeInteger(bps) || bps < 0) return ""
  const whole = Math.floor(bps / 100)
  const rest = bps % 100
  return rest ? `${whole}.${String(rest).padStart(2, "0").replace(/0$/, "")}%` : `${whole}%`
}

/** Percentage off the MRP, rounded down; null when there is no real discount. */
export function percentOff(pricePaise: number, mrpPaise: number | null): number | null {
  if (!isPaise(pricePaise) || mrpPaise === null || !isPaise(mrpPaise) || mrpPaise <= pricePaise || mrpPaise <= 0) return null
  return Math.floor(((mrpPaise - pricePaise) * 100) / mrpPaise)
}

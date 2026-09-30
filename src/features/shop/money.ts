// Money in the shop is integer paise, end to end. commerce-service's P0 routes
// (cart, quote, checkout, orders, payment intent) speak `*_minor` only, and the
// one thing this file refuses to do is put an amount through a JS float:
// `12.34 * 100` is 1233.9999999999998, and a listing priced a paisa off is a
// bug nobody notices until the money is wrong.
//
// There is deliberately NO rupee-float formatter here. The old shop had one
// (`inr(value)`) for the pre-P0 quote that sent float rupees; that quote is
// gone, and keeping two formatters is how ₹12.99 gets rendered as ₹1,299.

/** Digits with optional decimals. Grouping and noise are stripped before this. */
const NUMERIC = /^(\d+)?(?:\.(\d*))?$/

const CURRENCY_NOISE = /^(?:₹|rs\.?|inr)/i

/**
 * Parse a rupee amount typed by a human into integer paise.
 *
 * Accepts surrounding whitespace, a ₹ / Rs / INR prefix, internal spaces and
 * comma grouping in either the Indian ("1,23,456") or the Western ("123,456")
 * style. Answers `null`, never a guess, for anything else: more than two
 * decimals (we refuse rather than round someone's money), exponents, several
 * dots, stray commas, a bare "." or sign, or a value that is not a safe
 * integer once in paise.
 *
 * `-` is accepted because refunds and adjustments are negative; a caller that
 * only wants a price range-checks the result.
 */
export function parseMinor(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null
    // Through the string form so "at most two decimals" still bites, and a
    // float that has already drifted (0.1 + 0.2) shows its drift.
    return parseMinor(String(raw))
  }
  let s = raw.trim()
  if (!s) return null
  s = s.replace(CURRENCY_NOISE, "").trim()
  let negative = false
  if (s.startsWith("-") || s.startsWith("+")) {
    negative = s.startsWith("-")
    s = s.slice(1).trim()
  }
  s = s.replace(CURRENCY_NOISE, "").trim()
  s = s.replace(/\s/g, "")
  if (!s) return null
  if (s.includes(",")) {
    if (/^,|,,|,$|\.\d*,/.test(s)) return null
    s = s.replace(/,/g, "")
  }
  const match = NUMERIC.exec(s)
  if (!match) return null
  const whole = match[1] ?? ""
  const frac = match[2] ?? ""
  if (!whole && !frac) return null
  if (frac.length > 2) return null
  const minor = Number(whole || "0") * 100 + Number(frac.padEnd(2, "0"))
  if (!Number.isSafeInteger(minor)) return null
  return negative ? -minor : minor
}

/**
 * Integer paise → the plain "1234.50" an input shows. No grouping, no symbol:
 * those are the view's, see `inrMinor`. Answers "" for a value it cannot read.
 */
export function formatMinor(minor: number | null | undefined): string {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return ""
  const negative = minor < 0
  const abs = Math.abs(Math.trunc(minor))
  const text = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`
  return negative ? `-${text}` : text
}

/**
 * Integer paise → "₹1,299" / "₹1,299.50" (Indian grouping; the paise are
 * dropped when there are none). A value that cannot be read renders as "—",
 * because a total we cannot read is not "free".
 */
export function inrMinor(minor: number | null | undefined): string {
  const text = formatMinor(minor)
  if (!text) return "—"
  const negative = text.startsWith("-")
  const [rupees, paise] = (negative ? text.slice(1) : text).split(".")
  const grouped = Number(rupees).toLocaleString("en-IN")
  const body = paise === "00" ? grouped : `${grouped}.${paise}`
  return `${negative ? "−" : ""}₹${body}`
}

/** "MRP ₹1,999" strike-through helper: the saving as a whole percentage, or null when there is none. */
export function discountPercent(mrpMinor: number | null | undefined, priceMinor: number | null | undefined): number | null {
  if (!mrpMinor || !priceMinor || mrpMinor <= priceMinor || mrpMinor <= 0) return null
  return Math.floor(((mrpMinor - priceMinor) * 100) / mrpMinor)
}

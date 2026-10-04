/*
  B1: the customer picks the professional.

    service → options → address → PROFESSIONALS → quote (pro_id) → book → pay

  GET /services/{id}/professionals lists the approved professionals who
  can do the selection at the address: each card has the professional's own
  GST-inclusive price for exactly this selection, a rating, a DISTANCE BAND
  (never an exact distance or location: the wire has no field for one and
  nothing here prints anything but the band's words), and either their next
  free starts (scheduled) or an ETA (as soon as possible).

  ASAP with nobody on duty answers no_professional plus
  `scheduled_alternatives`: the screen shows those straight away as a
  scheduled list, keeping every choice already made (the selection and the
  address live in the URL), and a pick from it is a timed pick — never ASAP.

  The server sorts (price | rating | soonest); the screen sends the sort
  and keeps the server's order.
*/

import { formatPaise } from "./money"
import { DEFAULT_ZONE, formatSlot, formatTime } from "./slots"
import type { DistanceBand, ListMode, ProfessionalCard, ProfessionalList, ProSort, Quote, Unit } from "./wire"

/* ── units and "from" prices ──────────────────────────────────────── */

const UNIT_WORDS: Record<Unit, string> = { per_job: "per job", per_hour: "per hour", per_month: "per month" }

/** "per job", "per hour", "per month"; "" for a unit this client does not know. */
export function unitWord(unit: string): string {
  return (UNIT_WORDS as Record<string, string>)[unit] ?? ""
}

/** The quantity stepper's label: hours and months are counted, a job is a quantity. */
export function quantityLabel(unit: string): string {
  if (unit === "per_hour") return "Hours"
  if (unit === "per_month") return "Months"
  return "Quantity"
}

/**
  "From ₹699" (+ " per hour" when a unit is given): the lowest approved
  professional price. Null when nobody prices it yet — the screen says so
  instead of inventing a price (the city's suggested price is never shown as
  one: it is never charged).
*/
export function fromPriceLabel(paise: number | null, unit?: string): string | null {
  if (paise === null || !Number.isSafeInteger(paise)) return null
  const u = unit ? unitWord(unit) : ""
  return `From ${formatPaise(paise)}${u ? ` ${u}` : ""}`
}

/* ── one card, as the customer reads it ───────────────────────────── */

const DISTANCE_WORDS: Record<DistanceBand, string> = {
  under_2_km: "Under 2 km away",
  "2_to_5_km": "2–5 km away",
  "5_to_10_km": "5–10 km away",
  over_10_km: "Over 10 km away",
}

/** The band's words. Anything else (a lenient decode of an unknown value) is never printed raw. */
export function distanceLabel(band: string): string {
  return (DISTANCE_WORDS as Record<string, string>)[band] ?? "Distance not shown"
}

/** "★ 4.7 (10)" style parts; "New" until someone has rated them. */
export function ratingLabel(card: Pick<ProfessionalCard, "ratingAvg" | "ratingCount">): string {
  if (card.ratingAvg === null || card.ratingCount <= 0) return "New"
  return `${card.ratingAvg.toFixed(1)} (${card.ratingCount})`
}

export interface CardTime {
  start: string
  label: string
}

export interface CardView {
  name: string
  rating: string
  jobs: string
  distance: string
  price: string
  /** "Kitchen deep cleaning - Occupied kitchen · ₹1,699", one per line, with the unit when it is not per job. */
  lines: string[]
  /** Timed picks (scheduled); [] for ASAP. */
  times: CardTime[]
  /** "Arrives in about 15 min" (ASAP only), else null. */
  eta: string | null
  sameDay: boolean
}

/**
  What a card shows. `mode` is how the card is offered (ASAP cards show an
  ETA and no times; scheduled cards show their free starts, time only when
  the list is for one date). Only the band is shown for distance.
*/
export function cardView(card: ProfessionalCard, mode: ListMode, opts: { zone?: string; oneDate?: boolean } = {}): CardView {
  const zone = opts.zone || DEFAULT_ZONE
  return {
    name: card.firstName,
    rating: ratingLabel(card),
    jobs: card.jobsCompleted === 1 ? "1 job" : `${card.jobsCompleted} jobs`,
    distance: distanceLabel(card.distanceBand),
    price: formatPaise(card.price.totalPaise),
    lines: card.price.lines.map((l) => {
      const u = l.unit !== "per_job" ? ` (${l.quantity} × ${formatPaise(l.unitPricePaise)} ${unitWord(l.unit)})` : l.quantity > 1 ? ` (${l.quantity} × ${formatPaise(l.unitPricePaise)})` : ""
      return `${l.name}${u} · ${formatPaise(l.lineTotalPaise)}`
    }),
    times: mode === "scheduled" ? card.nextSlots.map((s) => ({ start: s.start, label: opts.oneDate ? formatTime(s.start, zone) : formatSlot(s.start, zone) })) : [],
    eta: mode === "asap" && card.etaMinutes !== null ? `Arrives in about ${card.etaMinutes} min` : null,
    sameDay: card.sameDay,
  }
}

/* ── the list's outcome: cards, nobody now (with alternatives), or nobody ─ */

export type ListOutcome =
  | { kind: "cards"; mode: ListMode; cards: ProfessionalCard[] }
  /** ASAP found nobody: show the scheduled alternatives at once, as a scheduled list. */
  | { kind: "asap_none"; alternatives: ProfessionalCard[] }
  | { kind: "empty"; mode: ListMode }

export function listOutcome(list: Pick<ProfessionalList, "mode" | "items" | "noProfessional" | "scheduledAlternatives">): ListOutcome {
  if (list.mode === "asap" && (list.noProfessional || list.items.length === 0)) return { kind: "asap_none", alternatives: list.scheduledAlternatives }
  if (!list.items.length) return { kind: "empty", mode: list.mode }
  return { kind: "cards", mode: list.mode, cards: list.items }
}

/** The mode a list's cards are offered in: the alternatives of an empty ASAP list are timed picks. */
export function offeredMode(outcome: ListOutcome): ListMode {
  if (outcome.kind === "asap_none") return "scheduled"
  return outcome.mode
}

/* ── a pick ───────────────────────────────────────────────────────── */

export type ProPick = { proId: string; asap: true; etaMinutes: number } | { proId: string; asap: false; slotStart: string }

/**
  A pick the card actually offers, else null: ASAP only from a card with an
  ETA (an ASAP list's own card), a time only from the card's own free
  starts. A card from the scheduled alternatives has no ETA, so it can only
  be picked for a time.
*/
export function pickFor(card: ProfessionalCard, how: { asap: true } | { slotStart: string }): ProPick | null {
  if ("asap" in how) return card.etaMinutes !== null ? { proId: card.proId, asap: true, etaMinutes: card.etaMinutes } : null
  const t = Date.parse(how.slotStart)
  if (Number.isNaN(t) || !card.nextSlots.some((s) => Date.parse(s.start) === t)) return null
  return { proId: card.proId, asap: false, slotStart: how.slotStart }
}

/* ── the queries ──────────────────────────────────────────────────── */

export interface ProListQuery {
  serviceId: string
  optionId: string
  quantity: number
  addonIds: string[]
  addressId: string
  mode: ListMode
  /** YYYY-MM-DD (IST); null: the next free starts from now. Never sent with ASAP. */
  date: string | null
  sort: ProSort
  requireFemalePro: boolean
}

/** GET /services/{id}/professionals' query: addon_id repeated, asap XOR date. */
export function professionalsSearch(q: ProListQuery): URLSearchParams {
  const p = new URLSearchParams()
  p.set("option_id", q.optionId)
  p.set("quantity", String(q.quantity))
  for (const id of q.addonIds) p.append("addon_id", id)
  p.set("address_id", q.addressId)
  if (q.mode === "asap") p.set("asap", "true")
  else if (q.date) p.set("date", q.date)
  p.set("sort", q.sort)
  if (q.requireFemalePro) p.set("require_female_pro", "true")
  return p
}

export interface BookingProQuery {
  mode: ListMode
  date: string | null
  sort: ProSort
}

/** GET /bookings/{id}/professionals' query (the booking's own selection and address). */
export function bookingProfessionalsSearch(q: BookingProQuery): URLSearchParams {
  const p = new URLSearchParams()
  if (q.mode === "asap") p.set("asap", "true")
  else if (q.date) p.set("date", q.date)
  p.set("sort", q.sort)
  return p
}

/* ── the steps' URLs ──────────────────────────────────────────────── */

export interface ListView {
  mode: ListMode
  date: string | null
  sort: ProSort
}

const SORTS: readonly string[] = ["price", "rating", "soonest"]
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** The list's view (mode, date, sort) read from the URL; anything unknown is the default. */
export function listViewFromParams(params: Pick<URLSearchParams, "get">): ListView {
  const mode: ListMode = params.get("mode") === "asap" ? "asap" : "scheduled"
  const date = params.get("date")
  const sort = params.get("sort") ?? ""
  return { mode, date: mode === "scheduled" && date && DATE_RE.test(date) ? date : null, sort: (SORTS.includes(sort) ? sort : "price") as ProSort }
}

/**
  The professionals step for these choices. `selection` is the sheet's
  params (option, qty, addon…, female); the view and the address are added.
  Switching mode, date or sort rebuilds this URL from the same selection, so
  no choice is lost.
*/
export function prosHref(serviceId: string, selection: URLSearchParams, addressId: string, view: ListView): string {
  const p = new URLSearchParams(selection)
  for (const k of ["address", "mode", "date", "sort"]) p.delete(k)
  p.set("address", addressId)
  if (view.mode === "asap") p.set("mode", "asap")
  else if (view.date) p.set("date", view.date)
  if (view.sort !== "price") p.set("sort", view.sort)
  return `/doorstep/s/${encodeURIComponent(serviceId)}/pros?${p.toString()}`
}

/** Just the sheet's params out of a professionals-step URL (to go back and change something). */
export function selectionOnly(params: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams()
  for (const k of ["option", "qty", "addon", "female"]) for (const v of params.getAll(k)) p.append(k, v)
  return p
}

/** The selection a quote was made for, as the sheet's params (to list professionals again from checkout). */
export function selectionFromQuote(q: Pick<Quote, "optionId" | "quantity" | "lines">, female: boolean): URLSearchParams {
  const p = new URLSearchParams()
  p.set("option", q.optionId)
  p.set("qty", String(q.quantity))
  for (const l of q.lines) if (l.kind === "addon") p.append("addon", l.refId)
  if (female) p.set("female", "1")
  return p
}

/** Checkout for a quote and a pick. The first name is only for display; the quote names the professional. */
export function checkoutHref(input: { quoteId: string; addressId: string; female: boolean; pick: ProPick; name: string }): string {
  const p = new URLSearchParams()
  p.set("quote", input.quoteId)
  p.set("address", input.addressId)
  if (input.female) p.set("female", "1")
  if (input.pick.asap) {
    p.set("asap", "1")
    p.set("eta", String(input.pick.etaMinutes))
  } else p.set("slot", input.pick.slotStart)
  if (input.name) p.set("name", input.name)
  return `/doorstep/checkout?${p.toString()}`
}

/* ── the booking body ─────────────────────────────────────────────── */

export interface BookingBody {
  quote_id: string
  address_id: string
  slot_start?: string
  asap?: true
  require_female_pro: boolean
  notes?: string
}

/** POST /bookings: exactly one of slot_start or asap=true. */
export function bookingBody(input: { quoteId: string; addressId: string; when: { asap: true } | { slotStart: string }; female: boolean; notes?: string }): BookingBody {
  const body: BookingBody = { quote_id: input.quoteId, address_id: input.addressId, require_female_pro: input.female }
  if ("asap" in input.when) body.asap = true
  else body.slot_start = input.when.slotStart
  const notes = input.notes?.trim()
  if (notes) body.notes = notes
  return body
}

/* ── the date chips ───────────────────────────────────────────────── */

/** Today in the city's zone, YYYY-MM-DD. */
export function cityToday(now: number, zone = DEFAULT_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(now))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  return `${get("year")}-${get("month")}-${get("day")}`
}

/** `count` city dates from today. */
export function cityDates(now: number, count: number, zone = DEFAULT_ZONE): string[] {
  const [y, m, d] = cityToday(now, zone).split("-").map(Number)
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(y, m - 1, d + i, 12)).toISOString().slice(0, 10))
}

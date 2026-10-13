import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { ProfessionalBooking, ProfessionalBookingCard, ProfessionalDateControls, type ProfessionalBookingProps } from "../components/ProfessionalBooking"
import { DEFAULT_PRO_FILTERS, filterProfessionals, hasProfessionalFilters, matchesTimeWindow, professionalChoice, resolveProfessionalChoice } from "../model/professionalBrowse"
import { pickFor } from "../model/professionals"
import { STRICT } from "../model/decode"
import { decodeAddress, decodeProfessionalList, decodeServicePage } from "../model/wire"
import { formatPaise } from "../model/money"
import { fixtureData } from "./fixtures"

const NOW = Date.parse("2026-10-04T03:00:00Z")
const list = () => decodeProfessionalList(fixtureData("service_professionals_get_200"), STRICT)
const props = (): ProfessionalBookingProps => ({
  service: decodeServicePage(fixtureData("service_get_200"), STRICT).service,
  address: decodeAddress(fixtureData("address_post_201"), STRICT),
  optionLabel: "Occupied kitchen", addonNames: ["Chimney cleaning"], female: false,
  backHref: "/doorstep/s/test?option=test", contextKey: "test-selection",
  view: { mode: "scheduled", sort: "price", date: "2026-10-05" }, now: NOW,
  list: list(), loading: false, refreshing: false, error: null, busy: false,
  blocked: null, refusal: null, onViewChange() {}, onRetry() {}, onContinue() {},
})

describe("professional booking dashboard", () => {
  test("filters prices and real ratings without mutating or reordering server results", () => {
    const data = list().items
    const original = JSON.stringify(data)
    expect(filterProfessionals(data, "scheduled", DEFAULT_PRO_FILTERS, NOW).map(c => c.proId)).toEqual(data.map(c => c.proId))
    expect(filterProfessionals(data, "scheduled", { ...DEFAULT_PRO_FILTERS, minRating: 4.5 }, NOW).map(c => c.firstName)).toEqual(["Asha"])
    expect(filterProfessionals(data, "scheduled", { ...DEFAULT_PRO_FILTERS, maxPricePaise: 210000 }, NOW).map(c => c.firstName)).toEqual(["Ravi"])
    expect(JSON.stringify(data)).toBe(original)
    expect(hasProfessionalFilters(DEFAULT_PRO_FILTERS)).toBe(false)
    expect(hasProfessionalFilters({ ...DEFAULT_PRO_FILTERS, minRating: 4 })).toBe(true)
  })

  test("time filters use India time rather than the browser timezone", () => {
    expect(matchesTimeWindow("2026-10-05T06:29:00Z", "morning")).toBe(true)
    expect(matchesTimeWindow("2026-10-05T06:30:00Z", "afternoon")).toBe(true)
    expect(matchesTimeWindow("2026-10-05T11:30:00Z", "evening")).toBe(true)
    expect(matchesTimeWindow("invalid", "any")).toBe(false)
    const morning = filterProfessionals(list().items, "scheduled", { ...DEFAULT_PRO_FILTERS, time: "morning" }, NOW)
    expect(morning.map(card => card.firstName)).toEqual(["Ravi"])
    expect(morning.flatMap(card => card.nextSlots).every(slot => matchesTimeWindow(slot.start, "morning"))).toBe(true)
    expect(filterProfessionals(list().items, "scheduled", DEFAULT_PRO_FILTERS, Date.parse("2026-10-06"))).toEqual([])
  })

  test("selection resolves only for the same service, address, time and price", () => {
    const data = list(), card = data.items[0]
    const pick = pickFor(card, { slotStart: card.nextSlots[0].start })!
    const choice = professionalChoice(pick, card, "context")
    expect(resolveProfessionalChoice(data, choice, "context", NOW)?.card.proId).toBe(card.proId)
    expect(resolveProfessionalChoice(data, choice, "another-address", NOW)).toBe(null)
    expect(resolveProfessionalChoice(undefined, choice, "context", NOW)).toBe(null)
    expect(resolveProfessionalChoice(data, choice, "context", Date.parse(card.nextSlots[0].start))).toBe(null)
    const removed = structuredClone(data)
    removed.items[0].nextSlots = []
    expect(resolveProfessionalChoice(removed, choice, "context", NOW)).toBe(null)
    const changed = structuredClone(data)
    changed.items[0].price.totalPaise += 100
    expect(resolveProfessionalChoice(changed, choice, "context", NOW)).toBe(null)
    const unavailable = { ...data, items: [] }
    expect(resolveProfessionalChoice(unavailable, choice, "context", NOW)).toBe(null)
  })

  test("ASAP alternatives stay scheduled and ETA changes invalidate ASAP selections", () => {
    const data = list(), card = data.items[0]
    const scheduled = professionalChoice(pickFor(card, { slotStart: card.nextSlots[0].start })!, card, "context")
    const alternatives = { ...data, mode: "asap" as const, items: [], scheduledAlternatives: [card], noProfessional: true }
    expect(resolveProfessionalChoice(alternatives, scheduled, "context", NOW)?.pick.asap).toBe(false)
    const asapCard = { ...card, etaMinutes: 25, nextSlots: [] }
    const asapList = { ...data, mode: "asap" as const, items: [asapCard] }
    const choice = professionalChoice(pickFor(asapCard, { asap: true })!, asapCard, "context")
    expect(resolveProfessionalChoice(asapList, choice, "context", NOW)?.pick.asap).toBe(true)
    expect(resolveProfessionalChoice({ ...asapList, items: [{ ...asapCard, etaMinutes: 35 }] }, choice, "context", NOW)).toBe(null)
    expect(resolveProfessionalChoice(alternatives, choice, "context", NOW)).toBe(null)
  })

  test("dashboard includes real people, prices and service details without reference-image inventions", () => {
    const input = props(), html = renderToStaticMarkup(<ProfessionalBooking {...input} />)
    expect(html).toContain("Choose your professional")
    for (const card of input.list!.items) {
      expect(html).toContain(card.firstName)
      expect(html).toContain(formatPaise(card.price.totalPaise))
    }
    expect(html).toContain("New professional")
    expect(html).toContain("10 reviews")
    expect(html).toContain("Chimney cleaning")
    expect(html).toContain(input.address.line1)
    expect(html).toContain('aria-label="Your service and appointment"')
    expect(html).toContain('aria-label="Time slot"')
    expect(html).not.toContain("background checked")
    expect(html).not.toContain("years experience")
    expect(html).not.toContain("Satisfaction Guarantee")
    expect(html).not.toContain("released only after")
    expect(html).not.toContain("maps.googleapis.com")
    expect((html.match(/Next: Review &amp; pay/g) ?? []).length).toBe(2)
    expect((html.match(/disabled=""/g) ?? []).length).toBe(2)
  })

  test("dates are bounded and all filters are properly labelled", () => {
    const html = renderToStaticMarkup(<ProfessionalDateControls view={props().view} now={NOW} disabled={false} onChange={() => {}} />)
    expect(html).toContain('min="2026-10-04"')
    expect(html).toContain('max="2026-10-10"')
    expect(html).toContain('aria-label="Choose appointment date"')
    expect(html).toContain('aria-pressed="true"')
    const asap = renderToStaticMarkup(<ProfessionalDateControls view={{ ...props().view, mode: "asap" }} now={NOW} disabled={false} onChange={() => {}} />)
    expect(asap).not.toContain('type="date"')
  })

  test("a selected card exposes one real selected slot and accessible pricing", () => {
    const card = list().items[1]
    const selected = pickFor(card, { slotStart: card.nextSlots[0].start })!
    const html = renderToStaticMarkup(<ProfessionalBookingCard card={card} selected={selected} mode="scheduled" zone="Asia/Kolkata" oneDate={true} serviceName="Kitchen cleaning" disabled={false} onSelect={() => {}} />)
    expect(html).toContain('class="dsc-professional is-selected"')
    expect(html).toContain("Selected")
    expect(html).toContain("Price details")
    expect(html).toContain("Asha&#x27;s available times")
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(2)
  })

  test("empty, loading, refusal and blocked states remain distinct", () => {
    const input = props()
    expect(renderToStaticMarkup(<ProfessionalBooking {...input} list={{ ...input.list!, items: [] }} />)).toContain("No available professionals")
    expect(renderToStaticMarkup(<ProfessionalBooking {...input} loading />)).toContain("Loading professionals")
    expect(renderToStaticMarkup(<ProfessionalBooking {...input} blocked="Pay your dues to book again." />)).toContain("Pay your dues")
    expect(renderToStaticMarkup(<ProfessionalBooking {...input} refusal="This time is no longer available." />)).toContain('role="alert"')
  })
})

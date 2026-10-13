import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { BookingSteps } from "../components/BookingJourney"
import { CheckoutReview, type CheckoutReviewProps } from "../components/CheckoutReview"
import { ProList } from "../components/ProfessionalPicker"
import { STRICT } from "../model/decode"
import { decodeQuote, decodeAddress, decodeProfessionalList } from "../model/wire"
import { formatPaise } from "../model/money"
import { fixtureData } from "./fixtures"
import { decodeBooking, decodeServicePage } from "../model/wire"
import { initialSelection, quoteBody, toggleAddon } from "../model/selection"
import { timeline } from "../model/booking"
import { Timeline } from "../screens/BookingDetailScreen"

const defaults = (): CheckoutReviewProps => ({
  quote: decodeQuote(fixtureData("quote_get_200"), STRICT),
  address: decodeAddress(fixtureData("address_post_201"), STRICT),
  name: "Test professional", female: false, asap: false, eta: null,
  slot: "2026-10-10T04:30:00Z", notes: "", onNotes() {},
  slotPicker: <div>Available appointment times</div>, changeHref: "/doorstep/s/test/pros",
  blocked: null, busy: false, onBook() {},
})
const render = (changes: Partial<CheckoutReviewProps> = {}) => renderToStaticMarkup(<CheckoutReview {...defaults()} {...changes} />)

describe("connected booking journey", () => {
  test("automatic appointments never ask the customer to choose a professional or pay before acceptance", () => {
    const props = defaults()
    props.quote.assignmentMode = "automatic"
    const html = render(props)
    expect(html).toContain("Request this appointment")
    expect(html).toContain("Nothing to pay now")
    expect(html).toContain("Assigned by Doorstep")
    expect(html).not.toContain("Test professional")
    expect(html).not.toContain("Selected professional")
    expect(html).not.toContain("Continue to payment")
    expect(html).not.toContain("select someone else")
    const steps = renderToStaticMarkup(<BookingSteps active={1} automatic />)
    expect(steps).toContain("Date &amp; time")
    expect(steps).not.toContain("Professional &amp; time")
  })
  test("automatic quotes omit a professional even if one is passed", () => {
    const service = decodeServicePage(fixtureData("service_get_200"), STRICT).service
    service.assignmentMode = "automatic"
    const group = service.addonGroups[0]
    const selection = toggleAddon(group, initialSelection(service), group.addons[0].id)
    const body = quoteBody(service, selection, { lat: 17.4, lng: 78.5 }, "untrusted-professional")
    expect(body).not.toBeNull()
    expect(body).not.toHaveProperty("pro_id")
  })
  test("automatic timeline reflects acceptance before payment and does not ask for a second payment on replacement", () => {
    const booking = decodeBooking(fixtureData("booking_get_200"), STRICT)
    booking.assignmentMode = "automatic"
    booking.status = "matching"
    booking.statusHistory = []
    booking.paidPaise = 0
    expect(timeline(booking).slice(0,3).map(s=>s.status)).toEqual(["matching","pending_payment","assigned"])
    booking.paidPaise = booking.totalPaise
    expect(timeline(booking).filter(s=>s.state==="todo").map(s=>s.status)).not.toContain("pending_payment")
  })
  test("one current step and completed previous steps", () => {
    const html = renderToStaticMarkup(<BookingSteps active={2} />)
    expect(html.match(/aria-current="step"/g)).toHaveLength(1)
    expect(html.match(/class="is-complete"/g)).toHaveLength(2)
    expect(html).toContain("Professional &amp; time")
  })
  test("paid progress has completed checks, one waiting step, and no false assignment", () => {
    const booking = decodeBooking(fixtureData("booking_get_200"), STRICT)
    const html = renderToStaticMarkup(<Timeline booking={booking} />)
    expect(html.match(/class="ds-step is-done"/g)).toHaveLength(2)
    expect(html.match(/aria-current="step"/g)).toHaveLength(1)
    expect(html).toContain("Payment confirmed")
    expect(html).toContain("Awaiting professional acceptance")
    expect(html).not.toContain("Professional assigned")
    booking.assignmentMode = "automatic"
    booking.status = "assigned"
    booking.statusHistory = []
    expect(timeline(booking)[0]).toMatchObject({ label: "Payment confirmed · appointment booked", state: "done" })
    expect(timeline(booking)[1]).toMatchObject({ label: "Waiting for your visit to begin", state: "current" })
  })
  test("review shows the real quote, address and optional instructions together", () => {
    const props = defaults()
    const html = render(props)
    expect(html).toContain(props.address!.line1)
    expect(html).toContain(formatPaise(props.quote.totalPaise))
    expect(html).toContain("Test professional")
    expect(html).toContain("Optional")
    expect(html).toContain("India Standard Time")
    expect(html).toContain('maxLength="500"')
    expect(html).toContain("call your verified mobile number")
    expect(html).not.toContain('type="password"')
    expect(html).not.toContain("Cash on delivery")
    expect(html).not.toContain("card number")
  })
  test("appointment is compact but picker remains mounted for availability updates", () => {
    expect(render()).toContain('class="dsc-time-editor" hidden=""')
    expect(render()).toContain("Available appointment times")
    const withoutTime = render({ slot: null, blocked: "Pick a time." })
    expect(withoutTime).not.toContain('class="dsc-time-editor" hidden=""')
    expect(withoutTime.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(2)
  })
  test("missing address or outstanding dues disables both payment controls", () => {
    const html = render({ address: null, blocked: "Review your location." })
    expect(html).toContain('role="alert"')
    expect(html.match(/disabled=""/g)).toHaveLength(2)
    expect(render({ blocked: "Pay your dues to book again." })).toContain("Pay your dues")
  })
  test("ASAP does not offer a conflicting scheduled-time editor", () => {
    const html = render({ asap: true, eta: 35, slot: null })
    expect(html).toContain("Arrives in about 35 minutes")
    expect(html).not.toContain("Available appointment times")
    expect(html).toContain("subject to professional acceptance")
  })
  test("reserving prevents double presses and explains progress", () => {
    const html = render({ busy: true })
    expect(html.match(/disabled=""/g)).toHaveLength(2)
    expect(html).toContain("Reserving your appointment")
  })
  test("new bookings select a time before continuing, existing changes retain direct picking", () => {
    const list = decodeProfessionalList(fixtureData("service_professionals_get_200"), STRICT)
    const props = { list, loading: false, error: null, busy: false, onRetry() {}, onPick() {}, onSwitchToScheduled() {}, emptyText: "No availability." }
    const html = renderToStaticMarkup(<ProList {...props} confirmPick />)
    expect(html).toContain("Select a time to continue")
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain("Prices include GST")
    const existing = renderToStaticMarkup(<ProList {...props} />)
    expect(existing).not.toContain("Select a time to continue")
  })
})

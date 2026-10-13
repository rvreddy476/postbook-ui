import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { DoorstepApiError } from "../api/client"
import { AvailabilityState, ErrorState } from "../components/parts"
import { refusalLine } from "../model/refusals"

describe("customer availability presentation", () => {
  test("a hidden or unavailable endpoint is not misreported as no nearby services", () => {
    const html = renderToStaticMarkup(<ErrorState error={new DoorstepApiError(404, "HTTP_404", "Not found", false)} what="Nearby services" onRetry={() => {}} />)
    expect(html).toContain("We couldn’t check service availability")
    expect(html).not.toContain("No home services available")
    expect(html).toContain('role="status"')
    expect(html).not.toContain("small pilot")
    expect(html).not.toContain("your account")
    expect(html).toContain("Try again")
    expect(refusalLine({ status: 404, code: "HTTP_404", message: "Not found", fromServer: false })).toContain("Please check back later")
  })

  test("true outside-area result can explain coverage without promising a launch date", () => {
    const html = renderToStaticMarkup(<AvailabilityState text="We don't currently serve your location. Please check back later." />)
    expect(html).toContain("serve your location")
    expect(html).toContain("Explore other apps")
    expect(html).not.toContain("Notify me")
  })

  test.each([0, 500, 401, 403])("real failure %s is still an error with a retry, not a no-service claim", (status) => {
    const html = renderToStaticMarkup(<ErrorState error={new DoorstepApiError(status, `HTTP_${status}`, "Please try again", false)} what="Nearby services" onRetry={() => {}} />)
    expect(html).toContain("couldn&#x27;t be loaded")
    expect(html).toContain("Try again")
    expect(html).not.toContain("No home services available")
  })

  test("a missing booking is not treated as service unavailability", () => {
    const html = renderToStaticMarkup(<ErrorState error={new DoorstepApiError(404, "DOORSTEP_BOOKING_NOT_FOUND", "Booking not found", true)} what="Booking" onRetry={() => {}} />)
    expect(html).toContain("Booking not found")
    expect(html).toContain("Try again")
    expect(html).not.toContain("No home services available")
  })
})

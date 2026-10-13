import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PartnerFrameView } from "../PartnerFrame"
import { PartnerAccountHeader, PartnerSetupChecklist } from "../PartnerScreen"
import { PartnerChangeHistory } from "../PartnerChanges"
import { PartnerEarningsStatement, PartnerJobsList, PartnerQuickLinks, PriceRow } from "../PartnerWorkspace"
import { PartnerReviewRequired } from "../ui"
import { PARTNER_STEPS, decodeEarnings, decodeJobs, decodePartner, decodeServicePricing, type StepCode } from "../model"
import { filterPartnerJobs, partnerDate, partnerView } from "../workspaceView"
import { canContactCustomer } from "../CustomerContact"
import type { SetupState } from "../PartnerSetupNotice"
import { STRICT } from "../../model/decode"
import { BUSINESS_SECTIONS } from "@/features/partners/businessNavigation"
import partnerFixture from "./contracts/pro_me_get_200.json"
import jobsFixture from "./contracts/pro_jobs_get_200.json"
import earningsFixture from "./contracts/pro_earnings_get_200.json"
import pricesFixture from "./contracts/pro_prices_get_200.json"

const partner = decodePartner(partnerFixture.data, STRICT)
const jobs = decodeJobs(jobsFixture.data, STRICT).items
const earnings = decodeEarnings(earningsFixture.data, STRICT)
const service = decodeServicePricing(pricesFixture.data.items[0], STRICT)
const render = (child: React.ReactNode) => renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}>{child}</QueryClientProvider>)

test("partner shell has its own accessible workspace and mobile navigation", () => {
  const html = render(<PartnerFrameView profile={<button>Profile</button>} navigation={() => <li>Home Services</li>}><p>Partner content</p></PartnerFrameView>)
  expect(html).toContain('data-doorstep-partner-design="home-services-partner-20261009"')
  expect(html).toContain('href="/doorstep/partner?tab=notifications"')
  expect(html).toContain('href="#partner-content"')
  expect(html).toContain('aria-controls="partner-navigation"')
  expect(html).toContain('aria-expanded="false"')
  expect(html).toContain("Partner content")
  expect(html).not.toContain("Detect my location")
})
test("workspace views validate links and default to dashboard", () => {
  for (const view of ["dashboard", "jobs", "prices", "earnings", "setup"]) expect(partnerView(view)).toBe(view)
  for (const view of [null, "", "__proto__", "constructor", "other"]) expect(partnerView(view)).toBe("dashboard")
  expect(BUSINESS_SECTIONS[0].sections.map(s => s[0])).toEqual(["Dashboard", "Jobs", "Services & prices", "Earnings", "Work settings"])
})
test("each page has an appropriate heading; only approved accounts have a verified badge", () => {
  expect(render(<PartnerAccountHeader partner={partner} view="jobs" />)).toContain("Your jobs")
  expect(render(<PartnerAccountHeader partner={partner} view="jobs" />)).not.toContain("Verified partner")
  const html = render(<PartnerAccountHeader partner={{ ...partner, status: "approved" }} view="dashboard" />)
  expect(html).toContain("Welcome, Lakshmi Devi")
  expect(html).toContain("Verified partner")
})
test("quick links open the appropriate work-setting step", () => {
  const html = render(<PartnerQuickLinks />)
  expect(html).toContain("tab=setup&amp;step=service_area")
  expect(html).toContain("tab=setup&amp;step=weekly_hours")
  expect(html).toContain("tab=prices")
})
test("setup checklist keeps saved coverage and pending review distinct from complete", () => {
  const states = Object.fromEntries(PARTNER_STEPS.map(s => [s.code, "complete"])) as Record<StepCode, SetupState>
  states.service_area = "saved"; states.skills = "review"
  const html = render(<PartnerSetupChecklist states={states} step="service_area" onStep={() => {}} />)
  expect(html).toContain("6 of 8 checks complete")
  expect(html).toContain("Saved · coverage pending")
  expect(html).toContain("Awaiting review")
  expect(html).toContain('aria-current="step"')
  expect(html).not.toContain("Police clearance")
})
test("review history stays collapsed but exposes pending and returned counts", () => {
  const html = render(<PartnerChangeHistory items={[
    { id: "1", kind: "area", status: "approved", payload: { area: { area_label: "Uppal" } }, reason: null },
    { id: "2", kind: "hours", status: "pending", payload: {}, reason: null },
    { id: "3", kind: "profile", status: "rejected", payload: {}, reason: "Please correct the name" },
  ]} />)
  expect(html).toContain("1 awaiting review"); expect(html).toContain("1 returned")
  expect(html).toContain("Uppal"); expect(html).toContain("Please correct the name")
  expect(html).not.toContain('open=""'); expect(html).not.toContain("All updates reviewed")
  expect(render(<PartnerChangeHistory items={[]} />)).toBe("")
})
test("job filters never classify unknown states as completed or mutate records", () => {
  const items = [...jobs, { ...jobs[0], booking_id: "complete", status: "completed" }, { ...jobs[0], booking_id: "unknown", status: "new_status" }]
  const before = JSON.stringify(items)
  expect(filterPartnerJobs(items, "all")).toHaveLength(3)
  expect(filterPartnerJobs(items, "active")).toHaveLength(1)
  expect(filterPartnerJobs(items, "completed").map(j => j.booking_id)).toEqual(["complete"])
  expect(JSON.stringify(items)).toBe(before)
})
test("jobs display real appointment and estimated earning, not fake booking controls", () => {
  const html = render(<PartnerJobsList items={jobs} />)
  expect(html).toContain("Kitchen deep cleaning"); expect(html).toContain("HITEC City")
  expect(html).toContain("1,524.07"); expect(html).toContain("Estimated earning"); expect(html).toContain("IST")
  expect(html).not.toContain("Accept job")
  expect(render(<PartnerJobsList items={[]} />)).toContain("Your next job starts here")
  expect(render(<PartnerJobsList items={[]} filtered />)).toContain("No matching jobs")
})
test("customer call action exists only on active assigned jobs and renders no number by default", () => {
  for (const status of ["assigned", "en_route", "arrived", "in_progress", "awaiting_extras_payment"]) {
    expect(canContactCustomer(status)).toBe(true)
    const html = render(<PartnerJobsList items={[{ ...jobs[0], status }]} />)
    expect(html).toContain("Call customer")
    expect(html).toContain("For directions and service coordination only")
    expect(html).not.toContain("tel:")
  }
  for (const status of ["offered", "matching", "pending_payment", "confirmed", "completed", "cancelled", "expired", "pro_unavailable", "pro_no_show", "customer_no_show", "unknown"]) {
    expect(canContactCustomer(status)).toBe(false)
    expect(render(<PartnerJobsList items={[{ ...jobs[0], status }]} />)).not.toContain("Call customer")
  }
})

test("appointment dates are explicitly formatted in India time and handle invalid values", () => {
  expect(partnerDate("2026-10-05T08:30:00Z")).toContain("2:00")
  expect(partnerDate("invalid")).toBe("Time unavailable")
})
test("earnings show recorded totals and signed adjustments, never a withdraw action", () => {
  const html = render(<PartnerEarningsStatement data={earnings} />)
  expect(html).toContain("₹400"); expect(html).toContain("₹500"); expect(html).toContain("−₹100")
  expect(html).toContain("Payouts are not enabled yet")
  expect(html).not.toContain("Withdraw")
  expect(render(<PartnerEarningsStatement data={{ total_paise: 0, lines: [] }} />)).toContain("No earnings activity yet")
})
test("pending price withdrawal retains its true action for approved partners", () => {
  const item = { ...service.items[0], pending: { ...service.items[0].approved!, price_paise: 160000, status: "pending" } }
  const html = render(<PartnerReviewRequired.Provider value={true}><PriceRow item={item} serviceId={service.service_id} editable /></PartnerReviewRequired.Provider>)
  expect(html).toContain("Approved price"); expect(html).toContain("₹1,499"); expect(html).toContain("₹1,600")
  expect(html).toContain("Withdraw pending price"); expect(html).not.toContain("Submit for review")
})

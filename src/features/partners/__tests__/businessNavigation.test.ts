import { describe, expect, test } from "bun:test"
import { BUSINESS_SECTIONS, registeredBusinesses, sectionIsCurrent } from "../businessNavigation"
describe("partner business navigation", () => {
  test("all business types have real dashboard and settings links", () => {
    expect(BUSINESS_SECTIONS).toHaveLength(5)
    for (const business of BUSINESS_SECTIONS) expect(business.sections.map(s => s[0])).toContain("Work settings")
  })
  test("Doorstep defaults to dashboard, not setup or prices", () => {
    expect(sectionIsCurrent("/doorstep/partner", null, "/doorstep/partner?tab=dashboard")).toBe(true)
    expect(sectionIsCurrent("/doorstep/partner", null, "/doorstep/partner?tab=setup")).toBe(false)
  })
  test("explicit query navigation highlights only the selected section", () => {
    expect(sectionIsCurrent("/doorstep/partner", "prices", "/doorstep/partner?tab=prices")).toBe(true)
    expect(sectionIsCurrent("/doorstep/partner", "prices", "/doorstep/partner?tab=dashboard")).toBe(false)
    expect(sectionIsCurrent("/feast/kitchen", null, "/feast/kitchen?tab=orders")).toBe(true)
  })
  test("only confirmed registrations enter the business menu", () => {
    expect(registeredBusinesses([
      {status:"fulfilled",value:true}, {status:"fulfilled",value:false},
      {status:"rejected",reason:Error("unavailable")}, {status:"fulfilled",value:true},
      {status:"fulfilled",value:false},
    ])).toEqual(["doorstep-partner","ride-partner"])
  })
  test("seller detail pages retain the parent section highlight", () => {
    expect(sectionIsCurrent("/shop/sell/products/example", null, "/shop/sell/products")).toBe(true)
    expect(sectionIsCurrent("/shop/sell/products/example", null, "/shop/sell")).toBe(false)
  })
})

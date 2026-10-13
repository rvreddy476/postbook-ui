import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { areaError } from "../workingAreaRules"
import { WorkingAreaForm } from "../WorkingArea"
import { PARTNER_STEPS } from "../model"

describe("working area", () => {
  const point = { lat: 17.4, lng: 78.6 }
  test("a location can be saved while coverage is unavailable", () => { expect(areaError(point, 8000, [], [])).toBeNull() })
  test("configured areas require an available zone", () => {
    expect(areaError(point, 8000, [], ["zone"])).toContain("Select")
    expect(areaError(point, 8000, ["other"], ["zone"])).toContain("available")
    expect(areaError(point, 8000, ["zone"], ["zone"])).toBeNull()
  })
  test("invalid location and radius are refused", () => {
    for (const p of [null, { lat: NaN, lng: 78 }, { lat: 91, lng: 78 }]) expect(areaError(p, 8000, [], [])).not.toBeNull()
    for (const radius of [0, 999, 15001, Infinity]) expect(areaError(point, radius, [], [])).not.toBeNull()
  })
  test("partner sees the same enabled zone names and saved selection", () => {
    const html=renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><WorkingAreaForm data={{zones:[{id:"zone-uppal",name:"Uppal",slug:"uppal",city_code:"HYD"}],area:{zone_ids:["zone-uppal"],home_lat:17.4,home_lng:78.6,radius_m:5000}}}/></QueryClientProvider>)
    expect(html).toContain("Uppal")
    expect(html).toContain("Selected working zone")
    expect(html).toContain("enabled by Admin")
    expect(html).toContain('checked=""')
  })
  test("police clearance is not a checklist requirement", () => { expect(PARTNER_STEPS.map(s => s.code)).not.toContain("police_certificate"); expect(PARTNER_STEPS.map(s => s.code)).toContain("identity_review") })
  test("location editor has no coordinate fields and explains uncovered areas", () => {
    const html = renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><WorkingAreaForm data={{ zones: [], area: { zone_ids: [], home_lat: null, home_lng: null, radius_m: 5000 } }} /></QueryClientProvider>)
    expect(html).not.toContain("Home latitude"); expect(html).not.toContain("Home longitude")
    expect(html).toContain("Search area manually"); expect(html).toContain("without sharing your device location")
    expect(html).toContain("Use current location"); expect(html).toContain("Travel radius")
    expect(html).toContain("Bookings aren’t available"); expect(html).toContain("Open Google Maps")
    expect(html).not.toContain("Choose 1 to 20")
  })
})

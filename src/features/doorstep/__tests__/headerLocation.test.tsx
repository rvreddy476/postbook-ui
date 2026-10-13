import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { HeaderLocationControl } from "../components/DoorstepHeaderLocation"
import { CurrentLocationBoundary, CurrentLocationGate } from "@/features/maps/CurrentLocation"

describe("Doorstep header location", () => {
  test("shows the area and an accessible refresh control without the old banner", () => {
    const html = renderToStaticMarkup(<HeaderLocationControl name="Peerzadiguda" city="Hyderabad" busy={false} detail="Nearby services use your device location." onRefresh={() => {}} />)
    expect(html).toContain("Peerzadiguda")
    expect(html).toContain('aria-label="Refresh current location"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-controls=')
    expect(html).not.toContain("No saved address required")
    expect(html).not.toContain("current-location--bar")
  })
  test("disables duplicate refreshes and announces progress", () => {
    const html = renderToStaticMarkup(<HeaderLocationControl name="Finding your area…" busy detail="" onRefresh={() => {}} />)
    expect(html).toContain('disabled=""')
    expect(html).toContain("Refreshing location")
    expect(html).toContain('role="status"')
  })
  test("the header remains visible while service content still requires permission", () => {
    const html = renderToStaticMarkup(<CurrentLocationBoundary gate={false}><header>Doorstep header</header><CurrentLocationGate><p>Nearby service catalogue</p></CurrentLocationGate></CurrentLocationBoundary>)
    expect(html).toContain("Doorstep header")
    expect(html).toContain("Find services near you")
    expect(html).not.toContain("Nearby service catalogue")
  })
  test("other applications retain the default location gate", () => {
    const html = renderToStaticMarkup(<CurrentLocationBoundary><p>Restricted service content</p></CurrentLocationBoundary>)
    expect(html).toContain("Find services near you")
    expect(html).not.toContain("Restricted service content")
  })
})

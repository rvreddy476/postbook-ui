import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { StorefrontFrameView, StorefrontSearch, storefrontLinkIsCurrent } from "../components/StorefrontFrame"

const render = (pathname = "/doorstep", duesCount = 0, unreadCount = 0) => renderToStaticMarkup(
  <StorefrontFrameView pathname={pathname} duesCount={duesCount} unreadCount={unreadCount}
    location={<button type="button" aria-label="Refresh location">Peerzadiguda</button>}
    profile={<button type="button" aria-label="Your account">R</button>}>
    <h1>Home services</h1>
  </StorefrontFrameView>,
)

describe("customer sidebar and compact header", () => {
  test("moves every navigation destination to a single left menu", () => {
    const html = render()
    const nav = html.match(/<nav[^>]*>[\s\S]*?<\/nav>/)?.[0] ?? ""
    expect(nav).toContain('class="dsc-sidebar"')
    for (const label of ["Home services", "My bookings", "Addresses", "Dues", "All apps", "Messenger", "Support"]) expect(nav).toContain(label)
    expect((nav.match(/<a /g) ?? []).length).toBe(7)
    expect(html).not.toContain('class="dsc-nav')
    expect(html).not.toContain('class="dsc-mobile-nav')
  })

  test("uses a small home icon, preserves location and account, and removes duplicate bookings", () => {
    const header = render().match(/<header[^>]*>[\s\S]*?<\/header>/)?.[0] ?? ""
    expect(header).toContain('aria-label="Doorstep home"')
    expect(header).toContain('dsc-brand__icon')
    expect(header).toContain('width="20"')
    expect(header).toContain('aria-label="Refresh location"')
    expect(header).toContain('aria-label="Your account"')
    expect(header).not.toContain("by Cleestudio")
    expect(header).not.toContain("My bookings")
  })

  test("exposes accessible mobile navigation and a skip link", () => {
    const html = render()
    expect(html).toContain('aria-controls="doorstep-navigation" aria-expanded="false"')
    expect(html).toContain('id="doorstep-navigation"')
    expect(html).toContain('aria-label="Open navigation"')
    expect(html).toContain('href="#doorstep-content"')
    expect(html).toContain('id="doorstep-content" tabindex="-1"')
  })

  test("preserves dues counts and notification state", () => {
    expect(render()).not.toContain('class="dsc-count"')
    expect(render("/doorstep/outstanding", 3, 2)).toContain('aria-label="3 outstanding dues"')
    expect(render("/doorstep", 0, 2)).toContain('aria-label="Notifications, unread items"')
    expect(render()).toContain('aria-label="Notifications"')
  })

  test("header search is a real catalogue search, including progressive form fallback", () => {
    const html = renderToStaticMarkup(<StorefrontSearch />)
    expect(html).toContain('action="/doorstep"')
    expect(html).toContain('name="q"')
    expect(html).toContain('aria-label="Find services"')
    expect(html).toContain('maxLength="120"')
  })

  test("highlights the appropriate section throughout booking", () => {
    for (const path of ["/doorstep", "/doorstep/c/ac", "/doorstep/s/123", "/doorstep/s/123/pros", "/doorstep/checkout"]) {
      expect(storefrontLinkIsCurrent(path, "/doorstep")).toBe(true)
    }
    expect(storefrontLinkIsCurrent("/doorstep/bookings/123", "/doorstep/bookings")).toBe(true)
    expect(storefrontLinkIsCurrent("/doorstep/addresses", "/doorstep/addresses")).toBe(true)
    for (const path of ["/doorstep/bookings", "/doorstep/partner", "/doorstep/checkout-other"]) expect(storefrontLinkIsCurrent(path, "/doorstep")).toBe(false)
    expect(storefrontLinkIsCurrent("/doorstep/bookings-other", "/doorstep/bookings")).toBe(false)
    const nav = render("/doorstep/checkout").match(/<nav[^>]*>[\s\S]*?<\/nav>/)?.[0] ?? ""
    expect((nav.match(/aria-current="page"/g) ?? []).length).toBe(1)
  })
})

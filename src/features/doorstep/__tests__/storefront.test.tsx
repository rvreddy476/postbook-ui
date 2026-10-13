import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { STRICT } from "../model/decode"
import { decodeCatalogue, decodeCategoryPage, decodeServicePage } from "../model/wire"
import { initialSelection } from "../model/selection"
import { featuredCategories, selectionAddonNames, selectionHasApprovedPrice, serviceArt, serviceDirectoryCategories, serviceDirectoryGroups, storefrontCategories } from "../model/storefront"
import { StorefrontHome } from "../screens/HomeScreen"
import { StorefrontCategory } from "../screens/CategoryScreen"
import { ServicePlan } from "../screens/ServiceScreen"
import { fixtureData } from "./fixtures"

const catalogue = () => decodeCatalogue(fixtureData("catalogue_get_200"), STRICT)
const service = () => decodeServicePage(fixtureData("service_get_200"), STRICT).service

describe("customer storefront", () => {
  test("searches and sorts real categories without modifying the query cache", () => {
    const original = catalogue().categories
    const input = [...original].reverse()
    const before = input.map(c => c.id)
    const list = storefrontCategories(input)
    expect(input.map(c => c.id)).toEqual(before)
    expect(list.length).toBe(original.length)
    expect(storefrontCategories(input, "   NO SUCH CATEGORY   ")).toEqual([])
    expect(storefrontCategories(input, " " + input[0].name.toUpperCase() + " ").some(c => c.id === input[0].id)).toBe(true)
    expect(list).toEqual([...input].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)))
  })

  test("featured services cannot introduce an absent catalogue entry", () => {
    expect(featuredCategories([])).toEqual([])
    const categories = catalogue().categories
    expect(featuredCategories(categories).every(c => categories.includes(c))).toBe(true)
    expect(serviceArt("plumbing")).toBe("plumber")
    expect(serviceArt("electrician")).toBe("electrician")
    expect(serviceArt("salon-women")).toBe("salon-women")
    expect(serviceArt("salon-men")).toBe("salon-men")
    expect(serviceArt("house-maid", "house-maid", "HOME_STAFFING")).toBe("house-help")
    expect(serviceArt("unknown")).toBe(null)
    expect(serviceArt("ac-basic", "ac-service-repair")).toBe("ac")
    expect(serviceArt("sofa-deep-clean", "home-cleaning")).toBe("sofa")
  })

  test("search matches service words across titles without short-token false matches", () => {
    const base = catalogue().categories[0]
    const entries = [
      { ...base, id: "ac", name: "AC service & repair", description: "Installation, servicing and maintenance" },
      { ...base, id: "beauty", name: "Salon", description: "Facials and threading" },
      { ...base, id: "ro", name: "Appliance and RO", description: "Purifier repairs" },
    ]
    expect(storefrontCategories(entries, "AC repair").map(c => c.id)).toEqual(["ac"])
    expect(storefrontCategories(entries, "ac").map(c => c.id)).toEqual(["ac"])
    expect(storefrontCategories(entries, "ro repair").map(c => c.id)).toEqual(["ro"])
    expect(storefrontCategories(entries, "  AC & service  ").map(c => c.id)).toEqual(["ac"])
    expect(storefrontCategories(entries, "not a service")).toEqual([])
  })

  test("homepage links to the database categories and contains no fabricated reviews", () => {
    const categories = catalogue().categories
    const html = renderToStaticMarkup(<StorefrontHome categories={categories} />)
    expect(html).toContain("Home services, made simple.")
    expect(html).toContain('aria-label="Search home services"')
    for (const c of storefrontCategories(categories).slice(0, 8)) expect(html).toContain("/doorstep/c/" + encodeURIComponent(c.slug))
    expect(html.replace(/<[^>]*>/g, "")).not.toContain("4.8")
    expect(html).not.toContain("million bookings")
  })

  test("category links to real service identifiers and exposes a genuine empty state", () => {
    const page = decodeCategoryPage(fixtureData("category_get_200"), STRICT)
    const html = renderToStaticMarkup(<StorefrontCategory page={page} />)
    for (const s of page.services) expect(html).toContain("/doorstep/s/" + encodeURIComponent(s.id))
    const empty = renderToStaticMarkup(<StorefrontCategory page={{ ...page, services: [] }} />)
    expect(empty).toContain("No services here yet")
    expect(empty).not.toContain("View options")
  })

  test("header search terms filter the real city catalogue", () => {
    const html = renderToStaticMarkup(<StorefrontHome categories={catalogue().categories} initialQuery="No such service xyz" />)
    expect(html).toContain("No matching services")
    expect(html).toContain("Search results")
    expect(html).not.toContain("A little help. A lot less to do.")
  })

  test("directory groups partition only the live catalogue and preserve its ordering", () => {
    const categories = catalogue().categories
    const groups = serviceDirectoryGroups(categories)
    expect(groups.flatMap(group => group.categories).map(category => category.id).sort()).toEqual(categories.map(category => category.id).sort())
    expect(serviceDirectoryGroups([])).toEqual([])
    for (const group of groups) {
      expect(group.categories.length).toBeGreaterThan(0)
      expect(serviceDirectoryCategories(categories, group.id)).toEqual(group.categories)
      expect(serviceDirectoryCategories(categories, group.id, "not-a-service")).toEqual([])
    }
    expect(serviceDirectoryCategories(categories, "all")).toEqual(storefrontCategories(categories))
    expect(serviceDirectoryCategories(categories, "unknown")).toEqual(storefrontCategories(categories))
  })

  test("directory is accessible and missing prices do not become invented offers", () => {
    const categories = catalogue().categories.map(category => ({ ...category, startingPricePaise: null }))
    const html = renderToStaticMarkup(<StorefrontHome categories={categories} />)
    expect(html).toContain('aria-label="Browse service categories"')
    expect(html).toContain('aria-label="Service categories"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('maxLength="120"')
    expect(html).toContain("Explore services")
    expect(html).not.toContain("₹")
    expect(html).not.toContain("Happiness Guarantee")
    for (const group of serviceDirectoryGroups(categories)) expect(html).toContain(group.label.replaceAll("&", "&amp;"))
  })

  test("suggested prices are never presented as approved prices", () => {
    const s = service()
    s.options = s.options.map(o => ({ ...o, fromPricePaise: null, suggestedPricePaise: 9876500 }))
    const selection = initialSelection(s)
    expect(selectionHasApprovedPrice(s, selection)).toBe(false)
    const html = renderToStaticMarkup(<ServicePlan service={s} selection={selection} />)
    expect(html).toContain("Price not available yet")
    expect(html).not.toContain("98,765")
    expect(html).not.toContain("Total")
  })

  test("approved minimum price is displayed without pretending it is a final quote", () => {
    const s = service()
    s.options = s.options.map(o => ({ ...o, fromPricePaise: 123400 }))
    const selection = initialSelection(s)
    expect(selectionHasApprovedPrice(s, selection)).toBe(true)
    const html = renderToStaticMarkup(<ServicePlan service={s} selection={selection} />)
    expect(html).toContain("1,234")
    expect(html).toContain("Final price is confirmed after you choose your professional")
    expect(html).not.toContain("Total")
  })

  test("selection summary only includes known selected add-ons", () => {
    const s = service()
    const selection = initialSelection(s)
    selection.addons = { nonexistent: ["made-up"] }
    for (const group of s.addonGroups) selection.addons[group.id] = ["made-up", ...group.addons.slice(0, 1).map(a => a.id)]
    expect(selectionAddonNames(s, selection)).toEqual(s.addonGroups.flatMap(g => g.addons.slice(0, 1).map(a => a.name)))
  })
})

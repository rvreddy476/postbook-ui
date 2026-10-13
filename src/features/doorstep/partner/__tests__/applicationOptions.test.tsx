import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { filterServiceTypes, townFromPlace, TownRequestVersion } from "../applicationOptions"
import { ServiceTypePicker } from "../ServiceTypePicker"
import { TownPicker } from "../TownPicker"

const catalogue = [
  { code: "house_help", name: "House help", description: "House maid and cleaning", requires_certificate: false },
  { code: "ac_service", name: "AC service and repair", description: "", requires_certificate: true },
]
const component = (longText: string, type: string, shortText?: string) => ({ longText, shortText, types: [type] })
const town = { addressComponents: [component("Warangal", "locality"), component("Telangana", "administrative_area_level_1"), component("India", "country", "IN")] }

describe("database-derived service types", () => {
  test("searches names, codes and descriptions without fabricating options", () => {
    expect(filterServiceTypes(catalogue, "ac repair").map(s => s.code)).toEqual(["ac_service"])
    expect(filterServiceTypes(catalogue, "house").map(s => s.code)).toEqual(["house_help"])
    expect(filterServiceTypes(catalogue, "maid").map(s => s.code)).toEqual(["house_help"])
    expect(filterServiceTypes(catalogue, "missing")).toEqual([])
    expect(filterServiceTypes([], "")).toEqual([])
    expect(catalogue[0].code).toBe("house_help")
  })
  test("renders multiple selected services without requiring optional certificates", () => {
    const html = renderToStaticMarkup(<ServiceTypePicker items={catalogue} selected={["house_help", "ac_service"]} onChange={() => {}} onRetry={() => {}} />)
    for (const text of ["Service types", "Search service types", "AC service and repair", "House help", "2 selected"]) expect(html).toContain(text)
    expect(html).not.toContain("Additional qualification")
    expect(html.match(/checked=""/g)?.length).toBe(2)
  })
  test("empty catalogue offers a retry, not invented choices", () => {
    const html = renderToStaticMarkup(<ServiceTypePicker items={[]} selected={[]} onChange={() => {}} onRetry={() => {}} />)
    expect(html).toContain("Reload service types")
    expect(html).not.toContain('type="checkbox"')
  })
})

describe("town search", () => {
  test("textbox is present before maps load, disabled until a state is selected", () => {
    const html = renderToStaticMarkup(<TownPicker state="" value="" onChange={() => {}} />)
    expect(html).toContain('role="combobox"')
    expect(html).toContain('disabled=""')
    expect(html).toContain("Select a state first")
  })
  test("state-specific textbox is enabled with a manual fallback", () => {
    const html = renderToStaticMarkup(<TownPicker state="Telangana" value="" onChange={() => {}} />)
    expect(html).toContain("Search towns in Telangana")
    expect(html).not.toContain('disabled=""')
    expect(html).toContain("Enter it manually")
  })
  test("accepts only an actual Indian town within the selected state", () => {
    expect(townFromPlace(town, " Telangana ")).toBe("Warangal")
    expect(townFromPlace(town, "Karnataka")).toBeNull()
    expect(townFromPlace({ addressComponents: town.addressComponents.filter(c => !c.types.includes("country")) }, "Telangana")).toBeNull()
    expect(townFromPlace({ addressComponents: [component("Warangal", "administrative_area_level_2"), ...town.addressComponents.slice(1)] }, "Telangana")).toBeNull()
    expect(townFromPlace({}, "Telangana")).toBeNull()
  })
  test("new searches, typing, blur and unmount invalidate old asynchronous results", () => {
    const requests = new TownRequestVersion()
    const search = requests.next()
    expect(requests.isCurrent(search)).toBe(true)
    const selection = requests.next()
    expect(requests.isCurrent(search)).toBe(false)
    expect(requests.isCurrent(selection)).toBe(true)
    requests.next()
    expect(requests.isCurrent(selection)).toBe(false)
  })
})

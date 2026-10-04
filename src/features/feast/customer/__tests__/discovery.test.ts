import { describe, expect, test } from "bun:test"
import { filterRestaurants } from "../model/discovery"
import type { Restaurant } from "../model/wire"

const rows = [
  { id: "near", name: "Garden Kitchen", cuisines: ["Indian", "Vegetarian"] },
  { id: "far", name: "Pizza Corner", cuisines: ["Italian"] },
  { id: "closed", name: "Evening Kitchen", cuisines: ["Indian"] },
] as Restaurant[]

describe("restaurant discovery", () => {
  test("preserves the server order and does not remove unavailable restaurants", () => {
    expect(filterRestaurants(rows,"","").map(r => r.id)).toEqual(["near","far","closed"])
  })
  test("search is trimmed, case-insensitive and matches cuisine", () => {
    expect(filterRestaurants(rows,"  KITCHEN  ","").map(r => r.id)).toEqual(["near","closed"])
    expect(filterRestaurants(rows,"italian","").map(r => r.id)).toEqual(["far"])
  })
  test("combines cuisine and text, without mutating the source", () => {
    expect(filterRestaurants(rows,"evening","Indian").map(r => r.id)).toEqual(["closed"])
    expect(filterRestaurants(rows,"pizza","Indian")).toEqual([])
    expect(rows.length).toBe(3)
  })
})

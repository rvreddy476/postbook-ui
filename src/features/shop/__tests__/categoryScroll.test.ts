import { describe, expect, it } from "bun:test"
import { categoryScrollEdges, categoryScrollStep } from "../model/categoryScroll"

describe("category carousel", () => {
  it("disables both arrows when all categories fit", () => {
    expect(categoryScrollEdges(0, 600, 400)).toEqual({ previous: false, next: false })
    expect(categoryScrollEdges(0, 600, 600)).toEqual({ previous: false, next: false })
  })
  it("enables only the correct arrow at each end", () => {
    expect(categoryScrollEdges(0, 400, 1200)).toEqual({ previous: false, next: true })
    expect(categoryScrollEdges(400, 400, 1200)).toEqual({ previous: true, next: true })
    expect(categoryScrollEdges(800, 400, 1200)).toEqual({ previous: true, next: false })
  })
  it("tolerates subpixels and touch overscroll", () => {
    expect(categoryScrollEdges(-20, 400, 1200).previous).toBe(false)
    expect(categoryScrollEdges(799.6, 400, 1200).next).toBe(false)
    expect(categoryScrollEdges(900, 400, 1200).next).toBe(false)
  })
  it("keeps some visible categories for context after a page advance", () => {
    expect(categoryScrollStep(500)).toBe(400)
    expect(categoryScrollStep(30)).toBe(100)
  })
})

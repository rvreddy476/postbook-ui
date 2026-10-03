/*
  The size + add-on sheet, as pure state.

  The server enforces every rule again at POST /cart/items; this is for UX:
  a required group (is_required or min_select > 0) must be satisfied before
  "Add" enables, and a group never holds more than max_select (0 = no cap).
  A one-pick group behaves like radio buttons. The total is a preview in
  integer paise; the cart's figures are the server's.
*/

import { addPaise, timesPaise } from "./money"
import type { AddCartItemBody } from "../api/client"
import type { AddonGroup, MenuItem, Variant } from "./wire"

export const MAX_QUANTITY = 20

export interface SheetState {
  variantId: string | null
  /** groupId → chosen addon ids, in pick order. */
  picks: Record<string, string[]>
  quantity: number
}

export function availableVariants(item: MenuItem): Variant[] {
  return item.variants.filter((v) => v.isAvailable).sort((a, b) => a.sortOrder - b.sortOrder)
}

export function sortedGroups(item: MenuItem): AddonGroup[] {
  return [...item.addonGroups].sort((a, b) => a.sortOrder - b.sortOrder)
}

/** True when the sheet must open (sizes or add-ons to choose); otherwise "Add" adds directly. */
export function needsSheet(item: MenuItem): boolean {
  return item.variants.length > 0 || item.addonGroups.some((g) => g.addons.length > 0)
}

export function initialSheet(item: MenuItem): SheetState {
  const first = availableVariants(item)[0]
  return { variantId: first ? first.id : null, picks: {}, quantity: 1 }
}

/** The least a group needs: min_select, and at least one when it is required. */
export function minimumFor(group: AddonGroup): number {
  return Math.max(group.minSelect, group.isRequired ? 1 : 0)
}

export function isRequiredGroup(group: AddonGroup): boolean {
  return minimumFor(group) > 0
}

export function selectVariant(state: SheetState, variantId: string): SheetState {
  return { ...state, variantId }
}

/**
  Toggle one add-on. A pick past max_select is refused (state unchanged),
  except in a one-pick group, where the new pick replaces the old one.
*/
export function toggleAddon(state: SheetState, group: AddonGroup, addonId: string): SheetState {
  const addon = group.addons.find((a) => a.id === addonId)
  if (!addon || !addon.isAvailable) return state
  const current = state.picks[group.id] ?? []
  if (current.includes(addonId)) {
    return { ...state, picks: { ...state.picks, [group.id]: current.filter((id) => id !== addonId) } }
  }
  if (group.maxSelect === 1) {
    return { ...state, picks: { ...state.picks, [group.id]: [addonId] } }
  }
  if (group.maxSelect > 0 && current.length >= group.maxSelect) return state
  return { ...state, picks: { ...state.picks, [group.id]: [...current, addonId] } }
}

export function setQuantity(state: SheetState, quantity: number): SheetState {
  const q = Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(quantity)))
  return { ...state, quantity: q }
}

export interface SheetProblem {
  groupId: string | null
  message: string
}

/** Everything that stops "Add"; empty when the selection is complete. */
export function sheetProblems(item: MenuItem, state: SheetState): SheetProblem[] {
  const problems: SheetProblem[] = []
  if (!item.isAvailable) problems.push({ groupId: null, message: "This dish isn't available right now." })
  const variants = availableVariants(item)
  if (item.variants.length > 0) {
    if (variants.length === 0) problems.push({ groupId: null, message: "No size is available right now." })
    else if (!state.variantId || !variants.some((v) => v.id === state.variantId)) problems.push({ groupId: null, message: "Choose a size." })
  }
  for (const group of item.addonGroups) {
    const count = (state.picks[group.id] ?? []).length
    const min = minimumFor(group)
    if (count < min) {
      problems.push({ groupId: group.id, message: min === 1 ? `Choose 1 from ${group.name}.` : `Choose at least ${min} from ${group.name}.` })
    }
    if (group.maxSelect > 0 && count > group.maxSelect) {
      problems.push({ groupId: group.id, message: `Choose at most ${group.maxSelect} from ${group.name}.` })
    }
  }
  return problems
}

/** "Required · choose 1", "Optional · up to 2". */
export function groupHint(group: AddonGroup): string {
  const min = minimumFor(group)
  const max = group.maxSelect
  const head = min > 0 ? "Required" : "Optional"
  if (min > 0 && max > 0 && min === max) return `${head} · choose ${min}`
  if (min > 0 && max > 0) return `${head} · choose ${min}–${max}`
  if (min > 0) return `${head} · choose at least ${min}`
  if (max > 0) return `${head} · up to ${max}`
  return head
}

/** One unit's price before add-ons: the size when chosen, else the dish (discounted when the server says so). */
export function unitPricePaise(item: MenuItem, state: SheetState): number {
  const variant = state.variantId ? item.variants.find((v) => v.id === state.variantId) : undefined
  if (variant) return variant.pricePaise
  return item.discountPricePaise ?? item.basePricePaise
}

/** (unit + chosen add-ons) × quantity, integer paise. */
export function sheetTotalPaise(item: MenuItem, state: SheetState): number {
  const addonPrices: number[] = []
  for (const group of item.addonGroups) {
    for (const id of state.picks[group.id] ?? []) {
      const addon = group.addons.find((a) => a.id === id)
      if (addon) addonPrices.push(addon.pricePaise)
    }
  }
  const unit = addPaise(unitPricePaise(item, state), ...addonPrices)
  return timesPaise(unit, state.quantity)
}

/** The POST /cart/items body. One of each add-on per unit; the address lets the server judge serviceability. */
export function cartBody(item: MenuItem, state: SheetState, addressId: string | null, clearExisting = false): AddCartItemBody {
  const addons: { addon_id: string; quantity: number }[] = []
  for (const group of item.addonGroups) {
    for (const id of state.picks[group.id] ?? []) addons.push({ addon_id: id, quantity: 1 })
  }
  const body: AddCartItemBody = { menu_item_id: item.id, quantity: state.quantity, addons }
  if (state.variantId) body.variant_id = state.variantId
  if (addressId) body.address_id = addressId
  if (clearExisting) body.clear_existing = true
  return body
}

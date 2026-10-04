/*
  The service sheet: one option, a quantity, add-ons per group, and the
  "require a woman professional" preference.

  The add-on rules mirror the server's (POST /quotes): in each group the
  count must be at least max(min_select, is_required ? 1 : 0) and at most
  max_select (0 = no upper bound beyond the group size); no add-on twice.
  The preview total here is only a preview — the quote the server returns
  is what the customer pays.

  Gender: women's salon is women professionals only and men's salon is men
  professionals only (the category's gender_rule). Any customer may ask for
  a woman professional, but only where the rule is "any": in a women-only
  category it is already true, in a men-only one it cannot be met.
*/

import { addPaise, timesPaise } from "./money"
import type { AddonGroup, GenderRule, ServiceDetail, ServiceOption } from "./wire"

export interface Selection {
  optionId: string | null
  quantity: number
  /** group id → chosen add-on ids, in the order they were picked. */
  addons: Record<string, string[]>
  requireFemalePro: boolean
}

export function defaultOption(options: readonly ServiceOption[]): ServiceOption | null {
  return options.find((o) => o.isDefault) ?? options[0] ?? null
}

export function initialSelection(service: ServiceDetail): Selection {
  return { optionId: defaultOption(service.options)?.id ?? null, quantity: 1, addons: {}, requireFemalePro: false }
}

export function chosenOption(service: ServiceDetail, sel: Selection): ServiceOption | null {
  return service.options.find((o) => o.id === sel.optionId) ?? null
}

/** The fewest picks a group accepts. */
export function groupMin(g: AddonGroup): number {
  return Math.max(g.minSelect, g.isRequired ? 1 : 0)
}

/** The most picks a group accepts (max_select 0 means "up to all of them"). */
export function groupMax(g: AddonGroup): number {
  return g.maxSelect > 0 ? g.maxSelect : g.addons.length
}

/** A pick-one group behaves like radio buttons. */
export function isPickOne(g: AddonGroup): boolean {
  return groupMax(g) === 1
}

export function selectOption(service: ServiceDetail, sel: Selection, optionId: string): Selection {
  const opt = service.options.find((o) => o.id === optionId)
  if (!opt) return sel
  return { ...sel, optionId, quantity: Math.min(sel.quantity, opt.maxQuantity) }
}

export function setQuantity(service: ServiceDetail, sel: Selection, quantity: number): Selection {
  const opt = chosenOption(service, sel)
  const max = opt?.maxQuantity ?? 1
  const q = Math.max(1, Math.min(max, Math.floor(quantity)))
  return { ...sel, quantity: q }
}

/**
  Toggles an add-on. A pick-one group swaps; a full group refuses a new pick
  (the box stays unticked) instead of silently dropping an older one.
*/
export function toggleAddon(group: AddonGroup, sel: Selection, addonId: string): Selection {
  if (!group.addons.some((a) => a.id === addonId)) return sel
  const current = sel.addons[group.id] ?? []
  let next: string[]
  if (current.includes(addonId)) next = current.filter((id) => id !== addonId)
  else if (isPickOne(group)) next = [addonId]
  else if (current.length >= groupMax(group)) return sel
  else next = [...current, addonId]
  return { ...sel, addons: { ...sel.addons, [group.id]: next } }
}

export interface GroupProblem {
  groupId: string
  message: string
}

/** What stops the sheet from being quoted; empty when it can go. */
export function selectionProblems(service: ServiceDetail, sel: Selection): GroupProblem[] {
  const out: GroupProblem[] = []
  if (!chosenOption(service, sel)) out.push({ groupId: "", message: "Choose an option." })
  for (const g of service.addonGroups) {
    const n = (sel.addons[g.id] ?? []).filter((id) => g.addons.some((a) => a.id === id)).length
    const min = groupMin(g)
    const max = groupMax(g)
    if (n < min) out.push({ groupId: g.id, message: min === 1 ? `Choose one in “${g.name}”.` : `Choose at least ${min} in “${g.name}”.` })
    else if (n > max) out.push({ groupId: g.id, message: `Choose at most ${max} in “${g.name}”.` })
  }
  return out
}

/** The hint under a group's name: "Required · choose 1", "Optional · up to 2". */
export function groupHint(g: AddonGroup): string {
  const min = groupMin(g)
  const max = groupMax(g)
  if (min === 0) return max === 1 ? "Optional · choose 1" : `Optional · up to ${max}`
  if (min === max) return `Required · choose ${min}`
  return `Required · choose ${min} to ${max}`
}

/** Every chosen add-on id, de-duplicated, in group order. */
export function chosenAddonIds(service: ServiceDetail, sel: Selection): string[] {
  const seen = new Set<string>()
  for (const g of service.addonGroups) {
    for (const id of sel.addons[g.id] ?? []) {
      if (g.addons.some((a) => a.id === id)) seen.add(id)
    }
  }
  return [...seen]
}

/** Preview of the price (GST-inclusive): option × quantity + each add-on once. */
export function previewTotalPaise(service: ServiceDetail, sel: Selection): number | null {
  const opt = chosenOption(service, sel)
  if (!opt) return null
  const parts = [timesPaise(opt.pricePaise, sel.quantity)]
  const ids = new Set(chosenAddonIds(service, sel))
  for (const g of service.addonGroups) for (const a of g.addons) if (ids.has(a.id)) parts.push(a.pricePaise)
  return addPaise(...parts)
}

/** Preview of the duration in minutes: option × quantity + add-on extra time. */
export function previewDurationMinutes(service: ServiceDetail, sel: Selection): number {
  const opt = chosenOption(service, sel)
  const base = (opt?.durationMinutes || service.durationMinutes) * (opt ? sel.quantity : 1)
  const ids = new Set(chosenAddonIds(service, sel))
  let extra = 0
  for (const g of service.addonGroups) for (const a of g.addons) if (ids.has(a.id)) extra += a.extraDurationMinutes
  return base + extra
}

export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return ""
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

/* ── gender ───────────────────────────────────────────────────────── */

/** The "require a woman professional" toggle is offered only where the category allows anyone. */
export function femaleToggleVisible(rule: GenderRule): boolean {
  return rule === "any"
}

/** What is sent as require_female_pro: the toggle, and only where it is offered. */
export function effectiveFemalePref(rule: GenderRule, toggle: boolean): boolean {
  return femaleToggleVisible(rule) && toggle
}

/** The fixed line a single-gender category shows instead of the toggle. */
export function genderRuleNote(rule: GenderRule): string | null {
  if (rule === "female_pros_only") return "Served by women professionals only."
  if (rule === "male_pros_only") return "Served by men professionals only."
  return null
}

/* ── the quote body ───────────────────────────────────────────────── */

export interface QuoteBody {
  service_id: string
  option_id: string
  quantity: number
  addons: { addon_id: string }[]
  lat: number
  lng: number
}

export function quoteBody(service: ServiceDetail, sel: Selection, at: { lat: number; lng: number }): QuoteBody | null {
  const opt = chosenOption(service, sel)
  if (!opt || selectionProblems(service, sel).length) return null
  return {
    service_id: service.id,
    option_id: opt.id,
    quantity: sel.quantity,
    addons: chosenAddonIds(service, sel).map((addon_id) => ({ addon_id })),
    lat: at.lat,
    lng: at.lng,
  }
}

import { listOutcome, offeredMode, pickFor, type ProPick } from "./professionals"
import { DEFAULT_ZONE } from "./slots"
import type { ListMode, ProfessionalCard, ProfessionalList } from "./wire"

export type TimeWindow = "any" | "morning" | "afternoon" | "evening"
export interface ProfessionalFilters { time: TimeWindow; maxPricePaise: number | null; minRating: number | null }
export const DEFAULT_PRO_FILTERS: ProfessionalFilters = { time: "any", maxPricePaise: null, minRating: null }
export const hasProfessionalFilters = (filters: ProfessionalFilters) => filters.time !== "any" || filters.maxPricePaise !== null || filters.minRating !== null

export function matchesTimeWindow(start: string, window: TimeWindow, zone = DEFAULT_ZONE) {
  if (!Number.isFinite(Date.parse(start))) return false
  if (window === "any") return true
  let hour: number
  try { hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", hourCycle: "h23" }).format(new Date(start))) }
  catch { hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: DEFAULT_ZONE, hour: "2-digit", hourCycle: "h23" }).format(new Date(start))) }
  return window === "morning" ? hour < 12 : window === "afternoon" ? hour >= 12 && hour < 17 : hour >= 17
}

/** Filter only returned availability; preserve the server's ordering and prices. */
export function filterProfessionals(cards: ProfessionalCard[], mode: ListMode, filters: ProfessionalFilters, now: number, zone = DEFAULT_ZONE): ProfessionalCard[] {
  return cards.flatMap(card => {
    if (filters.maxPricePaise !== null && card.price.totalPaise > filters.maxPricePaise) return []
    if (filters.minRating !== null && (card.ratingCount <= 0 || card.ratingAvg === null || card.ratingAvg < filters.minRating)) return []
    if (mode === "asap") return card.etaMinutes !== null ? [card] : []
    const nextSlots = card.nextSlots.filter(slot => Date.parse(slot.start) > now && matchesTimeWindow(slot.start, filters.time, zone))
    return nextSlots.length ? [{ ...card, nextSlots }] : []
  })
}

export interface ProfessionalChoice { pick: ProPick; priceFingerprint: string; contextKey: string }
export function professionalChoice(pick: ProPick, card: ProfessionalCard, contextKey: string): ProfessionalChoice {
  return { pick, contextKey, priceFingerprint: JSON.stringify(card.price) }
}

/** A refresh may remove a professional/time or change the price. Never continue with a stale selection. */
export function resolveProfessionalChoice(list: ProfessionalList | undefined, choice: ProfessionalChoice | null, contextKey: string, now: number): { pick: ProPick; card: ProfessionalCard } | null {
  if (!list || !choice || choice.contextKey !== contextKey) return null
  const outcome = listOutcome(list)
  const cards = outcome.kind === "cards" ? outcome.cards : outcome.kind === "asap_none" ? outcome.alternatives : []
  const card = cards.find(card => card.proId === choice.pick.proId)
  if (!card || JSON.stringify(card.price) !== choice.priceFingerprint) return null
  const mode = offeredMode(outcome)
  if (choice.pick.asap) {
    if (mode !== "asap" || card.etaMinutes !== choice.pick.etaMinutes) return null
    const pick = pickFor(card, { asap: true })
    return pick ? { pick, card } : null
  }
  if (mode !== "scheduled" || Date.parse(choice.pick.slotStart) <= now) return null
  const pick = pickFor(card, { slotStart: choice.pick.slotStart })
  return pick ? { pick, card } : null
}

/*
  Daily picks (mechanic M7): GET /v1/dating/picks?tz=<IANA zone>.

  The deck's envelope: `{data: [cards], meta: {date, timezone, resets_at, size}}`,
  the cards in the deck's own shape. Up to ten a day, the same all day, made
  again at the viewer's local midnight (`meta.resets_at`). Acting on a pick
  spends no deck card, so its sparks and passes say `source: "picks"`.

    404 MECHANIC_NOT_ENABLED → picks are hidden;
    400 INVALID_TIMEZONE     → asked once more without a zone (the server
                               then uses its own default).
*/

import { nameLine, travelMarker } from "./people"
import { toDeckCard, type DeckCard } from "./pulse"
import { arr, num, obj, str, time, toDatingError } from "./wire"

/** The most picks a day holds (dating-service MaxDailyPicks). */
export const MAX_DAILY_PICKS = 10

export interface Picks {
  cards: DeckCard[]
  /** The viewer's local date, "2026-10-02"; "" when not sent. */
  date: string
  timezone: string
  /** When the next picks arrive; "" when unknown. */
  resetsAt: string
  size: number
}

/** Takes the whole response body, envelope included. */
export function toPicks(body: unknown): Picks {
  const b = obj(body)
  const meta = obj(b.meta)
  const seen = new Set<string>()
  const cards = arr(b.data)
    .map(toDeckCard)
    .filter((c): c is DeckCard => c !== null && !seen.has(c.candidateId) && !!seen.add(c.candidateId))
    .slice(0, MAX_DAILY_PICKS)
  return {
    cards,
    date: str(meta.date),
    timezone: str(meta.timezone),
    resetsAt: time(meta.resets_at),
    size: Math.max(num(meta.size), cards.length),
  }
}

/** The browser's IANA zone ("Asia/Kolkata"), or "" when it cannot say. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ""
  } catch {
    return ""
  }
}

/**
  Reads the picks with the viewer's zone. If the server does not know that
  zone (400 INVALID_TIMEZONE) it is asked once more with none; any other
  refusal, or a second one, is thrown as it came.
*/
export async function loadPicksWithZone<T>(load: (tz: string) => Promise<T>, tz: string): Promise<T> {
  try {
    return await load(tz)
  } catch (error) {
    if (tz && toDatingError(error).code === "INVALID_TIMEZONE") return load("")
    throw error
  }
}

/** The line under "Today's picks": "New picks at 12:00 am", in the reader's locale. */
export function picksResetLine(resetsAt: string, locale?: string): string {
  if (!resetsAt) return "New picks arrive every day at midnight."
  const at = new Date(resetsAt)
  if (Number.isNaN(at.getTime())) return "New picks arrive every day at midnight."
  return `New picks at ${at.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}`
}

/** Picks left on screen once the ones acted on (or gone) are taken out. */
export function picksLeft(picks: Pick<Picks, "cards">, gone: ReadonlySet<string>): DeckCard[] {
  return picks.cards.filter((c) => !gone.has(c.candidateId))
}

/** What a pick tile says to a screen reader. */
export function pickTileLabel(card: DeckCard): string {
  const marker = travelMarker(card.person)
  return `${nameLine(card.person)}.${marker ? ` ${marker}.` : ""} Open profile.`
}

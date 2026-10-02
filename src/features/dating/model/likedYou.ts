/*
  Who liked you (mechanic M4): GET /v1/dating/liked-you.

  Locked (the server's gate is on and the viewer has no pass): the total and
  blurred cards only. The server sends no name, id, note or full image, so a
  locked card has nothing to show but its blurred photo route and whether it
  was a Super Spark. Unlocked: each card carries the person.
*/

import { toPerson, type Person } from "./people"
import { arr, bool, num, obj, str, time } from "./wire"

export interface LikedYouCard {
  sparkId: string
  isSuper: boolean
  createdAt: string
  /** The server's route: blurred while locked, the person's photo when unlocked. "" when none. */
  photoUrl: string
  /** Present only when unlocked. */
  person: Person | null
  note: string
}

export interface LikedYou {
  total: number
  unlocked: boolean
  cards: LikedYouCard[]
}

export function toLikedYou(wire: unknown): LikedYou {
  const w = obj(wire)
  const unlocked = bool(w.unlocked)
  const cards = arr(w.items)
    .map((raw) => {
      const i = obj(raw)
      return {
        sparkId: str(i.spark_id),
        isSuper: bool(i.super),
        createdAt: time(i.created_at),
        photoUrl: str(i.photo_url),
        // Never trust a locked card to carry a person, even if one appears.
        person: unlocked ? toPerson(i.person) : null,
        note: unlocked ? str(i.note) : "",
      }
    })
    .filter((c) => c.sparkId)
  return { total: Math.max(num(w.total), cards.length), unlocked, cards }
}

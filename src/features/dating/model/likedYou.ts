/*
  Who liked you (mechanic M4): GET /v1/dating/liked-you.

  Locked (the server's gate is on and the viewer has no pass): the total and
  blurred cards only. The server sends no name, id, note or full image, so a
  locked card has nothing to show but its blurred photo route and whether it
  was a Super Spark. Unlocked: each card carries the person.
*/

import { likedYouPhotoPath, nameLine, photoPath, toPerson, type Person } from "./people"
import { arr, bool, num, obj, str, time, toDatingError } from "./wire"

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

/** One page of the grid (the server's own default). */
export const LIKED_YOU_PAGE = 50

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
        // Locked, only the always-blurred liked-you route is drawn; anything else (a /full path included) is dropped.
        photoUrl: unlocked ? photoPath(i.photo_url) : likedYouPhotoPath(i.photo_url),
        // Never trust a locked card to carry a person, even if one appears.
        person: unlocked ? toPerson(i.person) : null,
        note: unlocked ? str(i.note) : "",
      }
    })
    .filter((c) => c.sparkId)
  return { total: Math.max(num(w.total), cards.length), unlocked, cards }
}

/* ── words ───────────────────────────────────────────────────────── */

/** The header line: the total in our own words. */
export function likedYouHeadline(total: number): string {
  if (total <= 0) return "No one has sparked you yet."
  return total === 1 ? "1 person sparked you." : `${total} people sparked you.`
}

export const LIKED_YOU_CTA = "See who sparked you with a pass"

/** A locked tile's label. It names no one: the server sent nobody to name. */
export function lockedTileLabel(card: Pick<LikedYouCard, "isSuper">): string {
  return card.isSuper ? "Hidden Super Spark. See who sparked you with a pass." : "Hidden spark. See who sparked you with a pass."
}

/** An unlocked tile's label: the person, then what opening it does. */
export function unlockedTileLabel(card: Pick<LikedYouCard, "isSuper" | "person">): string {
  const who = card.person ? nameLine(card.person) : "Someone who has left Pulse"
  return `${who}${card.isSuper ? ", sent you a Super Spark" : ""}. Open profile.`
}

/** How many sparks the grid does not show (past the first page). */
export function moreThanShown(data: Pick<LikedYou, "total" | "cards">): number {
  return Math.max(0, data.total - data.cards.length)
}

/* ── a refused accept ────────────────────────────────────────────── */

/** 403 LIKED_YOU_LOCKED: the pass ran out (or the gate turned on) since the grid was read. */
export function isLikedYouLocked(error: unknown): boolean {
  return toDatingError(error).code === "LIKED_YOU_LOCKED"
}

/**
  The grid as it must look once the server has said it is locked, before the
  refetch lands: the same count and Super Spark marks, with every person,
  note and unblurred photo removed. Only a liked-you route survives.
*/
export function lockLikedYou(data: LikedYou): LikedYou {
  return {
    total: data.total,
    unlocked: false,
    cards: data.cards.map((c) => ({ sparkId: c.sparkId, isSuper: c.isSuper, createdAt: c.createdAt, photoUrl: likedYouPhotoPath(c.photoUrl), person: null, note: "" })),
  }
}

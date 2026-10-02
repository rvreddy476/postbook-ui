import { describe, expect, test } from "bun:test"
import { QueryClient } from "@tanstack/react-query"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { LikedYouGrid, LikedYouUpsell } from "../components/LikedYouGrid"
import { applyAcceptRefusal } from "../hooks/discovery"
import { KEYS } from "../hooks/profile"
import { LIKED_YOU_CTA, isLikedYouLocked, likedYouHeadline, lockLikedYou, lockedTileLabel, moreThanShown, toLikedYou, unlockedTileLabel, type LikedYou } from "../model/likedYou"
import { likedYouPhotoPath, photoPath, toPerson, viewablePhotoPath } from "../model/people"
import { NoSparksYet } from "../screens/HomeScreen"

import { readFixture } from "./contractFixtures"

const html = (node: React.ReactElement) => renderToStaticMarkup(node)
const noop = () => {}
const axiosError = (status: number, code: string) => ({ response: { status, data: { error: { code, message: "developer words" } } } })
/** The fixtures use one placeholder id for every card; give each its own so React keys are unique. */
const distinct = (data: LikedYou): LikedYou => ({ ...data, cards: data.cards.map((c, i) => ({ ...c, sparkId: `s${i}` })) })
const grid = (data: LikedYou) => html(<LikedYouGrid data={data} onOpen={noop} onUpsell={noop} onAccept={noop} onDecline={noop} />)

const locked = distinct(toLikedYou(readFixture("liked_you_get_200_locked").data))
const unlocked = distinct(toLikedYou(readFixture("liked_you_get_200_unlocked").data))

const person = (userId: string, firstName: string, age: number) => ({ user_id: userId, first_name: firstName, age, primary_photo_url: `/v1/dating/photos/p-${userId}/full`, photo_state: "full" })

describe("liked you: the photo routes", () => {
  test("a locked card's image is the liked-you route only, and never a person's photo", () => {
    expect(likedYouPhotoPath("/v1/dating/liked-you/abc/photo")).toBe("/v1/dating/liked-you/abc/photo")
    for (const bad of ["", "/v1/dating/liked-you/abc", "/v1/dating/liked-you/abc/photo?full=1", "/v1/dating/liked-you/a/b/photo", "https://evil.example/v1/dating/liked-you/abc/photo"]) {
      expect(likedYouPhotoPath(bad)).toBe("")
    }
    // The photo loader may read it; a person card may not carry it.
    expect(viewablePhotoPath("/v1/dating/liked-you/abc/photo")).toBe("/v1/dating/liked-you/abc/photo")
    expect(photoPath("/v1/dating/liked-you/abc/photo")).toBe("")
    expect(toPerson({ user_id: "u", primary_photo_url: "/v1/dating/liked-you/abc/photo" })?.photoUrl).toBe("")
  })

  test("locked, a smuggled person, note or full photo is dropped", () => {
    const l = toLikedYou({
      total: 1,
      unlocked: false,
      items: [{ spark_id: "s1", super: true, photo_url: "/v1/dating/photos/p1/full", person: person("u1", "Asha", 30), note: "hi" }],
    })
    expect(l.cards[0]).toMatchObject({ sparkId: "s1", isSuper: true, photoUrl: "", person: null, note: "" })
  })

  test("Go zero values: no total, no items, no flag is an empty locked grid", () => {
    expect(toLikedYou({ total: 0, items: null })).toEqual({ total: 0, unlocked: false, cards: [] })
    expect(toLikedYou(undefined)).toEqual({ total: 0, unlocked: false, cards: [] })
  })
})

describe("liked you: words", () => {
  test("the header gives the total in our own words", () => {
    expect(likedYouHeadline(0)).toBe("No one has sparked you yet.")
    expect(likedYouHeadline(1)).toBe("1 person sparked you.")
    expect(likedYouHeadline(12)).toBe("12 people sparked you.")
    for (const n of [0, 1, 12]) expect(likedYouHeadline(n)).not.toMatch(/likes? you|admirer|beeline/i)
  })

  test("a locked tile's label invents no name; an unlocked one names the person", () => {
    expect(lockedTileLabel({ isSuper: true })).toBe("Hidden Super Spark. See who sparked you with a pass.")
    expect(lockedTileLabel({ isSuper: false })).toBe("Hidden spark. See who sparked you with a pass.")
    expect(unlockedTileLabel(unlocked.cards[0])).toBe("Asha, 30, sent you a Super Spark. Open profile.")
    expect(unlockedTileLabel(unlocked.cards[1])).toBe("Asha, 30. Open profile.")
  })

  test("more than one page says how many are not shown", () => {
    expect(moreThanShown({ total: 60, cards: unlocked.cards })).toBe(58)
    expect(moreThanShown(unlocked)).toBe(0)
  })
})

describe("liked you: locked tiles", () => {
  const out = grid(locked)

  test("blurred tiles: no name, no profile link, no unblurred route", () => {
    expect(out).toContain('aria-label="Hidden Super Spark. See who sparked you with a pass."')
    expect(out).toContain('aria-label="Hidden spark. See who sparked you with a pass."')
    expect((out.match(/<button type="button" class="pulse-like__tile"/g) ?? []).length).toBe(2)
    expect(out).not.toContain("Asha")
    expect(out).not.toContain("/dating/people/")
    expect(out).not.toContain("/v1/dating/photos/")
    expect(out).not.toMatch(/\/full\b/)
    for (const c of locked.cards) expect(c.photoUrl).toMatch(/^\/v1\/dating\/liked-you\/[^/]+\/photo$/)
  })

  test("a lock pill on every tile, the star on the Super Spark only, and no answers to give", () => {
    expect((out.match(/pulse-like__lock/g) ?? []).length).toBe(2)
    expect((out.match(/pulse-like__star/g) ?? []).length).toBe(1)
    expect(out).not.toContain(">Spark back<")
    expect(out).not.toContain(">Decline<")
  })

  test("the call to action leads to a pass, with the count", () => {
    expect(out).toContain('href="/dating/premium"')
    expect(out).toContain(`>${LIKED_YOU_CTA}<`)
    expect(out).toContain("2 people are waiting to hear back")
    expect(html(<LikedYouUpsell total={1} />)).toContain("Someone is waiting to hear back")
  })

  test("a locked grid never draws a person, even one it was handed", () => {
    const sneaky: LikedYou = { ...unlocked, unlocked: false }
    const s = grid(sneaky)
    expect(s).not.toContain("Asha")
    expect(s).not.toContain(">Spark back<")
    expect(s).toContain("Hidden Super Spark")
  })
})

describe("liked you: unlocked tiles", () => {
  const out = grid(unlocked)

  test("the person, a way to open them, and both answers", () => {
    expect(out).toContain('aria-label="Asha, 30, sent you a Super Spark. Open profile."')
    expect(out).toContain(">Asha, 30<")
    expect(out).toContain("Loved your answer")
    expect((out.match(/>Spark back</g) ?? []).length).toBe(2)
    expect((out.match(/>Decline</g) ?? []).length).toBe(2)
    expect(out).toContain('aria-label="Spark back to Asha"')
    expect(out).toContain('aria-label="Decline Asha"')
  })

  test("no lock, no upsell", () => {
    expect(out).not.toContain("pulse-like__lock")
    expect(out).not.toContain(LIKED_YOU_CTA)
    expect(out).not.toContain("Hidden")
  })

  test("Super Sparks first, in the server's order, starred and outlined", () => {
    const data = toLikedYou({
      total: 2,
      unlocked: true,
      items: [
        { spark_id: "a", super: true, photo_url: "/v1/dating/photos/pb/full", person: person("ub", "Bina", 27) },
        { spark_id: "b", photo_url: "/v1/dating/photos/pc/full", person: person("uc", "Chen", 31) },
      ],
    })
    const g = grid(data)
    expect(g.indexOf("Bina, 27")).toBeLessThan(g.indexOf("Chen, 31"))
    expect((g.match(/pulse-like__star/g) ?? []).length).toBe(1)
    expect(g.indexOf("pulse-like__star")).toBeLessThan(g.indexOf("Chen, 31"))
    expect(g.indexOf('class="pulse-like pulse-like--super"')).toBeLessThan(g.indexOf('class="pulse-like"'))
    expect(g).not.toMatch(/super like/i)
  })

  test("nobody yet: the empty state", () => {
    expect(html(<NoSparksYet />)).toContain("No sparks waiting")
  })
})

describe("liked you: a refused accept switches the grid to locked", () => {
  const seeded = () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData(KEYS.likedYou, unlocked)
    return qc
  }

  test("403 LIKED_YOU_LOCKED: locked at once, nobody left on screen, and read again", () => {
    const qc = seeded()
    expect(applyAcceptRefusal(qc, axiosError(403, "LIKED_YOU_LOCKED"))).toBe(true)
    const after = qc.getQueryData<LikedYou>(KEYS.likedYou)!
    expect(after.unlocked).toBe(false)
    expect(after.total).toBe(2)
    expect(after.cards.map((c) => c.isSuper)).toEqual([true, false])
    expect(after.cards.every((c) => c.person === null && c.note === "" && c.photoUrl === "")).toBe(true)
    expect(qc.getQueryState(KEYS.likedYou)?.isInvalidated).toBe(true)
    // And the screen draws the locked view with its upsell.
    const out = grid(after)
    expect(out).toContain(LIKED_YOU_CTA)
    expect(out).not.toContain("Asha")
  })

  test("any other refusal leaves the grid as it was", () => {
    const qc = seeded()
    expect(applyAcceptRefusal(qc, axiosError(404, "CANDIDATE_UNAVAILABLE"))).toBe(false)
    expect(applyAcceptRefusal(qc, new Error("offline"))).toBe(false)
    expect(qc.getQueryData<LikedYou>(KEYS.likedYou)).toBe(unlocked)
    expect(qc.getQueryState(KEYS.likedYou)?.isInvalidated).toBe(false)
  })

  test("locking keeps only a liked-you image route", () => {
    const withRoute: LikedYou = { ...unlocked, cards: [{ ...unlocked.cards[0], photoUrl: "/v1/dating/liked-you/s0/photo" }] }
    expect(lockLikedYou(withRoute).cards[0].photoUrl).toBe("/v1/dating/liked-you/s0/photo")
    expect(isLikedYouLocked(axiosError(403, "LIKED_YOU_LOCKED"))).toBe(true)
    expect(isLikedYouLocked(axiosError(403, "FORBIDDEN"))).toBe(false)
  })
})

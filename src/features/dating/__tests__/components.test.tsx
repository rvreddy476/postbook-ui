import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { DatingNav, MORE_NAV, PRIMARY_NAV, hidesNav } from "../components/DatingFrame"
import { PhotoFrame } from "../components/DatingPhoto"
import { ClosedState } from "../components/Guard"
import { MatchCelebration } from "../components/MatchCelebration"
import { ReportForm } from "../components/SafetyActions"
import { SwipeDeck } from "../components/SwipeDeck"
import { CLOSED_TITLE } from "../model/errors"
import { toPerson } from "../model/people"
import { toDeck } from "../model/pulse"
import { DeckEmpty, MatchList, OutOfSparks } from "../screens/HomeScreen"
import { CountdownNotice } from "../screens/MatchScreen"
import { AgeRefusal, PhotoTile, StepHeader } from "../screens/OnboardingScreens"
import { PersonDetails } from "../screens/PersonScreen"
import { CheckoutOutcome, Holding, PassesUnavailable, ProductList } from "../screens/PremiumScreen"
import { WaitingState } from "../screens/RootScreen"
import { BlockList, MOBILE_SAFETY_LINE, contactCandidates } from "../screens/SafetyScreen"
import { ConsentAsk, MobileOnlyNotice, SelfieOutcome } from "../screens/SelfieScreen"
import { ConsentToggles, ExportList, PrivacyToggles } from "../screens/SettingsScreen"
import { toCatalogue, toMyPremium } from "../model/premium"
import { toMatches } from "../model/matches"
import { toConsents } from "../model/consents"

import { readFixture } from "./contractFixtures"

const html = (node: React.ReactElement) => renderToStaticMarkup(node)
const ascending = (text: string, words: string[]) => {
  const at = words.map((w) => text.indexOf(w))
  return at.every((x, i) => x >= 0 && (i === 0 || x > at[i - 1]))
}
const noop = () => {}
const deck = toDeck(readFixture("pulse_today_get_200_rich_card"))
const asha = deck.cards[0].person

describe("navigation", () => {
  test("the tabs and the More menu are alphabetical", () => {
    expect(PRIMARY_NAV.map((e) => e.label)).toEqual(["Deck", "Matches", "Sparks"])
    expect(MORE_NAV.map((e) => e.label)).toEqual(["Premium", "Safety", "Settings"])
    const out = html(<DatingNav pathname="/dating/matches" />)
    expect(ascending(out, [">Deck<", ">Matches<", ">Sparks<", ">More<", ">Premium<", ">Safety<", ">Settings<"])).toBe(true)
    expect(out).toContain('<a class="pulse-nav__link" aria-current="page" href="/dating/matches">')
    expect((out.match(/aria-current="page"/g) ?? []).length).toBe(1)
  })

  test("there are no tabs while setting up, so nothing leads round the selfie check", () => {
    expect(hidesNav("/dating/verify")).toBe(true)
    expect(hidesNav("/dating/onboarding/photos")).toBe(true)
    expect(hidesNav("/dating/matches")).toBe(false)
    expect(html(<DatingNav pathname="/dating/verify" />)).toBe("")
  })
})

describe("gate states", () => {
  test("outside the pilot: a friendly closed state, not an error", () => {
    const out = html(<ClosedState />)
    expect(out).toContain(CLOSED_TITLE.replace("'", "&#x27;"))
    expect(out).not.toContain('role="alert"')
    expect(out).not.toMatch(/error|404|not found/i)
  })

  test("review, paused and held are places to wait; only paused can resume", () => {
    expect(html(<WaitingState step="review" />)).toContain("being reviewed")
    expect(html(<WaitingState step="paused" onResume={noop} />)).toContain(">Resume<")
    const held = html(<WaitingState step="held" />)
    expect(held).toContain("on hold")
    expect(held).not.toContain(">Resume<")
  })

  test("the 18+ refusal says adults only", () => {
    const out = html(<AgeRefusal />)
    expect(out).toContain("Pulse is for adults only")
    expect(out).toContain("18 or older")
  })

  test("setup shows which step of five", () => {
    expect(html(<StepHeader step="photos" title="Your photos" />)).toContain("Step 4 of 5")
    expect(html(<StepHeader step={null} title="Your photos" />)).not.toContain("Step")
  })
})

describe("the deck", () => {
  test("Super Spark renders disabled by default and enabled only on request", () => {
    const off = html(<SwipeDeck cards={deck.cards} onAction={noop} />)
    expect(off).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Super Spark, not available yet"/)
    const on = html(<SwipeDeck cards={deck.cards} onAction={noop} superSparkEnabled />)
    expect(on).toContain('aria-label="Super Spark"')
    expect(on).not.toContain("not available yet")
  })

  test("the top card is focusable and names its keys; the actions have names", () => {
    const out = html(<SwipeDeck cards={deck.cards} onAction={noop} />)
    expect(out).toMatch(/role="group"[^>]*tabindex="0"/)
    expect(out).toContain("Arrow right to spark, arrow left to pass, Enter to open the profile.")
    for (const label of ["Pass", "Save for later", "Spark"]) expect(out).toContain(`aria-label="${label}"`)
    expect(out).toContain("Asha, 30")
    expect(out).toContain("Under 5 km away")
  })

  test("while the server decides, every action is disabled and the card is held", () => {
    const out = html(<SwipeDeck cards={deck.cards} pending="spark" onAction={noop} />)
    expect(out).toContain('data-pending="spark"')
    expect(out).toContain('aria-busy="true"')
    expect((out.match(/<button[^>]*disabled=""/g) ?? []).length).toBe(4)
  })

  test("no cards, no deck", () => {
    expect(html(<SwipeDeck cards={[]} onAction={noop} />)).toBe("")
  })

  test("distance is only ever a bucket label: no figure from the server reaches the card", () => {
    const out = html(<SwipeDeck cards={deck.cards} onAction={noop} />)
    expect(out).not.toContain("&lt; 5 km") // the server's own distance_label is not rendered
    expect(out.match(/\d+(\.\d+)?\s*km/g)).toEqual(["5 km"]) // only the bucket's own wording
  })

  test("out of cards for today, with the reset time when the server gives one", () => {
    const withTime = html(<DeckEmpty kind="out_for_today" deck={{ resetsAt: new Date(Date.now() + 3600_000).toISOString() }} />)
    expect(withTime).toContain("out of cards for today")
    expect(withTime).toMatch(/New ones arrive (at|\w+day at) /)
    expect(html(<DeckEmpty kind="out_for_today" deck={{ resetsAt: "" }} />)).toContain("New ones arrive tomorrow.")
    expect(html(<DeckEmpty kind="gathering" deck={{ resetsAt: "" }} />)).toContain("still gathering people")
    expect(html(<DeckEmpty kind="none_left" deck={{ resetsAt: "" }} onLookAgain={noop} />)).toContain(">Look again<")
  })

  test("out of sparks uses the server's limit and window", () => {
    const out = html(<OutOfSparks limit={{ limit: 50, windowHours: 24, resetsAt: "" }} onClose={noop} />)
    expect(out).toContain("out of sparks for now")
    expect(out).toContain("You can send 50 sparks every 24 hours.")
  })
})

describe("photos", () => {
  test("a loading or missing photo is a placeholder; a blurred one says so", () => {
    expect(html(<PhotoFrame load={{ state: "loading", src: "" }} alt="Asha" blurred={false} />)).toContain('aria-label="Loading photo"')
    const ready = html(<PhotoFrame load={{ state: "ready", src: "blob:x" }} alt="Asha photo" blurred />)
    expect(ready).toContain('src="blob:x"')
    expect(ready).toContain("Blurred until you match")
  })

  test("my photo shows its moderation state and the reason it was refused", () => {
    const tile = (over: object) =>
      html(<PhotoTile photo={{ id: "p1", mediaId: "m1", sortOrder: 0, isPrimary: false, visibility: "public", moderationStatus: "approved", moderationReason: "", createdAt: "", ...over }} busy={false} onPrimary={noop} onRemove={noop} onVisibility={noop} />)
    expect(tile({})).toContain(">Approved<")
    expect(tile({})).toContain(">Make main<")
    expect(tile({})).toContain('src="/v1/media/m1/serve"')
    expect(tile({ isPrimary: true })).toContain(">Main photo<")
    expect(tile({ isPrimary: true })).not.toContain(">Make main<")
    const refused = tile({ moderationStatus: "rejected", moderationReason: "Face not visible" })
    expect(refused).toContain(">Not accepted<")
    expect(refused).toContain("Face not visible")
    expect(ascending(tile({}), [">Everyone on Pulse<", ">Matches only<", ">People I&#x27;ve sparked<"])).toBe(true)
  })
})

describe("the match moment", () => {
  test("our own words, the person, and two ways on", () => {
    const out = html(<MatchCelebration person={asha} conversationId="c1" onClose={noop} />)
    expect(out).toContain("You both sparked")
    expect(out).toContain("You and Asha chose each other")
    expect(out).toContain(">Say hello<")
    expect(out).toContain(">Keep browsing<")
    expect(out).toContain('href="/messenger?conversation=c1"')
    expect(out).toMatch(/role="dialog"[^>]*aria-modal="true"/)
    expect(out).not.toMatch(/it&#x27;s a match/i)
  })
})

describe("full profile", () => {
  test("bio, prompts, languages, the distance bucket; verified only when verified", () => {
    const out = html(<PersonDetails person={asha} />)
    expect(out).toContain("Filter coffee, long drives")
    expect(out).toContain("My ideal Sunday is...")
    expect(ascending(out, [">English<", ">Telugu<"])).toBe(true)
    expect(out).toContain("Under 5 km away")
    expect(out).not.toContain("Verified")
    expect(html(<PersonDetails person={{ ...asha, verified: true }} />)).toContain("Verified")
  })
})

describe("matches", () => {
  test("the list links each match and shows no countdown without an expiry", () => {
    const matches = toMatches(readFixture("matches_get_200").data)
    const out = html(<MatchList matches={matches} />)
    expect(out).toContain('href="/dating/matches/%3Cmatch%3E"')
    expect(out).toContain("Asha, 30")
    expect(out).not.toContain("left to say hello")
  })

  test("the countdown notice", () => {
    expect(html(<CountdownNotice value={{ kind: "none", text: "" }} />)).toBe("")
    expect(html(<CountdownNotice value={{ kind: "running", text: "2h 30m left to say hello" }} />)).toContain("2h 30m left to say hello")
  })
})

describe("safety", () => {
  test("the report form offers the server's reasons alphabetically; other asks for a description", () => {
    const form = (reason: string) => html(<ReportForm name="Asha" reason={reason} details="" error="" busy={false} onReason={noop} onDetails={noop} onSubmit={noop} onCancel={noop} />)
    expect(ascending(form(""), [">Fake profile<", ">Harassment<", ">Hate speech<", ">Nudity or sexual content<", ">Scam or fraud<", ">Something else<", ">Spam<", ">Threats or violence<", ">Under 18<"])).toBe(true)
    expect(form("other")).toContain("What happened? (required)")
    expect(form("spam")).toContain("Anything to add? (optional)")
  })

  test("the block list, and one line for what is mobile-only", () => {
    expect(html(<BlockList blocks={[]} busyId="" onUnblock={noop} />)).toContain("haven&#x27;t blocked anyone")
    expect(html(<BlockList blocks={[{ userId: "u", firstName: "Asha", age: 30, blockedAt: "" }]} busyId="" onUnblock={noop} />)).toContain(">Unblock<")
    expect(MOBILE_SAFETY_LINE).toContain("mobile app only")
  })

  test("only current matches not already trusted can be added", () => {
    const matches = toMatches(readFixture("matches_get_200").data)
    expect(contactCandidates(matches, { items: [], max: 3 })).toEqual([{ userId: "<user_b>", name: "Asha, 30" }])
    expect(contactCandidates(matches, { items: [{ contactId: "<user_b>", shareLocationOnPanic: true, person: null }], max: 3 })).toEqual([])
  })
})

describe("selfie verification", () => {
  test("without a recorder or a camera: one clear notice, done in the mobile app, and no skip", () => {
    for (const reason of ["unsupported", "camera"] as const) {
      const out = html(<MobileOnlyNotice reason={reason} />)
      expect(out).toContain("Finish this step in the mobile app")
      expect(out).toContain("Selfie verification is done in the Momentum mobile app")
      expect(out).not.toMatch(/skip|later/i)
      expect(out).not.toContain("<a ")
      expect(out).not.toContain("<button")
    }
  })

  test("consent is asked before any challenge; declining keeps the door shut", () => {
    const out = html(<ConsentAsk declined busy={false} onAnswer={noop} />)
    expect(out).toContain(">Allow<")
    expect(out).toContain("required before you can see people or message")
    expect(out).not.toContain('href="/dating"')
  })

  test("passed, in review, retry with attempts left, limit reached", () => {
    expect(html(<SelfieOutcome view={{ kind: "passed" }} attemptsLeft={null} onRetry={noop} />)).toContain("You&#x27;re verified")
    const review = html(<SelfieOutcome view={{ kind: "in_review" }} attemptsLeft={null} onRetry={noop} />)
    expect(review).toContain("in review")
    expect(review).not.toContain("<button")
    const retry = html(<SelfieOutcome view={{ kind: "retry", copy: "We couldn't see you blink twice.", attemptsLeft: 3 }} attemptsLeft={5} onRetry={noop} />)
    expect(retry).toContain(">Try again<")
    expect(retry).toContain("3 attempts left today")
    const limit = html(<SelfieOutcome view={{ kind: "limit_reached" }} attemptsLeft={0} onRetry={noop} />)
    expect(limit).toContain("all the attempts for today")
    expect(limit).not.toContain("<button")
  })
})

describe("settings", () => {
  test("the five privacy toggles, alphabetical, as switches", () => {
    const out = html(<PrivacyToggles privacy={{ incognito: false, hideLastActive: true, verifiedOnlyFilter: false, blurPhotosUntilMatch: false, echoesConsent: false }} busy={false} onChange={noop} />)
    expect(ascending(out, ["Blur my photos until we match", "Hide when I was last active", "Incognito", "Show me verified people only", "Show my Momentum activity"])).toBe(true)
    expect((out.match(/role="switch"/g) ?? []).length).toBe(5)
    expect((out.match(/checked=""/g) ?? []).length).toBe(1)
  })

  test("consents, alphabetical, reflecting what is granted", () => {
    const out = html(<ConsentToggles consents={toConsents(readFixture("consents_get_200").data)} busy={false} onChange={noop} />)
    expect(ascending(out, [">Community<", ">Face check<", ">Momentum activity on your profile<", ">Religion<"])).toBe(true)
    expect((out.match(/checked=""/g) ?? []).length).toBe(1)
  })

  test("an export downloads only when ready", () => {
    const row = (status: string) => html(<ExportList exports={[{ id: "e1", status, requestedAt: "2026-10-01T10:00:00Z", completedAt: "" }]} busyId="" onDownload={noop} />)
    expect(row("pending")).toContain("Being prepared")
    expect(row("pending")).not.toContain(">Download<")
    expect(row("ready")).toContain(">Download<")
    expect(row("expired")).not.toContain(">Download<")
  })
})

describe("premium", () => {
  const products = toCatalogue(readFixture("premium_catalogue_get_200").data)
  const me = toMyPremium(readFixture("premium_me_get_200").data)
  const all = [
    html(<ProductList products={products} buyingId="" disabled={false} onBuy={noop} />),
    html(<Holding me={me} />),
    html(<PassesUnavailable />),
    ...(["confirming", "still_confirming"] as const).map((kind) => html(<CheckoutOutcome state={{ kind, productName: "30-day pass" }} onDone={noop} onCheckAgain={noop} />)),
    html(<CheckoutOutcome state={{ kind: "paid", productName: "30-day pass", refunding: false }} onDone={noop} onCheckAgain={noop} />),
    html(<CheckoutOutcome state={{ kind: "failed", productId: "pass_30d", productName: "30-day pass", reason: "" }} onDone={noop} onCheckAgain={noop} />),
    html(<CheckoutOutcome state={{ kind: "unavailable" }} onDone={noop} onCheckAgain={noop} />),
  ]

  test("the catalogue lists every product with the server's price", () => {
    expect(all[0]).toContain("30-day pass")
    expect(all[0]).toContain("365-day pass")
    expect(all[0]).toContain(">Boost<")
    expect(all[0]).toContain("399")
    expect((all[0].match(/>Buy</g) ?? []).length).toBe(4)
  })

  test("what I hold: the pass and the boost balance", () => {
    expect(all[1]).toContain("Your pass is active")
    expect(all[1]).toContain("1 Boost to use")
  })

  test("confirming, paid, failed and unavailable each say what they are", () => {
    expect(all[3]).toContain("Confirming your payment")
    expect(all[4]).toContain("Still confirming")
    expect(all[5]).toContain("Payment received")
    expect(all[6]).toContain("didn&#x27;t go through")
    expect(all[7]).toContain("Passes aren&#x27;t available yet")
    expect(all[2]).toContain("Passes aren&#x27;t available yet")
    // Confirming is not paid.
    expect(all[3]).not.toContain("Payment received")
    expect(html(<CheckoutOutcome state={{ kind: "idle", notice: "" }} onDone={noop} onCheckAgain={noop} />)).toBe("")
  })

  test("one-off passes only: no screen says subscription or renews", () => {
    for (const out of all) expect(out).not.toMatch(/subscri|renew/i)
  })
})

describe("house rules", () => {
  const root = resolve(import.meta.dir, "..")
  const app = resolve(import.meta.dir, "../../../app/dating")
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = resolve(dir, name)
      if (statSync(path).isDirectory()) return name === "__tests__" ? [] : walk(path)
      return /\.(ts|tsx|css)$/.test(name) ? [path] : []
    })
  const sources = [...walk(root), ...walk(app)].map((path) => ({ path, text: readFileSync(path, "utf8") }))

  test("the stylesheet and every source use theme tokens only: no hex colours", () => {
    expect(sources.length).toBeGreaterThan(30)
    for (const { path, text } of sources) {
      expect({ path, hex: text.match(/#[0-9a-f]{3,8}\b/gi) }).toEqual({ path, hex: null })
    }
    const css = readFileSync(resolve(root, "dating.css"), "utf8")
    expect(css).toContain("rgb(var(--")
    expect(css).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(\s*\d/)
    expect(css).toContain("prefers-reduced-motion")
  })

  test("no Tailwind palette colours", () => {
    const palette = /\b(bg|text|border|ring|from|to|via|fill|stroke|outline|shadow|divide|decoration)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(-\d{2,3})?\b/
    for (const { path, text } of sources) {
      expect({ path, palette: text.match(palette)?.[0] ?? null }).toEqual({ path, palette: null })
    }
  })

  test("type sizes: body 13–14px, meta 11–12px, nothing smaller", () => {
    const css = readFileSync(resolve(root, "dating.css"), "utf8")
    const sizes = [...css.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1]))
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11)
    expect(css).toMatch(/\.pulse-zone \{[^}]*font-size: 14px/)
  })

  test("the legacy client is left alone: nothing here imports from it", () => {
    for (const { path, text } of sources) {
      expect({ path, legacy: /postmatch/i.test(text) }).toEqual({ path, legacy: false })
    }
  })

  test("only lucide icons, by name", () => {
    for (const { path, text } of sources) {
      expect({ path, bad: /from "(react-icons|@heroicons|lucide-react\/)/.test(text) }).toEqual({ path, bad: false })
    }
  })

  test("the route files are thin", () => {
    for (const { path, text } of sources.filter((s) => s.path.includes(`${resolve(app)}`))) {
      expect({ path, lines: text.split("\n").length < 30 }).toEqual({ path, lines: true })
      expect({ path, client: text.includes('"use client"') }).toEqual({ path, client: false })
    }
  })
})

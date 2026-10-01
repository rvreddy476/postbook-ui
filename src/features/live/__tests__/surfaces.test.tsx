import { describe, expect, it } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { foundingEarnedStep } from "../discovery"
import { parseSupporters } from "../hearts"
import { FOUNDING_EARNED_COPY, FoundingBadge, FoundingEarnedNote } from "../components/FoundingBadge"
import { HeartCountView, StageHeartsView } from "../components/LiveHearts"
import { ReminderButtonView } from "../components/ReminderButton"
import { SupportersList, TopSupportersButton } from "../components/TopSupporters"

describe("FoundingBadge", () => {
  it("shows the label, the tooltip and an accessible name when the card has the badge", () => {
    const html = renderToStaticMarkup(<FoundingBadge badges={["founding_creator"]} />)
    expect(html).toContain(">Founding creator<")
    expect(html).toContain('title="One of the first creators to go live here"')
    expect(html).toContain('aria-label="Founding creator: One of the first creators to go live here"')
  })
  it("compact is the icon alone, still named", () => {
    const html = renderToStaticMarkup(<FoundingBadge badges={["founding_creator"]} compact />)
    expect(html).toContain("live-founding--compact")
    expect(html).toContain('aria-label="Founding creator')
    expect(html).not.toContain(">Founding creator<")
  })
  it("absent, empty, other badges and junk render nothing at all", () => {
    for (const badges of [undefined, null, [], ["other"], "founding_creator", [{ badge: "x" }]]) {
      expect(renderToStaticMarkup(<FoundingBadge badges={badges} />)).toBe("")
    }
  })
})

describe("FoundingEarnedNote (the host's ended panel)", () => {
  /** The polled rows of one host session, in order; the answer after the last one. */
  const walk = (rows: Array<{ status: string; creator?: { badges?: unknown } | null } | null>) => {
    let before: string[] | null = null
    let earned = false
    for (const row of rows) ({ before, earned } = foundingEarnedStep(before, row))
    return earned
  }
  it("earned: no badge on the card before the stream, the badge on it once the stream is over", () => {
    expect(walk([{ status: "scheduled", creator: { badges: [] } }, { status: "live", creator: {} }, { status: "ended", creator: { badges: ["founding_creator"] } }])).toBe(true)
    // A row with no creator card at all still counts as "no badge before".
    expect(walk([{ status: "starting" }, { status: "ended", creator: { badges: ["founding_creator"] } }])).toBe(true)
  })
  it("not earned: the creator already had it, or the stream did not grant it", () => {
    expect(walk([{ status: "live", creator: { badges: ["founding_creator"] } }, { status: "ended", creator: { badges: ["founding_creator"] } }])).toBe(false)
    expect(walk([{ status: "live", creator: { badges: [] } }, { status: "ended", creator: { badges: [] } }])).toBe(false)
    expect(walk([{ status: "live", creator: { badges: [] } }, { status: "failed", creator: {} }])).toBe(false)
  })
  it("a badge that shows up mid-stream on a later poll is not 'before': the first card is", () => {
    expect(walk([{ status: "live", creator: { badges: [] } }, { status: "live", creator: { badges: ["founding_creator"] } }, { status: "ended", creator: { badges: ["founding_creator"] } }])).toBe(true)
  })
  it("the line is not shown while the stream is still on", () => {
    expect(walk([{ status: "scheduled", creator: { badges: [] } }, { status: "live", creator: { badges: ["founding_creator"] } }])).toBe(false)
    expect(walk([null])).toBe(false)
  })
  it("a page opened on a stream that is already over never claims the badge was just earned", () => {
    expect(renderToStaticMarkup(<FoundingEarnedNote stream={{ status: "ended", creator: { badges: ["founding_creator"] } }} />)).toBe("")
  })
  it("no stream, or a stream still on air, shows nothing", () => {
    expect(renderToStaticMarkup(<FoundingEarnedNote stream={null} />)).toBe("")
    expect(renderToStaticMarkup(<FoundingEarnedNote stream={{ status: "live", creator: { badges: [] } }} />)).toBe("")
  })
  it("copy", () => {
    expect(FOUNDING_EARNED_COPY).toBe("You earned the Founding creator badge.")
  })
})

describe("hearts", () => {
  it("the count sits in text for readers and compact for the eye", () => {
    const html = renderToStaticMarkup(<HeartCountView count={1234} />)
    expect(html).toContain('aria-label="1,234 hearts"')
    expect(html).toContain(">1.2K<")
    expect(renderToStaticMarkup(<HeartCountView count={1} />)).toContain('aria-label="1 heart"')
  })
  it("the button sends when open and floats what it is given", () => {
    const html = renderToStaticMarkup(<StageHeartsView count={7} floating={[{ id: 1, x: 0.5, delay: 0 }, { id: 2, x: 0.2, delay: 90 }]} block={null} onTap={() => {}} />)
    expect(html).toContain('aria-label="Send a heart. 7 so far"')
    expect(html).not.toContain("aria-disabled")
    expect(html.split('class="live-heart"').length - 1).toBe(2)
    expect(html).toContain("animation-delay:90ms")
  })
  it("disabled with the right copy when signed out, banned, or off air", () => {
    const blocked = (block: "signed_out" | "banned" | "not_live") => renderToStaticMarkup(<StageHeartsView count={7} floating={[]} block={block} onTap={() => {}} />)
    expect(blocked("signed_out")).toContain('aria-label="Sign in to send hearts."')
    expect(blocked("banned")).toContain("You can&#x27;t send hearts on this stream.")
    expect(blocked("not_live")).toContain('aria-label="Hearts open when the stream is live."')
    for (const b of ["signed_out", "banned", "not_live"] as const) expect(blocked(b)).toContain('aria-disabled="true"')
  })
})

describe("top supporters", () => {
  const supporters = parseSupporters({
    data: [
      { user: { user_id: "u1", name: "Asha", avatar_url: "/a.png", badges: ["founding_creator"] }, hearts: 1200, messages: 4, rank: 1 },
      { user: { user_id: "u2", handle: "ben" }, hearts: 30, rank: 2 },
      { user: { user_id: "u3", name: "Cy" }, hearts: 2, messages: 1, rank: 3 },
      { user: { user_id: "u4", name: "Di" }, messages: 1, rank: 4 },
    ],
  })
  it("the list: rank, avatar, name, hearts, messages, and the founding mark on a supporter who has it", () => {
    const html = renderToStaticMarkup(<SupportersList supporters={supporters} />)
    expect(html).toContain('aria-label="Rank 1"')
    expect(html).toContain('src="/a.png"')
    expect(html).toContain(">Asha<")
    expect(html).toContain(">@ben<")
    expect(html).toContain('aria-label="1,200 hearts"')
    expect(html).toContain('aria-label="4 messages"')
    expect(html.split('role="img"').length - 1).toBe(1) // only Asha has the badge
    expect(html.split("live-supporters__row").length - 1).toBe(4)
  })
  it("the empty state invites the first heart", () => {
    expect(renderToStaticMarkup(<SupportersList supporters={[]} />)).toContain("Be the first to send a heart")
  })
  it("the chat header button shows three avatars, or a heart when there is nobody yet", () => {
    const html = renderToStaticMarkup(<TopSupportersButton supporters={supporters} onOpen={() => {}} />)
    expect(html).toContain('aria-label="Top supporters"')
    expect(html).toContain('src="/a.png"')
    expect(html).not.toContain(">D<") // the fourth is not in the stack
    const empty = renderToStaticMarkup(<TopSupportersButton supporters={[]} onOpen={() => {}} />)
    expect(empty).toContain("lucide-heart")
    expect(empty).not.toContain("live-supporters-btn__stack")
  })
})

describe("reminder button", () => {
  it("Notify me ↔ Reminder set, pressed state for assistive tech", () => {
    const off = renderToStaticMarkup(<ReminderButtonView on={false} onToggle={() => {}} />)
    expect(off).toContain("Notify me")
    expect(off).not.toContain("Reminder set")
    expect(off).toContain('aria-pressed="false"')
    const on = renderToStaticMarkup(<ReminderButtonView on onToggle={() => {}} busy />)
    expect(on).toContain("Reminder set")
    expect(on).toContain('aria-pressed="true"')
    expect(on).toContain("disabled")
  })
})

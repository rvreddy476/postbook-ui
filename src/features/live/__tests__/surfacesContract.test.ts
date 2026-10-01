import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  parseLiveCategories,
  parseLiveCreators,
  parseReminder,
  parseStreamPage,
  parseUserBadges,
} from "../discovery"
import { parseHeartsAnswer, parseSupporters } from "../hearts"

// Golden answers copied from live-service-v2
// (internal/http/testdata/contracts/live). A renamed field on either side
// fails here, not in the browser.
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(import.meta.dir, "contracts", "live", `${name}.json`), "utf8"))

describe("live surfaces: the backend's golden answers", () => {
  test("live list rows", () => {
    const page = parseStreamPage(fixture("live_list"))
    expect(page.items.length).toBeGreaterThan(0)
    const row = page.items[0]!
    expect(row.id).toBe("a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1")
    expect(row.status).toBe("live")
    expect(row.title).toBe("Friday jam, live")
    expect(["landscape", "portrait"]).toContain(row.orientation)
    expect(row.creator.user_id).toBe("22222222-2222-4222-8222-222222222222")
    expect(row.creator.name).toBeTruthy()
  })

  test("upcoming rows carry the reminder state", () => {
    const page = parseStreamPage(fixture("upcoming"))
    expect(page.items.length).toBeGreaterThan(0)
    expect(typeof page.items[0]!.reminder_count).toBe("number")
  })

  test("categories and creators that are live", () => {
    const cats = parseLiveCategories(fixture("categories_live"))
    expect(cats.map((c) => c.slug)).toEqual(["music", "gaming"])
    expect(cats[0]!.viewer_count).toBe(128)
    const creators = parseLiveCreators(fixture("creators_live"))
    expect(creators[0]!.stream_id).toBe("a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1")
    expect(creators[0]!.creator.badges).toContain("founding_creator")
  })

  test("reminder, hearts, supporters and badges", () => {
    expect(parseReminder(fixture("reminder"))).toEqual({ reminder_set: true, reminder_count: 3 })
    expect(parseHeartsAnswer(fixture("hearts"))).toBe(524)
    const supporters = parseSupporters(fixture("supporters"))
    expect(supporters[0]!.hearts).toBe(240)
    expect(supporters[0]!.rank).toBe(1)
    expect(supporters[0]!.user.name).toBe("Kiran")
    expect(parseUserBadges(fixture("badges"))).toEqual(["founding_creator"])
  })
})

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { chatAuthorName, chatRoleTag, parseChatList } from "../author"
import { chatReducer, initialChatState } from "../chat"
import { goLiveGate, parseEligibility, primaryAction, requirementView, requirementsFromError, viewerCapNote } from "../eligibility"
import { errorCode } from "../model"

// Golden answers copied byte for byte from live-service-v2
// (internal/http/testdata/contracts/live, commit 4476fa68). If the backend
// files change, copy them again: a renamed field fails here, not in the browser.
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(import.meta.dir, "contracts", "live", `${name}.json`), "utf8"))

describe("live eligibility and chat authors: the backend's golden answers", () => {
  test("eligibility_open_not_eligible → the nearly-ready panel, in plain words", () => {
    const e = parseEligibility(fixture("eligibility_open_not_eligible"))!
    expect(e.mode).toBe("open")
    expect(e.eligible).toBe(false)
    expect(e.pilot_only).toBe(false)
    expect(e.viewer_cap).toBe(200)
    expect(goLiveGate({ loading: false, eligibility: e })).toBe("nearly")
    expect(e.requirements.map(requirementView)).toEqual([
      { key: "email_verified", state: "met", text: "Email verified" },
      { key: "adult", state: "met", text: "You're 18 or over" },
      { key: "account_age", state: "todo", text: "Your account must be 7 days old (5 days to go)" },
      { key: "activity", state: "todo", text: "Publish 3 posts or reach 10 followers (1 of 3 posts, 4 of 10 followers)" },
      { key: "good_standing", state: "met", text: "Your account is in good standing" },
    ])
    expect(primaryAction(e.requirements)).toMatchObject({ kind: "link", label: "Create a post", href: "/create/post" })
    expect(viewerCapNote(e.viewer_cap)).toBe("Your first streams are limited to 200 viewers.")
  })

  test("eligibility_pilot → the closed-pilot notice, though every requirement is met", () => {
    const e = parseEligibility(fixture("eligibility_pilot"))!
    expect(e.mode).toBe("pilot")
    expect(e.eligible).toBe(false)
    expect(e.pilot_only).toBe(true)
    expect(e.requirements.every((r) => r.met === true)).toBe(true)
    expect(e.requirements.find((r) => r.key === "activity")?.followers).toEqual({ current: 0, needed: 10 })
    expect(goLiveGate({ loading: false, eligibility: e })).toBe("pilot")
  })

  test("error_live_not_eligible → the same panel from error.details.requirements", () => {
    const err = { response: { status: 403, data: fixture("error_live_not_eligible") } }
    expect(errorCode(err)).toBe("LIVE_NOT_ELIGIBLE")
    const rows = requirementsFromError(err)!
    expect(rows.map(requirementView)).toEqual([
      { key: "account_age", state: "todo", text: "Your account must be 7 days old (5 days to go)" },
      { key: "activity", state: "todo", text: "Publish 3 posts or reach 10 followers (1 of 3 posts, 4 of 10 followers)" },
    ])
    expect(goLiveGate({ loading: false, eligibility: null, refused: rows })).toBe("nearly")
  })

  test("chat_list → every row has a name that is not an id, and Host / Mod marks", () => {
    const rows = parseChatList(fixture("chat_list"))
    expect(rows).toHaveLength(4)
    const shown = rows.map((m) => [chatAuthorName(m.author), chatRoleTag(m, "", [])])
    expect(shown).toEqual([
      ["Viewer", undefined],
      ["@ben", undefined],
      ["కిరణ్", "Mod"],
      ["Asha Rao", "Host"],
    ])
    for (const m of rows) {
      expect(m.author?.user_id).toBe(m.user_id)
      expect(chatAuthorName(m.author)).not.toContain(m.user_id.slice(0, 8))
    }
    expect(rows[3]!.author).toEqual({
      user_id: "22222222-2222-4222-8222-222222222222",
      name: "Asha Rao",
      handle: "asha",
      avatar_url: "/v1/media/77777777-7777-4777-8777-777777777777/serve/avatar",
      badges: ["founding_creator"],
      role: "host",
    })
    // Any Unicode, emoji included, arrives intact.
    expect(rows[1]!.text).toBe("नमस्ते 🇮🇳")
    expect(rows[2]!.text).toBe("నమస్తే! Requests in chat 👨‍👩‍👧‍👦")
  })

  test("chat_list replays through the reducer oldest first, authors kept", () => {
    const state = chatReducer(initialChatState("a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1"), { type: "replay", messages: parseChatList(fixture("chat_list")) })
    expect(state.messages.map((m) => chatAuthorName(m.author))).toEqual(["Asha Rao", "కిరణ్", "@ben", "Viewer"])
  })
})

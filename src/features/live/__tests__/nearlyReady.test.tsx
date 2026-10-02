import { describe, expect, it } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { parseRequirements } from "../eligibility"
import { parseChatMessage } from "../author"
import { chatAuthorAvatar, chatAuthorName, chatRoleTag } from "../author"
import { ChatMessageRow } from "../components/ChatMessageRow"
import { NearlyReady } from "../components/NearlyReady"
import { STREAM_FULL_COPY, isStreamFull, viewerTokenRetry, watchErrorCopy } from "../errors"

const OPEN = parseRequirements([
  { key: "phone_verified", met: true },
  { key: "adult", met: true },
  { key: "account_age", met: false, current: 2, needed: 7, unit: "days" },
  { key: "activity", met: false, posts: { current: 1, needed: 3 }, followers: { current: 4, needed: 10 } },
  { key: "good_standing", met: null },
])

const panel = (rows = OPEN, props: Partial<React.ComponentProps<typeof NearlyReady>> = {}) =>
  renderToStaticMarkup(<NearlyReady requirements={rows} onRecheck={() => {}} {...props} />)

describe("the nearly-ready panel", () => {
  it("lists each requirement as done, still needed, or couldn't check", () => {
    const html = panel()
    expect(html).toContain("You&#x27;re nearly ready to go live")
    expect(html).toContain('data-key="phone_verified" data-state="met"')
    expect(html).toContain('data-key="account_age" data-state="todo"')
    expect(html).toContain('data-key="good_standing" data-state="unknown"')
    expect(html).toContain("Your account must be 7 days old (5 days to go)")
    expect(html).toContain("Publish 3 posts or reach 10 followers (1 of 3 posts, 4 of 10 followers)")
    // The state is words for a screen reader, not only an icon.
    expect(html).toContain('<span class="sr-only">Done: </span>')
    expect(html).toContain('<span class="sr-only">Still needed: </span>')
    expect(html).toContain("Couldn&#x27;t check")
    expect(html.match(/class="live-ready__tag"/g)).toHaveLength(1)
  })
  it("one primary button: Create a post when activity is what is missing", () => {
    const html = panel()
    expect(html.match(/live-btn--primary/g)).toHaveLength(1)
    expect(html).toContain('href="/create/post"')
    expect(html).toContain(">Create a post<")
    expect(html).not.toContain("Check again")
  })
  it("one primary button: Check again when nothing else helps", () => {
    const html = panel(parseRequirements([{ key: "account_age", met: false, current: 2, needed: 7, unit: "days" }]))
    expect(html.match(/live-btn--primary/g)).toHaveLength(1)
    expect(html).toContain('data-action="recheck"')
    expect(html).toContain("Check again")
    expect(html).not.toContain("/create/post")
    expect(panel(parseRequirements([{ key: "adult", met: false }]), { rechecking: true })).toContain("Checking…")
  })
  it("Learn more is a collapsed disclosure that opens in place", () => {
    const html = panel()
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain("Learn more")
    expect(html).toMatch(/class="live-ready__more" hidden=""/)
    const id = /aria-controls="([^"]+)"/.exec(html)?.[1]
    expect(id).toBeTruthy()
    expect(html).toContain(`id="${id}"`)
  })
  it("a refusal that came without rows still shows the panel and a way forward", () => {
    const html = panel([])
    expect(html).toContain("We couldn&#x27;t load what&#x27;s still needed.")
    expect(html).toContain("Check again")
    expect(html).not.toContain("<ul")
  })
})

describe("a chat row drawn from its author card", () => {
  const draw = (raw: Record<string, unknown>) => {
    const m = parseChatMessage({ id: "m1", stream_id: "s", text: "hello", created_at: "2026-10-02T09:01:00Z", ...raw })!
    return renderToStaticMarkup(
      <ChatMessageRow message={m} name={chatAuthorName(m.author)} avatarUrl={chatAuthorAvatar(m.author)} roleTag={chatRoleTag(m, "", [])} badges={m.author?.badges} actions={[]} onAction={() => {}} />,
    )
  }
  const USER = "22222222-2222-4222-8222-222222222222"
  it("host: name, avatar, Host mark and the Founding creator badge", () => {
    const html = draw({ user_id: USER, author: { user_id: USER, name: "Asha Rao", handle: "asha", avatar_url: "/v1/media/a/serve/avatar", badges: ["founding_creator"], role: "host" } })
    expect(html).toContain('class="live-chat__name">Asha Rao<')
    expect(html).toContain('src="/v1/media/a/serve/avatar"')
    expect(html).toContain('class="live-chat__role">Host<')
    expect(html).toContain('data-role="host"')
    expect(html).toContain("Founding creator")
  })
  it("moderator: Mod mark, no badge", () => {
    const html = draw({ user_id: USER, author: { user_id: USER, name: "Kiran", badges: [], role: "moderator" } })
    expect(html).toContain('class="live-chat__role">Mod<')
    expect(html).not.toContain("Founding creator")
  })
  it("no author card: Viewer, an initial for the avatar, never the id", () => {
    const html = draw({ user_id: USER })
    expect(html).toContain('class="live-chat__name">Viewer<')
    expect(html).not.toContain("live-chat__role")
    expect(html).not.toContain("<img")
    expect(html).not.toContain("2222")
  })
})

describe("a full stream (the new-streamer viewer cap)", () => {
  const full = { response: { status: 403, data: { error: { code: "STREAM_FULL", message: "raw" } } } }
  it("reads as full, not as no access", () => {
    expect(STREAM_FULL_COPY).toBe("This stream is full right now. Try again in a little while.")
    expect(watchErrorCopy(full)).toBe(STREAM_FULL_COPY)
    expect(isStreamFull(full)).toBe(true)
    expect(isStreamFull({ response: { status: 403, data: { error: { code: "NOT_FOLLOWER" } } } })).toBe(false)
    expect(watchErrorCopy({ response: { status: 403, data: { error: { code: "", message: "STREAM_FULL" } } } })).toBe("You don't have access to this stream.")
  })
  it("is not hammered: the viewer asks again, the page does not", () => {
    expect(viewerTokenRetry(0, full)).toBe(false)
  })
})

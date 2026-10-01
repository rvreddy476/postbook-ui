import { describe, expect, it } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { messageActions } from "../chat"
import { liveStatusView } from "../status"
import { ChatMessageRow } from "../components/ChatMessageRow"
import { ModerationPanel } from "../components/ModerationPanel"
import { LiveStatusBadge, LiveStatusPanel, ReconnectingNotice } from "../components/LiveStatus"
import { PilotNotice } from "../components/PilotNotice"
import { LivePageHeading } from "../components/LivePageHeading"

const HOST = "host"
const message = { id: "m1", stream_id: "s", user_id: "u1", text: "hello", created_at: "2026-10-01T10:00:00Z" }

function row(role: "host" | "moderator" | "viewer" | "guest", meId: string | null) {
  const actions = messageActions({ role, meId, hostId: HOST, authorId: message.user_id, moderators: [], banned: [] })
  return renderToStaticMarkup(<ChatMessageRow message={message} name="Asha" actions={actions} onAction={() => {}} />)
}

describe("host-only tools are hidden from viewers", () => {
  it("the options button appears only when the reader has an action on the message", () => {
    expect(row("viewer", "v")).toContain('aria-label="Message options"')
    expect(row("guest", null)).not.toContain("Message options")
    expect(row("viewer", "u1")).not.toContain("Message options")
  })
  it("the moderation panel does not render for viewers or guests", () => {
    const panel = (role: "host" | "moderator" | "viewer" | "guest") =>
      renderToStaticMarkup(
        <ModerationPanel role={role} banned={["b1"]} moderators={["m1"]} nameOf={(id) => id} onUnban={() => {}} onRemoveModerator={() => {}} />,
      )
    expect(panel("viewer")).toBe("")
    expect(panel("guest")).toBe("")
    expect(panel("moderator")).toContain("Banned from this stream")
    expect(panel("moderator")).not.toContain("Moderators")
    expect(panel("host")).toContain("Moderators")
    expect(panel("host")).toContain("Unban")
  })
})

describe("status components", () => {
  it("keeps the stream name, real status and return navigation in the header", () => {
    const html = renderToStaticMarkup(<LivePageHeading title="Weekend conversation" view={liveStatusView({ status: "reconnecting" })} studio />)
    expect(html).toContain("Weekend conversation")
    expect(html).toContain("Reconnecting")
    expect(html).toContain("Your broadcast studio")
    expect(html).toContain('aria-label="Back to live streams"')
  })
  it("shows a message's real avatar, time and body separately", () => {
    const html = renderToStaticMarkup(<ChatMessageRow message={message} name="Asha" avatarUrl="/avatar.png" roleTag="Host" actions={[]} onAction={() => {}} />)
    expect(html).toContain('src="/avatar.png"')
    expect(html).toContain('dateTime="2026-10-01T10:00:00Z"')
    expect(html).toContain('data-role="host"')
    expect(html).toContain('class="live-chat__message">hello')
  })
  it("badge shows the server status", () => {
    expect(renderToStaticMarkup(<LiveStatusBadge view={liveStatusView({ status: "starting" })} />)).toContain("Starting")
    expect(renderToStaticMarkup(<LiveStatusBadge view={liveStatusView({ status: "live" })} />)).toContain("live-badge--live")
  })
  it("Reconnecting renders a calm polite notice; other states render none", () => {
    const html = renderToStaticMarkup(<ReconnectingNotice view={liveStatusView({ status: "reconnecting" })} />)
    expect(html).toContain('role="status"')
    expect(html).toContain("We&#x27;ll pick up as soon as they&#x27;re back.")
    expect(renderToStaticMarkup(<ReconnectingNotice view={liveStatusView({ status: "live" })} />)).toBe("")
  })
  it("Ended panel states the reason", () => {
    const html = renderToStaticMarkup(<LiveStatusPanel view={liveStatusView({ status: "ended", ended_reason: "admin_stopped" })} />)
    expect(html).toContain("Stream ended")
    expect(html).toContain("Our moderators stopped this stream.")
  })
  it("pilot notice carries the closed-pilot copy", () => {
    expect(renderToStaticMarkup(<PilotNotice />)).toContain("Going live is in a closed pilot right now.")
  })
})

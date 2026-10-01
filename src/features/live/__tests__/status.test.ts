import { describe, expect, it } from "bun:test"

import {
  currentViewerCount,
  endedReasonCopy,
  liveStatusView,
  normalizeStatus,
  viewerCountLabel,
} from "../status"

describe("liveStatusView: every state, from the server's status only", () => {
  const cases: Array<[string, string, string, boolean, boolean, boolean, boolean]> = [
    // status, label, tone, connectPlayer, showChat, chatOpen, terminal
    ["scheduled", "Scheduled", "neutral", false, false, false, false],
    ["starting", "Starting", "calm", false, true, false, false],
    ["live", "Live", "live", true, true, true, false],
    ["reconnecting", "Reconnecting", "calm", true, true, true, false],
    ["ended", "Ended", "neutral", false, false, false, true],
    ["failed", "Failed", "danger", false, false, false, true],
  ]
  for (const [status, label, tone, connect, showChat, chatOpen, terminal] of cases) {
    it(`${status} → ${label}`, () => {
      for (const audience of ["viewer", "host"] as const) {
        const v = liveStatusView({ status: status as never }, audience)
        expect(v.kind).toBe(status as never)
        expect(v.label).toBe(label)
        expect(v.tone).toBe(tone as never)
        expect(v.connectPlayer).toBe(connect)
        expect(v.showChat).toBe(showChat)
        expect(v.chatOpen).toBe(chatOpen)
        expect(v.terminal).toBe(terminal)
      }
    })
  }

  it("only Live is labelled Live: Starting never claims Live before media", () => {
    const labels = ["scheduled", "starting", "reconnecting", "ended", "failed", "bogus", ""].map(
      (s) => liveStatusView({ status: s as never }).label,
    )
    expect(labels).not.toContain("Live")
    expect(liveStatusView({ status: "starting" }).connectPlayer).toBe(false)
  })

  it("Reconnecting carries a calm notice for viewer and host", () => {
    expect(liveStatusView({ status: "reconnecting" }, "viewer").body).toBe(
      "The host's connection dropped. We'll pick up as soon as they're back.",
    )
    expect(liveStatusView({ status: "reconnecting" }, "host").body).toBe(
      "Your connection dropped. Stay on this page and we'll pick up where you left off.",
    )
  })

  it("an unknown status is Unavailable, never Live and never terminal", () => {
    const v = liveStatusView({ status: "weird" as never })
    expect(normalizeStatus("weird")).toBe("unknown")
    expect(v.kind).toBe("unknown")
    expect(v.label).toBe("Unavailable")
    expect(v.connectPlayer).toBe(false)
    expect(v.terminal).toBe(false)
  })

  it("Scheduled says when, or 'soon' when Go sent nothing", () => {
    expect(liveStatusView({ status: "scheduled", scheduled_at: "" }).body).toBe("It will start soon.")
    expect(liveStatusView({ status: "scheduled", scheduled_at: null }).body).toBe("It will start soon.")
    expect(liveStatusView({ status: "scheduled", scheduled_at: "2026-10-02T10:00:00Z" }).body).toStartWith("Starts ")
  })
})

describe("Ended / Failed carry a human reason", () => {
  const viewer: Record<string, string> = {
    host_ended: "The host ended the stream.",
    host_lost: "The host's connection dropped for too long, so the stream ended.",
    room_finished: "The stream has finished.",
    admin_stopped: "Our moderators stopped this stream.",
    no_media: "No video reached us from the host, so the stream was closed.",
  }
  const host: Record<string, string> = {
    host_ended: "You ended the stream.",
    host_lost: "Your connection dropped for too long, so the stream ended.",
    room_finished: "The stream has finished.",
    admin_stopped: "Our moderators stopped this stream.",
    no_media: "No video reached us from your device, so the stream was closed.",
  }
  for (const reason of Object.keys(viewer)) {
    it(`ended_reason=${reason}`, () => {
      expect(liveStatusView({ status: "ended", ended_reason: reason as never }, "viewer").body).toBe(viewer[reason])
      expect(liveStatusView({ status: "ended", ended_reason: reason as never }, "host").body).toBe(host[reason])
      expect(endedReasonCopy(reason, "viewer")).toBe(viewer[reason])
    })
  }
  it("no reason (Go zero value) falls back to a plain sentence", () => {
    expect(liveStatusView({ status: "ended", ended_reason: "" }).body).toBe("This stream has ended.")
    expect(liveStatusView({ status: "ended", ended_reason: null }, "host").body).toBe("Your stream has ended.")
  })
  it("Failed: no_media explains itself; otherwise a generic line", () => {
    expect(liveStatusView({ status: "failed", ended_reason: "no_media" }).body).toBe(viewer.no_media)
    expect(liveStatusView({ status: "failed" }).body).toBe("Something went wrong before the stream could start.")
    expect(liveStatusView({ status: "failed" }, "host").title).toBe("Your stream couldn't start")
  })
})

describe("viewer count is the server's count without the host", () => {
  it("uses viewer_count, never the peak", () => {
    expect(currentViewerCount({ viewer_count: 3 }, null)).toBe(3)
    expect(currentViewerCount({ viewer_count: 0, viewer_peak: 40 } as never, null)).toBe(0)
    expect(currentViewerCount({} as never, null)).toBe(0)
    expect(currentViewerCount(null, null)).toBe(0)
  })
  it("a viewer.count frame wins over the polled row, including a drop to zero", () => {
    expect(currentViewerCount({ viewer_count: 3 }, 5)).toBe(5)
    expect(currentViewerCount({ viewer_count: 3 }, 0)).toBe(0)
    expect(currentViewerCount({ viewer_count: 3 }, -1)).toBe(3)
  })
  it("labels", () => {
    expect(viewerCountLabel(0)).toBe("No viewers yet")
    expect(viewerCountLabel(1)).toBe("1 watching")
    expect(viewerCountLabel(12)).toBe("12 watching")
  })
})

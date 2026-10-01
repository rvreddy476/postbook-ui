import { describe, expect, it } from "bun:test";

import { chatReducer, initialChatState } from "@/features/live/chat";
import { liveByCreator, parseLiveCreators } from "@/features/live/discovery";
import type { LiveChatMessage } from "@/features/live/model";
import { DEFAULT_PREFS, parsePrefs } from "@/features/reels/playback/playerPrefs";
import { liveMoreItems } from "../liveMenu";
import { liveRingLabel, reelLiveHref } from "../liveRing";
import { liveMuted, toggleLiveSound } from "../liveSound";
import { OVERLAY_CHAT_COUNT, overlayMessages, overlayName } from "../overlayChat";

const msg = (n: number, extra: Partial<LiveChatMessage> = {}): LiveChatMessage => ({
  id: `m${n}`,
  stream_id: "s1",
  user_id: `u${n}`,
  text: `message ${n}`,
  created_at: new Date(Date.parse("2026-10-02T10:00:00Z") + n * 1000).toISOString(),
  ...extra,
});

describe("overlay chat window", () => {
  it("shows the last few messages, oldest of them first", () => {
    const messages = [1, 2, 3, 4, 5, 6, 7].map((n) => msg(n));
    expect(OVERLAY_CHAT_COUNT).toBe(4);
    expect(overlayMessages({ messages, removed: [] }).map((m) => m.id)).toEqual(["m4", "m5", "m6", "m7"]);
    expect(overlayMessages({ messages, removed: [] }, 2).map((m) => m.id)).toEqual(["m6", "m7"]);
  });

  it("fewer than the window shows what there is; none shows nothing", () => {
    expect(overlayMessages({ messages: [msg(1)], removed: [] }).map((m) => m.id)).toEqual(["m1"]);
    expect(overlayMessages({ messages: [], removed: [] })).toEqual([]);
    expect(overlayMessages({ messages: [msg(1)], removed: [] }, 0)).toEqual([]);
  });

  it("a removed message is dropped even when a late echo left it in the list", () => {
    const messages = [1, 2, 3, 4, 5].map((n) => msg(n));
    expect(overlayMessages({ messages, removed: ["m4"] }).map((m) => m.id)).toEqual(["m1", "m2", "m3", "m5"]);
  });

  it("removal through the chat reducer leaves the window without it", () => {
    let chat = initialChatState("s1");
    for (const n of [1, 2, 3]) chat = chatReducer(chat, { type: "sent", message: msg(n) });
    chat = chatReducer(chat, { type: "removed_locally", message_id: "m2" });
    // A late echo of the removed message must not bring it back.
    chat = chatReducer(chat, { type: "sent", message: msg(2) });
    expect(overlayMessages(chat).map((m) => m.id)).toEqual(["m1", "m3"]);
  });

  it("Go zero values: a message with no text or no id is not a row", () => {
    const messages = [msg(1), msg(2, { text: "" }), msg(3, { text: "   " }), { ...msg(4), text: undefined as unknown as string }, msg(5, { id: "" }), msg(6)];
    expect(overlayMessages({ messages, removed: [] }).map((m) => m.id)).toEqual(["m1", "m6"]);
  });

  it("names fall through empty values and never show an id", () => {
    expect(overlayName({ display_name: "Asha", username: "asha" })).toBe("Asha");
    expect(overlayName({ display_name: "", first_name: "Asha" })).toBe("Asha");
    expect(overlayName({ display_name: "", first_name: "", username: "asha" })).toBe("@asha");
    expect(overlayName({})).toBe("Someone");
    expect(overlayName(undefined)).toBe("Someone");
  });
});

describe("mute preference", () => {
  it("a browser that never chose starts muted, like reels", () => {
    expect(liveMuted(DEFAULT_PREFS)).toBe(true);
    expect(liveMuted(parsePrefs(null))).toBe(true);
    expect(liveMuted(parsePrefs("not json"))).toBe(true);
  });

  it("once unmuted it stays on through the stored reels preference", () => {
    const next = { ...DEFAULT_PREFS, ...toggleLiveSound(DEFAULT_PREFS) };
    expect(liveMuted(next)).toBe(false);
    // What the next stream, the next visit and the reels stage read back.
    expect(liveMuted(parsePrefs(JSON.stringify(next)))).toBe(false);
  });

  it("muting again turns it off and keeps the volume", () => {
    const on = { ...DEFAULT_PREFS, sound: true, volume: 0.4 };
    expect(toggleLiveSound(on)).toEqual({ sound: false });
    expect(liveMuted({ ...on, ...toggleLiveSound(on) })).toBe(true);
  });

  it("unmuting never lands on volume 0", () => {
    expect(toggleLiveSound({ sound: false, volume: 0 })).toEqual({ sound: true, volume: 1 });
    expect(toggleLiveSound({ sound: false, volume: 0.4 })).toEqual({ sound: true, volume: 0.4 });
  });

  it("only an explicit true is sound on", () => {
    expect(liveMuted({ sound: undefined as unknown as boolean })).toBe(true);
  });
});

describe("LIVE ring", () => {
  const U1 = "11111111-1111-4111-8111-111111111111";
  const U2 = "22222222-2222-4222-8222-222222222222";
  const live = liveByCreator(
    parseLiveCreators({
      data: [
        { creator: { user_id: U1, name: "Asha" }, stream_id: "s-tall", viewer_count: 12, orientation: "portrait" },
        // Go omits a zero viewer_count and the default orientation.
        { creator: { user_id: U2 }, stream_id: "s-wide" },
        // No stream id: cannot be opened, so it is not a ring.
        { creator: { user_id: "33333333-3333-4333-8333-333333333333" } },
      ],
    }),
  );

  it("a creator who is live is ringed and opens their stream where it is watched", () => {
    expect(reelLiveHref(U1, live)).toBe("/reels/live/s-tall");
    expect(reelLiveHref(U2, live)).toBe("/posttube/live/s-wide");
  });

  it("a creator who is not in the live list has no ring", () => {
    expect(reelLiveHref("44444444-4444-4444-8444-444444444444", live)).toBe("");
    expect(reelLiveHref("33333333-3333-4333-8333-333333333333", live)).toBe("");
  });

  it("no author, no answer yet, or an empty list is never a ring", () => {
    expect(reelLiveHref("", live)).toBe("");
    expect(reelLiveHref(undefined, live)).toBe("");
    expect(reelLiveHref(U1, null)).toBe("");
    expect(reelLiveHref(U1, new Map())).toBe("");
    expect(reelLiveHref(U1, liveByCreator(parseLiveCreators({})))).toBe("");
  });

  it("the ringed avatar says what it does", () => {
    expect(liveRingLabel("Asha")).toBe("Asha is live. Watch now");
    expect(liveRingLabel("")).toBe("This creator is live. Watch now");
  });
});

describe("More menu", () => {
  const labels = (ctx: { canReport: boolean; landscape: boolean }) => liveMoreItems(ctx).map((i) => i.label);

  it("is alphabetical in every combination", () => {
    for (const canReport of [true, false]) {
      for (const landscape of [true, false]) {
        const got = labels({ canReport, landscape });
        expect(got).toEqual([...got].sort((a, b) => a.localeCompare(b)));
      }
    }
    expect(labels({ canReport: true, landscape: true })).toEqual(["Copy link", "Report", "Watch on PostTube"]);
  });

  it("Report is offered only to someone who may report (never the host or a signed-out reader)", () => {
    expect(labels({ canReport: true, landscape: false })).toEqual(["Copy link", "Report"]);
    expect(labels({ canReport: false, landscape: false })).toEqual(["Copy link"]);
  });

  it("Watch on PostTube is offered only for a landscape stream", () => {
    expect(liveMoreItems({ canReport: false, landscape: true }).map((i) => i.key)).toEqual(["copy-link", "watch-on-posttube"]);
    expect(liveMoreItems({ canReport: true, landscape: false }).some((i) => i.key === "watch-on-posttube")).toBe(false);
  });
});

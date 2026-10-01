import { describe, expect, it } from "bun:test";

import { parseStream, type StreamRow } from "@/features/live/discovery";
import {
  LIVE_TABS,
  activeIndex,
  canStep,
  clampIndex,
  liveEmptyCopy,
  liveStageState,
  liveTabFilters,
  liveTabFromSearch,
  liveTabRequest,
  neighbours,
  portraitLive,
  shouldConnect,
  stageList,
  stageModes,
  stepIndex,
  upcomingPortrait,
  upcomingTabRequest,
} from "../liveStage";

const NOW = Date.parse("2026-10-02T10:00:00Z");

/** A row as the server sends it; Go omits zero values, so only what is set is on the wire. */
const row = (id: string, extra: Record<string, unknown> = {}): StreamRow =>
  parseStream({ id, creator_user_id: `u-${id}`, title: `Stream ${id}`, status: "live", orientation: "portrait", ...extra }) as StreamRow;

describe("tabs and request params", () => {
  it("For you is the bare path; Following is ?feed=following", () => {
    expect(LIVE_TABS.map((t) => [t.label, t.href])).toEqual([["For you", "/reels/live"], ["Following", "/reels/live?feed=following"]]);
    expect(liveTabFromSearch(new URLSearchParams(""))).toBe("for-you");
    expect(liveTabFromSearch(new URLSearchParams("feed=following"))).toBe("following");
    expect(liveTabFromSearch(new URLSearchParams("feed=anything"))).toBe("for-you");
    expect(liveTabFromSearch(null)).toBe("for-you");
  });

  it("the live list always asks for portrait streams that are live", () => {
    expect(liveTabRequest("for-you")).toEqual({ status: "live", orientation: "portrait", limit: "24" });
    expect(liveTabFilters("for-you")).toEqual({ orientation: "portrait" });
  });

  it("Following adds following=true and nothing else changes", () => {
    expect(liveTabRequest("following")).toEqual({ status: "live", orientation: "portrait", following: "true", limit: "24" });
    expect("following" in liveTabRequest("for-you")).toBe(false);
    expect(liveTabRequest("following", "c2").cursor).toBe("c2");
  });

  it("the upcoming list of the empty state is portrait too, and follows the tab", () => {
    expect(upcomingTabRequest("for-you")).toEqual({ orientation: "portrait", limit: "12" });
    expect(upcomingTabRequest("following")).toEqual({ orientation: "portrait", following: "true", limit: "12" });
  });
});

describe("the list is portrait and live only", () => {
  it("drops landscape rows even when they are live", () => {
    const rows = [row("a"), row("wide", { orientation: "landscape" }), row("old")];
    // A row from before the contract has no orientation: it reads as landscape and stays out.
    const legacy = parseStream({ id: "legacy", status: "live" }) as StreamRow;
    expect(portraitLive([...rows, legacy]).map((r) => r.id)).toEqual(["a", "old"]);
  });

  it("drops every status but live", () => {
    const rows = ["scheduled", "starting", "live", "reconnecting", "ended", "failed", "", "LIVE"].map((status, i) => row(`s${i}`, { status }));
    expect(portraitLive(rows).map((r) => r.status)).toEqual(["live"]);
  });

  it("keeps each stream once, in the server's order", () => {
    expect(portraitLive([row("b"), row("a"), row("b")]).map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("upcoming: scheduled portrait streams still ahead, soonest first", () => {
    const rows = [
      row("late", { status: "scheduled", scheduled_at: "2026-10-04T10:00:00Z" }),
      row("soon", { status: "scheduled", scheduled_at: "2026-10-02T12:00:00Z" }),
      row("past", { status: "scheduled", scheduled_at: "2026-10-01T10:00:00Z" }),
      row("wide", { status: "scheduled", scheduled_at: "2026-10-02T11:00:00Z", orientation: "landscape" }),
      row("live"),
    ];
    expect(upcomingPortrait(rows, NOW).map((r) => r.id)).toEqual(["soon", "late"]);
  });
});

describe("stageList", () => {
  it("a stream opened by id is first whatever its shape or status, and never twice", () => {
    const pinned = row("p", { orientation: "landscape", status: "scheduled" });
    expect(stageList(pinned, [row("a"), row("p"), row("b")]).map((r) => r.id)).toEqual(["p", "a", "b"]);
    expect(stageList(pinned, [])[0]).toBe(pinned);
  });

  it("without a pinned stream it is the portrait live list", () => {
    expect(stageList(null, [row("a"), row("w", { orientation: "landscape" })]).map((r) => r.id)).toEqual(["a"]);
    expect(stageList(undefined, [])).toEqual([]);
  });

  it("the stream being watched keeps its place when it leaves the live list", () => {
    const watching = row("b");
    expect(stageList(null, [row("a"), row("c")], { row: watching, index: 1 }).map((r) => r.id)).toEqual(["a", "b", "c"]);
    // Still listed: nothing is inserted.
    expect(stageList(null, [row("a"), row("b"), row("c")], { row: watching, index: 0 }).map((r) => r.id)).toEqual(["a", "b", "c"]);
    // Its old place is past the end of a shorter list: it goes last.
    expect(stageList(null, [row("a")], { row: watching, index: 5 }).map((r) => r.id)).toEqual(["a", "b"]);
    // Never ahead of a pinned stream.
    expect(stageList(row("p"), [row("a")], { row: watching, index: 0 }).map((r) => r.id)).toEqual(["p", "b", "a"]);
  });
});

describe("navigation bounds", () => {
  it("steps inside the list and stops at both ends without wrapping", () => {
    expect(stepIndex(0, 1, 3)).toBe(1);
    expect(stepIndex(1, -1, 3)).toBe(0);
    expect(stepIndex(0, -1, 3)).toBe(0);
    expect(stepIndex(2, 1, 3)).toBe(2);
  });

  it("an empty or one-item list never moves", () => {
    expect(stepIndex(0, 1, 0)).toBe(0);
    expect(stepIndex(0, -1, 0)).toBe(0);
    expect(stepIndex(0, 1, 1)).toBe(0);
    expect(canStep(0, 1, 1)).toBe(false);
    expect(canStep(0, 1, 0)).toBe(false);
  });

  it("canStep says which arrow is live", () => {
    expect([canStep(0, -1, 3), canStep(0, 1, 3)]).toEqual([false, true]);
    expect([canStep(2, -1, 3), canStep(2, 1, 3)]).toEqual([true, false]);
  });

  it("clampIndex pulls a stale index back into the list", () => {
    expect(clampIndex(7, 3)).toBe(2);
    expect(clampIndex(-1, 3)).toBe(0);
    expect(clampIndex(1.9, 3)).toBe(1);
    expect(clampIndex(4, 0)).toBe(0);
    expect(clampIndex(Number.NaN, 3)).toBe(0);
  });

  it("activeIndex finds the stream on stage; an unknown or unset id is the top", () => {
    const list = [row("a"), row("b"), row("c")];
    expect(activeIndex(list, "c")).toBe(2);
    expect(activeIndex(list, "gone")).toBe(0);
    expect(activeIndex(list, null)).toBe(0);
    expect(activeIndex([], "a")).toBe(0);
  });
});

describe("one room at a time", () => {
  it("only the active item connects", () => {
    const list = [row("a"), row("b"), row("c")];
    expect(stageModes(list, 1, true, NOW)).toEqual(["cover", "connected", "cover"]);
    for (let active = 0; active < list.length; active++) {
      expect(stageModes(list, active, true, NOW).filter((m) => m === "connected")).toHaveLength(1);
    }
  });

  it("nothing connects while the tab is hidden", () => {
    const list = [row("a"), row("b"), row("c")];
    expect(stageModes(list, 1, false, NOW)).toEqual(["cover", "cover", "cover"]);
    expect(shouldConnect({ active: true, pageVisible: false, player: true })).toBe(false);
  });

  it("a neighbour never connects, however live it is", () => {
    expect(shouldConnect({ active: false, pageVisible: true, player: true })).toBe(false);
  });

  it("the active item connects only while media can flow", () => {
    expect(shouldConnect({ active: true, pageVisible: true, player: true })).toBe(true);
    expect(shouldConnect({ active: true, pageVisible: true, player: false })).toBe(false);
    for (const status of ["scheduled", "starting", "ended", "failed", ""]) {
      expect(stageModes([row("a", { status })], 0, true, NOW)).toEqual(["cover"]);
    }
    // The host's connection dropped: the room is still joined, waiting for them.
    expect(stageModes([row("a", { status: "reconnecting" })], 0, true, NOW)).toEqual(["connected"]);
  });

  it("a viewer who was refused (banned, followers only, signed out) holds no connection", () => {
    expect(shouldConnect({ active: true, pageVisible: true, player: true, refused: true })).toBe(false);
  });

  it("neighbours are the rows either side, for their covers", () => {
    const list = ["a", "b", "c", "d"];
    expect(neighbours(list, 1)).toEqual(["a", "c"]);
    expect(neighbours(list, 0)).toStrictEqual(["b"]);
    expect(neighbours(list, 3)).toStrictEqual(["c"]);
    expect(neighbours(list, 3)).toHaveLength(1);
    expect(neighbours(["a"], 0)).toEqual([]);
    expect(neighbours([], 0)).toEqual([]);
  });
});

describe("what the stage shows per status", () => {
  it("LIVE is shown for status live and for nothing else", () => {
    expect(liveStageState(row("a"), NOW)).toMatchObject({ kind: "live", player: true, liveBadge: true, chat: true });
    for (const status of ["scheduled", "starting", "reconnecting", "ended", "failed", "", "LIVE", "paused"]) {
      expect([status, liveStageState(row("a", { status }), NOW).liveBadge]).toEqual([status, false]);
    }
  });

  it("reconnecting keeps the player and the chat but not the badge", () => {
    expect(liveStageState(row("a", { status: "reconnecting" }), NOW)).toMatchObject({ kind: "live", player: true, liveBadge: false, chat: true });
  });

  it("scheduled is the waiting card: Notify me, and a countdown only while the time is ahead", () => {
    expect(liveStageState(row("a", { status: "scheduled", scheduled_at: "2026-10-02T11:00:00Z" }), NOW)).toMatchObject({ kind: "waiting", player: false, canRemind: true, countdown: true });
    expect(liveStageState(row("a", { status: "scheduled", scheduled_at: "2026-10-02T09:00:00Z" }), NOW)).toMatchObject({ kind: "waiting", canRemind: true, countdown: false });
    // Go omitted the time: still a waiting card, no countdown.
    expect(liveStageState(row("a", { status: "scheduled" }), NOW)).toMatchObject({ kind: "waiting", canRemind: true, countdown: false });
  });

  it("ended links to the video the recording became, else the file, else neither", () => {
    expect(liveStageState(row("a", { status: "ended", recording_post_id: "p1", recording_url: "https://cdn.example/x.mp4" }), NOW)).toMatchObject({ kind: "ended", player: false, recordingHref: "/posttube/watch/p1", recordingUrl: "" });
    expect(liveStageState(row("a", { status: "ended", recording_post_id: "", recording_url: "https://cdn.example/x.mp4" }), NOW)).toMatchObject({ kind: "ended", recordingHref: "", recordingUrl: "https://cdn.example/x.mp4" });
    expect(liveStageState(row("a", { status: "ended" }), NOW)).toMatchObject({ kind: "ended", recordingHref: "", recordingUrl: "" });
  });

  it("failed and unknown statuses never mount a player", () => {
    expect(liveStageState(row("a", { status: "failed" }), NOW)).toMatchObject({ kind: "failed", player: false });
    expect(liveStageState(row("a", { status: "" }), NOW)).toMatchObject({ kind: "unavailable", player: false });
  });

  it("a landscape stream is letterboxed and offers PostTube; a portrait one does neither", () => {
    expect(liveStageState(row("w 1", { orientation: "landscape" }), NOW)).toMatchObject({ letterbox: true, posttubeHref: "/posttube/live/w%201" });
    expect(liveStageState(row("a"), NOW)).toMatchObject({ letterbox: false, posttubeHref: "" });
    // No orientation on the wire reads as landscape (rows from before the contract).
    expect(liveStageState(parseStream({ id: "x", status: "live" }) as StreamRow, NOW).letterbox).toBe(true);
  });
});

describe("empty state copy", () => {
  it("For you says nothing is live; Following asks a signed-out reader to sign in", () => {
    expect(liveEmptyCopy({ tab: "for-you", signedIn: false }).title).toBe("Nothing live right now");
    expect(liveEmptyCopy({ tab: "for-you", signedIn: true }).actionHref).toBeUndefined();
    expect(liveEmptyCopy({ tab: "following", signedIn: false })).toMatchObject({ actionLabel: "Sign in", actionHref: "/login?next=%2Freels%2Flive%3Ffeed%3Dfollowing" });
    expect(liveEmptyCopy({ tab: "following", signedIn: true })).toMatchObject({ actionLabel: "Go to For you", actionHref: "/reels/live" });
  });
});

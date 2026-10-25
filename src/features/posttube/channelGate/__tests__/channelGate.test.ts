import { describe, expect, test } from "bun:test";

import { channelGateState, needsChannel, studioNeedsChannel } from "../ChannelGate";

const base = { signedIn: true, pending: false, error: false, hasChannel: false };

describe("channel gate", () => {
  test("only long videos and podcasts need a channel (the backend's rule)", () => {
    expect(needsChannel("long")).toBe(true);
    expect(needsChannel("podcast")).toBe(true);
    expect(needsChannel("short")).toBe(false);
    expect(needsChannel("reel")).toBe(false);
  });

  test("a long video without a channel asks for it first; with one the studio opens", () => {
    expect(channelGateState({ ...base, contentType: "long" })).toBe("no-channel");
    expect(channelGateState({ ...base, contentType: "long", hasChannel: true })).toBe("ready");
  });

  test("reels and shorts pass straight through, whatever the channel state", () => {
    expect(channelGateState({ ...base, contentType: "reel", signedIn: false, pending: true })).toBe("ready");
    expect(channelGateState({ ...base, contentType: "short" })).toBe("ready");
  });

  test("signed out, loading and a failed lookup never open the studio", () => {
    expect(channelGateState({ ...base, contentType: "long", signedIn: false })).toBe("signed-out");
    expect(channelGateState({ ...base, contentType: "long", pending: true })).toBe("loading");
    expect(channelGateState({ ...base, contentType: "podcast", error: true })).toBe("error");
  });
});

describe("studio channel check", () => {
  test("a reel or short whose file classifies as a long video needs a channel", () => {
    expect(studioNeedsChannel("reel", "long_video")).toBe(true);
    expect(studioNeedsChannel("short", "long_video")).toBe(true);
  });

  test("a reel or short that stays short does not; long uploads always do", () => {
    expect(studioNeedsChannel("reel", "flick")).toBe(false);
    expect(studioNeedsChannel("short", null)).toBe(false);
    expect(studioNeedsChannel("long", "flick")).toBe(true);
    expect(studioNeedsChannel("podcast", null)).toBe(true);
  });
});

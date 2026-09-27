import { describe, expect, test } from "bun:test";

import { channelGateState, needsChannel } from "../ChannelGate";

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

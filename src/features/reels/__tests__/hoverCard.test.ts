import { describe, expect, test } from "bun:test";

import { HOVER_CARD_CLOSE_MS, HOVER_CARD_INITIAL, HOVER_CARD_OPEN_MS, hoverCardDelay, hoverCardReducer, type HoverCardState } from "../hoverCard";

const run = (...actions: Parameters<typeof hoverCardReducer>[1][]): HoverCardState =>
  actions.reduce(hoverCardReducer, HOVER_CARD_INITIAL);

describe("hoverCardReducer", () => {
  test("resting on an anchor arms a 350 ms open; the timer opens it", () => {
    const armed = run({ type: "anchor-enter", anchor: "overlay" });
    expect(armed).toEqual({ open: false, pending: "open", anchor: "overlay" });
    expect(hoverCardDelay(armed)).toBe(HOVER_CARD_OPEN_MS);
    const opened = hoverCardReducer(armed, { type: "timer" });
    expect(opened).toEqual({ open: true, pending: null, anchor: "overlay" });
    expect(hoverCardDelay(opened)).toBeNull();
  });

  test("leaving before the timer fires cancels the open", () => {
    const s = run({ type: "anchor-enter", anchor: "rail" }, { type: "anchor-leave" });
    expect(s).toEqual(HOVER_CARD_INITIAL);
    expect(hoverCardDelay(s)).toBeNull();
  });

  test("leaving an open card gives 200 ms grace; entering the card keeps it", () => {
    const open = run({ type: "anchor-enter", anchor: "overlay" }, { type: "timer" });
    const leaving = hoverCardReducer(open, { type: "anchor-leave" });
    expect(leaving.pending).toBe("close");
    expect(leaving.open).toBe(true);
    expect(hoverCardDelay(leaving)).toBe(HOVER_CARD_CLOSE_MS);
    const kept = hoverCardReducer(leaving, { type: "card-enter" });
    expect(kept).toEqual({ open: true, pending: null, anchor: "overlay" });
    const closing = hoverCardReducer(kept, { type: "card-leave" });
    expect(hoverCardReducer(closing, { type: "timer" })).toEqual(HOVER_CARD_INITIAL);
  });

  test("moving from one anchor to the other while open keeps it open on the new anchor", () => {
    const open = run({ type: "anchor-enter", anchor: "overlay" }, { type: "timer" }, { type: "anchor-leave" });
    const moved = hoverCardReducer(open, { type: "anchor-enter", anchor: "rail" });
    expect(moved).toEqual({ open: true, pending: null, anchor: "rail" });
  });

  test("keyboard Enter opens at once; Escape / scroll close at once", () => {
    const open = run({ type: "open-now", anchor: "rail" });
    expect(open).toEqual({ open: true, pending: null, anchor: "rail" });
    expect(hoverCardReducer(open, { type: "close-now" })).toEqual(HOVER_CARD_INITIAL);
    const closingSoon = hoverCardReducer(open, { type: "anchor-leave" });
    expect(hoverCardReducer(closingSoon, { type: "close-now" })).toEqual(HOVER_CARD_INITIAL);
  });

  test("card events and a stray timer do nothing while closed", () => {
    expect(hoverCardReducer(HOVER_CARD_INITIAL, { type: "card-enter" })).toEqual(HOVER_CARD_INITIAL);
    expect(hoverCardReducer(HOVER_CARD_INITIAL, { type: "card-leave" })).toEqual(HOVER_CARD_INITIAL);
    expect(hoverCardReducer(HOVER_CARD_INITIAL, { type: "timer" })).toEqual(HOVER_CARD_INITIAL);
    expect(hoverCardReducer(HOVER_CARD_INITIAL, { type: "anchor-leave" })).toEqual(HOVER_CARD_INITIAL);
  });
});

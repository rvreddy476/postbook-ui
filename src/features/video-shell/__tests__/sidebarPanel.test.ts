import { describe, expect, test } from "bun:test";

import { SIDEBAR_PANEL_INITIAL, sidebarPanelReducer, type SidebarPanelAction } from "../sidebarPanel";

const run = (...actions: SidebarPanelAction[]) => actions.reduce(sidebarPanelReducer, SIDEBAR_PANEL_INITIAL);

describe("sidebarPanelReducer", () => {
  test("starts on the nav list", () => {
    expect(SIDEBAR_PANEL_INITIAL).toBe("nav");
  });

  test("More opens the panel; ✕ returns to the nav", () => {
    expect(run({ type: "open-more" })).toBe("more");
    expect(run({ type: "open-more" }, { type: "close-more" })).toBe("nav");
  });

  test("Escape returns to the nav and is a no-op on the nav", () => {
    expect(run({ type: "open-more" }, { type: "escape" })).toBe("nav");
    expect(run({ type: "escape" })).toBe("nav");
  });

  test("toggle flips; opening twice stays open", () => {
    expect(run({ type: "toggle-more" })).toBe("more");
    expect(run({ type: "toggle-more" }, { type: "toggle-more" })).toBe("nav");
    expect(run({ type: "open-more" }, { type: "open-more" })).toBe("more");
  });

  test("collapsing the column to the rail drops the panel", () => {
    expect(run({ type: "open-more" }, { type: "collapse" })).toBe("nav");
    expect(run({ type: "collapse" })).toBe("nav");
  });
});

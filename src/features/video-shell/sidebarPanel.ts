/*
  Which face the expanded sidebar shows: the nav list, or the More panel
  that replaces it in the same column. Pure, so the rules are testable:
  More opens on its entry, closes on its ✕, Escape, or when the column
  collapses to the rail (the rail has no room for it).
*/

export type SidebarPanel = "nav" | "more";

export type SidebarPanelAction =
  | { type: "open-more" }
  | { type: "close-more" }
  | { type: "toggle-more" }
  /** Escape: back to the nav when More is open; nothing otherwise. */
  | { type: "escape" }
  /** The column collapsed to the rail: the panel cannot stay. */
  | { type: "collapse" };

export const SIDEBAR_PANEL_INITIAL: SidebarPanel = "nav";

export function sidebarPanelReducer(state: SidebarPanel, action: SidebarPanelAction): SidebarPanel {
  switch (action.type) {
    case "open-more":
      return "more";
    case "toggle-more":
      return state === "more" ? "nav" : "more";
    case "close-more":
    case "escape":
    case "collapse":
      return "nav";
    default:
      return state;
  }
}

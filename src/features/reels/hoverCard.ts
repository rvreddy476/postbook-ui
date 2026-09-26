/*
  Timing for the creator hover card, as a reducer so the rules are testable
  without a DOM: the card opens once the pointer has rested 350 ms on an
  anchor (the author name or the rail avatar), closes 200 ms after the
  pointer leaves both the anchor and the card, and opens or closes at once
  for the keyboard (Enter / Escape) and on scroll.

  The component keeps one timer: whenever `pending` is set it arms a timeout
  for `hoverCardDelay(state)` ms and dispatches "timer" when it fires;
  whenever `pending` clears it cancels the timer.
*/

export const HOVER_CARD_OPEN_MS = 350;
export const HOVER_CARD_CLOSE_MS = 200;

export interface HoverCardState {
  open: boolean;
  /** A timer is running towards this outcome. */
  pending: "open" | "close" | null;
  /** Which anchor the card belongs to (positioning), or null when closed. */
  anchor: string | null;
}

export type HoverCardAction =
  | { type: "anchor-enter"; anchor: string }
  | { type: "anchor-leave" }
  | { type: "card-enter" }
  | { type: "card-leave" }
  | { type: "open-now"; anchor: string }
  | { type: "close-now" }
  | { type: "timer" };

export const HOVER_CARD_INITIAL: HoverCardState = { open: false, pending: null, anchor: null };

export function hoverCardReducer(state: HoverCardState, action: HoverCardAction): HoverCardState {
  switch (action.type) {
    case "anchor-enter":
      // Already open: the pointer came back (possibly to the other anchor) — cancel any close.
      if (state.open) return { open: true, pending: null, anchor: action.anchor };
      return { open: false, pending: "open", anchor: action.anchor };
    case "anchor-leave":
      if (state.pending === "open") return HOVER_CARD_INITIAL;
      if (state.open) return { ...state, pending: "close" };
      return state;
    case "card-enter":
      if (state.open && state.pending === "close") return { ...state, pending: null };
      return state;
    case "card-leave":
      if (state.open) return { ...state, pending: "close" };
      return state;
    case "open-now":
      return { open: true, pending: null, anchor: action.anchor };
    case "close-now":
      return HOVER_CARD_INITIAL;
    case "timer":
      if (state.pending === "open") return { open: true, pending: null, anchor: state.anchor };
      if (state.pending === "close") return HOVER_CARD_INITIAL;
      return state;
    default:
      return state;
  }
}

/** How long the running timer should wait, or null when nothing is pending. */
export function hoverCardDelay(state: HoverCardState): number | null {
  if (state.pending === "open") return HOVER_CARD_OPEN_MS;
  if (state.pending === "close") return HOVER_CARD_CLOSE_MS;
  return null;
}

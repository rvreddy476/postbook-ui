/*
  "Clear screen": the video alone, no overlay, rails, scrubber or arrows.
  A tiny state machine so the rules are testable without a DOM:

  - enter       → on, with the "Tap to show controls" hint showing
  - hint-expiry → hint gone, still on
  - any key, Escape, or a tap on the stage → off
  - toggle (the `h` key or the menu row) → flips
*/

export interface ClearScreenState {
  on: boolean;
  hint: boolean;
}

export type ClearScreenAction =
  | { type: "enter" }
  | { type: "exit" }
  | { type: "toggle" }
  | { type: "hint-expired" }
  | { type: "key" }
  | { type: "tap" };

export const CLEAR_SCREEN_INITIAL: ClearScreenState = { on: false, hint: false };

/** How long the hint stays up after entering. */
export const CLEAR_SCREEN_HINT_MS = 2000;

export function clearScreenReducer(state: ClearScreenState, action: ClearScreenAction): ClearScreenState {
  switch (action.type) {
    case "enter":
      return state.on ? state : { on: true, hint: true };
    case "toggle":
      return state.on ? CLEAR_SCREEN_INITIAL : { on: true, hint: true };
    case "hint-expired":
      return state.hint ? { ...state, hint: false } : state;
    case "exit":
    case "key":
    case "tap":
      return state.on || state.hint ? CLEAR_SCREEN_INITIAL : state;
    default:
      return state;
  }
}

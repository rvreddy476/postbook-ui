/*
  The long-video player's keyboard, as data.

  One pure function from a key to an action, so the bindings are testable
  without a <video> and the player only has to dispatch. Space and K both
  toggle play (K used to fall through to L and skip forward); J and L jump
  ten seconds, the arrows five; M, F, C toggle mute, fullscreen and
  captions; T asks for theater and N for the next video — the player
  dispatches both and the watch page decides what they do (theater lands
  in W1); 0–9 seek to that tenth of the video, Home and End to the ends.

  Ctrl, Alt and Meta chords are never ours: a browser shortcut stays a
  browser shortcut. Shift is tolerated on the letters (Shift+N reads as
  "next" too) and ignored on everything else.
*/

export type PlayerKeyAction =
  | { type: "toggle-play" }
  | { type: "seek-by"; seconds: number }
  | { type: "seek-percent"; percent: number }
  | { type: "toggle-mute" }
  | { type: "toggle-fullscreen" }
  | { type: "toggle-captions" }
  | { type: "toggle-theater" }
  | { type: "next" };

export interface PlayerKeyModifiers {
  shift?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  meta?: boolean;
}

export const SEEK_SMALL_S = 5;
export const SEEK_LARGE_S = 10;

/**
 * The action for a KeyboardEvent's `key`, or null when the key is not
 * ours. Letters are matched case-insensitively so Caps Lock and Shift do
 * not change what a key does.
 */
export function playerKeyAction(key: string, modifiers: PlayerKeyModifiers = {}): PlayerKeyAction | null {
  if (modifiers.ctrl || modifiers.alt || modifiers.meta) return null;
  if (typeof key !== "string" || key.length === 0) return null;

  switch (key) {
    case " ":
    case "Spacebar":
      return { type: "toggle-play" };
    case "ArrowLeft":
      return { type: "seek-by", seconds: -SEEK_SMALL_S };
    case "ArrowRight":
      return { type: "seek-by", seconds: SEEK_SMALL_S };
    case "Home":
      return { type: "seek-percent", percent: 0 };
    case "End":
      return { type: "seek-percent", percent: 100 };
    default:
      break;
  }

  if (key.length === 1 && key >= "0" && key <= "9") {
    return { type: "seek-percent", percent: Number(key) * 10 };
  }

  switch (key.toLowerCase()) {
    case "k":
      return { type: "toggle-play" };
    case "j":
      return { type: "seek-by", seconds: -SEEK_LARGE_S };
    case "l":
      return { type: "seek-by", seconds: SEEK_LARGE_S };
    case "m":
      return { type: "toggle-mute" };
    case "f":
      return { type: "toggle-fullscreen" };
    case "c":
      return { type: "toggle-captions" };
    case "t":
      return { type: "toggle-theater" };
    case "n":
      return { type: "next" };
    default:
      return null;
  }
}

/**
 * Keys whose browser default (scrolling the page) must be suppressed when
 * the player handles them. Letters never scroll, so they are left alone.
 */
export function playerKeyPreventsDefault(key: string): boolean {
  return key === " " || key === "Spacebar" || key === "ArrowLeft" || key === "ArrowRight" || key === "Home" || key === "End";
}

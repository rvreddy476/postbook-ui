import { playerKeyAction, SEEK_LARGE_S, SEEK_SMALL_S, type PlayerKeyAction } from "../playerKeys";

/*
  The "Keys" pane of the settings menu, derived from the key map itself:
  every candidate key is run through playerKeyAction and grouped by what
  it does, so the pane can never disagree with the player.
*/

export interface KeyHelpRow {
  keys: string[];
  action: string;
}

const CANDIDATES = [" ", "k", "j", "l", "ArrowLeft", "ArrowRight", "0", "5", "9", "Home", "End", "m", "f", "c", "t", "i", "n"] as const;

function keyName(key: string): string {
  switch (key) {
    case " ":
      return "Space";
    case "ArrowLeft":
      return "←";
    case "ArrowRight":
      return "→";
    default:
      return key.length === 1 ? key.toUpperCase() : key;
  }
}

function describe(action: PlayerKeyAction): string {
  switch (action.type) {
    case "toggle-play":
      return "Play / pause";
    case "seek-by":
      return `${action.seconds < 0 ? "Back" : "Forward"} ${Math.abs(action.seconds)} s`;
    case "seek-percent":
      return action.percent === 0 ? "Start" : action.percent === 100 ? "End" : `Jump to ${action.percent}%`;
    case "toggle-mute":
      return "Mute";
    case "toggle-fullscreen":
      return "Full screen";
    case "toggle-captions":
      return "Captions";
    case "toggle-theater":
      return "Theater";
    case "toggle-miniplayer":
      return "Miniplayer";
    case "next":
      return "Next video";
    default:
      return "";
  }
}

/** Rows in the order the keys are listed above; keys with the same action share a row. */
export function keyHelpRows(): KeyHelpRow[] {
  const rows: KeyHelpRow[] = [];
  const byAction = new Map<string, KeyHelpRow>();
  for (const key of CANDIDATES) {
    const action = playerKeyAction(key);
    if (!action) continue;
    const label = describe(action);
    if (!label) continue;
    const row = byAction.get(label);
    if (row) row.keys.push(keyName(key));
    else {
      const next = { keys: [keyName(key)], action: label };
      byAction.set(label, next);
      rows.push(next);
    }
  }
  // 0 / 5 / 9 stand for the digit row.
  return rows.map((r) => (r.action.startsWith("Jump to") ? { keys: ["0–9"], action: "Jump to that tenth" } : r)).filter((r, i, all) => all.findIndex((x) => x.action === r.action) === i);
}

export { SEEK_LARGE_S, SEEK_SMALL_S };

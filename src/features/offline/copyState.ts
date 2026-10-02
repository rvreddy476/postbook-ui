/*
  One offline copy's life, as a pure state machine:

    idle ──start──▶ downloading(progress) ──complete──▶ stored
                         │  ▲                             │
                 cancel  │  │ start (resume or restart)   ├─expire──────▶ expired
                 / fail  ▼  │                             ├─invalidate──▶ invalid
                        idle                              ▼
                                         any ──remove──▶ removed

  cancel throws the partial bytes away (restart next time); fail keeps them
  when the store can append (resume next time). expired / invalid / removed
  are ends: the bytes are deleted, and only a fresh start leaves them.
  An event that does not apply to the current phase changes nothing.
*/

export type CopyPhase = "idle" | "downloading" | "stored" | "expired" | "invalid" | "removed";

export interface CopyState {
  phase: CopyPhase;
  receivedBytes: number;
  /** null = unknown until the response says. */
  totalBytes: number | null;
  /** Partial bytes are kept: the next start resumes instead of restarting. */
  resumable: boolean;
  /** Why the last attempt stopped (idle), or why the copy ended (invalid). */
  message: string | null;
}

export type CopyEvent =
  | { type: "start"; totalBytes: number | null; resumeFrom?: number }
  | { type: "progress"; receivedBytes: number; totalBytes?: number | null }
  | { type: "complete"; totalBytes: number }
  | { type: "fail"; message: string; keptBytes: number }
  | { type: "cancel" }
  | { type: "expire" }
  | { type: "invalidate"; reason: string }
  | { type: "remove" };

export const COPY_IDLE: CopyState = { phase: "idle", receivedBytes: 0, totalBytes: null, resumable: false, message: null };

const STARTABLE: ReadonlySet<CopyPhase> = new Set<CopyPhase>(["idle", "expired", "invalid", "removed"]);

export function copyReducer(state: CopyState, event: CopyEvent): CopyState {
  switch (event.type) {
    case "start": {
      if (!STARTABLE.has(state.phase)) return state;
      // Resume only what an earlier failed attempt kept; anything else starts from zero.
      const from = state.phase === "idle" && state.resumable ? Math.max(0, Math.min(event.resumeFrom ?? 0, state.receivedBytes)) : 0;
      return { phase: "downloading", receivedBytes: from, totalBytes: event.totalBytes, resumable: false, message: null };
    }
    case "progress": {
      if (state.phase !== "downloading") return state;
      const total = event.totalBytes === undefined ? state.totalBytes : event.totalBytes;
      const received = Math.max(0, total ? Math.min(event.receivedBytes, total) : event.receivedBytes);
      return { ...state, receivedBytes: received, totalBytes: total };
    }
    case "complete":
      if (state.phase !== "downloading") return state;
      return { phase: "stored", receivedBytes: event.totalBytes, totalBytes: event.totalBytes, resumable: false, message: null };
    case "fail":
      if (state.phase !== "downloading") return state;
      return { phase: "idle", receivedBytes: Math.max(0, event.keptBytes), totalBytes: state.totalBytes, resumable: event.keptBytes > 0, message: event.message };
    case "cancel":
      if (state.phase !== "downloading") return state;
      return COPY_IDLE;
    case "expire":
      if (state.phase !== "stored") return state;
      return { ...state, phase: "expired", message: null };
    case "invalidate":
      if (state.phase !== "stored") return state;
      return { ...state, phase: "invalid", message: event.reason };
    case "remove":
      if (state.phase === "removed") return state;
      return { phase: "removed", receivedBytes: 0, totalBytes: null, resumable: false, message: null };
    default:
      return state;
  }
}

/** 0..1 while downloading with a known size; null when the size is unknown; 1 once stored. */
export function copyProgress(state: CopyState): number | null {
  if (state.phase === "stored") return 1;
  if (state.phase !== "downloading") return 0;
  if (!state.totalBytes) return null;
  return Math.max(0, Math.min(1, state.receivedBytes / state.totalBytes));
}

/** A stored copy that may be played: nothing else is ever handed to a player. */
export function isPlayable(state: CopyState): boolean {
  return state.phase === "stored";
}

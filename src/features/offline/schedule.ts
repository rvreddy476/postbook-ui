import { DEFAULT_RECHECK_SECONDS, type OfflineCheckRow, type OfflineInvalidReason } from "./wire";

/*
  When a copy ends and when the server is asked again. Pure.

  A copy is good until `expiresAt` (30 days from the grant; saving again
  refreshes it, a check never extends it). The server is asked on start,
  whenever the tab regains the network, and again `recheckAfterSeconds`
  after the last answer while the tab stays open.

  What a check deletes:
    - a copy past its own expiry, with or without an answer ("expired");
    - a copy the server answers `valid: false` for, whatever the reason.
  What it never deletes: a copy the answer does not mention, and anything
  at all when the request failed — no network is not a revocation.
*/

export interface ScheduledCopy {
  postId: string;
  expiresAt: number;
  recheckAfterSeconds: number;
  /** Epoch ms of the last answered check; 0 = never. */
  lastCheckedAt: number;
}

export function isExpired(copy: Pick<ScheduledCopy, "expiresAt">, now: number): boolean {
  return copy.expiresAt <= now;
}

export function nextCheckAt(copy: Pick<ScheduledCopy, "lastCheckedAt" | "recheckAfterSeconds">): number {
  const every = copy.recheckAfterSeconds > 0 ? copy.recheckAfterSeconds : DEFAULT_RECHECK_SECONDS;
  return copy.lastCheckedAt > 0 ? copy.lastCheckedAt + every * 1000 : 0;
}

export function checkDue(copy: ScheduledCopy, now: number): boolean {
  return nextCheckAt(copy) <= now;
}

/** The ids to ask about: never one that has already expired here (it is deleted without asking). `force` asks about all the rest. */
export function idsToCheck(copies: readonly ScheduledCopy[], now: number, force: boolean): string[] {
  return copies.filter((c) => !isExpired(c, now) && (force || checkDue(c, now))).map((c) => c.postId);
}

export interface CheckOutcome {
  remove: { postId: string; reason: OfflineInvalidReason }[];
  update: { postId: string; expiresAt: number; lastCheckedAt: number }[];
}

/** `rows` is the server's answer, or null when there was none (offline, or the request failed). */
export function applyCheck(copies: readonly ScheduledCopy[], rows: readonly OfflineCheckRow[] | null, now: number): CheckOutcome {
  const answers = new Map((rows ?? []).map((r) => [r.postId, r]));
  const out: CheckOutcome = { remove: [], update: [] };
  for (const copy of copies) {
    if (isExpired(copy, now)) {
      out.remove.push({ postId: copy.postId, reason: "expired" });
      continue;
    }
    const answer = answers.get(copy.postId);
    if (!answer) continue;
    if (!answer.valid) {
      out.remove.push({ postId: copy.postId, reason: answer.reason });
      continue;
    }
    const expiresAt = answer.expiresAt ?? copy.expiresAt;
    if (expiresAt <= now) out.remove.push({ postId: copy.postId, reason: "expired" });
    else out.update.push({ postId: copy.postId, expiresAt, lastCheckedAt: now });
  }
  return out;
}

export const MIN_WAKE_MS = 60_000;
export const MAX_WAKE_MS = 6 * 60 * 60 * 1000;

/** How long until something needs doing (the earliest expiry or due check), kept between a minute and six hours. null = nothing stored. */
export function nextWakeDelay(copies: readonly ScheduledCopy[], now: number): number | null {
  if (copies.length === 0) return null;
  let at = Infinity;
  for (const c of copies) at = Math.min(at, c.expiresAt, nextCheckAt(c));
  return Math.max(MIN_WAKE_MS, Math.min(MAX_WAKE_MS, at - now));
}

/** The quiet notice after a sweep; null when nothing was removed. */
export function removalNotice(removed: readonly { reason: OfflineInvalidReason }[]): string | null {
  if (removed.length === 0) return null;
  const n = removed.length;
  const allExpired = removed.every((r) => r.reason === "expired");
  if (n === 1) return allExpired ? "An offline copy expired and was removed." : "An offline copy is no longer available and was removed.";
  return allExpired ? `${n} offline copies expired and were removed.` : `${n} offline copies are no longer available and were removed.`;
}

/** "Expires in 12 days" / "Expires today" for the Offline page. */
export function expiryLabel(expiresAt: number, now: number): string {
  const ms = expiresAt - now;
  if (ms <= 0) return "Expired";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 2) return `Expires in ${days} days`;
  if (days === 1) return "Expires tomorrow";
  return "Expires today";
}

/** "1.2 GB" / "84 MB" / "512 KB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

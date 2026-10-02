import { describe, expect, test } from "bun:test";

import { COPY_IDLE, copyProgress, copyReducer, isPlayable, type CopyEvent, type CopyState } from "../copyState";
import { applyCheck, checkDue, expiryLabel, formatBytes, idsToCheck, isExpired, MAX_WAKE_MS, MIN_WAKE_MS, nextCheckAt, nextWakeDelay, removalNotice, type ScheduledCopy } from "../schedule";
import { DAY, T0 } from "./fakes";

const run = (events: CopyEvent[], from: CopyState = COPY_IDLE) => events.reduce(copyReducer, from);

describe("the copy state machine", () => {
  test("idle → downloading(progress) → stored", () => {
    let s = run([{ type: "start", totalBytes: 100 }]);
    expect(s).toMatchObject({ phase: "downloading", receivedBytes: 0, totalBytes: 100 });
    expect(copyProgress(s)).toBe(0);
    s = run([{ type: "progress", receivedBytes: 40 }], s);
    expect(copyProgress(s)).toBe(0.4);
    s = run([{ type: "complete", totalBytes: 100 }], s);
    expect(s).toMatchObject({ phase: "stored", receivedBytes: 100, totalBytes: 100 });
    expect(copyProgress(s)).toBe(1);
    expect(isPlayable(s)).toBe(true);
  });

  test("progress never runs past the total, and an unknown total has no fraction", () => {
    const s = run([{ type: "start", totalBytes: 100 }, { type: "progress", receivedBytes: 250 }]);
    expect(s.receivedBytes).toBe(100);
    const unknown = run([{ type: "start", totalBytes: null }, { type: "progress", receivedBytes: 50 }]);
    expect(copyProgress(unknown)).toBeNull();
    expect(copyProgress(run([{ type: "progress", receivedBytes: 80, totalBytes: 160 }], unknown))).toBe(0.5);
  });

  test("stored → expired, stored → invalid: neither is playable, and both can only be left by a fresh start", () => {
    const stored = run([{ type: "start", totalBytes: 10 }, { type: "complete", totalBytes: 10 }]);
    const expired = run([{ type: "expire" }], stored);
    expect(expired.phase).toBe("expired");
    expect(isPlayable(expired)).toBe(false);
    const invalid = run([{ type: "invalidate", reason: "private" }], stored);
    expect(invalid).toMatchObject({ phase: "invalid", message: "private" });
    expect(isPlayable(invalid)).toBe(false);
    expect(run([{ type: "progress", receivedBytes: 5 }, { type: "complete", totalBytes: 10 }], expired).phase).toBe("expired");
    expect(run([{ type: "start", totalBytes: 10 }], invalid)).toMatchObject({ phase: "downloading", receivedBytes: 0 });
  });

  test("→ removed from anywhere, and a removed copy starts again from zero", () => {
    const stored = run([{ type: "start", totalBytes: 10 }, { type: "complete", totalBytes: 10 }]);
    for (const from of [COPY_IDLE, run([{ type: "start", totalBytes: 10 }]), stored, run([{ type: "expire" }], stored), run([{ type: "invalidate", reason: "deleted" }], stored)]) {
      expect(run([{ type: "remove" }], from)).toEqual({ phase: "removed", receivedBytes: 0, totalBytes: null, resumable: false, message: null });
    }
    expect(run([{ type: "remove" }, { type: "start", totalBytes: 10 }], stored)).toMatchObject({ phase: "downloading", receivedBytes: 0 });
  });

  test("cancel throws the partial bytes away: the next start is a restart", () => {
    const cancelled = run([{ type: "start", totalBytes: 100 }, { type: "progress", receivedBytes: 60 }, { type: "cancel" }]);
    expect(cancelled).toEqual(COPY_IDLE);
    expect(run([{ type: "start", totalBytes: 100, resumeFrom: 60 }], cancelled).receivedBytes).toBe(0);
  });

  test("a failure that kept bytes resumes from them; one that kept none restarts", () => {
    const failed = run([{ type: "start", totalBytes: 100 }, { type: "progress", receivedBytes: 60 }, { type: "fail", message: "dropped", keptBytes: 60 }]);
    expect(failed).toMatchObject({ phase: "idle", receivedBytes: 60, resumable: true, message: "dropped" });
    expect(run([{ type: "start", totalBytes: 100, resumeFrom: 60 }], failed)).toMatchObject({ phase: "downloading", receivedBytes: 60, message: null });
    // Never from further than what was kept.
    expect(run([{ type: "start", totalBytes: 100, resumeFrom: 90 }], failed).receivedBytes).toBe(60);
    const lost = run([{ type: "start", totalBytes: 100 }, { type: "progress", receivedBytes: 60 }, { type: "fail", message: "quota", keptBytes: 0 }]);
    expect(lost).toMatchObject({ phase: "idle", resumable: false });
    expect(run([{ type: "start", totalBytes: 100, resumeFrom: 60 }], lost).receivedBytes).toBe(0);
  });

  test("an event that does not apply changes nothing", () => {
    const stored = run([{ type: "start", totalBytes: 10 }, { type: "complete", totalBytes: 10 }]);
    expect(run([{ type: "start", totalBytes: 99 }], stored)).toBe(stored);
    expect(run([{ type: "cancel" }], stored)).toBe(stored);
    expect(run([{ type: "fail", message: "x", keptBytes: 0 }], stored)).toBe(stored);
    expect(run([{ type: "complete", totalBytes: 10 }], COPY_IDLE)).toBe(COPY_IDLE);
    expect(run([{ type: "expire" }], COPY_IDLE)).toBe(COPY_IDLE);
    expect(run([{ type: "invalidate", reason: "x" }], run([{ type: "start", totalBytes: 1 }])).phase).toBe("downloading");
    expect(isPlayable(run([{ type: "start", totalBytes: 1 }]))).toBe(false);
  });
});

const copy = (postId: string, over: Partial<ScheduledCopy> = {}): ScheduledCopy => ({ postId, expiresAt: T0 + 30 * DAY, recheckAfterSeconds: 172_800, lastCheckedAt: T0, ...over });

describe("expiry and recheck scheduling", () => {
  test("a copy expires at its expiry, not before", () => {
    expect(isExpired(copy("a"), T0 + 30 * DAY - 1)).toBe(false);
    expect(isExpired(copy("a"), T0 + 30 * DAY)).toBe(true);
  });

  test("the next check is recheck_after_seconds after the last answer; never checked = due now", () => {
    expect(nextCheckAt(copy("a"))).toBe(T0 + 172_800_000);
    expect(checkDue(copy("a"), T0 + 172_800_000 - 1)).toBe(false);
    expect(checkDue(copy("a"), T0 + 172_800_000)).toBe(true);
    expect(checkDue(copy("a", { lastCheckedAt: 0 }), T0)).toBe(true);
    // A zero interval off the wire falls back to the default, not "every millisecond".
    expect(nextCheckAt(copy("a", { recheckAfterSeconds: 0 }))).toBe(T0 + 172_800_000);
  });

  test("which ids are asked about: the due ones, or all with force — never an already expired one", () => {
    const copies = [copy("fresh"), copy("due", { lastCheckedAt: T0 - 3 * DAY }), copy("expired", { expiresAt: T0 - 1 })];
    expect(idsToCheck(copies, T0, false)).toEqual(["due"]);
    expect(idsToCheck(copies, T0, true)).toEqual(["fresh", "due"]);
  });

  test("the wake-up: the earliest expiry or due check, between a minute and six hours", () => {
    expect(nextWakeDelay([], T0)).toBeNull();
    expect(nextWakeDelay([copy("a")], T0)).toBe(MAX_WAKE_MS);
    expect(nextWakeDelay([copy("a", { lastCheckedAt: T0 - 2 * DAY + 3_600_000 })], T0)).toBe(3_600_000);
    expect(nextWakeDelay([copy("a"), copy("b", { expiresAt: T0 + 5_000 })], T0)).toBe(MIN_WAKE_MS);
    expect(nextWakeDelay([copy("a", { lastCheckedAt: 0 })], T0)).toBe(MIN_WAKE_MS);
  });
});

describe("what a check deletes", () => {
  const copies = [copy("ok"), copy("deleted"), copy("private"), copy("off"), copy("silent"), copy("old", { expiresAt: T0 - 1 })];

  test("invalid rows and expired copies go; valid ones are stamped; an unmentioned one is left alone", () => {
    const out = applyCheck(
      copies,
      [
        { postId: "ok", valid: true, expiresAt: T0 + 10 * DAY },
        { postId: "deleted", valid: false, reason: "deleted" },
        { postId: "private", valid: false, reason: "private" },
        { postId: "off", valid: false, reason: "not_allowed" },
      ],
      T0,
    );
    expect(out.remove).toEqual([
      { postId: "deleted", reason: "deleted" },
      { postId: "private", reason: "private" },
      { postId: "off", reason: "not_allowed" },
      { postId: "old", reason: "expired" },
    ]);
    expect(out.update).toEqual([{ postId: "ok", expiresAt: T0 + 10 * DAY, lastCheckedAt: T0 }]);
  });

  test("no answer at all (offline): only the expired copy goes — no network is not a revocation", () => {
    expect(applyCheck(copies, null, T0)).toEqual({ remove: [{ postId: "old", reason: "expired" }], update: [] });
  });

  test("a valid answer keeps the copy's own expiry when it sends none, and an already past one removes it", () => {
    expect(applyCheck([copy("a")], [{ postId: "a", valid: true, expiresAt: null }], T0).update).toEqual([{ postId: "a", expiresAt: T0 + 30 * DAY, lastCheckedAt: T0 }]);
    expect(applyCheck([copy("a")], [{ postId: "a", valid: true, expiresAt: T0 - 5 }], T0)).toEqual({ remove: [{ postId: "a", reason: "expired" }], update: [] });
  });

  test("an expired copy goes even when the server still calls it valid", () => {
    expect(applyCheck([copy("old", { expiresAt: T0 - 1 })], [{ postId: "old", valid: true, expiresAt: T0 + DAY }], T0).remove).toEqual([{ postId: "old", reason: "expired" }]);
  });
});

describe("words", () => {
  test("the quiet notice", () => {
    expect(removalNotice([])).toBeNull();
    expect(removalNotice([{ reason: "expired" }])).toBe("An offline copy expired and was removed.");
    expect(removalNotice([{ reason: "deleted" }])).toBe("An offline copy is no longer available and was removed.");
    expect(removalNotice([{ reason: "expired" }, { reason: "expired" }])).toBe("2 offline copies expired and were removed.");
    expect(removalNotice([{ reason: "expired" }, { reason: "private" }, { reason: "not_allowed" }])).toBe("3 offline copies are no longer available and were removed.");
  });

  test("expiry and size", () => {
    expect(expiryLabel(T0 + 12 * DAY + 5, T0)).toBe("Expires in 12 days");
    expect(expiryLabel(T0 + DAY + 5, T0)).toBe("Expires tomorrow");
    expect(expiryLabel(T0 + 3_600_000, T0)).toBe("Expires today");
    expect(expiryLabel(T0 - 1, T0)).toBe("Expired");
    expect(formatBytes(0)).toBe("0 KB");
    expect(formatBytes(300)).toBe("1 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(84 * 1024 * 1024)).toBe("84 MB");
    expect(formatBytes(1.5 * 1024 ** 3)).toBe("1.5 GB");
  });
});

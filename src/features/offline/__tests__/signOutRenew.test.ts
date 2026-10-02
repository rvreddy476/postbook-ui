import { describe, expect, test } from "bun:test";

import { OfflineManager, type ManagerDeps } from "../manager";
import { memoryMetaStore, type MetaStore } from "../metaStore";
import { RENEW_GAP_MS } from "../schedule";
import { noteOfflineSignIn, noteOfflineSignOut, SIGN_IN_MARKS_KEY, SIGN_OUT_MARKS_KEY, signOutMarks, type KeyValueStore, type SignOutMarks } from "../signOut";
import { fileNames } from "../storage";
import { OfflineGrantError } from "../wire";
import { bytes, DAY, fakeApi, fakeFetch, FakeFiles, grant, T0, type FakeApi } from "./fakes";

/*
  The two founder rules of 2 Oct 2026, against the same fakes as the manager's
  own tests: a signed-out account's copies keep for 48 hours, and a valid
  copy renews itself while the device keeps coming online.

  A "start" here is a new manager over the same disk, records and marks —
  what a page load is.
*/

const HOUR = 3_600_000;

interface Device {
  files: FakeFiles;
  meta: MetaStore;
  api: FakeApi;
  storage: Map<string, string>;
  marks: SignOutMarks;
  ins: SignOutMarks;
  clock: { now: number };
  who: { id: string | null };
  sleeps: number[];
  /** Grants in flight right now, and the most there ever were at once. */
  flight: { now: number; max: number };
}

function device(): Device {
  const storage = new Map<string, string>();
  const kv: KeyValueStore = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => void storage.set(k, v), removeItem: (k) => void storage.delete(k) };
  const api = fakeApi();
  const flight = { now: 0, max: 0 };
  const grantOnce = api.grant.bind(api);
  api.grant = async (postId) => {
    flight.now += 1;
    flight.max = Math.max(flight.max, flight.now);
    try {
      await Promise.resolve();
      return await grantOnce(postId);
    } finally {
      flight.now -= 1;
    }
  };
  return { files: new FakeFiles(), meta: memoryMetaStore(), api, storage, marks: signOutMarks(() => kv), ins: signOutMarks(() => kv, SIGN_IN_MARKS_KEY), clock: { now: T0 }, who: { id: "u1" }, sleeps: [], flight };
}

function start(d: Device): OfflineManager {
  const net = fakeFetch({});
  const deps: ManagerDeps = {
    files: d.files,
    meta: d.meta,
    api: d.api,
    fetchFn: (url, init) => {
      // Every granted video is there to fetch.
      if (!net.routes.has(url)) net.routes.set(url, { body: bytes(20) });
      return net.fetch(url, init);
    },
    resolveUrl: (p) => p,
    now: () => d.clock.now,
    userId: () => d.who.id,
    createObjectUrl: () => "blob:fake/1",
    revokeObjectUrl: () => undefined,
    signOutMarks: d.marks,
    signInMarks: d.ins,
    sleep: async (ms) => void d.sleeps.push(ms),
  };
  return new OfflineManager(deps);
}

async function save(d: Device, m: OfflineManager, postId: string): Promise<void> {
  d.api.grants.set(postId, grant(postId, { expiresAt: d.clock.now + 30 * DAY }));
  expect(await m.save(postId, "video")).toEqual({ ok: true });
  d.api.calls.grant.length = 0;
}

/** The app's sign-out: the mark, then the session goes. */
function signOut(d: Device): void {
  noteOfflineSignOut(d.who.id, d.clock.now, d.marks);
  d.who.id = null;
}

/** The app's sign-in: the session is there, and the mark says when. No video app is opened. */
function signIn(d: Device, userId: string): void {
  d.who.id = userId;
  noteOfflineSignIn(userId, d.clock.now, d.ins);
}

const listed = (m: OfflineManager) => m.getSnapshot().copies.map((c) => c.postId);
const stamps = async (d: Device) => (await d.meta.all()).map((r) => [r.postId, r.signedOutAt]);

describe("signing out keeps the copies for 48 hours", () => {
  test("the sign-out stamps the account's copies with the moment it happened", async () => {
    const d = device();
    await save(d, start(d), "p1");
    d.clock.now = T0 + HOUR;
    signOut(d);
    expect(JSON.parse(d.storage.get(SIGN_OUT_MARKS_KEY)!)).toEqual({ u1: T0 + HOUR });

    // The next start is hours later: the stamp is the sign-out, not the start.
    d.clock.now = T0 + 5 * HOUR;
    const m = start(d);
    await m.init();
    expect(await stamps(d)).toEqual([["p1", T0 + HOUR]]);
    expect(d.storage.has(SIGN_OUT_MARKS_KEY)).toBe(false);
    // Kept on the device, shown to nobody.
    expect(await d.files.size(fileNames.video("p1"))).toBe(20);
    expect(listed(m)).toEqual([]);
    expect(m.getSnapshot().usedBytes).toBe(0);
    expect(await m.open("p1")).toBeNull();
  });

  test("signing out with nobody signed in, or with storage that throws, does nothing and never throws", () => {
    const d = device();
    noteOfflineSignOut(null, T0, d.marks);
    noteOfflineSignOut(undefined, T0, d.marks);
    expect(d.storage.size).toBe(0);
    const broken = signOutMarks(() => {
      throw new Error("denied");
    });
    expect(() => noteOfflineSignOut("u1", T0, broken)).not.toThrow();
    expect(broken.read()).toEqual({});
    d.storage.set(SIGN_OUT_MARKS_KEY, "{not json");
    expect(d.marks.read()).toEqual({});
  });

  test("the same account back within 48 hours finds its copies again, still under the server's check", async () => {
    const d = device();
    await save(d, start(d), "p1");
    await save(d, start(d), "p2");
    signOut(d);
    await start(d).sync({ force: true });
    expect((await stamps(d)).map((s) => s[1])).toEqual([T0, T0]);

    d.clock.now = T0 + 47 * HOUR;
    d.who.id = "u1";
    const m = start(d);
    await m.init();
    expect(listed(m).sort()).toEqual(["p1", "p2"]);
    expect(await m.open("p1")).not.toBeNull();
    expect((await stamps(d)).map((s) => s[1])).toEqual([undefined, undefined]);
    expect(d.api.calls.remove).toEqual([]);

    d.api.checkRows = [{ postId: "p1", valid: true, expiresAt: null, renewable: false }, { postId: "p2", valid: false, reason: "private" }];
    const removed = await m.sync({ force: true });
    expect(removed.map((r) => r.postId)).toEqual(["p2"]);
    expect(listed(m)).toEqual(["p1"]);

    // And the 48 hours do not come back to bite once it has signed in again.
    d.clock.now = T0 + 60 * HOUR;
    await start(d).sync({ force: true });
    expect((await d.meta.all()).map((r) => r.postId)).toEqual(["p1"]);
  });

  test("the same account back straight after signing out (no start in between) keeps its copies", async () => {
    const d = device();
    await save(d, start(d), "p1");
    signOut(d);
    d.clock.now = T0 + HOUR;
    d.who.id = "u1";
    const m = start(d);
    await m.init();
    expect(listed(m)).toEqual(["p1"]);
    expect(d.storage.has(SIGN_OUT_MARKS_KEY)).toBe(false);
    expect(await stamps(d)).toEqual([["p1", undefined]]);
  });

  test("after 48 hours the copies are deleted, bytes and records, on the next start — with nobody signed in the server is not asked", async () => {
    const d = device();
    await save(d, start(d), "p1");
    await save(d, start(d), "p2");
    signOut(d);

    d.clock.now = T0 + 48 * HOUR - 1;
    await start(d).init();
    expect(d.files.files.size).toBe(2);

    d.clock.now = T0 + 48 * HOUR;
    const m = start(d);
    await m.init();
    expect(d.files.files.size).toBe(0);
    expect(await d.meta.all()).toEqual([]);
    expect(d.api.calls.remove).toEqual([]);
    expect(d.api.calls.check).toEqual([]);
  });

  test("after 48 hours the periodic sweep of a tab that stayed open deletes them too", async () => {
    const d = device();
    const m = start(d);
    await save(d, m, "p1");
    signOut(d);
    await m.sync({ force: true });
    expect(d.files.files.size).toBe(1);
    d.clock.now = T0 + 49 * HOUR;
    await m.sync({ force: false });
    expect(d.files.files.size).toBe(0);
    expect(await d.meta.all()).toEqual([]);
  });

  test("the owner back after 48 hours: the copies are gone and the server is told, one DELETE per copy", async () => {
    const d = device();
    await save(d, start(d), "p1");
    await save(d, start(d), "p2");
    signOut(d);
    d.clock.now = T0 + 49 * HOUR;
    d.who.id = "u1";
    const m = start(d);
    await m.init();
    expect(d.files.files.size).toBe(0);
    expect(await d.meta.all()).toEqual([]);
    expect(d.api.calls.remove.sort()).toEqual(["p1", "p2"]);
    expect(listed(m)).toEqual([]);
    expect(await m.open("p1")).toBeNull();
  });

  test("the owner back after 48 hours with no network: the bytes still go, and the server is told on a later sweep", async () => {
    const d = device();
    await save(d, start(d), "p1");
    signOut(d);
    d.clock.now = T0 + 49 * HOUR;
    d.who.id = "u1";
    d.api.removeFails = true;
    const m = start(d);
    await m.init();
    expect(d.files.files.size).toBe(0);
    expect(listed(m)).toEqual([]);
    expect((await d.meta.all()).map((r) => [r.state, r.signedOutAt])).toEqual([["removed", undefined]]);

    d.api.removeFails = false;
    await m.sync({ force: true });
    expect(await d.meta.all()).toEqual([]);
    expect(d.api.calls.remove).toEqual(["p1", "p1"]);
  });

  test("another account inside the 48 hours never sees, lists, plays, counts or checks them — and its sign-in does not delete them", async () => {
    const d = device();
    await save(d, start(d), "p1");
    signOut(d);
    d.clock.now = T0 + 10 * HOUR;
    d.who.id = "u2";
    const m = start(d);
    await m.init();
    d.api.checkRows = [{ postId: "p1", valid: false, reason: "private" }];
    await m.sync({ force: true, reconcile: true });

    expect(listed(m)).toEqual([]);
    expect(m.getSnapshot().byId.p1).toBeUndefined();
    expect(m.getSnapshot().usedBytes).toBe(0);
    expect(await m.open("p1")).toBeNull();
    expect(await m.openPoster("p1")).toBeNull();
    expect(m.nextWake()).toBeNull();
    expect(d.api.calls.check).toEqual([]);
    expect(d.api.calls.grant).toEqual([]);
    expect(d.api.calls.remove).toEqual([]);
    // Still there for u1, with u1's own sign-out time.
    expect(await d.files.size(fileNames.video("p1"))).toBe(20);
    expect((await d.meta.all()).map((r) => [r.userId, r.signedOutAt])).toEqual([["u1", T0]]);

    // u2's own copies are untouched by any of it.
    await save(d, m, "p9");
    expect(listed(m)).toEqual(["p9"]);
    expect((await d.meta.all()).find((r) => r.postId === "p9")?.signedOutAt).toBeUndefined();
  });

  test("another account signing in after the 48 hours triggers the deletion, and never speaks to the server for them", async () => {
    const d = device();
    await save(d, start(d), "p1");
    signOut(d);
    d.clock.now = T0 + 48 * HOUR;
    d.who.id = "u2";
    const m = start(d);
    await m.init();
    expect(d.files.files.size).toBe(0);
    expect(await d.meta.all()).toEqual([]);
    expect(d.api.calls.remove).toEqual([]);
    expect(listed(m)).toEqual([]);
  });

  test("a copy with no owner signed in and no stamp (signed out in another tab, session expired) is stamped on start, and the 48 hours run from then", async () => {
    const d = device();
    await save(d, start(d), "p1");
    // The session went without the sign-out function running in this browser.
    d.who.id = null;
    d.clock.now = T0 + 100 * HOUR;
    await start(d).init();
    expect(await stamps(d)).toEqual([["p1", T0 + 100 * HOUR]]);
    expect(d.files.files.size).toBe(1);

    // A later start does not move the stamp.
    d.clock.now = T0 + 120 * HOUR;
    await start(d).init();
    expect(await stamps(d)).toEqual([["p1", T0 + 100 * HOUR]]);

    d.clock.now = T0 + 148 * HOUR;
    await start(d).init();
    expect(await d.meta.all()).toEqual([]);
    expect(d.files.files.size).toBe(0);
  });

  test("an unstamped copy of ANOTHER account is stamped when someone else is signed in, too", async () => {
    const d = device();
    await save(d, start(d), "p1");
    d.who.id = "u2";
    d.clock.now = T0 + HOUR;
    await start(d).init();
    expect(await stamps(d)).toEqual([["p1", T0 + HOUR]]);
  });

  test("signing out twice: the later sign-out is the one that counts", async () => {
    const d = device();
    await save(d, start(d), "p1");
    signOut(d);
    await start(d).init();
    // Back in and out again, with no start in between.
    d.who.id = "u1";
    d.clock.now = T0 + 40 * HOUR;
    signOut(d);
    d.clock.now = T0 + 50 * HOUR;
    await start(d).init();
    expect(await stamps(d)).toEqual([["p1", T0 + 40 * HOUR]]);
    expect(d.files.files.size).toBe(1);
  });
});

describe("copies renew themselves while the device comes online", () => {
  async function three(d: Device): Promise<OfflineManager> {
    const m = start(d);
    for (const id of ["a", "b", "c"]) await save(d, m, id);
    return m;
  }
  const valid = (...ids: string[]) => ids.map((postId) => ({ postId, valid: true as const, expiresAt: null }));
  const expiries = async (d: Device) => Object.fromEntries((await d.meta.all()).map((r) => [r.postId, r.expiresAt]));

  test("after an answered check each valid copy is granted again and its expiry comes from the answer", async () => {
    const d = device();
    const m = await three(d);
    d.clock.now = T0 + 10 * DAY;
    for (const id of ["a", "b", "c"]) d.api.grants.set(id, grant(id, { expiresAt: T0 + 40 * DAY, recheckAfterSeconds: 3600 }));
    d.api.checkRows = valid("a", "b", "c");
    let emitted = 0;
    await m.sync({ force: true });
    m.subscribe(() => (emitted += 1));
    await m.whenRenewed();

    expect(d.api.calls.grant).toEqual(["a", "b", "c"]);
    expect(await expiries(d)).toEqual({ a: T0 + 40 * DAY, b: T0 + 40 * DAY, c: T0 + 40 * DAY });
    expect((await d.meta.all()).map((r) => [r.recheckAfterSeconds, r.renewTriedAt, r.state, r.bytes])).toEqual(Array(3).fill([3600, T0 + 10 * DAY, "stored", 20]));
    expect(m.getSnapshot().byId.a.record?.expiresAt).toBe(T0 + 40 * DAY);
    expect(emitted).toBeGreaterThan(0);
    // The bytes were not fetched again.
    expect(await d.files.size(fileNames.video("a"))).toBe(20);
  });

  test("no burst: one renewal at a time, with a pause between each two", async () => {
    const d = device();
    const m = await three(d);
    d.clock.now = T0 + 2 * DAY;
    d.api.checkRows = valid("a", "b", "c");
    await m.sync({ force: true });
    await m.whenRenewed();
    expect(d.api.calls.grant).toEqual(["a", "b", "c"]);
    expect(d.flight.max).toBe(1);
    expect(d.sleeps).toEqual([RENEW_GAP_MS, RENEW_GAP_MS]);
    expect(RENEW_GAP_MS).toBeGreaterThanOrEqual(1000);
  });

  test("at most once per copy per 24 hours — counted from the save, then from the last renewal", async () => {
    const d = device();
    const m = start(d);
    await save(d, m, "a");
    d.api.checkRows = valid("a");

    d.clock.now = T0 + DAY - 1;
    await m.sync({ force: true });
    await m.whenRenewed();
    expect(d.api.calls.grant).toEqual([]);

    d.clock.now = T0 + DAY;
    await m.sync({ force: true });
    await m.whenRenewed();
    expect(d.api.calls.grant).toEqual(["a"]);

    // Every later sweep that day — and a fresh start — asks for nothing.
    d.clock.now = T0 + 2 * DAY - 1;
    await m.sync({ force: true });
    await m.whenRenewed();
    const again = start(d);
    await again.sync({ force: true });
    await again.whenRenewed();
    expect(d.api.calls.grant).toEqual(["a"]);

    d.clock.now = T0 + 2 * DAY;
    await again.sync({ force: true });
    await again.whenRenewed();
    expect(d.api.calls.grant).toEqual(["a", "a"]);
  });

  test("a copy the check marks `renewable: false` is not renewed; the others are", async () => {
    const d = device();
    const m = await three(d);
    d.clock.now = T0 + 2 * DAY;
    d.api.checkRows = [{ postId: "a", valid: true, expiresAt: null, renewable: true }, { postId: "b", valid: true, expiresAt: null, renewable: false }, { postId: "c", valid: true, expiresAt: null }];
    await m.sync({ force: true });
    await m.whenRenewed();
    expect(d.api.calls.grant).toEqual(["a", "c"]);
    expect((await d.meta.all()).find((r) => r.postId === "b")?.renewTriedAt).toBeUndefined();
  });

  test("nothing is renewed without an answered check, nor a copy the answer left out or called invalid", async () => {
    const d = device();
    const m = await three(d);
    d.clock.now = T0 + 2 * DAY;
    d.api.checkRows = new Error("offline");
    await m.sync({ force: true });
    await m.whenRenewed();
    expect(d.api.calls.grant).toEqual([]);

    d.api.checkRows = [{ postId: "a", valid: true, expiresAt: null }, { postId: "b", valid: false, reason: "private" }];
    await m.sync({ force: true });
    await m.whenRenewed();
    expect(d.api.calls.grant).toEqual(["a"]);
  });

  test("a refused renewal (403, 404, the 100-copy limit) deletes nothing, keeps the old expiry, and is not asked again that day", async () => {
    const d = device();
    const m = await three(d);
    d.clock.now = T0 + 2 * DAY;
    d.api.grants.set("a", new OfflineGrantError("not_allowed"));
    d.api.grants.set("b", new OfflineGrantError("gone"));
    d.api.grants.set("c", new OfflineGrantError("limit"));
    d.api.checkRows = valid("a", "b", "c");
    expect(await m.sync({ force: true })).toEqual([]);
    await m.whenRenewed();

    expect(d.api.calls.grant).toEqual(["a", "b", "c"]);
    expect(d.api.calls.remove).toEqual([]);
    expect(d.files.files.size).toBe(3);
    expect(listed(m).sort()).toEqual(["a", "b", "c"]);
    expect(await expiries(d)).toEqual({ a: T0 + 30 * DAY, b: T0 + 30 * DAY, c: T0 + 30 * DAY });
    expect(await m.open("a")).not.toBeNull();

    await m.sync({ force: true });
    await m.whenRenewed();
    expect(d.api.calls.grant).toEqual(["a", "b", "c"]);
  });

  test("a network error is ignored quietly: nothing changes, the round stops, and the next sweep tries again", async () => {
    const d = device();
    const m = await three(d);
    d.clock.now = T0 + 2 * DAY;
    d.api.grants.set("a", new OfflineGrantError("network"));
    d.api.checkRows = valid("a", "b", "c");
    expect(await m.sync({ force: true })).toEqual([]);
    await m.whenRenewed();
    expect(d.api.calls.grant).toEqual(["a"]);
    expect(d.files.files.size).toBe(3);
    expect((await d.meta.all()).map((r) => r.renewTriedAt)).toEqual([undefined, undefined, undefined]);

    d.api.grants.set("a", grant("a", { expiresAt: T0 + 32 * DAY }));
    await m.sync({ force: true });
    await m.whenRenewed();
    expect(d.api.calls.grant).toEqual(["a", "a", "b", "c"]);
    expect((await expiries(d)).a).toBe(T0 + 32 * DAY);
  });

  test("a copy removed while its renewal was in flight stays removed, and the grant is released", async () => {
    const d = device();
    const m = start(d);
    await save(d, m, "a");
    d.clock.now = T0 + 2 * DAY;
    d.api.checkRows = valid("a");
    const inner = d.api.grant;
    d.api.grant = async (postId) => {
      const g = await inner(postId);
      await m.remove(postId);
      return g;
    };
    await m.sync({ force: true });
    await m.whenRenewed();
    expect(await d.meta.all()).toEqual([]);
    expect(d.files.files.size).toBe(0);
    expect(d.api.calls.remove).toEqual(["a", "a"]);
  });

  test("signing out mid-round stops the renewals", async () => {
    const d = device();
    const m = await three(d);
    d.clock.now = T0 + 2 * DAY;
    d.api.checkRows = valid("a", "b", "c");
    const inner = d.api.grant;
    d.api.grant = async (postId) => {
      const g = await inner(postId);
      d.who.id = null;
      return g;
    };
    await m.sync({ force: true });
    await m.whenRenewed();
    expect(d.api.calls.grant).toEqual(["a"]);
  });
});

describe("signing back in without opening a video app", () => {
  test("signed in within the 48 hours, the manager first runs long after them: the copies are kept", async () => {
    const d = device();
    await save(d, start(d), "p1");
    await save(d, start(d), "p2");
    signOut(d);
    d.clock.now = T0 + 10 * HOUR;
    signIn(d, "u1");

    d.clock.now = T0 + 60 * HOUR;
    const m = start(d);
    await m.init();
    expect(listed(m).sort()).toEqual(["p1", "p2"]);
    expect(d.files.files.size).toBe(2);
    expect(await m.open("p1")).not.toBeNull();
    expect((await stamps(d)).map((s) => s[1])).toEqual([undefined, undefined]);
    expect(d.api.calls.remove).toEqual([]);
    // Both marks are spent.
    expect(d.storage.size).toBe(0);
    await m.sync({ force: true });
    expect(d.files.files.size).toBe(2);
  });

  test("the same when the sign-out was already stamped on the records before the sign-in", async () => {
    const d = device();
    await save(d, start(d), "p1");
    signOut(d);
    d.clock.now = T0 + HOUR;
    await start(d).init();
    expect(await stamps(d)).toEqual([["p1", T0]]);
    d.clock.now = T0 + 47 * HOUR;
    signIn(d, "u1");

    d.clock.now = T0 + 200 * HOUR;
    const m = start(d);
    await m.init();
    expect(listed(m)).toEqual(["p1"]);
    expect(await stamps(d)).toEqual([["p1", undefined]]);
  });

  test("signed in after the 48 hours: the copies are deleted and the server is told", async () => {
    const d = device();
    await save(d, start(d), "p1");
    signOut(d);
    d.clock.now = T0 + 48 * HOUR;
    signIn(d, "u1");

    d.clock.now = T0 + 60 * HOUR;
    const m = start(d);
    await m.init();
    expect(listed(m)).toEqual([]);
    expect(d.files.files.size).toBe(0);
    expect(await d.meta.all()).toEqual([]);
    expect(d.api.calls.remove).toEqual(["p1"]);
  });

  test("a sign-in from BEFORE the sign-out does not count", async () => {
    const d = device();
    await save(d, start(d), "p1");
    noteOfflineSignIn("u1", T0 - HOUR, d.ins);
    signOut(d);
    // Back with no fresh mark (storage refused it), long after the window.
    d.who.id = "u1";
    d.clock.now = T0 + 60 * HOUR;
    await start(d).init();
    expect(await d.meta.all()).toEqual([]);
    expect(d.files.files.size).toBe(0);
  });

  test("another account's sign-in lifts nothing: its own start after the 48 hours deletes them", async () => {
    const d = device();
    await save(d, start(d), "p1");
    signOut(d);
    d.clock.now = T0 + 10 * HOUR;
    signIn(d, "u2");

    d.clock.now = T0 + 20 * HOUR;
    const within = start(d);
    await within.init();
    expect(listed(within)).toEqual([]);
    expect(await within.open("p1")).toBeNull();
    expect(await stamps(d)).toEqual([["p1", T0]]);

    d.clock.now = T0 + 60 * HOUR;
    noteOfflineSignIn("u2", T0 + 10 * HOUR, d.ins);
    await start(d).init();
    expect(await d.meta.all()).toEqual([]);
    expect(d.files.files.size).toBe(0);
    expect(d.api.calls.remove).toEqual([]);
  });

  test("another account's sign-in does not stand in for the owner's, even when the owner is the one signed in later", async () => {
    const d = device();
    await save(d, start(d), "p1");
    signOut(d);
    d.clock.now = T0 + 10 * HOUR;
    signIn(d, "u2");
    // u1 is back after the window; the only sign-in mark inside it is u2's.
    d.who.id = "u1";
    d.clock.now = T0 + 60 * HOUR;
    await start(d).init();
    expect(await d.meta.all()).toEqual([]);
    expect(d.files.files.size).toBe(0);
    expect(JSON.parse(d.storage.get(SIGN_IN_MARKS_KEY)!)).toEqual({ u2: T0 + 10 * HOUR });
  });

  test("the session store notes the sign-in, with the account, wherever a session is saved", async () => {
    const source = await Bun.file(new URL("../../../services/auth/AuthSessionStore.ts", import.meta.url)).text();
    const body = /\n  save\(result: AuthResult\) \{([\s\S]*?)\n  \}/.exec(source)?.[1] ?? "";
    expect(body).toContain("noteOfflineSignIn(result.user?.id);");
    // Every sign-in path goes through that one save().
    const repo = await Bun.file(new URL("../../../services/auth/AuthRepository.ts", import.meta.url)).text();
    expect(repo.match(/this\.sessionStore\.save\(/g)?.length).toBe(4);
    expect(repo).not.toContain("localStorage.setItem");
  });
});

describe("the app's sign-out", () => {
  test("logoutUser notes the sign-out, with the account, before the session is cleared", async () => {
    const source = await Bun.file(new URL("../../../services/authService.ts", import.meta.url)).text();
    const body = /export const logoutUser = \(\) => \{([\s\S]*?)\n\};/.exec(source)?.[1] ?? "";
    const note = body.indexOf("noteOfflineSignOut(authRepository.getSessionUser()?.id)");
    const clear = body.indexOf("authRepository.logout(");
    expect(note).toBeGreaterThanOrEqual(0);
    expect(clear).toBeGreaterThan(note);
  });
});

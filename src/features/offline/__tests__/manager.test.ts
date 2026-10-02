import { describe, expect, test } from "bun:test";

import { OfflineManager, type ManagerDeps } from "../manager";
import { memoryMetaStore, type MetaStore } from "../metaStore";
import { fileNames } from "../storage";
import { OfflineGrantError } from "../wire";
import { bytes, DAY, fakeApi, fakeFetch, FakeFiles, grant, T0, type FakeApi, type FakeFetch, type FakeRoute } from "./fakes";

/* The manager against fakes for the store, the metadata, the API, fetch and the clock. */

interface Rig {
  manager: OfflineManager;
  files: FakeFiles;
  meta: MetaStore;
  api: FakeApi;
  net: FakeFetch;
  clock: { now: number };
  who: { id: string | null };
  urls: { made: string[]; revoked: string[] };
  persisted: { count: number };
}

function rig(routes: Record<string, FakeRoute> = {}, opts: { files?: FakeFiles; meta?: MetaStore } = {}): Rig {
  const files = opts.files ?? new FakeFiles();
  const meta = opts.meta ?? memoryMetaStore();
  const api = fakeApi();
  const net = fakeFetch(routes);
  const clock = { now: T0 };
  const who: { id: string | null } = { id: "u1" };
  const urls = { made: [] as string[], revoked: [] as string[] };
  const persisted = { count: 0 };
  const deps: ManagerDeps = {
    files,
    meta,
    api,
    fetchFn: net.fetch,
    resolveUrl: (p) => p,
    now: () => clock.now,
    userId: () => who.id,
    persist: async () => {
      persisted.count += 1;
      return true;
    },
    createObjectUrl: () => {
      const u = `blob:fake/${urls.made.length + 1}`;
      urls.made.push(u);
      return u;
    },
    revokeObjectUrl: (u) => void urls.revoked.push(u),
  };
  return { manager: new OfflineManager(deps), files, meta, api, net, clock, who, urls, persisted };
}

const VIDEO = "/v1/media/m-p1/serve/720p";
const phase = (r: Rig, id = "p1") => r.manager.getSnapshot().byId[id]?.state.phase;

async function saved(r: Rig, postId = "p1", over: Parameters<typeof grant>[1] = {}): Promise<void> {
  const g = grant(postId, over);
  r.api.grants.set(postId, g);
  r.net.routes.set(g.media.path, { body: bytes(g.media.sizeBytes ?? 20) });
  expect(await r.manager.save(postId, "video")).toEqual({ ok: true });
}

describe("saving a copy", () => {
  test("grant → bytes in the private store → a stored record; storage is asked to persist once", async () => {
    const r = rig();
    const phases: (string | undefined)[] = [];
    r.manager.subscribe(() => phases.push(phase(r)));
    await saved(r);
    await saved(r, "p2");

    expect(phases).toContain("downloading");
    expect(phase(r)).toBe("stored");
    expect(await r.files.size(fileNames.video("p1"))).toBe(20);
    const [rec] = (await r.meta.all()).filter((x) => x.postId === "p1");
    expect(rec).toMatchObject({ postId: "p1", userId: "u1", surface: "video", state: "stored", bytes: 20, title: "Video p1", expiresAt: T0 + 30 * DAY, lastCheckedAt: T0 });
    expect(r.manager.getSnapshot().usedBytes).toBe(40);
    expect(r.persisted.count).toBe(1);
    expect(r.net.calls.every((c) => c.credentials === "include")).toBe(true);
  });

  test("the sound, the captions and the poster are stored with it; a missing caption or poster does not fail the copy", async () => {
    const r = rig({ "/v1/audio/s1/serve": { body: bytes(5), type: "audio/mp4" }, "/v1/media/m-p1/subtitles/en.vtt": { body: bytes(3), type: "text/vtt" } });
    await saved(r, "p1", {
      sound: { path: "/v1/audio/s1/serve", mime: "audio/mp4", sizeBytes: 5, startMs: 250, originalVolume: 0, overlayVolume: 0.8 },
      captions: [{ lang: "en", label: "English", path: "/v1/media/m-p1/subtitles/en.vtt" }, { lang: "hi", label: "Hindi", path: "/v1/media/m-p1/subtitles/hi.vtt" }],
      posterPath: "/v1/media/c1/serve/thumb",
    });
    const [rec] = await r.meta.all();
    expect(rec.bytes).toBe(28);
    expect(rec.sound?.stored).toBe(true);
    expect(rec.captions.map((c) => [c.lang, c.stored])).toEqual([["en", true], ["hi", false]]);
    expect(rec.posterStored).toBe(false);

    const source = (await r.manager.open("p1"))!;
    expect(source.captions).toEqual([{ lang: "en", label: "English", src: expect.stringMatching(/^blob:/) }]);
    expect(source.sound).toMatchObject({ startMs: 250, originalVolume: 0, overlayVolume: 0.8 });
    expect(source.posterUrl).toBeNull();
    source.release();
    expect(r.urls.revoked.sort()).toEqual([...r.urls.made].sort());
  });

  test("a reel whose sound cannot be fetched is not a copy", async () => {
    const r = rig();
    const g = grant("p1", { sound: { path: "/v1/audio/s1/serve", mime: "audio/mp4", sizeBytes: 5, startMs: 0, originalVolume: 1, overlayVolume: 1 } });
    r.api.grants.set("p1", g);
    r.net.routes.set(VIDEO, { body: bytes(20) });
    r.net.routes.set("/v1/audio/s1/serve", { body: bytes(1), status: 404 });
    const result = await r.manager.save("p1", "reel");
    expect(result.ok).toBe(false);
    expect(await r.meta.all()).toEqual([]);
    expect(r.files.files.size).toBe(0);
    expect(r.api.calls.remove).toEqual(["p1"]);
  });

  test("a refusal from the server stores nothing and says why", async () => {
    const r = rig();
    r.api.grants.set("p1", new OfflineGrantError("not_allowed"));
    const result = await r.manager.save("p1", "video");
    expect(result).toEqual({ ok: false, cancelled: false, message: "The creator has turned off offline copies for this video." });
    expect(await r.meta.all()).toEqual([]);
    expect(r.net.calls).toEqual([]);
    expect(phase(r)).toBe("idle");
    expect(r.api.calls.remove).toEqual([]);
  });

  test("signed out: nothing is asked for", async () => {
    const r = rig();
    r.who.id = null;
    expect((await r.manager.save("p1", "video")).ok).toBe(false);
    expect(r.api.calls.grant).toEqual([]);
  });

  test("a full disk: a clear message, and no half copy left on disk, in the records or on the server", async () => {
    const r = rig();
    r.files.capacity = 8;
    r.api.grants.set("p1", grant("p1"));
    r.net.routes.set(VIDEO, { body: bytes(20), chunk: 4 });
    const result = await r.manager.save("p1", "video");
    expect(result).toEqual({ ok: false, cancelled: false, message: "Not enough space on this device. Remove some offline copies and try again." });
    expect(r.files.files.size).toBe(0);
    expect(await r.meta.all()).toEqual([]);
    expect(r.api.calls.remove).toEqual(["p1"]);
    expect(r.manager.getSnapshot().byId.p1.state).toMatchObject({ phase: "idle", resumable: false });
  });

  test("the copy is stored under the id that was asked for, whatever the answer calls it", async () => {
    const r = rig();
    r.api.grants.set("p1", grant("other-id", { media: { mediaId: "m-p1", variant: "720p", path: VIDEO, mime: "video/mp4", sizeBytes: 20 } }));
    r.net.routes.set(VIDEO, { body: bytes(20) });
    await r.manager.save("p1", "video");
    expect((await r.meta.all()).map((x) => x.postId)).toEqual(["p1"]);
  });
});

describe("cancel, resume, restart", () => {
  test("cancel stops the download, deletes the partial bytes and releases the grant", async () => {
    const r = rig();
    r.api.grants.set("p1", grant("p1"));
    r.net.routes.set(VIDEO, { body: bytes(20), hang: true });
    const pending = r.manager.save("p1", "video");
    while (phase(r) !== "downloading" || r.net.calls.length === 0) await new Promise((res) => setTimeout(res, 1));
    r.manager.cancel("p1");
    expect(await pending).toEqual({ ok: false, cancelled: true, message: "Stopped saving." });
    expect(r.files.files.size).toBe(0);
    expect(await r.meta.all()).toEqual([]);
    expect(r.api.calls.remove).toEqual(["p1"]);
    expect(r.manager.getSnapshot().byId.p1).toBeUndefined();
  });

  test("a dropped connection pauses the copy; saving again continues from the kept bytes", async () => {
    const r = rig();
    const body = Uint8Array.from({ length: 20 }, (_, i) => i);
    r.api.grants.set("p1", grant("p1"));
    r.net.routes.set(VIDEO, { body, chunk: 4, dropAfter: 12 });
    const first = await r.manager.save("p1", "video");
    expect(first).toMatchObject({ ok: false, cancelled: false });
    expect(r.manager.getSnapshot().byId.p1.state).toMatchObject({ phase: "idle", resumable: true, receivedBytes: 12 });
    expect((await r.meta.all())[0].state).toBe("downloading");
    expect(r.api.calls.remove).toEqual([]);
    // A paused copy is not playable.
    expect(await r.manager.open("p1")).toBeNull();

    r.net.routes.set(VIDEO, { body, chunk: 4 });
    expect(await r.manager.save("p1", "video")).toEqual({ ok: true });
    expect(r.net.calls.at(-1)?.range).toBe("bytes=12-");
    expect(Array.from(r.files.files.get(fileNames.video("p1"))!)).toEqual(Array.from(body));
    expect(phase(r)).toBe("stored");
  });

  test("a download a closed tab left behind comes back paused and resumable", async () => {
    const first = rig();
    first.api.grants.set("p1", grant("p1"));
    first.net.routes.set(VIDEO, { body: bytes(20), chunk: 4, dropAfter: 8 });
    await first.manager.save("p1", "video");

    const next = rig({}, { files: first.files, meta: first.meta });
    await next.manager.init();
    expect(next.manager.getSnapshot().byId.p1.state).toMatchObject({ phase: "idle", resumable: true, receivedBytes: 8, totalBytes: 20 });
  });

  test("a different rendition on the new grant restarts from zero rather than appending to the old file", async () => {
    const r = rig();
    r.api.grants.set("p1", grant("p1"));
    r.net.routes.set(VIDEO, { body: bytes(20, 1), chunk: 4, dropAfter: 8 });
    await r.manager.save("p1", "video");

    const other = "/v1/media/m-p1/serve/480p";
    r.api.grants.set("p1", grant("p1", { media: { mediaId: "m-p1", variant: "480p", path: other, mime: "video/mp4", sizeBytes: 10 } }));
    r.net.routes.set(other, { body: bytes(10, 2) });
    expect(await r.manager.save("p1", "video")).toEqual({ ok: true });
    expect(r.net.calls.at(-1)).toMatchObject({ url: other, range: null });
    expect(Array.from(r.files.files.get(fileNames.video("p1"))!)).toEqual(Array.from(bytes(10, 2)));
  });

  test("on a store that cannot append, a dropped connection keeps nothing: the next save restarts", async () => {
    const r = rig({}, { files: new FakeFiles(false) });
    r.api.grants.set("p1", grant("p1"));
    r.net.routes.set(VIDEO, { body: bytes(20), chunk: 4, dropAfter: 8 });
    await r.manager.save("p1", "video");
    expect(await r.meta.all()).toEqual([]);
    expect(r.manager.getSnapshot().byId.p1.state.resumable).toBe(false);
  });

  test("saving a stored copy again asks for nothing", async () => {
    const r = rig();
    await saved(r);
    const calls = r.api.calls.grant.length;
    expect(await r.manager.save("p1", "video")).toEqual({ ok: true });
    expect(r.api.calls.grant.length).toBe(calls);
  });
});

describe("removing", () => {
  test("remove deletes the bytes and the record and tells the server", async () => {
    const r = rig();
    await saved(r);
    await r.manager.remove("p1");
    expect(r.files.files.size).toBe(0);
    expect(await r.meta.all()).toEqual([]);
    expect(r.api.calls.remove).toEqual(["p1"]);
    expect(r.manager.getSnapshot().copies).toEqual([]);
    expect(await r.manager.open("p1")).toBeNull();
  });

  test("offline: the bytes go at once, and the server is told on the next sync", async () => {
    const r = rig();
    await saved(r);
    r.api.removeFails = true;
    await r.manager.remove("p1");
    expect(r.files.files.size).toBe(0);
    expect(r.manager.getSnapshot().copies).toEqual([]);
    expect((await r.meta.all()).map((x) => x.state)).toEqual(["removed"]);

    r.api.removeFails = false;
    await r.manager.sync({ force: true });
    expect(await r.meta.all()).toEqual([]);
    expect(r.api.calls.remove).toEqual(["p1", "p1"]);
  });

  test("Remove all removes every copy of this account", async () => {
    const r = rig();
    await saved(r, "p1");
    await saved(r, "p2");
    await r.manager.removeAll();
    expect(r.files.files.size).toBe(0);
    expect(await r.meta.all()).toEqual([]);
    expect(r.api.calls.remove.sort()).toEqual(["p1", "p2"]);
  });
});

describe("the check", () => {
  test("deletes what the server no longer allows, bytes and all, and reports it for the notice", async () => {
    const r = rig();
    await saved(r, "keep");
    await saved(r, "deleted");
    await saved(r, "private");
    await saved(r, "off");
    r.clock.now = T0 + DAY;
    r.api.checkRows = [
      { postId: "keep", valid: true, expiresAt: T0 + 30 * DAY },
      { postId: "deleted", valid: false, reason: "deleted" },
      { postId: "private", valid: false, reason: "private" },
      { postId: "off", valid: false, reason: "not_allowed" },
    ];
    const removed = await r.manager.sync({ force: true });
    expect(removed.map((x) => [x.postId, x.reason]).sort()).toEqual([["deleted", "deleted"], ["off", "not_allowed"], ["private", "private"]]);
    expect(Array.from(r.files.files.keys())).toEqual([fileNames.video("keep")]);
    expect((await r.meta.all()).map((x) => [x.postId, x.lastCheckedAt])).toEqual([["keep", T0 + DAY]]);
    expect(r.manager.getSnapshot().copies.map((c) => c.postId)).toEqual(["keep"]);
    expect(r.api.calls.check.at(-1)?.sort()).toEqual(["deleted", "keep", "off", "private"]);
  });

  test("an expired copy is deleted without asking, even with no network", async () => {
    const r = rig();
    await saved(r, "old", { expiresAt: T0 + DAY });
    await saved(r, "fine");
    r.clock.now = T0 + 2 * DAY;
    r.api.checkRows = new Error("offline");
    r.api.listed = new Error("offline");
    const removed = await r.manager.sync({ force: true });
    expect(removed).toEqual([{ postId: "old", title: "Video old", reason: "expired" }]);
    expect(Array.from(r.files.files.keys())).toEqual([fileNames.video("fine")]);
    expect(r.api.calls.check.at(-1)).toEqual(["fine"]);
    // An expired copy never opens, even before a sweep has run.
    const r2 = rig();
    await saved(r2, "old", { expiresAt: T0 + DAY });
    r2.clock.now = T0 + 2 * DAY;
    expect(await r2.manager.open("old")).toBeNull();
  });

  test("no network: nothing that has not expired is deleted", async () => {
    const r = rig();
    await saved(r);
    r.api.checkRows = new Error("offline");
    expect(await r.manager.sync({ force: true })).toEqual([]);
    expect(phase(r)).toBe("stored");
    expect(await r.manager.open("p1")).not.toBeNull();
  });

  test("without force only the copies whose recheck is due are asked about", async () => {
    const r = rig();
    await saved(r);
    r.clock.now = T0 + DAY;
    await r.manager.sync({ force: false });
    expect(r.api.calls.check).toEqual([]);
    r.clock.now = T0 + 2 * DAY;
    r.api.checkRows = [{ postId: "p1", valid: true, expiresAt: null }];
    await r.manager.sync({ force: false });
    expect(r.api.calls.check).toEqual([["p1"]]);
    expect(r.api.calls.list).toBe(0);
  });

  test("a check never extends the expiry on its own", async () => {
    const r = rig();
    await saved(r);
    r.clock.now = T0 + 3 * DAY;
    r.api.checkRows = [{ postId: "p1", valid: true, expiresAt: null }];
    await r.manager.sync({ force: true });
    expect((await r.meta.all())[0].expiresAt).toBe(T0 + 30 * DAY);
  });

  test("copies the server still counts for this device but that are gone from it are released", async () => {
    const r = rig();
    await saved(r);
    r.api.checkRows = [{ postId: "p1", valid: true, expiresAt: null }];
    r.api.listed = [
      { postId: "p1", title: "", channelName: "", durationMs: null, posterPath: null, expiresAt: T0 + DAY, recheckAfterSeconds: 1, surface: null },
      { postId: "ghost", title: "", channelName: "", durationMs: null, posterPath: null, expiresAt: T0 + DAY, recheckAfterSeconds: 1, surface: null },
    ];
    await r.manager.sync({ force: true });
    expect(r.api.calls.list).toBe(0);
    await r.manager.sync({ force: true, reconcile: true });
    expect(r.api.calls.remove).toEqual(["ghost"]);
    expect(phase(r)).toBe("stored");
  });

  test("nothing stored: the sweep on start sends nothing at all", async () => {
    const r = rig();
    expect(await r.manager.sync({ force: true })).toEqual([]);
    expect(r.api.calls).toEqual({ grant: [], check: [], list: 0, remove: [] });
  });

  test("the next wake-up follows the stored copies", async () => {
    const r = rig();
    expect(r.manager.nextWake()).toBeNull();
    await saved(r);
    expect(r.manager.nextWake()).toBe(6 * 60 * 60 * 1000);
  });
});

describe("who may play a copy", () => {
  test("only a stored copy opens, as object URLs of the stored bytes — never a path", async () => {
    const r = rig();
    await saved(r);
    const source = (await r.manager.open("p1"))!;
    expect(source.videoUrl).toMatch(/^blob:/);
    expect(await r.manager.open("nope")).toBeNull();
  });

  test("another account on the same browser neither sees nor plays the copy, and its check does not speak for it", async () => {
    const r = rig();
    await saved(r);
    r.who.id = "u2";
    await r.manager.reload();
    expect(r.manager.getSnapshot().copies).toEqual([]);
    expect(await r.manager.open("p1")).toBeNull();
    r.api.checkRows = [{ postId: "p1", valid: false, reason: "private" }];
    await r.manager.sync({ force: true });
    expect(r.api.calls.check).toEqual([]);
    expect((await r.meta.all()).map((x) => x.userId)).toEqual(["u1"]);
  });

  test("bytes the browser evicted: the copy is dropped, not offered", async () => {
    const r = rig();
    await saved(r);
    r.files.files.clear();
    expect(await r.manager.open("p1")).toBeNull();
    expect(await r.meta.all()).toEqual([]);
    expect(r.manager.getSnapshot().copies).toEqual([]);
  });
});

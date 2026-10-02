import { describe, expect, test } from "bun:test";

import { contentRangeStart, downloadToStore, OfflineDownloadError } from "../transfer";
import { indexedDbWorks, memoryMetaStore } from "../metaStore";
import { CACHE_NAME, cacheStore, detectFileStore, fileNames, isQuotaError, OfflineQuotaError, OPFS_DIR, opfsStore, type StorageEnv } from "../storage";
import { bytes, fakeCaches, fakeDir, fakeFetch, FakeFiles, quotaError } from "./fakes";

const text = async (blob: Blob | null) => (blob ? Array.from(new Uint8Array(await blob.arrayBuffer())) : null);

describe("which private storage this browser has", () => {
  const works = async () => true;

  test("the private file system first", async () => {
    const root = fakeDir();
    const store = await detectFileStore({ getDirectory: async () => root, writableFiles: true, caches: fakeCaches(), indexedDbWorks: works });
    expect(store?.kind).toBe("opfs");
    expect(store?.canAppend).toBe(true);
  });

  test("Cache Storage where the file system is missing, refuses, or cannot be written from a page", async () => {
    const env = (over: Partial<StorageEnv>): StorageEnv => ({ caches: fakeCaches(), indexedDbWorks: works, ...over });
    expect((await detectFileStore(env({})))?.kind).toBe("cache");
    expect((await detectFileStore(env({ getDirectory: async () => { throw new Error("SecurityError"); }, writableFiles: true })))?.kind).toBe("cache");
    expect((await detectFileStore(env({ getDirectory: async () => fakeDir(), writableFiles: false })))?.kind).toBe("cache");
    expect((await detectFileStore(env({})))?.canAppend).toBe(false);
  });

  test("neither works (a private window): no store, so no Save offline row", async () => {
    expect(await detectFileStore({ indexedDbWorks: works })).toBeNull();
    expect(await detectFileStore({ getDirectory: async () => { throw new Error("no"); }, writableFiles: true, caches: { open: async () => { throw new Error("no"); }, delete: async () => false }, indexedDbWorks: works })).toBeNull();
  });

  test("no IndexedDB for the metadata: no store, even with a working file system", async () => {
    expect(await detectFileStore({ getDirectory: async () => fakeDir(), writableFiles: true, caches: fakeCaches(), indexedDbWorks: async () => false })).toBeNull();
    expect(await detectFileStore({ getDirectory: async () => fakeDir(), writableFiles: true, caches: fakeCaches(), indexedDbWorks: async () => { throw new Error("blocked"); } })).toBeNull();
    expect(await indexedDbWorks(undefined)).toBe(false);
  });
});

describe("the private file system store", () => {
  test("writes in chunks under its own directory, reads back, appends, removes and clears", async () => {
    const root = fakeDir();
    const store = opfsStore(async () => root);
    expect(await store.size("v-p1")).toBe(0);
    expect(await store.read("v-p1")).toBeNull();

    const w = await store.openWriter("v-p1", { append: false, mime: "video/mp4" });
    await w.write(bytes(3, 1));
    await w.write(bytes(2, 2));
    await w.close();
    expect(root.files.size).toBe(0);
    expect(Array.from(root.children.get(OPFS_DIR)!.files.keys())).toEqual(["v-p1"]);
    expect(await store.size("v-p1")).toBe(5);
    expect(await text(await store.read("v-p1"))).toEqual([1, 1, 1, 2, 2]);

    const more = await store.openWriter("v-p1", { append: true, mime: "video/mp4" });
    await more.write(bytes(2, 3));
    await more.close();
    expect(await text(await store.read("v-p1"))).toEqual([1, 1, 1, 2, 2, 3, 3]);

    const again = await store.openWriter("v-p1", { append: false, mime: "video/mp4" });
    await again.write(bytes(1, 9));
    await again.close();
    expect(await text(await store.read("v-p1"))).toEqual([9]);

    await store.remove("v-p1");
    await store.remove("v-p1");
    expect(await store.size("v-p1")).toBe(0);
    await store.clear();
    expect(root.children.has(OPFS_DIR)).toBe(false);
  });

  test("a full disk is a quota error with words a person can act on", async () => {
    const root = fakeDir();
    const dir = await root.getDirectoryHandle!(OPFS_DIR, { create: true });
    const real = dir.getFileHandle.bind(dir);
    dir.getFileHandle = async (name, opts) => {
      const h = await real(name, opts);
      return { ...h, createWritable: async () => ({ write: async () => { throw quotaError(); }, close: async () => undefined, abort: async () => undefined }) };
    };
    const w = await opfsStore(async () => root).openWriter("v-p1", { append: false, mime: "video/mp4" });
    const err = await w.write(bytes(1)).then(() => null, (e) => e);
    expect(err).toBeInstanceOf(OfflineQuotaError);
    expect(err.message).toContain("Not enough space");
    expect(isQuotaError(err)).toBe(true);
    expect(isQuotaError(new Error("other"))).toBe(false);
  });
});

describe("the Cache Storage store", () => {
  test("streams in, is readable only when complete, and never appends", async () => {
    const caches = fakeCaches();
    const store = cacheStore(caches);
    expect(store.canAppend).toBe(false);
    const w = await store.openWriter("v-p1", { append: true, mime: "video/mp4" });
    await w.write(bytes(4, 5));
    expect(await store.read("v-p1")).toBeNull();
    await w.close();
    expect(await store.size("v-p1")).toBe(4);
    expect(await text(await store.read("v-p1"))).toEqual([5, 5, 5, 5]);
    expect(Array.from(caches.stores.keys())).toEqual([CACHE_NAME]);

    const aborted = await store.openWriter("v-p2", { append: false, mime: "video/mp4" });
    await aborted.write(bytes(2));
    await aborted.abort();
    expect(await store.read("v-p2")).toBeNull();

    await store.remove("v-p1");
    expect(await store.size("v-p1")).toBe(0);
    await store.clear();
    expect(caches.stores.size).toBe(0);
  });
});

describe("file names", () => {
  test("one name per asset, and a caption language cannot escape its name", () => {
    expect(fileNames.video("p1")).toBe("v-p1");
    expect(fileNames.sound("p1")).toBe("s-p1");
    expect(fileNames.poster("p1")).toBe("p-p1");
    expect(fileNames.caption("p1", "pt-BR")).toBe("c-p1-pt-BR");
    expect(fileNames.caption("p1", "../x")).toBe("c-p1-___x");
  });
});

describe("the metadata fake", () => {
  test("keeps copies, not references", async () => {
    const meta = memoryMetaStore();
    const rec = { postId: "p1", title: "t" } as never as Parameters<typeof meta.put>[0];
    await meta.put(rec);
    (rec as { title: string }).title = "changed";
    expect((await meta.all())[0].title).toBe("t");
    await meta.delete("p1");
    expect(await meta.all()).toEqual([]);
  });
});

const URL_A = "/v1/media/m1/serve/720p";

describe("downloading into the store", () => {
  test("streams chunk by chunk with progress, sends the session, and stores exactly the granted size", async () => {
    const files = new FakeFiles();
    const net = fakeFetch({ [URL_A]: { body: bytes(10), chunk: 4 } });
    const seen: [number, number | null][] = [];
    const size = await downloadToStore({ fetchFn: net.fetch, url: URL_A, files, name: "v-p1", mime: "video/mp4", expectedBytes: 10, resume: false, onProgress: (r, t) => seen.push([r, t]) });
    expect(size).toBe(10);
    expect(seen).toEqual([[0, 10], [4, 10], [8, 10], [10, 10]]);
    expect(await files.size("v-p1")).toBe(10);
    expect(net.calls).toEqual([{ url: URL_A, range: null, credentials: "include" }]);
  });

  test("an unknown size takes the response's length", async () => {
    const files = new FakeFiles();
    const net = fakeFetch({ [URL_A]: { body: bytes(6) } });
    const totals: (number | null)[] = [];
    expect(await downloadToStore({ fetchFn: net.fetch, url: URL_A, files, name: "v", mime: "video/mp4", expectedBytes: null, resume: false, onProgress: (_r, t) => totals.push(t) })).toBe(6);
    expect(new Set(totals)).toEqual(new Set([6]));
  });

  test("a dropped connection keeps what arrived; the next attempt asks for the rest and appends it", async () => {
    const files = new FakeFiles();
    const body = Uint8Array.from({ length: 12 }, (_, i) => i);
    const net = fakeFetch({ [URL_A]: { body, chunk: 4, dropAfter: 8 } });
    const err = await downloadToStore({ fetchFn: net.fetch, url: URL_A, files, name: "v", mime: "video/mp4", expectedBytes: 12, resume: true }).then(() => null, (e) => e);
    expect(err).toBeInstanceOf(OfflineDownloadError);
    expect(err.kind).toBe("network");
    expect(await files.size("v")).toBe(8);

    net.routes.set(URL_A, { body, chunk: 4 });
    const first: number[] = [];
    expect(await downloadToStore({ fetchFn: net.fetch, url: URL_A, files, name: "v", mime: "video/mp4", expectedBytes: 12, resume: true, onProgress: (r) => first.push(r) })).toBe(12);
    expect(net.calls[1].range).toBe("bytes=8-");
    expect(first[0]).toBe(8);
    expect(Array.from(files.files.get("v")!)).toEqual(Array.from(body));
  });

  test("a server that ignores the range restarts the file from zero instead of appending to it", async () => {
    const files = new FakeFiles();
    files.files.set("v", bytes(8, 1));
    const body = bytes(12, 2);
    const net = fakeFetch({ [URL_A]: { body, ignoreRange: true } });
    expect(await downloadToStore({ fetchFn: net.fetch, url: URL_A, files, name: "v", mime: "video/mp4", expectedBytes: 12, resume: true })).toBe(12);
    expect(Array.from(files.files.get("v")!)).toEqual(Array.from(body));
  });

  test("without resume, or on a store that cannot append, nothing is kept and no range is sent", async () => {
    const files = new FakeFiles(false);
    files.files.set("v", bytes(8, 1));
    const net = fakeFetch({ [URL_A]: { body: bytes(12, 2), dropAfter: 4 } });
    await downloadToStore({ fetchFn: net.fetch, url: URL_A, files, name: "v", mime: "video/mp4", expectedBytes: 12, resume: true }).catch(() => undefined);
    expect(net.calls[0].range).toBeNull();
    const keep = new FakeFiles(true);
    keep.files.set("v", bytes(8, 1));
    const net2 = fakeFetch({ [URL_A]: { body: bytes(12, 2) } });
    await downloadToStore({ fetchFn: net2.fetch, url: URL_A, files: keep, name: "v", mime: "video/mp4", expectedBytes: 12, resume: false });
    expect(net2.calls[0].range).toBeNull();
    expect(Array.from(keep.files.get("v")!)).toEqual(Array.from(bytes(12, 2)));
  });

  test("a file that is already whole is not fetched again", async () => {
    const files = new FakeFiles();
    files.files.set("v", bytes(12));
    const net = fakeFetch({});
    expect(await downloadToStore({ fetchFn: net.fetch, url: URL_A, files, name: "v", mime: "video/mp4", expectedBytes: 12, resume: true })).toBe(12);
    expect(net.calls).toEqual([]);
  });

  test("the wrong size is thrown away, never kept as a copy", async () => {
    const files = new FakeFiles();
    const net = fakeFetch({ [URL_A]: { body: bytes(9) } });
    const err = await downloadToStore({ fetchFn: net.fetch, url: URL_A, files, name: "v", mime: "video/mp4", expectedBytes: 12, resume: false }).then(() => null, (e) => e);
    expect(err.kind).toBe("integrity");
    expect(await files.size("v")).toBe(0);
  });

  test("a page instead of a video (a sign-in redirect that answers 200) is refused", async () => {
    const files = new FakeFiles();
    const net = fakeFetch({ [URL_A]: { body: bytes(9), type: "text/html; charset=utf-8" } });
    const err = await downloadToStore({ fetchFn: net.fetch, url: URL_A, files, name: "v", mime: "video/mp4", expectedBytes: null, resume: false }).then(() => null, (e) => e);
    expect(err.kind).toBe("integrity");
    expect(await files.size("v")).toBe(0);
  });

  test("a refusal from the server carries its status; no network is a network error", async () => {
    const files = new FakeFiles();
    const refused = await downloadToStore({ fetchFn: fakeFetch({ [URL_A]: { body: bytes(1), status: 404 } }).fetch, url: URL_A, files, name: "v", mime: "video/mp4", expectedBytes: null, resume: false }).then(() => null, (e) => e);
    expect([refused.kind, refused.status]).toEqual(["http", 404]);
    const down = await downloadToStore({ fetchFn: fakeFetch({}).fetch, url: URL_A, files, name: "v", mime: "video/mp4", expectedBytes: null, resume: false }).then(() => null, (e) => e);
    expect(down.kind).toBe("network");
  });

  test("a full disk is a quota error and leaves nothing behind", async () => {
    const files = new FakeFiles();
    files.capacity = 6;
    const net = fakeFetch({ [URL_A]: { body: bytes(12), chunk: 4 } });
    const err = await downloadToStore({ fetchFn: net.fetch, url: URL_A, files, name: "v", mime: "video/mp4", expectedBytes: 12, resume: true }).then(() => null, (e) => e);
    expect(err).toBeInstanceOf(OfflineQuotaError);
    expect(await files.size("v")).toBe(0);
  });

  test("Content-Range", () => {
    expect(contentRangeStart("bytes 8-11/12")).toBe(8);
    expect(contentRangeStart("bytes 0-11/*")).toBe(0);
    expect(contentRangeStart("items 8-11/12")).toBeNull();
    expect(contentRangeStart(null)).toBeNull();
  });
});

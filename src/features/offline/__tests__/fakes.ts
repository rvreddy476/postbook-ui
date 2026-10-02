import type { FetchLike } from "../transfer";
import type { CacheLike, CachesLike, DirHandle, FileHandle, FileStore, FileWriter, Writable } from "../storage";
import type { OfflineApi, OfflineCard, OfflineCheckRow, OfflineGrant } from "../wire";

/* Fakes for the browser pieces: the private file system, Cache Storage, fetch and the API. */

export function quotaError(): Error {
  const err = new Error("quota");
  err.name = "QuotaExceededError";
  return err;
}

export function notFoundError(): Error {
  const err = new Error("missing");
  err.name = "NotFoundError";
  return err;
}

function abortError(): Error {
  const err = new Error("aborted");
  err.name = "AbortError";
  return err;
}

export function bytes(n: number, fill = 7): Uint8Array {
  return new Uint8Array(n).fill(fill);
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(a, 0);
  out.set(b, a.byteLength);
  return out;
}

/** An in-memory FileStore with the OPFS behaviour: a write is visible only after close(). */
export class FakeFiles implements FileStore {
  readonly kind = "opfs" as const;
  files = new Map<string, Uint8Array>();
  /** Total bytes the "disk" holds before a write throws a quota error. */
  capacity = Infinity;
  constructor(public canAppend = true) {}

  async size(name: string): Promise<number> {
    return this.files.get(name)?.byteLength ?? 0;
  }
  async openWriter(name: string, opts: { append: boolean; mime: string }): Promise<FileWriter> {
    let pending = opts.append && this.canAppend ? (this.files.get(name) ?? new Uint8Array()) : new Uint8Array();
    const others = () => Array.from(this.files.entries()).reduce((n, [k, v]) => n + (k === name ? 0 : v.byteLength), 0);
    return {
      write: async (chunk) => {
        if (others() + pending.byteLength + chunk.byteLength > this.capacity) throw quotaError();
        pending = concat(pending, chunk);
      },
      close: async () => void this.files.set(name, pending),
      abort: async () => undefined,
    };
  }
  async read(name: string): Promise<Blob | null> {
    const data = this.files.get(name);
    return data && data.byteLength > 0 ? new Blob([data]) : null;
  }
  async remove(name: string): Promise<void> {
    this.files.delete(name);
  }
  async clear(): Promise<void> {
    this.files.clear();
  }
}

export type FakeDir = DirHandle & { files: Map<string, Uint8Array>; children: Map<string, FakeDir> };

/** A fake OPFS directory tree, enough for opfsStore. */
export function fakeDir(): FakeDir {
  const files = new Map<string, Uint8Array>();
  const children = new Map<string, FakeDir>();
  const handle = (name: string): FileHandle => ({
    getFile: async () => new Blob([files.get(name) ?? new Uint8Array()]),
    createWritable: async (opts) => {
      let buf = opts?.keepExistingData ? (files.get(name) ?? new Uint8Array()) : new Uint8Array();
      const w: Writable = {
        write: async (data) => {
          if (data instanceof Uint8Array) {
            buf = concat(buf, data);
            return;
          }
          const end = data.position + data.data.byteLength;
          const next = new Uint8Array(Math.max(buf.byteLength, end));
          next.set(buf, 0);
          next.set(data.data, data.position);
          buf = next;
        },
        close: async () => void files.set(name, buf),
        abort: async () => undefined,
      };
      return w;
    },
  });
  return {
    files,
    children,
    getFileHandle: async (name, opts) => {
      if (!files.has(name)) {
        if (!opts?.create) throw notFoundError();
        files.set(name, new Uint8Array());
      }
      return handle(name);
    },
    removeEntry: async (name) => {
      if (children.delete(name)) return;
      if (!files.delete(name)) throw notFoundError();
    },
    getDirectoryHandle: async (name, opts) => {
      let child = children.get(name);
      if (!child) {
        if (!opts?.create) throw notFoundError();
        child = fakeDir();
        children.set(name, child);
      }
      return child;
    },
  };
}

export function fakeCaches(): CachesLike & { stores: Map<string, Map<string, Response>> } {
  const stores = new Map<string, Map<string, Response>>();
  return {
    stores,
    open: async (name) => {
      let store = stores.get(name);
      if (!store) {
        store = new Map();
        stores.set(name, store);
      }
      const s = store;
      const cache: CacheLike = {
        match: async (key) => s.get(key)?.clone(),
        put: async (key, response) => {
          // Like the real thing: the entry exists only once the whole body has arrived.
          const body = await response.arrayBuffer();
          s.set(key, new Response(body, { headers: response.headers }));
        },
        delete: async (key) => s.delete(key),
      };
      return cache;
    },
    delete: async (name) => stores.delete(name),
  };
}

export interface FakeRoute {
  body: Uint8Array;
  type?: string;
  status?: number;
  /** Chunk size of the stream. */
  chunk?: number;
  /** The stream errors once this many bytes of the file have gone out (a dropped connection). */
  dropAfter?: number;
  /** Answer 200 with the whole body even when a Range was asked for. */
  ignoreRange?: boolean;
  /** Never finish: the stream waits for the abort signal. */
  hang?: boolean;
}

export interface FakeFetch {
  fetch: FetchLike;
  calls: { url: string; range: string | null; credentials: string }[];
  routes: Map<string, FakeRoute>;
}

export function fakeFetch(routes: Record<string, FakeRoute>): FakeFetch {
  const table = new Map(Object.entries(routes));
  const calls: FakeFetch["calls"] = [];
  const fetch: FetchLike = async (url, init) => {
    const range = init.headers?.Range ?? null;
    calls.push({ url, range, credentials: init.credentials });
    const route = table.get(url);
    if (!route) throw new TypeError("network down");
    if (route.status && route.status !== 200) return new Response("no", { status: route.status, headers: { "content-type": "application/json" } });
    const from = range && !route.ignoreRange ? Number(/bytes=(\d+)-/.exec(range)?.[1] ?? 0) : 0;
    const data = route.body.subarray(from);
    const size = route.chunk ?? 4;
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (init.signal?.aborted) {
          controller.error(abortError());
          return;
        }
        if (route.hang) {
          await new Promise<void>((resolve) => init.signal?.addEventListener("abort", () => resolve()));
          controller.error(abortError());
          return;
        }
        if (route.dropAfter !== undefined && from + sent >= route.dropAfter) {
          controller.error(new TypeError("connection reset"));
          return;
        }
        if (sent >= data.byteLength) {
          controller.close();
          return;
        }
        const next = data.subarray(sent, Math.min(sent + size, data.byteLength));
        sent += next.byteLength;
        controller.enqueue(next.slice());
      },
    });
    const headers: Record<string, string> = { "content-type": route.type ?? "video/mp4", "content-length": String(data.byteLength) };
    if (from > 0) headers["content-range"] = `bytes ${from}-${route.body.byteLength - 1}/${route.body.byteLength}`;
    return new Response(stream, { status: from > 0 ? 206 : 200, headers });
  };
  return { fetch, calls, routes: table };
}

export interface FakeApi extends OfflineApi {
  grants: Map<string, OfflineGrant | Error>;
  checkRows: OfflineCheckRow[] | Error;
  listed: OfflineCard[] | Error;
  removeFails: boolean;
  calls: { grant: string[]; check: string[][]; list: number; remove: string[] };
}

export function fakeApi(): FakeApi {
  const api: FakeApi = {
    grants: new Map(),
    checkRows: [],
    listed: [],
    removeFails: false,
    calls: { grant: [], check: [], list: 0, remove: [] },
    async grant(postId) {
      api.calls.grant.push(postId);
      const g = api.grants.get(postId);
      if (!g) throw new Error("no grant");
      if (g instanceof Error) throw g;
      return structuredClone(g);
    },
    async check(postIds) {
      api.calls.check.push([...postIds]);
      if (api.checkRows instanceof Error) throw api.checkRows;
      return api.checkRows;
    },
    async list() {
      api.calls.list += 1;
      if (api.listed instanceof Error) throw api.listed;
      return api.listed;
    },
    async remove(postId) {
      api.calls.remove.push(postId);
      if (api.removeFails) throw new Error("offline");
    },
  };
  return api;
}

export const DAY = 86_400_000;
export const T0 = 1_800_000_000_000;

export function grant(postId: string, over: Partial<OfflineGrant> = {}): OfflineGrant {
  return {
    postId,
    title: `Video ${postId}`,
    channelName: "Ravi",
    durationMs: 60_000,
    posterPath: null,
    expiresAt: T0 + 30 * DAY,
    recheckAfterSeconds: 172_800,
    surface: null,
    media: { mediaId: `m-${postId}`, variant: "720p", path: `/v1/media/m-${postId}/serve/720p`, mime: "video/mp4", sizeBytes: 20 },
    captions: [],
    sound: null,
    ...over,
  };
}

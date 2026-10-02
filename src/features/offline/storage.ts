/*
  Where the bytes live: the browser's private storage for this site.

    opfs   the Origin Private File System (`navigator.storage.getDirectory()`),
           one file per asset under the "offline-copies" directory. It is
           not a folder the person can browse to, it has no path, and
           nothing is written to Downloads.
    cache  Cache Storage, where the file system is missing or cannot be
           written from a page (older Safari). No append: a broken download
           starts again.
    none   neither works (some private windows, blocked site data): the
           Save offline row is not offered at all.

  Writes are streamed chunk by chunk; a whole video is never held in memory.
*/

export type StorageKind = "opfs" | "cache" | "none";

export interface FileWriter {
  write(chunk: Uint8Array): Promise<void>;
  /** Commits what was written. */
  close(): Promise<void>;
  /** Drops what was written in this session. */
  abort(): Promise<void>;
}

export interface FileStore {
  readonly kind: Exclude<StorageKind, "none">;
  /** A failed download's bytes can be kept and appended to. */
  readonly canAppend: boolean;
  /** Committed bytes under this name; 0 when there is none. */
  size(name: string): Promise<number>;
  /** `append`: keep the committed bytes and write after them (ignored where canAppend is false). */
  openWriter(name: string, opts: { append: boolean; mime: string }): Promise<FileWriter>;
  /** A disk-backed blob, or null. */
  read(name: string): Promise<Blob | null>;
  remove(name: string): Promise<void>;
  /** Removes every file this feature wrote. */
  clear(): Promise<void>;
}

export const OPFS_DIR = "offline-copies";
export const CACHE_NAME = "offline-copies-v1";
const CACHE_PREFIX = "/__offline-copy__/";

export class OfflineQuotaError extends Error {
  constructor() {
    super("Not enough space on this device. Remove some offline copies and try again.");
    this.name = "OfflineQuotaError";
  }
}

export function isQuotaError(err: unknown): boolean {
  if (err instanceof OfflineQuotaError) return true;
  const name = (err as { name?: unknown })?.name;
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED";
}

function quota<T>(p: Promise<T>): Promise<T> {
  return p.catch((err) => {
    throw isQuotaError(err) ? new OfflineQuotaError() : err;
  });
}

/* ── OPFS ───────────────────────────────────────────────── */

/** The slice of the File System API used here (a fake in tests). */
export interface DirHandle {
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FileHandle>;
  removeEntry(name: string, opts?: { recursive?: boolean }): Promise<void>;
  getDirectoryHandle?(name: string, opts?: { create?: boolean }): Promise<DirHandle>;
}
export interface FileHandle {
  getFile(): Promise<Blob>;
  createWritable(opts?: { keepExistingData?: boolean }): Promise<Writable>;
}
export interface Writable {
  write(data: Uint8Array | { type: "write"; position: number; data: Uint8Array }): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

function notFound(err: unknown): boolean {
  return (err as { name?: unknown })?.name === "NotFoundError";
}

export function opfsStore(root: () => Promise<DirHandle>): FileStore {
  const dir = async () => {
    const r = await root();
    return r.getDirectoryHandle ? r.getDirectoryHandle(OPFS_DIR, { create: true }) : r;
  };
  const size = async (name: string) => {
    try {
      return (await (await (await dir()).getFileHandle(name)).getFile()).size;
    } catch (err) {
      if (notFound(err)) return 0;
      throw err;
    }
  };
  return {
    kind: "opfs",
    canAppend: true,
    size,
    async openWriter(name, { append }) {
      const handle = await quota((await dir()).getFileHandle(name, { create: true }));
      const from = append ? (await handle.getFile()).size : 0;
      const w = await quota(handle.createWritable({ keepExistingData: append }));
      let position = from;
      return {
        async write(chunk) {
          await quota(w.write({ type: "write", position, data: chunk }));
          position += chunk.byteLength;
        },
        close: () => quota(w.close()),
        abort: () => w.abort().catch(() => undefined),
      };
    },
    async read(name) {
      try {
        const file = await (await (await dir()).getFileHandle(name)).getFile();
        return file.size > 0 ? file : null;
      } catch (err) {
        if (notFound(err)) return null;
        throw err;
      }
    },
    async remove(name) {
      try {
        await (await dir()).removeEntry(name);
      } catch (err) {
        if (!notFound(err)) throw err;
      }
    },
    async clear() {
      const r = await root();
      if (!r.getDirectoryHandle) return;
      try {
        await r.removeEntry(OPFS_DIR, { recursive: true });
      } catch (err) {
        if (!notFound(err)) throw err;
      }
    },
  };
}

/* ── Cache Storage ──────────────────────────────────────── */

export interface CacheLike {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<void>;
  delete(key: string): Promise<boolean>;
}
export interface CachesLike {
  open(name: string): Promise<CacheLike>;
  delete(name: string): Promise<boolean>;
}

export function cacheStore(caches: CachesLike): FileStore {
  const key = (name: string) => `${CACHE_PREFIX}${encodeURIComponent(name)}`;
  const open = () => caches.open(CACHE_NAME);
  return {
    kind: "cache",
    canAppend: false,
    async size(name) {
      const hit = await (await open()).match(key(name));
      return hit ? (await hit.blob()).size : 0;
    },
    async openWriter(name, { mime }) {
      const cache = await open();
      await cache.delete(key(name));
      const pipe = new TransformStream<Uint8Array, Uint8Array>();
      const writer = pipe.writable.getWriter();
      // put() settles only when the body ends, and an entry cannot be read before that: a half-written copy is never served.
      const put = quota(cache.put(key(name), new Response(pipe.readable, { headers: { "content-type": mime } })));
      put.catch(() => undefined);
      return {
        write: (chunk) => quota(writer.write(chunk)),
        async close() {
          await quota(writer.close());
          await put;
        },
        async abort() {
          await writer.abort().catch(() => undefined);
          await put.catch(() => undefined);
          await cache.delete(key(name)).catch(() => false);
        },
      };
    },
    async read(name) {
      const hit = await (await open()).match(key(name));
      return hit ? hit.blob() : null;
    },
    async remove(name) {
      await (await open()).delete(key(name));
    },
    async clear() {
      await caches.delete(CACHE_NAME);
    },
  };
}

/* ── detection ──────────────────────────────────────────── */

export interface StorageEnv {
  /** `navigator.storage.getDirectory`, when the browser has it. */
  getDirectory?: () => Promise<DirHandle>;
  /** Whether a page (not only a worker) can write a file: `createWritable` exists. */
  writableFiles?: boolean;
  caches?: CachesLike;
  /** IndexedDB opens (the metadata lives there). */
  indexedDbWorks: () => Promise<boolean>;
}

/**
  The store this browser can use, or null — and with null there is no Save
  offline row anywhere. Each candidate is actually opened: a private window
  can have the API and still refuse it.
*/
export async function detectFileStore(env: StorageEnv): Promise<FileStore | null> {
  let meta = false;
  try {
    meta = await env.indexedDbWorks();
  } catch {
    meta = false;
  }
  if (!meta) return null;

  if (env.getDirectory && env.writableFiles) {
    try {
      const root = await env.getDirectory();
      if (root) return opfsStore(env.getDirectory);
    } catch {
      /* fall through to Cache Storage */
    }
  }
  if (env.caches) {
    try {
      await env.caches.open(CACHE_NAME);
      return cacheStore(env.caches);
    } catch {
      /* nothing works */
    }
  }
  return null;
}

/** The names one copy's assets are stored under. */
export const fileNames = {
  video: (postId: string) => `v-${postId}`,
  sound: (postId: string) => `s-${postId}`,
  poster: (postId: string) => `p-${postId}`,
  caption: (postId: string, lang: string) => `c-${postId}-${lang.replace(/[^A-Za-z0-9_-]/g, "_")}`,
};

import type { OfflineCaption, OfflineMedia, OfflineSound, OfflineSurface } from "./wire";

/*
  What is known about each stored copy: the grant card, the expiry, the
  last check and which assets made it to disk. It lives in IndexedDB beside
  the bytes; nothing in it is a path on the person's disk.

    state  downloading  a download is running, or one stopped and its bytes are kept
           stored       complete and playable
           removed      the bytes are gone; the server still has to be told
*/

export type RecordState = "downloading" | "stored" | "removed";

export interface OfflineRecord {
  postId: string;
  /** The account that saved it: a copy is only ever listed or played for that account. */
  userId: string;
  surface: OfflineSurface;
  state: RecordState;
  title: string;
  channelName: string;
  durationMs: number | null;
  posterPath: string | null;
  posterStored: boolean;
  /** Epoch ms. */
  expiresAt: number;
  recheckAfterSeconds: number;
  media: OfflineMedia;
  captions: (OfflineCaption & { stored: boolean })[];
  sound: (OfflineSound & { stored: boolean }) | null;
  /** Bytes on disk for every asset of this copy. */
  bytes: number;
  savedAt: number;
  /** Epoch ms of the last answered check; 0 = never. */
  lastCheckedAt: number;
}

export interface MetaStore {
  all(): Promise<OfflineRecord[]>;
  put(record: OfflineRecord): Promise<void>;
  delete(postId: string): Promise<void>;
  clear(): Promise<void>;
}

export const META_DB = "postbook-offline";
export const META_STORE = "copies";

/** The in-memory store: the tests' fake, and what a page falls back to never (no IndexedDB = no feature). */
export function memoryMetaStore(seed: readonly OfflineRecord[] = []): MetaStore {
  const rows = new Map(seed.map((r) => [r.postId, structuredClone(r)]));
  return {
    all: async () => Array.from(rows.values(), (r) => structuredClone(r)),
    put: async (record) => void rows.set(record.postId, structuredClone(record)),
    delete: async (postId) => void rows.delete(postId),
    clear: async () => rows.clear(),
  };
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(META_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(META_STORE)) req.result.createObjectStore(META_STORE, { keyPath: "postId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("offline metadata is blocked"));
  });
}

export function indexedDbMetaStore(factory: IDBFactory): MetaStore {
  let db: Promise<IDBDatabase> | null = null;
  const store = async (mode: IDBTransactionMode) => {
    db ??= openDb(factory);
    return (await db).transaction(META_STORE, mode).objectStore(META_STORE);
  };
  return {
    all: async () => (await wrap((await store("readonly")).getAll())) as OfflineRecord[],
    put: async (record) => void (await wrap((await store("readwrite")).put(record))),
    delete: async (postId) => void (await wrap((await store("readwrite")).delete(postId))),
    clear: async () => void (await wrap((await store("readwrite")).clear())),
  };
}

/** Whether IndexedDB really opens here (some private windows have the object and refuse the open). */
export async function indexedDbWorks(factory: IDBFactory | undefined): Promise<boolean> {
  if (!factory) return false;
  try {
    const db = await openDb(factory);
    db.close();
    return true;
  } catch {
    return false;
  }
}

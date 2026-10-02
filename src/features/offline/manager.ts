import { COPY_IDLE, copyReducer, type CopyEvent, type CopyState } from "./copyState";
import { downloadToStore, isAbort, OfflineDownloadError, type FetchLike } from "./transfer";
import type { MetaStore, OfflineRecord } from "./metaStore";
import { applyCheck, idsToCheck, isExpired, nextWakeDelay } from "./schedule";
import { fileNames, isQuotaError, OfflineQuotaError, type FileStore } from "./storage";
import { OfflineGrantError, REFUSAL_MESSAGES, type OfflineApi, type OfflineCheckRow, type OfflineGrant, type OfflineInvalidReason, type OfflineSurface } from "./wire";

/*
  The one object that owns offline copies in a tab: it asks the server for
  a grant, streams the granted rendition into the private store, records
  the copy, hands players an object URL of the stored file, and deletes
  copies that expire or that the server no longer allows.

  Everything it touches is injected (store, metadata, API, fetch, clock),
  so the tests drive it with fakes.
*/

export interface CopyView {
  postId: string;
  state: CopyState;
  /** Absent before the grant answers. */
  record: OfflineRecord | null;
}

export interface OfflineSnapshot {
  /** The records were read; before that nothing is known. */
  ready: boolean;
  /** This account's copies on this device, newest first: stored, downloading and paused. */
  copies: CopyView[];
  byId: Readonly<Record<string, CopyView>>;
  /** Bytes on disk across those copies. */
  usedBytes: number;
}

export interface OfflineSource {
  videoUrl: string;
  /** A reel's added sound and the creator's mix. */
  sound: { url: string; startMs: number; originalVolume: number; overlayVolume: number } | null;
  posterUrl: string | null;
  captions: { lang: string; label: string; src: string }[];
  release(): void;
}

export type SaveResult = { ok: true } | { ok: false; cancelled: boolean; message: string };

export interface RemovedCopy {
  postId: string;
  title: string;
  reason: OfflineInvalidReason;
}

export interface ManagerDeps {
  files: FileStore;
  meta: MetaStore;
  api: OfflineApi;
  fetchFn: FetchLike;
  /** Gateway-relative path → the URL to fetch. */
  resolveUrl: (path: string) => string;
  now: () => number;
  /** The signed-in account, or null. */
  userId: () => string | null;
  /** `navigator.storage.persist()`: asked once, before the first save. */
  persist?: () => Promise<unknown>;
  createObjectUrl: (blob: Blob) => string;
  revokeObjectUrl: (url: string) => void;
  /** Tells this site's other tabs that the records changed. */
  broadcast?: () => void;
}

const EMPTY: OfflineSnapshot = { ready: false, copies: [], byId: {}, usedBytes: 0 };
const PROGRESS_EVERY_MS = 200;

export class OfflineManager {
  private records = new Map<string, OfflineRecord>();
  private states = new Map<string, CopyState>();
  private active = new Map<string, AbortController>();
  private listeners = new Set<() => void>();
  private snapshot: OfflineSnapshot = EMPTY;
  private ready: Promise<void> | null = null;
  private syncing: Promise<RemovedCopy[]> | null = null;
  private persistAsked = false;

  constructor(private readonly deps: ManagerDeps) {}

  /* ── store plumbing ───────────────────────────────────── */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): OfflineSnapshot => this.snapshot;

  /** Reads the records once; every other call waits for it. */
  init(): Promise<void> {
    this.ready ??= this.reload();
    return this.ready;
  }

  /** Re-reads the records (another tab changed them). Running downloads keep their state. */
  async reload(): Promise<void> {
    const rows = await this.deps.meta.all();
    this.records = new Map(rows.map((r) => [r.postId, r]));
    for (const r of rows) {
      if (this.active.has(r.postId)) continue;
      this.states.set(r.postId, await this.stateOf(r));
    }
    for (const id of Array.from(this.states.keys())) {
      if (!this.records.has(id) && !this.active.has(id) && this.states.get(id)?.phase !== "idle") this.states.delete(id);
    }
    this.emit(true);
  }

  private async stateOf(r: OfflineRecord): Promise<CopyState> {
    if (r.state === "stored") return { phase: "stored", receivedBytes: r.bytes, totalBytes: r.bytes, resumable: false, message: null };
    if (r.state === "removed") return { ...COPY_IDLE, phase: "removed" };
    // A download a closed tab left behind: paused, resumable from whatever was committed.
    const kept = this.deps.files.canAppend ? await this.deps.files.size(fileNames.video(r.postId)).catch(() => 0) : 0;
    return { phase: "idle", receivedBytes: kept, totalBytes: r.media.sizeBytes, resumable: kept > 0, message: null };
  }

  private dispatch(postId: string, event: CopyEvent) {
    this.states.set(postId, copyReducer(this.states.get(postId) ?? COPY_IDLE, event));
  }

  private emit(ready = this.snapshot.ready) {
    const user = this.deps.userId();
    const copies: CopyView[] = [];
    const byId: Record<string, CopyView> = {};
    let usedBytes = 0;
    const ids = new Set([...this.records.keys(), ...this.states.keys()]);
    for (const postId of ids) {
      const record = this.records.get(postId) ?? null;
      if (record && (record.userId !== user || record.state === "removed")) continue;
      const state = this.states.get(postId) ?? COPY_IDLE;
      if (!record && state.phase !== "downloading" && !state.message) continue;
      const view: CopyView = { postId, state, record };
      byId[postId] = view;
      if (record) {
        copies.push(view);
        usedBytes += record.state === "stored" ? record.bytes : state.receivedBytes;
      }
    }
    copies.sort((a, b) => (b.record?.savedAt ?? 0) - (a.record?.savedAt ?? 0));
    this.snapshot = { ready, copies, byId, usedBytes };
    for (const l of this.listeners) l();
  }

  private changed() {
    this.emit();
    try {
      this.deps.broadcast?.();
    } catch {
      /* other tabs catch up on their next read */
    }
  }

  /* ── save ─────────────────────────────────────────────── */

  /**
    Saves a copy: grant → video → sound → captions → poster → stored. A
    copy that stopped half way resumes when the grant still names the same
    file. Never throws; the result says what to tell the viewer.
  */
  async save(postId: string, surface: OfflineSurface): Promise<SaveResult> {
    await this.init();
    if (this.active.has(postId)) return { ok: false, cancelled: false, message: "Already saving." };
    const userId = this.deps.userId();
    if (!userId) return { ok: false, cancelled: false, message: REFUSAL_MESSAGES.sign_in };
    const held = this.records.get(postId) ?? null;
    if (held && held.userId === userId && held.state === "stored") return { ok: true };
    // Another account's copy of the same video on this browser: it is replaced, never shared.
    if (held && held.userId !== userId) this.states.delete(postId);

    const ctrl = new AbortController();
    this.active.set(postId, ctrl);
    const prior = this.records.get(postId) ?? null;
    const paused = this.states.get(postId) ?? COPY_IDLE;
    this.dispatch(postId, { type: "start", totalBytes: prior?.media.sizeBytes ?? null, resumeFrom: paused.receivedBytes });
    this.emit();

    const { files, meta, api } = this.deps;
    let granted = false;
    try {
      if (!this.persistAsked) {
        this.persistAsked = true;
        await this.deps.persist?.().catch(() => undefined);
      }
      const grant = await api.grant(postId);
      granted = true;
      if (ctrl.signal.aborted) throw abortError();

      const sameFile = !!prior && prior.userId === userId && prior.state === "downloading" && prior.media.path === grant.media.path && prior.media.sizeBytes === grant.media.sizeBytes;
      if (!sameFile) await this.deleteFiles(prior ?? recordFrom(grant, userId, surface, this.deps.now()));
      const record: OfflineRecord = { ...recordFrom(grant, userId, surface, this.deps.now()), postId };
      this.records.set(postId, record);
      await meta.put(record);
      this.changed();

      let shown = 0;
      const videoBytes = await downloadToStore({
        fetchFn: this.deps.fetchFn,
        url: this.deps.resolveUrl(grant.media.path),
        files,
        name: fileNames.video(postId),
        mime: grant.media.mime,
        expectedBytes: grant.media.sizeBytes,
        resume: sameFile,
        signal: ctrl.signal,
        onProgress: (received, total) => {
          this.dispatch(postId, { type: "progress", receivedBytes: received, totalBytes: total });
          const t = this.deps.now();
          if (t - shown >= PROGRESS_EVERY_MS || (total !== null && received >= total)) {
            shown = t;
            this.emit();
          }
        },
      });
      let bytes = videoBytes;

      // The added sound is part of a reel: without it the copy is not the video.
      if (grant.sound) {
        bytes += await this.fetchAsset(grant.sound.path, fileNames.sound(postId), grant.sound.mime, grant.sound.sizeBytes, ctrl.signal);
        record.sound = { ...grant.sound, stored: true };
      }
      // Captions and the poster are extras: a copy without them still plays.
      for (const caption of record.captions) {
        try {
          bytes += await this.fetchAsset(caption.path, fileNames.caption(postId, caption.lang), "text/vtt", null, ctrl.signal);
          caption.stored = true;
        } catch (err) {
          if (isAbort(err) || isQuotaError(err)) throw err;
        }
      }
      if (record.posterPath) {
        try {
          bytes += await this.fetchAsset(record.posterPath, fileNames.poster(postId), "image/jpeg", null, ctrl.signal);
          record.posterStored = true;
        } catch (err) {
          if (isAbort(err) || isQuotaError(err)) throw err;
        }
      }
      if (ctrl.signal.aborted) throw abortError();

      record.state = "stored";
      record.bytes = bytes;
      record.savedAt = this.deps.now();
      record.lastCheckedAt = this.deps.now();
      await meta.put(record);
      this.dispatch(postId, { type: "complete", totalBytes: bytes });
      this.active.delete(postId);
      this.changed();
      return { ok: true };
    } catch (err) {
      this.active.delete(postId);
      const record = this.records.get(postId) ?? null;

      if (isAbort(err) || ctrl.signal.aborted) {
        await this.discard(postId, record, granted);
        this.dispatch(postId, { type: "cancel" });
        this.changed();
        return { ok: false, cancelled: true, message: "Stopped saving." };
      }
      if (err instanceof OfflineGrantError) {
        this.dispatch(postId, { type: "fail", message: err.message, keptBytes: 0 });
        this.emit();
        return { ok: false, cancelled: false, message: err.message };
      }
      const network = err instanceof OfflineDownloadError && err.kind === "network";
      if (network && files.canAppend) {
        // Keep the record and the bytes: saving again continues from here.
        const kept = await files.size(fileNames.video(postId)).catch(() => 0);
        const message = "The connection dropped. Save offline again to continue.";
        this.dispatch(postId, { type: "fail", message, keptBytes: kept });
        if (kept === 0) await this.discard(postId, record, granted);
        this.changed();
        return { ok: false, cancelled: false, message };
      }
      await this.discard(postId, record, granted);
      const message = isQuotaError(err) ? new OfflineQuotaError().message : network ? "The connection dropped. Try again." : "Could not save this video offline.";
      this.dispatch(postId, { type: "fail", message, keptBytes: 0 });
      this.changed();
      return { ok: false, cancelled: false, message };
    }
  }

  private fetchAsset(path: string, name: string, mime: string, expectedBytes: number | null, signal: AbortSignal): Promise<number> {
    return downloadToStore({ fetchFn: this.deps.fetchFn, url: this.deps.resolveUrl(path), files: this.deps.files, name, mime, expectedBytes, resume: false, signal });
  }

  /** Stops a running save and throws its bytes away. */
  cancel(postId: string): void {
    this.active.get(postId)?.abort();
  }

  /* ── remove ───────────────────────────────────────────── */

  private async deleteFiles(record: Pick<OfflineRecord, "postId" | "captions">): Promise<void> {
    const { files } = this.deps;
    const names = [fileNames.video(record.postId), fileNames.sound(record.postId), fileNames.poster(record.postId), ...record.captions.map((c) => fileNames.caption(record.postId, c.lang))];
    await Promise.all(names.map((n) => files.remove(n).catch(() => undefined)));
  }

  /** Bytes and record gone; the server's row released when it was granted (best effort — the check retires it otherwise). */
  private async discard(postId: string, record: OfflineRecord | null, tellServer: boolean): Promise<void> {
    if (record) await this.deleteFiles(record);
    else await this.deps.files.remove(fileNames.video(postId)).catch(() => undefined);
    this.records.delete(postId);
    await this.deps.meta.delete(postId).catch(() => undefined);
    if (tellServer) await this.deps.api.remove(postId).catch(() => undefined);
  }

  /**
    Removes a copy. The bytes go first and at once; if the server cannot be
    told (offline), the record stays as a tombstone and the next sync tells it.
  */
  async remove(postId: string): Promise<void> {
    await this.init();
    this.cancel(postId);
    const record = this.records.get(postId);
    if (!record) {
      this.states.delete(postId);
      this.emit();
      return;
    }
    await this.deleteFiles(record);
    this.dispatch(postId, { type: "remove" });
    try {
      await this.deps.api.remove(postId);
      this.records.delete(postId);
      await this.deps.meta.delete(postId);
    } catch {
      const tombstone: OfflineRecord = { ...record, state: "removed", bytes: 0 };
      this.records.set(postId, tombstone);
      await this.deps.meta.put(tombstone).catch(() => undefined);
    }
    this.states.delete(postId);
    this.changed();
  }

  /** Removes every copy of this account on this device. */
  async removeAll(): Promise<void> {
    await this.init();
    const user = this.deps.userId();
    const mine = Array.from(this.records.values()).filter((r) => r.userId === user && r.state !== "removed");
    for (const r of mine) await this.remove(r.postId);
  }

  /* ── check ────────────────────────────────────────────── */

  /**
    Deletes expired copies, asks the server about the rest, deletes what it
    no longer allows, and returns what went (for the quiet notice). With no
    network only the expired ones go. `force` asks about every copy; without
    it only those whose recheck time has come. `reconcile` (the Offline page)
    also releases copies the server still counts for this device that are
    no longer on it. With nothing stored and no reconcile, nothing is sent.
  */
  sync(opts: { force: boolean; reconcile?: boolean }): Promise<RemovedCopy[]> {
    this.syncing ??= this.runSync(opts.force, opts.reconcile === true).finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }

  private async runSync(force: boolean, reconcile: boolean): Promise<RemovedCopy[]> {
    await this.init();
    const { api, meta } = this.deps;
    const now = this.deps.now();
    const user = this.deps.userId();
    const removed: RemovedCopy[] = [];

    // Another account's copies are never checked as this one; they still expire.
    for (const r of Array.from(this.records.values())) {
      if (r.userId !== user && r.state !== "removed" && isExpired(r, now) && !this.active.has(r.postId)) {
        await this.deleteFiles(r);
        this.records.delete(r.postId);
        await meta.delete(r.postId).catch(() => undefined);
      }
    }
    if (!user) {
      this.changed();
      return removed;
    }

    // Removals the server has not heard about yet.
    for (const r of Array.from(this.records.values())) {
      if (r.state !== "removed" || r.userId !== user) continue;
      try {
        await api.remove(r.postId);
        this.records.delete(r.postId);
        await meta.delete(r.postId);
      } catch {
        /* next time */
      }
    }

    const mine = Array.from(this.records.values()).filter((r) => r.userId === user && r.state !== "removed" && !this.active.has(r.postId));
    const ids = idsToCheck(mine, now, force);
    let rows: OfflineCheckRow[] | null = null;
    if (ids.length > 0) {
      try {
        rows = await api.check(ids);
      } catch {
        rows = null;
      }
    }
    const outcome = applyCheck(mine, rows, now);
    for (const gone of outcome.remove) {
      const record = this.records.get(gone.postId);
      if (!record) continue;
      await this.deleteFiles(record);
      this.dispatch(gone.postId, gone.reason === "expired" ? { type: "expire" } : { type: "invalidate", reason: gone.reason });
      this.records.delete(gone.postId);
      this.states.delete(gone.postId);
      await meta.delete(gone.postId).catch(() => undefined);
      if (record.state === "stored") removed.push({ postId: gone.postId, title: record.title, reason: gone.reason });
    }
    for (const fresh of outcome.update) {
      const record = this.records.get(fresh.postId);
      if (!record) continue;
      record.expiresAt = fresh.expiresAt;
      record.lastCheckedAt = fresh.lastCheckedAt;
      await meta.put(record).catch(() => undefined);
    }

    // Copies the server counts for this device that are not here any more (site data was cleared): release them, so they stop counting towards the 100.
    if (reconcile && (rows !== null || ids.length === 0)) {
      try {
        // Re-read first: another tab may have started a save since this sweep began.
        const local = new Set((await meta.all()).map((r) => r.postId));
        for (const card of await api.list()) {
          if (!local.has(card.postId) && !this.active.has(card.postId)) await api.remove(card.postId).catch(() => undefined);
        }
      } catch {
        /* offline, or the list is not there yet */
      }
    }

    this.changed();
    return removed;
  }

  /** ms until the next expiry or due check for this account's copies; null when there is nothing stored. */
  nextWake(): number | null {
    const user = this.deps.userId();
    return nextWakeDelay(
      Array.from(this.records.values()).filter((r) => r.userId === user && r.state === "stored"),
      this.deps.now(),
    );
  }

  /* ── playback ─────────────────────────────────────────── */

  /**
    Object URLs of a stored copy, for a player in this page. Only a stored,
    unexpired copy of the signed-in account opens. If the browser has
    evicted the bytes, the copy is dropped and null comes back.
  */
  async open(postId: string): Promise<OfflineSource | null> {
    await this.init();
    const record = this.records.get(postId);
    if (!record || record.state !== "stored" || record.userId !== this.deps.userId() || isExpired(record, this.deps.now())) return null;
    const { files, createObjectUrl, revokeObjectUrl } = this.deps;
    const video = await files.read(fileNames.video(postId)).catch(() => null);
    if (!video) {
      await this.discard(postId, record, false);
      this.states.delete(postId);
      this.changed();
      return null;
    }
    const urls: string[] = [];
    const url = (blob: Blob) => {
      const u = createObjectUrl(blob);
      urls.push(u);
      return u;
    };
    const optional = async (name: string) => {
      const blob = await files.read(name).catch(() => null);
      return blob ? url(blob) : null;
    };
    const captions: OfflineSource["captions"] = [];
    for (const c of record.captions) {
      const src = c.stored ? await optional(fileNames.caption(postId, c.lang)) : null;
      if (src) captions.push({ lang: c.lang, label: c.label, src });
    }
    const soundUrl = record.sound?.stored ? await optional(fileNames.sound(postId)) : null;
    return {
      videoUrl: url(video),
      sound: record.sound && soundUrl ? { url: soundUrl, startMs: record.sound.startMs, originalVolume: record.sound.originalVolume, overlayVolume: record.sound.overlayVolume } : null,
      posterUrl: record.posterStored ? await optional(fileNames.poster(postId)) : null,
      captions,
      release: () => urls.splice(0).forEach(revokeObjectUrl),
    };
  }

  /** The stored poster of a copy (any state), for the Offline page's rows. */
  async openPoster(postId: string): Promise<{ url: string; release: () => void } | null> {
    const record = this.records.get(postId);
    if (!record?.posterStored || record.userId !== this.deps.userId()) return null;
    const blob = await this.deps.files.read(fileNames.poster(postId)).catch(() => null);
    if (!blob) return null;
    const url = this.deps.createObjectUrl(blob);
    return { url, release: () => this.deps.revokeObjectUrl(url) };
  }
}

function abortError(): Error {
  const err = new Error("aborted");
  err.name = "AbortError";
  return err;
}

export function recordFrom(grant: OfflineGrant, userId: string, surface: OfflineSurface, now: number): OfflineRecord {
  return {
    postId: grant.postId,
    userId,
    surface: grant.surface ?? surface,
    state: "downloading",
    title: grant.title,
    channelName: grant.channelName,
    durationMs: grant.durationMs,
    posterPath: grant.posterPath,
    posterStored: false,
    expiresAt: grant.expiresAt,
    recheckAfterSeconds: grant.recheckAfterSeconds,
    media: grant.media,
    captions: grant.captions.map((c) => ({ ...c, stored: false })),
    sound: grant.sound ? { ...grant.sound, stored: false } : null,
    bytes: 0,
    savedAt: now,
    lastCheckedAt: 0,
  };
}

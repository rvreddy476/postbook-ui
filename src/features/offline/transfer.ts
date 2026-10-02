import { isQuotaError, OfflineQuotaError, type FileStore } from "./storage";

/*
  One asset from a serve route into the private store, streamed.

  - progress is reported per chunk (the caller throttles what it shows);
  - a failed attempt's bytes are kept where the store can append, and the
    next attempt asks for the rest with a Range header. A 206 that starts
    where we stopped is appended; a plain 200 means the server ignored the
    range, and the file is written again from zero;
  - when the grant says a size, the stored file must be exactly that size,
    or it is thrown away;
  - the response must not be a page (a sign-in redirect that answers 200
    with HTML is not a video).

  Nothing here makes a link, opens a window or hands the browser a file to
  save: the bytes go from fetch() into the store and nowhere else.
*/

export class OfflineDownloadError extends Error {
  constructor(
    message: string,
    /** "http": the server refused. "integrity": what arrived is not the file. "network": the connection dropped. */
    public readonly kind: "http" | "integrity" | "network",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "OfflineDownloadError";
  }
}

export function isAbort(err: unknown): boolean {
  return (err as { name?: unknown })?.name === "AbortError";
}

export type FetchLike = (url: string, init: { credentials: "include"; signal?: AbortSignal; headers?: Record<string, string> }) => Promise<Response>;

export interface DownloadInput {
  fetchFn: FetchLike;
  url: string;
  files: FileStore;
  name: string;
  mime: string;
  /** From the grant; null = unknown. */
  expectedBytes: number | null;
  /** Continue a kept partial file when there is one. */
  resume: boolean;
  signal?: AbortSignal;
  onProgress?: (receivedBytes: number, totalBytes: number | null) => void;
}

/** "bytes 100-999/1000" → 100; null when it is not that. */
export function contentRangeStart(header: string | null): number | null {
  const m = header ? /^bytes\s+(\d+)-\d*\/(?:\d+|\*)$/i.exec(header.trim()) : null;
  return m ? Number(m[1]) : null;
}

function looksLikeAPage(res: Response): boolean {
  const type = (res.headers.get("content-type") ?? "").toLowerCase();
  return type.startsWith("text/html") || type.startsWith("application/json");
}

/** Resolves with the stored size. */
export async function downloadToStore(input: DownloadInput): Promise<number> {
  const { fetchFn, url, files, name, mime, expectedBytes, signal, onProgress } = input;

  let offset = input.resume && files.canAppend ? await files.size(name) : 0;
  if (expectedBytes !== null && offset > expectedBytes) offset = 0;
  if (expectedBytes !== null && offset === expectedBytes && offset > 0) {
    onProgress?.(offset, expectedBytes);
    return offset;
  }

  const request = (from: number) =>
    fetchFn(url, { credentials: "include", signal, headers: from > 0 ? { Range: `bytes=${from}-` } : undefined }).catch((err) => {
      if (isAbort(err)) throw err;
      throw new OfflineDownloadError("The connection dropped.", "network");
    });

  let res = await request(offset);
  if (res.status === 416 && offset > 0) {
    offset = 0;
    res = await request(0);
  }
  if (res.status === 206) {
    // Only a range that starts exactly where the kept bytes end may be appended.
    if (contentRangeStart(res.headers.get("content-range")) !== offset) {
      await res.body?.cancel().catch(() => undefined);
      offset = 0;
      res = await request(0);
    }
  } else if (res.status === 200) {
    offset = 0;
  }
  if (res.status !== 200 && res.status !== 206) throw new OfflineDownloadError(`The server answered ${res.status}.`, "http", res.status);
  if (looksLikeAPage(res) || !res.body) throw new OfflineDownloadError("That was not a video.", "integrity");

  const length = Number(res.headers.get("content-length"));
  const total = expectedBytes ?? (Number.isFinite(length) && length > 0 ? offset + length : null);

  const writer = await files.openWriter(name, { append: offset > 0, mime });
  const reader = res.body.getReader();
  let received = offset;
  onProgress?.(received, total);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      await writer.write(value);
      received += value.byteLength;
      onProgress?.(received, total);
    }
  } catch (err) {
    await reader.cancel().catch(() => undefined);
    if (isQuotaError(err)) {
      await writer.abort();
      throw new OfflineQuotaError();
    }
    // Keep what arrived where the next attempt can append to it.
    if (files.canAppend) await writer.close().catch(() => writer.abort());
    else await writer.abort();
    if (isAbort(err)) throw err;
    throw new OfflineDownloadError("The connection dropped.", "network");
  }
  await writer.close();

  if (expectedBytes !== null && received !== expectedBytes) {
    await files.remove(name);
    throw new OfflineDownloadError("The download did not complete correctly.", "integrity");
  }
  if (received === 0) {
    await files.remove(name);
    throw new OfflineDownloadError("The download was empty.", "integrity");
  }
  return received;
}

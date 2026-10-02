import { DEVICE_ID_MAX } from "./wire";

/*
  The opaque id this browser sends with every offline call: made once, kept
  in localStorage, never derived from anything about the device or the
  person. Clearing site data makes a new one (and the stored copies are
  gone with it, so that is the right behaviour).
*/

export const DEVICE_ID_KEY = "postbook_offline_device";

export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function randomId(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isDeviceId(v: unknown): v is string {
  return typeof v === "string" && v.length >= 8 && v.length <= DEVICE_ID_MAX && /^[A-Za-z0-9_-]+$/.test(v);
}

/** Reads the stored id, or makes and stores one. Storage that throws (blocked site data) still yields an id for this page. */
export function deviceId(storage: KeyValue | null, make: () => string = randomId): string {
  try {
    const existing = storage?.getItem(DEVICE_ID_KEY);
    if (isDeviceId(existing)) return existing;
  } catch {
    /* fall through to a fresh id */
  }
  const id = make().slice(0, DEVICE_ID_MAX);
  try {
    storage?.setItem(DEVICE_ID_KEY, id);
  } catch {
    /* an id for this page load only */
  }
  return id;
}

let memo: string | null = null;

/** The browser's id (memoised for the page). */
export function browserDeviceId(): string {
  if (memo) return memo;
  let storage: KeyValue | null = null;
  try {
    storage = typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    storage = null;
  }
  memo = deviceId(storage);
  return memo;
}

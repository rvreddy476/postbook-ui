/*
  Signing out and offline copies (founder, 2 Oct 2026).

  A signed-out account's copies stay on the device, hidden from everyone,
  for 48 hours. The same account back inside that window finds them again;
  after it they are deleted the next time the app runs.

  The moment of sign-out is written here, synchronously, as a small mark in
  localStorage: the sign-out is followed at once by a navigation, which an
  IndexedDB write may not survive. The manager moves the mark onto the
  account's records (`signedOutAt`) the next time it runs, and stamps any
  copy it finds ownerless without one (signed out in another tab, session
  expired) at that moment instead.

  The manager only runs inside the video apps, so the sign-IN leaves a mark
  too: an account that came back inside the 48 hours keeps its copies even
  when it first opens a video app long after them.

  Nothing in this file imports the rest of the feature: the auth service
  calls it, and must not pull the manager in with it.
*/

export const SIGN_OUT_KEEP_MS = 48 * 60 * 60 * 1000;
export const SIGN_OUT_MARKS_KEY = "postbook-offline-signed-out";
export const SIGN_IN_MARKS_KEY = "postbook-offline-signed-in";

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** userId → epoch ms of that account's latest sign-out (or sign-in) on this browser, not yet settled by the manager. */
export interface SignOutMarks {
  read(): Record<string, number>;
  set(userId: string, at: number): void;
  clear(userIds: readonly string[]): void;
}

/** Never throws: storage that is missing, full or corrupt reads as "no marks". */
export function signOutMarks(storage: () => KeyValueStore | null, key: string = SIGN_OUT_MARKS_KEY): SignOutMarks {
  const read = (): Record<string, number> => {
    try {
      const raw = storage()?.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      const out: Record<string, number> = {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const [k, v] of Object.entries(parsed)) if (k && typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = v;
      }
      return out;
    } catch {
      return {};
    }
  };
  const write = (marks: Record<string, number>) => {
    try {
      if (Object.keys(marks).length === 0) storage()?.removeItem(key);
      else storage()?.setItem(key, JSON.stringify(marks));
    } catch {
      /* the manager stamps the copies itself when it next runs */
    }
  };
  return {
    read,
    set(userId, at) {
      if (!userId) return;
      write({ ...read(), [userId]: at });
    },
    clear(userIds) {
      const marks = read();
      let changed = false;
      for (const id of userIds) {
        if (id in marks) {
          delete marks[id];
          changed = true;
        }
      }
      if (changed) write(marks);
    },
  };
}

/** The sign-out that counts for a copy: the later of its own stamp and its owner's mark; null when there is neither. */
export function signOutStamp(recorded: number | undefined, mark: number | undefined): number | null {
  const at = Math.max(recorded ?? 0, mark ?? 0);
  return at > 0 ? at : null;
}

/** The 48 hours are over. */
export function signOutOver(stamp: number, now: number): boolean {
  return now - stamp >= SIGN_OUT_KEEP_MS;
}

/**
  The owner signed in again after that sign-out and inside its 48 hours:
  the copies are kept, however much later this is being asked.
*/
export function signedBackInTime(stamp: number, signIn: number | undefined): boolean {
  return signIn !== undefined && signIn >= stamp && signIn - stamp < SIGN_OUT_KEEP_MS;
}

function browserStorage(): KeyValueStore | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/** The browser's marks. */
export const browserSignOutMarks: SignOutMarks = signOutMarks(browserStorage);
export const browserSignInMarks: SignOutMarks = signOutMarks(browserStorage, SIGN_IN_MARKS_KEY);

/**
  Called by the app's sign-out, BEFORE the session is cleared, with the
  account that is signing out. Synchronous, and never throws.
*/
export function noteOfflineSignOut(userId: string | null | undefined, now: number = Date.now(), marks: SignOutMarks = browserSignOutMarks): void {
  if (!userId) return;
  marks.set(userId, now);
}

/**
  Called wherever the app establishes a session, with the account that
  signed in. Synchronous, and never throws.
*/
export function noteOfflineSignIn(userId: string | null | undefined, now: number = Date.now(), marks: SignOutMarks = browserSignInMarks): void {
  if (!userId) return;
  marks.set(userId, now);
}

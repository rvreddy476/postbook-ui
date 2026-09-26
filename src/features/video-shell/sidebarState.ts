/*
  Sidebar open/closed state, as a pure reducer plus the storage codec.

  "Open" means different things by viewport: expanded (240px, labels) on a
  wide screen, rail (72px, icons) when closed; below 768px "open" is an
  overlay drawer and "closed" is nothing at all. Only the wide-screen
  preference is remembered — a drawer left open is never what someone wants
  on their next visit.
*/

export const SIDEBAR_STORAGE_KEY = "video_shell_sidebar_v1";

/** Below this the sidebar is a drawer; at or above, a column. */
export const SIDEBAR_DRAWER_MAX_WIDTH = 767;
/** At or above this the column starts expanded; below, as a rail. */
export const SIDEBAR_EXPANDED_MIN_WIDTH = 1200;

export interface SidebarState {
  /** Expanded column, or the drawer visible. */
  open: boolean;
  /** Viewport under 768px: the sidebar is an overlay drawer. */
  drawer: boolean;
  /** The stored/derived preference has been applied (false on the server). */
  hydrated: boolean;
}

export type SidebarAction =
  | { type: "toggle" }
  | { type: "set"; open: boolean }
  | { type: "viewport"; width: number }
  | { type: "hydrate"; width: number; stored: boolean | null };

export const SIDEBAR_INITIAL: SidebarState = { open: true, drawer: false, hydrated: false };

export function isDrawerWidth(width: number): boolean {
  return width <= SIDEBAR_DRAWER_MAX_WIDTH;
}

/** The default when nothing is stored: expanded on a wide screen, rail otherwise. */
export function defaultSidebarOpen(width: number): boolean {
  return width >= SIDEBAR_EXPANDED_MIN_WIDTH;
}

export function sidebarReducer(state: SidebarState, action: SidebarAction): SidebarState {
  switch (action.type) {
    case "toggle":
      return { ...state, open: !state.open };
    case "set":
      return state.open === action.open ? state : { ...state, open: action.open };
    case "viewport": {
      const drawer = isDrawerWidth(action.width);
      if (drawer === state.drawer) return state;
      // Crossing into drawer mode never leaves a drawer open on its own;
      // crossing out of it restores the column preference.
      return { ...state, drawer, open: drawer ? false : state.open };
    }
    case "hydrate": {
      const drawer = isDrawerWidth(action.width);
      const preferred = action.stored ?? defaultSidebarOpen(action.width);
      return { open: drawer ? false : preferred, drawer, hydrated: true };
    }
    default:
      return state;
  }
}

/** Parses what localStorage holds; null when absent or unreadable. */
export function parseStoredSidebar(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === "boolean") return value;
    if (value && typeof value === "object" && "open" in value) {
      const open = (value as { open?: unknown }).open;
      return typeof open === "boolean" ? open : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function serializeSidebar(open: boolean): string {
  return JSON.stringify({ open });
}

export function readStoredSidebar(): boolean | null {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
    return parseStoredSidebar(localStorage.getItem(SIDEBAR_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredSidebar(open: boolean): void {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    localStorage.setItem(SIDEBAR_STORAGE_KEY, serializeSidebar(open));
  } catch {
    // Private mode or a full quota: the preference just does not persist.
  }
}

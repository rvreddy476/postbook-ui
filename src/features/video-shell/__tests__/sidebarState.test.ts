import { describe, expect, test } from "bun:test";

import {
  SIDEBAR_INITIAL,
  SIDEBAR_STORAGE_KEY,
  defaultSidebarOpen,
  isDrawerWidth,
  parseStoredSidebar,
  serializeSidebar,
  sidebarReducer,
  type SidebarState,
} from "../sidebarState";

describe("defaults", () => {
  test("expanded at 1200px and up, rail below", () => {
    expect(defaultSidebarOpen(1200)).toBe(true);
    expect(defaultSidebarOpen(1600)).toBe(true);
    expect(defaultSidebarOpen(1199)).toBe(false);
    expect(defaultSidebarOpen(800)).toBe(false);
  });
  test("drawer below 768px", () => {
    expect(isDrawerWidth(767)).toBe(true);
    expect(isDrawerWidth(768)).toBe(false);
  });
  test("storage key is the versioned one", () => {
    expect(SIDEBAR_STORAGE_KEY).toBe("video_shell_sidebar_v1");
  });
});

describe("sidebarReducer", () => {
  test("hydrate uses the stored preference on a wide screen", () => {
    expect(sidebarReducer(SIDEBAR_INITIAL, { type: "hydrate", width: 1440, stored: false })).toEqual({ open: false, drawer: false, hydrated: true });
    expect(sidebarReducer(SIDEBAR_INITIAL, { type: "hydrate", width: 900, stored: true })).toEqual({ open: true, drawer: false, hydrated: true });
  });
  test("hydrate falls back to the viewport default when nothing is stored", () => {
    expect(sidebarReducer(SIDEBAR_INITIAL, { type: "hydrate", width: 1440, stored: null }).open).toBe(true);
    expect(sidebarReducer(SIDEBAR_INITIAL, { type: "hydrate", width: 900, stored: null }).open).toBe(false);
  });
  test("hydrate on a phone is a closed drawer whatever was stored", () => {
    expect(sidebarReducer(SIDEBAR_INITIAL, { type: "hydrate", width: 400, stored: true })).toEqual({ open: false, drawer: true, hydrated: true });
  });
  test("toggle flips open; set is idempotent", () => {
    const s: SidebarState = { open: true, drawer: false, hydrated: true };
    expect(sidebarReducer(s, { type: "toggle" }).open).toBe(false);
    expect(sidebarReducer(sidebarReducer(s, { type: "toggle" }), { type: "toggle" }).open).toBe(true);
    expect(sidebarReducer(s, { type: "set", open: true })).toBe(s);
    expect(sidebarReducer(s, { type: "set", open: false }).open).toBe(false);
  });
  test("crossing into drawer width closes; crossing out keeps the column preference", () => {
    const wide: SidebarState = { open: true, drawer: false, hydrated: true };
    const narrow = sidebarReducer(wide, { type: "viewport", width: 500 });
    expect(narrow).toEqual({ open: false, drawer: true, hydrated: true });
    expect(sidebarReducer(narrow, { type: "viewport", width: 500 })).toBe(narrow);
    const opened = sidebarReducer(narrow, { type: "toggle" });
    expect(opened.open).toBe(true);
    expect(sidebarReducer(opened, { type: "viewport", width: 1300 })).toEqual({ open: true, drawer: false, hydrated: true });
  });
});

describe("storage codec", () => {
  test("round-trips", () => {
    expect(parseStoredSidebar(serializeSidebar(true))).toBe(true);
    expect(parseStoredSidebar(serializeSidebar(false))).toBe(false);
  });
  test("accepts a bare boolean and rejects junk", () => {
    expect(parseStoredSidebar("true")).toBe(true);
    expect(parseStoredSidebar("false")).toBe(false);
    expect(parseStoredSidebar(null)).toBeNull();
    expect(parseStoredSidebar(undefined)).toBeNull();
    expect(parseStoredSidebar("{not json")).toBeNull();
    expect(parseStoredSidebar('{"open":"yes"}')).toBeNull();
    expect(parseStoredSidebar("42")).toBeNull();
  });
});

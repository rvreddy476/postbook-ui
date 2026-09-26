import { describe, expect, test } from "bun:test";

import {
  THEME_CHOICES,
  THEME_STORAGE_KEY,
  applyTheme,
  chooseTheme,
  parseThemeChoice,
  readThemeChoice,
  resolveTheme,
  writeThemeChoice,
  type ThemeRoot,
  type ThemeStorage,
} from "../themeChoice";

function storageStub(initial: Record<string, string> = {}): ThemeStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const rootStub = (): ThemeRoot => ({ className: "light", style: { colorScheme: "light" } });

describe("theme choice", () => {
  test("the key is the one the root layout's inline script reads", () => {
    expect(THEME_STORAGE_KEY).toBe("postbook_theme");
    expect(THEME_CHOICES.map((c) => c.value)).toEqual(["auto", "dark", "light"]);
  });

  test("writer: dark → \"dark\", light → \"light\", auto → key removed", () => {
    const storage = storageStub();
    writeThemeChoice("dark", storage);
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    writeThemeChoice("light", storage);
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("light");
    writeThemeChoice("auto", storage);
    expect(storage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(storage.data.size).toBe(0);
  });

  test("reader: only dark / light are choices; anything else is auto", () => {
    expect(readThemeChoice(storageStub({ [THEME_STORAGE_KEY]: "dark" }))).toBe("dark");
    expect(readThemeChoice(storageStub({ [THEME_STORAGE_KEY]: "light" }))).toBe("light");
    expect(readThemeChoice(storageStub())).toBe("auto");
    expect(parseThemeChoice("system")).toBe("auto");
    expect(parseThemeChoice(null)).toBe("auto");
    expect(readThemeChoice({ getItem: () => { throw new Error("blocked"); } })).toBe("auto");
  });

  test("auto follows prefers-color-scheme; explicit choices ignore it", () => {
    expect(resolveTheme("auto", true)).toBe("dark");
    expect(resolveTheme("auto", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  test("applying mirrors the inline script: className and color-scheme", () => {
    const root = rootStub();
    applyTheme(root, "dark");
    expect(root).toEqual({ className: "dark", style: { colorScheme: "dark" } });
    applyTheme(root, "light");
    expect(root).toEqual({ className: "light", style: { colorScheme: "light" } });
  });

  test("chooseTheme stores and applies in one go", () => {
    const storage = storageStub({ [THEME_STORAGE_KEY]: "light" });
    const root = rootStub();
    expect(chooseTheme("auto", { storage, root, prefersDark: true })).toBe("dark");
    expect(storage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(root.className).toBe("dark");
    expect(chooseTheme("light", { storage, root, prefersDark: true })).toBe("light");
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(root.style.colorScheme).toBe("light");
  });

  test("a storage that throws does not break the choice", () => {
    const root = rootStub();
    const broken = { setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("quota"); } };
    expect(chooseTheme("dark", { storage: broken, root, prefersDark: false })).toBe("dark");
    expect(root.className).toBe("dark");
  });
});

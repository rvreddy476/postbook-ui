/*
  The theme switch in the More panel, as pure functions over a storage and
  a root you hand in — so the tests use stubs and the component uses
  localStorage and document.documentElement.

  The choice is three-state. "dark" and "light" are written to the same
  key the root layout's inline script reads on load (`postbook_theme`), so
  a reload keeps them. "auto" removes the key and follows the OS
  (prefers-color-scheme) for this visit; the inline script has no "auto"
  branch and renders light on the next load — that script lives outside
  this feature, so the gap is noted here rather than closed.

  Applying a theme mirrors that script exactly: the root's className is
  the theme name (Tailwind's dark variant is `.dark *`) and its
  color-scheme follows, so native controls agree with the page.
*/

export const THEME_STORAGE_KEY = "postbook_theme";

export type Theme = "dark" | "light";
export type ThemeChoice = "auto" | Theme;

export const THEME_CHOICES: readonly { value: ThemeChoice; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The element the theme is written to: className and color-scheme. */
export interface ThemeRoot {
  className: string;
  style: { colorScheme: string };
}

/** What a stored value means; anything but "dark" / "light" is auto. */
export function parseThemeChoice(raw: string | null | undefined): ThemeChoice {
  return raw === "dark" || raw === "light" ? raw : "auto";
}

export function readThemeChoice(storage: Pick<ThemeStorage, "getItem">): ThemeChoice {
  try {
    return parseThemeChoice(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "auto";
  }
}

/** dark → "dark", light → "light", auto → the key is removed. */
export function writeThemeChoice(choice: ThemeChoice, storage: Pick<ThemeStorage, "setItem" | "removeItem">): void {
  try {
    if (choice === "auto") storage.removeItem(THEME_STORAGE_KEY);
    else storage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Private mode or a full quota: the choice applies to this visit only.
  }
}

/** The theme a choice means right now; auto follows the OS. */
export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): Theme {
  if (choice === "auto") return prefersDark ? "dark" : "light";
  return choice;
}

/** What src/app/layout.tsx's inline script does on load, for a choice made mid-session. */
export function applyTheme(root: ThemeRoot, theme: Theme): void {
  root.className = theme;
  root.style.colorScheme = theme;
}

/** Store the choice and apply what it means. Returns the theme applied. */
export function chooseTheme(
  choice: ThemeChoice,
  env: { storage: Pick<ThemeStorage, "setItem" | "removeItem">; root: ThemeRoot; prefersDark: boolean },
): Theme {
  writeThemeChoice(choice, env.storage);
  const theme = resolveTheme(choice, env.prefersDark);
  applyTheme(env.root, theme);
  return theme;
}

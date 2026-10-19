import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/*
  Colour lives in src/ui/theme.css. The stage's CSS and components name
  tokens only: no hex, no literal rgb()/rgba() colours, no raw Tailwind
  palette classes (blue-600, rose-100, …).
*/
const dir = resolve(import.meta.dir, "..");
const files = [join(dir, "post-stage.css"), ...readdirSync(join(dir, "components")).map((f) => join(dir, "components", f))];
const PALETTE = /\b(?:bg|text|border|ring|from|to|via|fill|stroke|shadow|outline|divide|accent|caret|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?\b/;

test("the stage's CSS and components use tokens only", () => {
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    expect({ file, hex: src.match(/#[0-9a-f]{3,8}\b/gi) }).toEqual({ file, hex: null });
    expect({ file, literal: src.match(/rgba?\((?!var\()[^)]*\)/g) }).toEqual({ file, literal: null });
    expect({ file, palette: src.match(PALETTE)?.[0] ?? null }).toEqual({ file, palette: null });
  }
});

test("the Follow badge token is defined in both themes, aliased, and is what the badge uses", () => {
  const theme = readFileSync(resolve(dir, "../../ui/theme.css"), "utf8");
  expect((theme.match(/--theme-follow-badge: 254 44 85;/g) ?? []).length).toBe(2);
  const globals = readFileSync(resolve(dir, "../../app/globals.css"), "utf8");
  expect((globals.match(/--follow-badge: var\(--theme-follow-badge\);/g) ?? []).length).toBe(2);
  const css = readFileSync(join(dir, "post-stage.css"), "utf8");
  expect(css).toContain(".ps-rail__follow-badge { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: rgb(var(--follow-badge)); color: rgb(var(--reel-on-stage));");
});

test("no spinning disc: neither the stage nor the reels rail animates one", () => {
  expect(readFileSync(join(dir, "post-stage.css"), "utf8")).not.toMatch(/disc|rotate/);
  expect(readFileSync(resolve(dir, "../reels/components/reels-screen.css"), "utf8")).not.toContain("reel-disc-spin");
});

test("reduced motion is respected", () => {
  expect(readFileSync(join(dir, "post-stage.css"), "utf8")).toContain("@media (prefers-reduced-motion: reduce)");
});

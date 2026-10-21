import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { TYPE_SCALE_ALLOWLIST } from "../type-scale-allowlist";

/*
  The type-scale guard (founder, 21 Oct 2026: one scale, defined once).

  1. src/ui/theme.css declares the scale; nothing in it is under 11px and
     the 12px floor step exists.
  2. globals.css maps every Tailwind text-* step to those variables.
  3. In the folders this guard owns, no TSX writes `text-[Npx]` and no CSS
     writes `font-size: Npx` (or a clamp() whose floor is under the scale's
     base), except the rows in src/ui/type-scale-allowlist.ts.

  Social (messenger, feed, profile) is swept in a later pass, and Commerce
  (src/features/shop, src/app/shop) is paused by the founder (22 Oct 2026);
  add those folders to GUARDED when their sweeps land.
*/

const ROOT = join(import.meta.dir, "..", "..", "..");

const GUARDED = [
  "src/ui",
  "src/features/posttube",
  "src/features/reels",
  "src/app/posttube",
];

const STEPS = ["2xs", "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"] as const;

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function files(dir: string, pattern: string): string[] {
  const glob = new Bun.Glob(pattern);
  const out: string[] = [];
  for (const rel of glob.scanSync({ cwd: join(ROOT, dir) })) {
    if (rel.includes("__tests__")) continue;
    out.push(relative(ROOT, join(ROOT, dir, rel)).split("\\").join("/"));
  }
  return out.sort();
}

function allowed(file: string, match: string): boolean {
  return TYPE_SCALE_ALLOWLIST.some((row) => row.file === file && row.match === match);
}

describe("the type scale is one source", () => {
  const theme = read("src/ui/theme.css");
  const globals = read("src/app/globals.css");

  test("theme.css declares every step with a line height, none under 11px, floor at 12px", () => {
    for (const step of STEPS) {
      const size = theme.match(new RegExp(`--type-${step}:\\s*([0-9.]+)px`));
      const lh = theme.match(new RegExp(`--type-${step}-lh:\\s*([0-9.]+)px`));
      expect(size, `--type-${step}`).not.toBeNull();
      expect(lh, `--type-${step}-lh`).not.toBeNull();
      expect(parseFloat(size![1])).toBeGreaterThanOrEqual(11);
    }
    expect(theme).toMatch(/--type-2xs:\s*11px/);
    expect(theme).toMatch(/--type-xs:\s*12px/);
  });

  test("steps grow monotonically", () => {
    const sizes = STEPS.map((step) => parseFloat(theme.match(new RegExp(`--type-${step}:\\s*([0-9.]+)px`))![1]));
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
  });

  test("Tailwind's text-* utilities read the same variables", () => {
    for (const step of STEPS) {
      expect(globals).toContain(`--text-${step}: var(--type-${step});`);
      expect(globals).toContain(`--text-${step}--line-height: var(--type-${step}-lh);`);
    }
  });

  test("tokens.ts reads the variables rather than restating numbers", () => {
    const tokens = read("src/ui/tokens.ts");
    for (const step of STEPS) expect(tokens).toContain(`'var(--type-${step})'`);
    expect(tokens).not.toMatch(/type:\s*\{[^}]*\d+px/);
  });

  test("every allowlist row still points at a real line", () => {
    for (const row of TYPE_SCALE_ALLOWLIST) {
      expect(read(row.file), `${row.file} no longer contains "${row.match}"`).toContain(row.match);
      expect(row.reason.length).toBeGreaterThan(20);
    }
  });
});

describe("no raw font sizes in the guarded folders", () => {
  test("TSX never writes text-[Npx]", () => {
    const offenders: string[] = [];
    for (const dir of GUARDED) {
      for (const file of files(dir, "**/*.{ts,tsx}")) {
        if (file.endsWith("type-scale-allowlist.ts")) continue;
        const src = read(file);
        const lines = src.split(/\r?\n/);
        lines.forEach((line, i) => {
          for (const m of line.matchAll(/\btext-\[[0-9.]+px\]/g)) {
            if (!allowed(file, m[0])) offenders.push(`${file}:${i + 1} ${m[0]}`);
          }
        });
      }
    }
    expect(offenders, "use text-2xs … text-4xl (src/ui/theme.css), or add a reasoned row to type-scale-allowlist.ts").toEqual([]);
  });

  test("CSS never writes font-size with a px literal", () => {
    const offenders: string[] = [];
    for (const dir of GUARDED) {
      for (const file of files(dir, "**/*.css")) {
        const src = read(file);
        const lines = src.split(/\r?\n/);
        lines.forEach((line, i) => {
          for (const m of line.matchAll(/font-size:\s*([0-9.]+)px/g)) {
            if (!allowed(file, m[0])) offenders.push(`${file}:${i + 1} ${m[0]}`);
          }
          // A clamp() may scale a display heading, but its floor is still a step.
          for (const m of line.matchAll(/font-size:\s*clamp\(\s*([0-9.]+)px/g)) {
            if (!allowed(file, m[0])) offenders.push(`${file}:${i + 1} ${m[0]} (floor must be var(--type-*))`);
          }
        });
      }
    }
    expect(offenders, "write font-size: var(--type-*) (src/ui/theme.css), or add a reasoned row to type-scale-allowlist.ts").toEqual([]);
  });

  test("nothing user-facing uses text-2xs outside meta (a count badge, a timestamp, a tag)", () => {
    // Not a hard rule the regex can judge; the smell check is that 2xs stays rare.
    let uses = 0;
    for (const dir of GUARDED) {
      for (const file of files(dir, "**/*.{ts,tsx,css}")) {
        const src = read(file);
        uses += (src.match(/\btext-2xs\b|var\(--type-2xs\)/g) ?? []).length;
      }
    }
    expect(uses).toBeLessThanOrEqual(12);
  });
});

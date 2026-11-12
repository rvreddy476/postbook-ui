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

  4. Social (the feed, post cards, comments, notifications, the post page
     and the home page; 24 Oct 2026) holds the founder's 12px floor outright:
     no text-2xs, no --type-2xs, nothing under 12px, and colour only from the
     theme tokens: no raw Tailwind palette classes (bg-violet-100) and no hex.

  Messenger and profile are swept in a later pass, and Commerce
  (src/features/shop, src/app/shop) is paused by the founder (22 Oct 2026);
  add those folders to GUARDED when their sweeps land.
*/

const ROOT = join(import.meta.dir, "..", "..", "..");

/* The Social folders and the loose Social files at the top of src/components. */
const SOCIAL_DIRS = [
  "src/components/feed",
  "src/components/comments",
  "src/components/home",
  "src/components/notifications",
  "src/app/notifications",
  "src/app/post",
  "src/app/feed",
  // Saved collections and followed hashtags (24 Oct 2026, server 546eec063).
  "src/app/saved",
  "src/features/saved",
  "src/app/hashtag",
  "src/features/hashtag",
  "src/app/settings/followed-hashtags",
  // Echo, premium short notes (12 Nov 2026).
  "src/features/echo",
  "src/app/echo",
];
const SOCIAL_FILES = "src/components/{PostCard,CommentSection,CommentPreview,Feed*}.tsx";

const GUARDED = [
  "src/ui",
  "src/features/posttube",
  "src/features/reels",
  "src/app/posttube",
  ...SOCIAL_DIRS,
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

/* GUARDED's files plus the loose Social files, for one extension pattern. */
function guardedFiles(pattern: string): string[] {
  const loose = new Bun.Glob(pattern);
  const top = files(".", SOCIAL_FILES).filter((file) => loose.match(file));
  return [...GUARDED.flatMap((dir) => files(dir, pattern)), ...top];
}

function socialFiles(pattern: string): string[] {
  const loose = new Bun.Glob(pattern);
  return [...SOCIAL_DIRS.flatMap((dir) => files(dir, pattern)), ...files(".", SOCIAL_FILES).filter((file) => loose.match(file))];
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
    for (const file of guardedFiles("**/*.{ts,tsx}")) {
      if (file.endsWith("type-scale-allowlist.ts")) continue;
      const src = read(file);
      const lines = src.split(/\r?\n/);
      lines.forEach((line, i) => {
        for (const m of line.matchAll(/\btext-\[[0-9.]+px\]/g)) {
          if (!allowed(file, m[0])) offenders.push(`${file}:${i + 1} ${m[0]}`);
        }
      });
    }
    expect(offenders, "use text-2xs … text-4xl (src/ui/theme.css), or add a reasoned row to type-scale-allowlist.ts").toEqual([]);
  });

  test("CSS never writes font-size with a px literal", () => {
    const offenders: string[] = [];
    for (const file of guardedFiles("**/*.css")) {
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

/*
  Social: the founder's rules with no exceptions. A size the scale already
  forbids above (text-[Npx], font-size: Npx) is caught there; this adds the
  step and units that slip under 12px without a px literal, and colour.
  Black and white scrims over media stay allowed; they are not palette steps.
*/
const PALETTE =
  /\b(?:bg|text|border|ring|from|via|to|fill|stroke|outline|divide|shadow|placeholder|decoration|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;
const HEX = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;

function pxOf(value: string, unit: string): number {
  return unit === "px" ? parseFloat(value) : parseFloat(value) * 16;
}

function scan(pattern: string, check: (line: string) => string[]): string[] {
  const offenders: string[] = [];
  for (const file of socialFiles(pattern)) {
    read(file).split(/\r?\n/).forEach((line, i) => {
      for (const hit of check(line)) offenders.push(`${file}:${i + 1} ${hit}`);
    });
  }
  return offenders;
}

describe("Social folders: 12px floor and theme colours only", () => {
  test("the guard sees the Social files (a moved folder must not pass silently)", () => {
    const seen = socialFiles("**/*.{ts,tsx,css}");
    for (const file of [
      "src/components/PostCard.tsx",
      "src/components/CommentSection.tsx",
      "src/components/Feed.tsx",
      "src/components/feed/home-feed.css",
      "src/components/comments/comments.css",
      "src/components/home/creative-home.css",
      "src/app/notifications/ActivityTabs.tsx",
      "src/app/post/[postId]/PostDetailClient.tsx",
      "src/app/feed/page.tsx",
      "src/components/notifications/NotificationToastHost.tsx",
    ]) {
      expect(seen, file).toContain(file);
    }
  });

  test("no text below 12px: no text-2xs, no --type-2xs, no sub-12px arbitrary or inline size", () => {
    const offenders = scan("**/*.{ts,tsx,css}", (line) => {
      const hits: string[] = [];
      for (const m of line.matchAll(/\btext-2xs\b|var\(--type-2xs\)/g)) hits.push(m[0]);
      for (const m of line.matchAll(/\btext-\[(\d*\.?\d+)(px|rem|em)\]/g)) {
        if (pxOf(m[1], m[2]) < 12) hits.push(m[0]);
      }
      for (const m of line.matchAll(/font-size:\s*(\d*\.?\d+)(px|rem|em)\b/g)) {
        if (pxOf(m[1], m[2]) < 12) hits.push(m[0]);
      }
      for (const m of line.matchAll(/fontSize:\s*['"]?(\d*\.?\d+)(px)?['"]?\s*[,}]/g)) {
        if (parseFloat(m[1]) < 12) hits.push(m[0]);
      }
      return hits;
    });
    expect(offenders, "12px (text-xs, var(--type-xs)) is the floor in Social").toEqual([]);
  });

  test("no raw Tailwind palette colours", () => {
    const offenders = scan("**/*.{ts,tsx,css}", (line) => [...line.matchAll(PALETTE)].map((m) => m[0]));
    expect(offenders, "use the theme tokens (bg-primary-tint, text-primary-ink, bg-destructive, text-muted-foreground …) from src/ui/theme.css").toEqual([]);
  });

  test("no hex colours", () => {
    const offenders = scan("**/*.{ts,tsx,css}", (line) => [...line.matchAll(HEX)].map((m) => m[0]));
    expect(offenders, "colour lives in src/ui/theme.css; read it through a token").toEqual([]);
  });
});

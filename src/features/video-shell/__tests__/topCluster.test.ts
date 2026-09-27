import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(import.meta.dir, "../video-shell.css"), "utf8");
const cluster = readFileSync(resolve(import.meta.dir, "../VideoTopCluster.tsx"), "utf8");
const profile = readFileSync(resolve(import.meta.dir, "../../reels/components/ProfileDropdown.tsx"), "utf8");

test("the top-right cluster: a 40px pill, 4px padding, 6px gaps, top 12 / right 16", () => {
  expect(css).toContain(".video-shell__top-cluster { position: absolute; top: 12px; right: 16px; z-index: 30; display: flex; height: 40px; align-items: center; gap: 6px; padding: 4px;");
});

test("inside it: Create 32 tall at 13/700 with 16px icons, the bell a 32px circle, the avatar 32px", () => {
  expect(css).toContain(".video-shell__top-cluster .context-app-bar__create { height: 32px; padding: 0 10px 0 8px; margin-right: 0; gap: 4px; font-size: 13px; font-weight: 700; }");
  expect(css).toContain(".video-shell__top-cluster .context-app-bar__create svg { width: 16px; height: 16px; }");
  expect(css).toContain(".video-shell__top-action { position: relative; display: flex; width: 32px; height: 32px;");
  expect(cluster).toContain('<CreateButton variant="pill" />');
  expect(cluster).toContain('<ProfileDropdown size="sm" />');
  // The small trigger is the 32px avatar alone: no border, no hover ring.
  expect(profile).toContain('size?: "sm" | "md"');
  expect(profile).toContain('"flex h-8 w-8 items-center justify-center rounded-full transition-opacity hover:opacity-90"');
  expect(profile).toContain('className={size === "sm" ? "h-8 w-8" : "h-8 w-8 border-2 border-border shadow-xs"}');
});

test("colour only through tokens in the cluster rules", () => {
  const block = css.slice(css.indexOf(".video-shell__top-cluster {"), css.indexOf(".video-shell__drawer-toggle"));
  expect(block.match(/#[0-9a-f]{3,8}\b/gi)).toBeNull();
  expect(block.match(/rgba?\((?!var\()[^)]*\)/g)).toBeNull();
});

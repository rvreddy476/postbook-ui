import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(import.meta.dir, "../video-shell.css"), "utf8");
const cluster = readFileSync(resolve(import.meta.dir, "../VideoTopCluster.tsx"), "utf8");
const sidebar = readFileSync(resolve(import.meta.dir, "../VideoSidebar.tsx"), "utf8");

test("the top-right corner holds the search pill alone: a 40px pill, top 12 / right 16", () => {
  expect(css).toContain(".video-shell__top-cluster { position: absolute; top: 12px; right: 16px; z-index: 30; display: flex; height: 40px; align-items: center; gap: 6px; padding: 4px;");
  expect(css).toContain(".video-shell__top-search { width: min(280px, calc(100% - 32px)); padding: 0 12px; gap: 8px; }");
  expect(cluster).toContain('role="search"');
  expect(cluster).toContain('placeholder="Search"');
  expect(cluster).not.toContain("CreateButton");
  expect(cluster).not.toContain("ProfileDropdown");
  expect(cluster).not.toContain("Bell");
});

test("the left menu no longer carries a search field", () => {
  expect(sidebar).not.toContain("<SidebarSearch");
});

test("colour only through tokens in the corner rules", () => {
  const block = css.slice(css.indexOf(".video-shell__top-cluster {"), css.indexOf(".video-shell__drawer-toggle"));
  expect(block.match(/#[0-9a-f]{3,8}\b/gi)).toBeNull();
  expect(block.match(/rgba?\((?!var\()[^)]*\)/g)).toBeNull();
});

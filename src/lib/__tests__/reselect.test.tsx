import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(import.meta.dir, p), "utf8");

// Bun's test runtime has no window, so the wiring is checked at the source.
describe("refresh only when the viewer asks", () => {
  test("the side menu announces a reselect only when the clicked item is already current", () => {
    expect(read("../../features/video-shell/VideoSidebar.tsx")).toMatch(/if \(current && item\.href\) announceReselect\(item\.href\)/);
  });

  test("Reels and PostTube home both offer a refresh button and listen for reselect", () => {
    const reels = read("../../features/reels/components/ReelsScreen.tsx");
    const home = read("../../features/posttube/components/HomePage.tsx");
    expect(reels).toContain('useReselect("/reels"');
    expect(reels).toContain('aria-label="Refresh reels"');
    expect(home).toContain('useReselect("/posttube"');
    expect(home).toContain('aria-label="Refresh videos"');
  });
});

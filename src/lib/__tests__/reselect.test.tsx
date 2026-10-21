import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(import.meta.dir, p), "utf8");

// Bun's test runtime has no window, so the wiring is checked at the source.
describe("refresh only when the viewer asks", () => {
  test("the side menu announces a reselect only when the clicked item is already current", () => {
    expect(read("../../features/video-shell/VideoSidebar.tsx")).toMatch(/if \(current && item\.href\) announceReselect\(item\.href\)/);
  });

  test("Reels refreshes by reselect only (no button, founder 21 Oct); PostTube home has a button and reselect", () => {
    const reels = read("../../features/reels/components/ReelsScreen.tsx");
    const home = read("../../features/posttube/components/HomePage.tsx");
    expect(reels).toContain('useReselect("/reels"');
    expect(reels).not.toContain('aria-label="Refresh reels"');
    expect(reels).toContain("<MoreVertical");
    expect(home).toContain('useReselect("/posttube"');
    expect(home).toContain('aria-label="Refresh videos"');
  });
});

describe("one sound control on a reel (founder, 21 Oct)", () => {
  test("no bottom 'Tap to unmute' pill; the top speaker unmutes a forced-muted reel", () => {
    const video = read("../../features/reels/components/ReelVideo.tsx");
    const screen = read("../../features/reels/components/ReelsScreen.tsx");
    expect(video).not.toContain("Tap to unmute");
    expect(screen).toContain("sound={prefs.sound && !forcedMuted}");
    expect(screen).toContain("playerRef.current?.unmute()");
  });

  test("sound is on by default", () => {
    expect(read("../../features/reels/playback/playerPrefs.ts")).toMatch(/DEFAULT_PREFS: PlayerPrefs = \{\s*sound: true,/);
  });
});

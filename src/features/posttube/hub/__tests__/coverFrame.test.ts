import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

import { captureCoverFrame, frameFileName, frameSeekSeconds, frameSize, frameSourcePaths, frameSources, pickFrameLevel, type FrameSource } from "../coverFrame";

describe("frame sources", () => {
  test("are this site's own paths, best rendition first", () => {
    expect(frameSourcePaths("m1")).toEqual(["/v1/media/m1/serve/720p", "/v1/media/m1/serve/480p", "/v1/media/m1/serve"]);
  });

  test("start with the stream the player plays, then the files", () => {
    expect(frameSources("m1")).toEqual([
      { kind: "hls", url: "/v1/media/m1/hls/master.m3u8" },
      { kind: "file", url: "/v1/media/m1/serve/720p" },
      { kind: "file", url: "/v1/media/m1/serve/480p" },
      { kind: "file", url: "/v1/media/m1/serve" },
    ]);
  });

  test("never carry a host: a frame from another origin cannot be exported", () => {
    const before = process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    try {
      for (const src of frameSourcePaths("m1")) expect(src.startsWith("/v1/")).toBe(true);
      for (const src of frameSources("m1")) if (src.kind === "file") expect(src.url.startsWith("/v1/")).toBe(true);
    } finally {
      if (before === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
      else process.env.NEXT_PUBLIC_API_BASE_URL = before;
    }
  });
});

describe("stream level", () => {
  test("is the tallest that does not exceed 720", () => {
    expect(pickFrameLevel([360, 720, 1080])).toBe(1);
    expect(pickFrameLevel([1080, 720, 360])).toBe(1);
    expect(pickFrameLevel([360, 480])).toBe(1);
  });

  test("is the smallest there is when every level is taller", () => {
    expect(pickFrameLevel([2160, 1080])).toBe(1);
  });

  test("ignores levels that report no height and survives an empty list", () => {
    expect(pickFrameLevel([0, 360])).toBe(1);
    expect(pickFrameLevel([])).toBe(0);
    expect(pickFrameLevel([0, 0])).toBe(0);
  });
});

describe("seek target", () => {
  test("is the chosen time in seconds", () => {
    expect(frameSeekSeconds(12_500, 60)).toBe(12.5);
    expect(frameSeekSeconds(0, 60)).toBe(0);
  });

  test("stays inside the video", () => {
    expect(frameSeekSeconds(90_000, 60)).toBeCloseTo(59.95, 5);
    expect(frameSeekSeconds(60_000, 60)).toBeCloseTo(59.95, 5);
    expect(frameSeekSeconds(1_000, 0.02)).toBe(0);
  });

  test("falls back to the start on a bad time, and trusts the time when the length is unknown", () => {
    expect(frameSeekSeconds(-5, 60)).toBe(0);
    expect(frameSeekSeconds(Number.NaN, 60)).toBe(0);
    expect(frameSeekSeconds(5_000, 0)).toBe(5);
    expect(frameSeekSeconds(5_000, Number.NaN)).toBe(5);
  });
});

describe("cover size", () => {
  test("keeps a frame that already fits", () => {
    expect(frameSize(1280, 720)).toEqual({ width: 1280, height: 720 });
    expect(frameSize(640, 360)).toEqual({ width: 640, height: 360 });
  });

  test("scales a larger frame down in its own shape", () => {
    expect(frameSize(3840, 2160)).toEqual({ width: 1280, height: 720 });
    expect(frameSize(1920, 1080)).toEqual({ width: 1280, height: 720 });
  });

  test("keeps a vertical frame vertical and both sides even", () => {
    expect(frameSize(1080, 1920)).toEqual({ width: 1080, height: 1920 });
    expect(frameSize(2160, 3840)).toEqual({ width: 1280, height: 2276 });
    expect(frameSize(853, 481)).toEqual({ width: 854, height: 482 });
  });

  test("has no size for a video that reported none", () => {
    expect(frameSize(0, 720)).toBeNull();
    expect(frameSize(1280, 0)).toBeNull();
  });
});

describe("captureCoverFrame", () => {
  const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" });

  test("returns the frame as a JPEG image file from the best source", async () => {
    const asked: [FrameSource, number][] = [];
    const file = await captureCoverFrame("0123456789abcdef", "m1", 12_000, 60, async (src, seconds) => {
      asked.push([src, seconds]);
      return jpeg();
    });
    expect(asked).toEqual([[{ kind: "hls", url: "/v1/media/m1/hls/master.m3u8" }, 12]]);
    expect(file.type).toBe("image/jpeg");
    expect(file.size).toBe(4);
    expect(file.name).toBe("cover-01234567-12000ms.jpg");
    expect(frameFileName("0123456789abcdef", 12_000)).toBe(file.name);
  });

  test("tries the next source when one cannot be read", async () => {
    const asked: string[] = [];
    const file = await captureCoverFrame("p1", "m1", 1_000, 60, async (src) => {
      asked.push(src.url);
      if (!src.url.endsWith("/serve")) throw new Error("not transcoded yet");
      return jpeg();
    });
    expect(asked).toEqual(["/v1/media/m1/hls/master.m3u8", "/v1/media/m1/serve/720p", "/v1/media/m1/serve/480p", "/v1/media/m1/serve"]);
    expect(file.type).toBe("image/jpeg");
  });

  test("asks for a time inside the video", async () => {
    let at = -1;
    await captureCoverFrame("p1", "m1", 600_000, 30, async (_src, seconds) => {
      at = seconds;
      return jpeg();
    });
    expect(at).toBeCloseTo(29.95, 5);
  });

  test("fails with the last reason when no source yields a frame", async () => {
    let calls = 0;
    const attempt = captureCoverFrame("p1", "m1", 1_000, 60, async () => {
      calls += 1;
      throw new Error(`reason ${calls}`);
    });
    await expect(attempt).rejects.toThrow("reason 4");
  });
});

// post-service accepts a video as a cover only for clients that still name it
// (the old picker). The Hub must never do that again: the cover is an image,
// set through the owner patch.
describe("the Hub's frame picker", () => {
  const source = readFileSync(join(import.meta.dir, "..", "hubApi.ts"), "utf8");
  const body = source.slice(source.indexOf("export async function pickCoverFrame"), source.indexOf("export async function uploadCoverImage"));

  test("uploads the frame as an image and sets it like an uploaded cover", () => {
    expect(body).toContain("captureCoverFrame(postId, mediaId, timestampMs, durationSeconds)");
    expect(body).toContain("uploadCoverImage(postId, file)");
  });

  test("names neither the video nor a signed link as the cover", () => {
    expect(body.length).toBeGreaterThan(0);
    expect(source).not.toContain("extractCoverFrame");
    expect(source).not.toContain("setCoverFrame");
    expect(source).not.toContain("/frames");
    expect(source).not.toContain("thumbnail_url: frame");
  });
});

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { PostDetail } from "@/types/profile";
import { HashtagGrid } from "../HashtagGrid";
import { hashtagCountLabel, hashtagShareUrl, hashtagTile, hashtagTotal } from "../hashtagPage";

/*
  The hashtag page (audit T-34): a poster grid, the server's count when it
  sends meta.total (post-service 2-B2) and an honest loaded count when it
  does not, and a Share sheet with the page's own address.
*/

function post(over: Partial<PostDetail>): PostDetail {
  return {
    id: "x",
    author_id: "a",
    text: "",
    visibility: "public",
    content_type: "post",
    is_pinned: false,
    created_at: "2026-10-14T00:00:00Z",
    updated_at: "2026-10-14T00:00:00Z",
    ...over,
  };
}

describe("hashtagTotal", () => {
  test("reads meta.total when it is a usable number, and tolerates its absence", () => {
    expect(hashtagTotal({ next_cursor: "c", total: 1234 })).toBe(1234);
    expect(hashtagTotal({ total: 0 })).toBe(0);
    expect(hashtagTotal({ next_cursor: "c" })).toBeNull();
    expect(hashtagTotal(undefined)).toBeNull();
    expect(hashtagTotal({ total: null })).toBeNull();
    expect(hashtagTotal({ total: -1 })).toBeNull();
    expect(hashtagTotal({ total: Number.NaN })).toBeNull();
    expect(hashtagTotal({ total: "12" as unknown as number })).toBeNull();
  });
});

describe("hashtagCountLabel", () => {
  test("with a total: the server's number, compact, per tab", () => {
    expect(hashtagCountLabel(1234, 20, true)).toBe("1.2K posts");
    expect(hashtagCountLabel(1, 1, false)).toBe("1 post");
    expect(hashtagCountLabel(3, 3, false, "reels")).toBe("3 reels");
    expect(hashtagCountLabel(0, 0, false, "videos")).toBe("No videos yet");
  });

  test("a total below what is already loaded is stale; the loaded count wins", () => {
    expect(hashtagCountLabel(5, 20, true)).toBe("20 posts");
  });

  test("without a total: what is loaded, with + while more pages exist — never a made-up total", () => {
    expect(hashtagCountLabel(null, 20, true)).toBe("20+ posts");
    expect(hashtagCountLabel(null, 1, false)).toBe("1 post");
    expect(hashtagCountLabel(null, 0, false)).toBe("No posts yet");
  });
});

describe("hashtagShareUrl", () => {
  test("is the page's own address, the tag encoded and without a leading #", () => {
    expect(hashtagShareUrl("sunset", "https://vchat.example")).toBe("https://vchat.example/hashtag/sunset");
    expect(hashtagShareUrl("#café", "https://vchat.example")).toBe("https://vchat.example/hashtag/caf%C3%A9");
  });
});

describe("hashtagTile", () => {
  test("a reel opens on the stage, with its cover as the poster", () => {
    const tile = hashtagTile(post({ id: "r1", content_type: "flick", text: "dance", cover_media_id: "c1", counts: { likes: 1500, comments: 0 } }));
    expect(tile).toMatchObject({ href: "/reels?reelId=r1", kind: "reel", posterUrl: "/v1/media/c1/serve", likes: 1500 });
    expect(tile.label).toBe("Reel: dance, 1.5K likes");
  });

  test("a long video opens on the watch page and prefers its thumbnail", () => {
    const tile = hashtagTile(
      post({
        id: "v1",
        content_type: "long_video",
        title: "Trip",
        cover_media_id: "c2",
        video_metadata: { duration_seconds: 600, thumbnail_url: "/v1/media/t2/serve", upload_status: "ready", final_category: "long" },
      }),
    );
    expect(tile).toMatchObject({ href: "/posttube/watch/v1", kind: "video", posterUrl: "/v1/media/t2/serve", text: "Trip" });
  });

  test("a post opens its permalink; an image is its poster, a video file never is", () => {
    expect(hashtagTile(post({ id: "p1", media: [{ media_id: "i1", kind: "image" }] })).posterUrl).toBe("/v1/media/i1/serve");
    expect(hashtagTile(post({ id: "p2", media: [{ media_id: "v9", kind: "video" }] })).posterUrl).toBeNull();
    expect(hashtagTile(post({ id: "p1" })).href).toBe("/post/p1");
  });
});

describe("HashtagGrid", () => {
  test("draws a tile per post: poster tiles, a caption tile for a post with no picture", () => {
    const tiles = [
      hashtagTile(post({ id: "r1", content_type: "flick", text: "dance", cover_media_id: "c1", counts: { likes: 12, comments: 0 } })),
      hashtagTile(post({ id: "p1", text: "words only" })),
    ];
    const html = renderToStaticMarkup(<HashtagGrid tiles={tiles} />);
    expect(html.match(/<li>/g)?.length).toBe(2);
    expect(html).toContain('class="liked-reels__grid"');
    expect(html).toContain('href="/reels?reelId=r1"');
    expect(html).toContain('src="/v1/media/c1/serve"');
    expect(html).toContain('href="/post/p1"');
    expect(html).toContain("words only");
    expect(html).toContain('aria-label="Reel: dance, 12 likes"');
  });
});

describe("the page", () => {
  const page = readFileSync(resolve(import.meta.dir, "../../../app/hashtag/[tag]/page.tsx"), "utf8");

  test("shows the count line, a Share sheet with the page URL, and the grid — not a list of feed cards", () => {
    expect(page).toContain("hashtagCountLabel(total, allPosts.length");
    expect(page).toContain("hashtagTotal(data?.pages[0]?.meta)");
    expect(page).toContain("<ShareSheet open={shareOpen}");
    expect(page).toContain("url={shareUrl}");
    expect(page).toContain("<HashtagGrid tiles={tiles} />");
    expect(page).not.toContain("<PostCard");
  });

  test("no Report until trust-safety takes entity_type 'hashtag', and no off-token colours", () => {
    expect(page).not.toMatch(/useSubmitReport|ReportDialog|v1\/reports/);
    expect(page.match(/#[0-9a-f]{3,8}\b/gi)).toBeNull();
    expect(page).not.toMatch(/violet|fuchsia|rose-|emerald-/);
  });
});

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import PostEmbedView from "@/components/PostEmbedView";
import PostControls, { type PostControlsProps } from "@/components/feed/PostControls";
import { EMBED_UNAVAILABLE_TEXT, embedCode, embeddableVideoId, embedPath, isEmbeddablePost } from "@/lib/postEmbed";
import type { PostDetail } from "@/types/profile";

/*
  Audit T-23: "Copy embed code" handed out an iframe of /post/<id>/embed, a
  page that did not exist. The page exists now, plays only a public video
  post, and the menu offers the item only for such a post.
*/

const video = (over: Partial<PostDetail> = {}): PostDetail => ({
  id: "p-1",
  author_id: "a-1",
  text: "",
  visibility: "public",
  content_type: "video",
  is_pinned: false,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  media: [{ media_id: "m-1", kind: "video" }],
  ...over,
});

describe("embeddableVideoId", () => {
  test("a public video post plays its first video", () => {
    expect(embeddableVideoId(video())).toBe("m-1");
    expect(embeddableVideoId(video({ media: [{ media_id: "i-1", kind: "image" }, { media_id: "m-2", kind: "video" }] }))).toBe("m-2");
  });

  test("refuses anything that is not public", () => {
    for (const visibility of ["private", "followers", "unlisted", "circle", ""]) {
      expect([visibility, embeddableVideoId(video({ visibility }))]).toEqual([visibility, null]);
    }
  });

  test("refuses members-only, redacted, age-restricted, non-video and missing posts", () => {
    expect(embeddableVideoId(video({ tier_required_id: "t-1" }))).toBeNull();
    expect(embeddableVideoId(video({ body_redacted: true }))).toBeNull();
    expect(embeddableVideoId(video({ age_restricted: true }))).toBeNull();
    expect(embeddableVideoId(video({ media: [{ media_id: "i-1", kind: "image" }] }))).toBeNull();
    expect(embeddableVideoId(video({ media: [] }))).toBeNull();
    expect(embeddableVideoId(null)).toBeNull();
    expect(isEmbeddablePost(video({ visibility: "private" }))).toBe(false);
    expect(isEmbeddablePost(video())).toBe(true);
  });

  test("the copied code points at the embed page, which exists", () => {
    expect(embedPath("p-1")).toBe("/post/p-1/embed");
    expect(embedCode("https://example.test", "p-1")).toContain('src="https://example.test/post/p-1/embed"');
    expect(existsSync(resolve(import.meta.dir, "../../app/post/[postId]/embed/page.tsx"))).toBe(true);
  });
});

function renderView(props: Parameters<typeof PostEmbedView>[0]) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <PostEmbedView {...props} />
    </QueryClientProvider>,
  );
}

describe("the embed page view", () => {
  test("a public video gets a bare player and a link to the full post", () => {
    const html = renderView({ post: video(), loading: false, failed: false });
    expect(html).toContain("<video");
    expect(html).toContain('src="/v1/media/m-1/serve"');
    expect(html).toContain('href="/post/p-1"');
    expect(html).not.toContain(EMBED_UNAVAILABLE_TEXT.replace("'", "&#x27;"));
  });

  test("a reel starts muted", () => {
    const html = renderView({ post: video({ content_type: "short" }), loading: false, failed: false });
    expect(html).toMatch(/<video[^>]*muted=""/);
  });

  test("private, unlisted, not found and failed reads all get the same neutral line and no player", () => {
    const neutral = EMBED_UNAVAILABLE_TEXT.replace("'", "&#x27;");
    for (const props of [
      { post: video({ visibility: "private" }), loading: false, failed: false },
      { post: video({ visibility: "unlisted" }), loading: false, failed: false },
      { post: null, loading: false, failed: false },
      { post: video(), loading: false, failed: true },
    ]) {
      const html = renderView(props);
      expect(html).toContain(neutral);
      expect(html).not.toContain("<video");
      expect(html).not.toContain("/v1/media/");
    }
  });
});

describe("Copy embed code in the post menu", () => {
  const noop = () => {};
  const props: PostControlsProps = {
    own: false, pinned: false, deleting: false,
    onRecommend: noop, onHide: noop, onMute: noop, onEmbed: noop,
    onReport: noop, onBlock: noop, onPin: noop, onDelete: noop, onClose: noop,
  };

  test("is offered only for an embeddable post", () => {
    expect(renderToStaticMarkup(<PostControls {...props} />)).not.toContain("Copy embed code");
    expect(renderToStaticMarkup(<PostControls {...props} canEmbed />)).toContain('aria-label="Copy embed code"');
  });
});

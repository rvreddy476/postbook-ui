import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { indexBatch } from "@/features/reels/liked";
import { PostMessageCard } from "../PostMessageCard";
import { POST_UNAVAILABLE_TEXT, postCardIds, postCardView } from "../postCards";

/*
  A shared post in a thread is hydrated through POST /v1/posts/batch as the
  viewer. What the batch returns renders as a card linking to /post/<id>;
  an id it leaves out (deleted, private, blocked author) renders only
  "This post isn't available" — nothing the sender saw leaks through.
*/

// The batch answers a map keyed by id; p2 was not returned for this viewer.
const batch = indexBatch({
  p1: {
    id: "p1",
    author_id: "a",
    content_type: "short",
    text: "Sunset over the lake",
    cover_media_id: "cov1",
    author: { id: "a", display_name: "Asha Rao", username: "asha" },
  },
  p2: null,
  p3: { id: "p3", author_id: "b", content_type: "post", text: "", author: { id: "b", username: "bee" } },
});

describe("postCardIds", () => {
  test("collects each shared post once, in thread order, skipping deleted and non-post messages", () => {
    expect(
      postCardIds([
        { type: "text" },
        { type: "post", postId: "p2" },
        { type: "post", postId: "p1" },
        { type: "post", postId: "p2" },
        { type: "post", postId: "p9", isDeleted: true },
        { type: "post" },
        { type: "media", postId: "nope" },
      ]),
    ).toEqual(["p2", "p1"]);
  });
});

describe("postCardView", () => {
  test("a returned post is a card that opens its permalink", () => {
    const view = postCardView("p1", { status: "success", posts: batch });
    expect(view).toEqual({
      state: "ready",
      href: "/post/p1",
      title: "Sunset over the lake",
      kindLabel: "Reel",
      authorName: "Asha Rao",
      posterUrl: "/v1/media/cov1/serve",
    });
  });

  test("an id the batch did not return is not available — and says nothing else", () => {
    expect(postCardView("p2", { status: "success", posts: batch })).toEqual({ state: "unavailable", text: POST_UNAVAILABLE_TEXT });
    expect(postCardView("missing", { status: "success", posts: batch })).toEqual({ state: "unavailable", text: "This post isn't available" });
  });

  test("a text post with no caption still has a title and an author handle", () => {
    const view = postCardView("p3", { status: "success", posts: batch });
    expect(view.state).toBe("ready");
    if (view.state !== "ready") return;
    expect([view.title, view.kindLabel, view.authorName, view.posterUrl]).toEqual(["Post", "Post", "@bee", null]);
  });

  test("loading and a failed batch are their own states, never 'not available'", () => {
    expect(postCardView("p1", { status: "pending" })).toEqual({ state: "loading" });
    expect(postCardView("p1", { status: "error" })).toEqual({ state: "error" });
  });
});

describe("PostMessageCard", () => {
  test("draws the ready card as a link to the post", () => {
    const html = renderToStaticMarkup(<PostMessageCard view={postCardView("p1", { status: "success", posts: batch })} />);
    expect(html).toContain('href="/post/p1"');
    expect(html).toContain("Sunset over the lake");
    expect(html).toContain('src="/v1/media/cov1/serve"');
    expect(html).toContain("Asha Rao");
  });

  test("draws the not-available line with no link and nothing from the post", () => {
    const html = renderToStaticMarkup(<PostMessageCard view={postCardView("p2", { status: "success", posts: batch })} />);
    expect(html).toContain("This post isn&#x27;t available");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("<img");
  });

  test("a failed load offers a retry; loading is marked busy", () => {
    const failed = renderToStaticMarkup(<PostMessageCard view={{ state: "error" }} onRetry={() => undefined} />);
    expect(failed).toContain("Try again");
    const loading = renderToStaticMarkup(<PostMessageCard view={{ state: "loading" }} />);
    expect(loading).toContain('aria-busy="true"');
  });

  test("tokens only: no hex colours in the card", async () => {
    const src = await Bun.file(new URL("../PostMessageCard.tsx", import.meta.url)).text();
    expect(src.match(/#[0-9a-f]{3,8}\b/gi)).toBeNull();
  });
});

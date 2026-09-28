import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { rowToVideo } from "../../model";
import { WatchActions } from "../components/WatchActions";
import { AgeGateCard, RelatedCard, WatchDetails } from "../components/WatchDetails";
import { ageGateFromError, errorCode, normalizeRelatedPost, normalizeWatchDetail, type WatchPostRow } from "../watchApi";

/* The watch page's side of the Creator Hub batch (contract B). */

const noop = () => undefined;

const base: WatchPostRow = {
  id: "v1",
  author_id: "a1",
  title: "A long one",
  text: "",
  content_type: "long_video",
  created_at: "2026-09-01T00:00:00Z",
  media: [{ media_id: "m1", kind: "video", duration_ms: 600_000 }],
  counts: { likes: 12, comments: 3, shares: 1 },
  view_count: 900,
  author: { id: "a1", display_name: "Ravi" },
  video_metadata: { media_asset_id: "m1", duration_seconds: 600 },
};

const detailsBase = {
  title: "Rain on a tin roof",
  authorId: "u1",
  channelName: "Ravi",
  channelHref: "/posttube/channel/ravi",
  followerCount: 2100,
  viewCount: 272000,
  publishedAt: "2026-09-01T00:00:00Z",
  source: "upload" as const,
  chapters: [],
  currentChapter: -1,
  onSeek: noop,
  description: "Three hours of rain.",
  hashtags: [],
};

const actionsBase = { loved: false, passed: false, queued: false, onLove: noop, onPass: noop, onQueue: noop, onAdd: noop, onMore: noop };

describe("hide_like_count", () => {
  test("a viewer gets like_count: null → hidden; the owner gets the number → shown", () => {
    const viewer = normalizeWatchDetail({ ...base, hide_like_count: true, like_count: null }, rowToVideo(base));
    expect(viewer.likeCountHidden).toBe(true);
    const owner = normalizeWatchDetail({ ...base, hide_like_count: true, like_count: 40 }, rowToVideo(base));
    expect(owner.likeCountHidden).toBe(false);
    expect(owner.likeCount).toBe(40);
    expect(normalizeWatchDetail({ ...base, hide_like_count: false, like_count: 7 }, rowToVideo(base)).likeCountHidden).toBe(false);
    expect(normalizeWatchDetail(base, rowToVideo(base)).likeCountHidden).toBe(false);
  });

  test("the Like button reads Like with no number when hidden", () => {
    const hidden = renderToStaticMarkup(<WatchActions {...actionsBase} likeCount={null} />);
    expect(hidden).toContain('class="tube-actions__count">Like<');
    expect(hidden).not.toMatch(/tube-actions__count">\d/);
    const shown = renderToStaticMarkup(<WatchActions {...actionsBase} likeCount={1200} />);
    expect(shown).toContain('class="tube-actions__count">1.2K<');
  });
});

describe("default_comment_sort", () => {
  test("newest opens on Newest; anything else (absent, '', unknown) on Top", () => {
    expect(normalizeWatchDetail({ ...base, default_comment_sort: "newest" }, rowToVideo(base)).defaultCommentSort).toBe("newest");
    expect(normalizeWatchDetail({ ...base, default_comment_sort: "NEWEST" }, rowToVideo(base)).defaultCommentSort).toBe("newest");
    expect(normalizeWatchDetail({ ...base, default_comment_sort: "" }, rowToVideo(base)).defaultCommentSort).toBe("top");
    expect(normalizeWatchDetail({ ...base, default_comment_sort: null }, rowToVideo(base)).defaultCommentSort).toBe("top");
    expect(normalizeWatchDetail(base, rowToVideo(base)).defaultCommentSort).toBe("top");
  });
});

describe("related_post", () => {
  test("normalised with Go zero values; null or id-less is no card; a self-pointer is dropped", () => {
    const d = normalizeWatchDetail({ ...base, related_post_id: "v2", related_post: { id: "v2", title: " Part two ", thumbnail_url: "/v1/media/c2/serve", duration_seconds: 125, channel_name: "Ravi" } }, rowToVideo(base));
    expect(d.relatedPost?.id).toBe("v2");
    expect(d.relatedPost?.title).toBe("Part two");
    expect(d.relatedPost?.thumbnailUrl).toContain("/v1/media/c2/serve");
    expect(normalizeWatchDetail({ ...base, related_post: null }, rowToVideo(base)).relatedPost).toBeNull();
    expect(normalizeWatchDetail({ ...base, related_post: { id: "", title: "x" } }, rowToVideo(base)).relatedPost).toBeNull();
    expect(normalizeWatchDetail({ ...base, related_post_id: "v1", related_post: { id: "v1" } }, rowToVideo(base)).relatedPost).toBeNull();
    expect(normalizeRelatedPost({ id: "v3", title: "", thumbnail_url: null, duration_seconds: null, channel_name: null })).toEqual({ id: "v3", title: "Untitled", thumbnailUrl: "", durationSeconds: 0, channelName: "" });
  });

  test("the card sits inside the about card, before Show more, and links to the video", () => {
    const related = { id: "v2", title: "Part two", thumbnailUrl: "https://cdn/t.jpg", durationSeconds: 125, channelName: "Ravi" };
    const html = renderToStaticMarkup(<WatchDetails {...detailsBase} related={related} />);
    const about = html.indexOf("tube-about");
    const card = html.indexOf("data-related");
    const toggle = html.indexOf("Show more");
    expect(card).toBeGreaterThan(about);
    expect(toggle).toBeGreaterThan(card);
    expect(html).toContain(">Related video<");
    expect(html).toContain('href="/posttube/watch/v2"');
    expect(html).toContain(">Part two<");
    expect(html).toContain(">Ravi<");
    expect(html).toContain(">2:05<");
    expect(renderToStaticMarkup(<WatchDetails {...detailsBase} />)).not.toContain("Related video");
    expect(renderToStaticMarkup(<RelatedCard related={{ ...related, thumbnailUrl: "", durationSeconds: 0, channelName: "" }} />)).not.toContain("<img");
  });
});

describe("age restriction", () => {
  const err = (status: number, code: string) => ({ response: { status, data: { error: { code, message: "x" } } } });

  test("each code → its gate; anything else is not a gate", () => {
    expect(ageGateFromError(err(401, "AGE_RESTRICTED_SIGN_IN"))).toBe("sign_in");
    expect(ageGateFromError(err(403, "AGE_RESTRICTED"))).toBe("restricted");
    expect(ageGateFromError(err(403, "AGE_UNVERIFIED"))).toBe("unverified");
    expect(ageGateFromError(err(403, "FORBIDDEN"))).toBeNull();
    expect(ageGateFromError({ response: { status: 500, data: "oops" } })).toBeNull();
    expect(ageGateFromError(new Error("network"))).toBeNull();
    expect(ageGateFromError(null)).toBeNull();
    expect(errorCode({ response: { data: { error: "AGE_RESTRICTED" } } })).toBe("AGE_RESTRICTED");
    expect(errorCode({ response: { data: { code: "AGE_UNVERIFIED" } } })).toBe("AGE_UNVERIFIED");
  });

  test("the flag reads on the detail", () => {
    expect(normalizeWatchDetail({ ...base, age_restricted: true }, rowToVideo(base)).ageRestricted).toBe(true);
    expect(normalizeWatchDetail({ ...base, age_restricted: null }, rowToVideo(base)).ageRestricted).toBe(false);
  });

  test("sign_in: a Sign in link that comes back to this video", () => {
    const html = renderToStaticMarkup(<AgeGateCard gate="sign_in" videoId="v1" />);
    expect(html).toContain('data-age-gate="sign_in"');
    expect(html).toContain("Age-restricted video");
    expect(html).toContain(`href="/login?next=${encodeURIComponent("/posttube/watch/v1")}"`);
    expect(html).toContain(">Sign in<");
    expect(html).not.toContain("Video not found");
  });

  test("restricted and unverified: a plain explanation, no sign-in link", () => {
    const restricted = renderToStaticMarkup(<AgeGateCard gate="restricted" videoId="v1" />);
    expect(restricted).toContain("18 and older");
    expect(restricted).not.toContain("/login");
    const unverified = renderToStaticMarkup(<AgeGateCard gate="unverified" videoId="v1" />);
    expect(unverified).toContain("date of birth");
    expect(unverified).not.toContain("/login");
    expect(unverified).not.toBe(restricted);
  });
});

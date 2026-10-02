import { describe, expect, test } from "bun:test";

import { rowToVideo } from "../../model";
import * as watchApi from "../watchApi";
import { normalizeWatchDetail, storyboardJpgUrl, storyboardVttUrl, viewerSubtitleTracks, type WatchPostRow } from "../watchApi";

const base: WatchPostRow = {
  id: "v1",
  author_id: "a1",
  title: "A long one",
  text: "00:00 Intro\n02:10 Middle",
  content_type: "long_video",
  created_at: "2026-09-01T00:00:00Z",
  media: [{ media_id: "m1", kind: "video", duration_ms: 600_000 }],
  counts: { likes: 12, comments: 3, shares: 1 },
  view_count: 900,
  has_reacted: true,
  is_bookmarked: false,
  author: { id: "a1", display_name: "Ravi" },
  video_metadata: { media_asset_id: "m1", duration_seconds: 600 },
};

describe("normalizeWatchDetail: the post detail with the W1 keys", () => {
  test("with every new key", () => {
    const row: WatchPostRow = {
      ...base,
      viewer_disliked: false,
      viewer_queued: true,
      chapters: [
        { start_ms: 0, title: "Intro" },
        { start_ms: 130_000, title: "Middle" },
      ],
      allow_download: true,
      source: "live",
      like_count: 40,
      tier_required_id: "tier-9",
      no_comments: true,
      hide_share: true,
      category: "science-tech",
    };
    const d = normalizeWatchDetail(row, rowToVideo(row));
    expect(d.viewerDisliked).toBe(false);
    expect(d.viewerQueued).toBe(true);
    expect(d.chapters).toEqual([
      { startMs: 0, title: "Intro" },
      { startMs: 130_000, title: "Middle" },
    ]);
    expect(d.allowDownload).toBe(true);
    expect(d.source).toBe("live");
    expect(d.likeCount).toBe(40);
    expect(d.video.like_count).toBe(40);
    expect(d.tierRequiredId).toBe("tier-9");
    expect(d.commentsOff).toBe(true);
    expect(d.shareHidden).toBe(true);
    expect(d.topicSlug).toBe("science-tech");
    expect(d.mediaId).toBe("m1");
    expect(d.video.viewer_has_liked).toBe(true);
  });

  test("without them (an older fixture): safe defaults, the count from counts.likes", () => {
    const d = normalizeWatchDetail(base, rowToVideo(base));
    expect(d.viewerDisliked).toBe(false);
    expect(d.viewerQueued).toBe(false);
    expect(d.chapters).toEqual([]);
    expect(d.allowDownload).toBe(false);
    expect(d.source).toBe("upload");
    expect(d.likeCount).toBe(12);
    expect(d.tierRequiredId).toBeNull();
    expect(d.commentsOff).toBe(false);
    expect(d.shareHidden).toBe(false);
    expect(d.topicSlug).toBeNull();
    expect(d.mediaId).toBe("m1");
  });

  test("love and pass never both true on the way in; free-text categories are not a topic", () => {
    const row: WatchPostRow = { ...base, has_reacted: true, viewer_disliked: true, category: "Science & Technology" };
    const d = normalizeWatchDetail(row, rowToVideo(row));
    expect(d.viewerDisliked).toBe(true);
    expect(d.video.viewer_has_disliked).toBe(true);
    expect(d.topicSlug).toBeNull();
  });

  test("the media id falls back to the video media when video_metadata is absent", () => {
    const row: WatchPostRow = { ...base, video_metadata: null };
    expect(normalizeWatchDetail(row, rowToVideo(row)).mediaId).toBe("m1");
  });
});

describe("media routes", () => {
  test("no download route for a viewer (offline copies stay in the app); the storyboard is the served variants", () => {
    expect("downloadHref" in watchApi).toBe(false);
    expect(storyboardVttUrl("m1")).toContain("/v1/media/m1/serve/storyboard_vtt");
    expect(storyboardJpgUrl("m1")).toContain("/v1/media/m1/serve/storyboard_jpg");
  });

  test("subtitle drafts (published:false) are hidden from viewers; older rows without the key stay", () => {
    const rows = [
      { id: "s1", media_asset_id: "m1", language: "en", source: "manual_upload", format: "vtt", content_url: "", created_at: "" },
      { id: "s2", media_asset_id: "m1", language: "hi", source: "auto", format: "vtt", content_url: "", created_at: "", published: false },
      { id: "s3", media_asset_id: "m1", language: "te", source: "auto", format: "vtt", content_url: "", created_at: "", published: true },
    ];
    expect(viewerSubtitleTracks(rows).map((r) => r.id)).toEqual(["s1", "s3"]);
    expect(viewerSubtitleTracks(null)).toEqual([]);
  });
});

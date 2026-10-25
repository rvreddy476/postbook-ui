import { describe, expect, test } from "bun:test";

import {
  cardMetadata,
  channelCard,
  clip,
  hashtagCard,
  isShareId,
  isShareRef,
  mediaVideoUrl,
  neutralMetadata,
  NEUTRAL_TITLE,
  postCard,
  postIsPublic,
  profileCard,
  resolveShareBases,
  soundCard,
  type ShareBases,
  type WirePost,
} from "../siteMeta";

/*
  The link-preview builders (features/share/siteMeta): what a shared post,
  video, profile, channel, sound and tag say about themselves, and — more
  important — what they never say when the public may not see them.
*/

const POST_ID = "3f860f61-ddb6-4be6-98e6-3b892e9c584f";
const COVER_ID = "9a1c2e3d-4b5f-4a6b-8c7d-0e1f2a3b4c5d";
const VIDEO_ID = "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e";

const withApi: ShareBases = { siteUrl: "https://cleestudio.com", mediaBaseUrl: "https://api.cleestudio.com" };
const noApi: ShareBases = { siteUrl: "https://cleestudio.com", mediaBaseUrl: "" };

const publicVideo = (): WirePost => ({
  id: POST_ID,
  title: "Workshop tour",
  text: "A walk through the new workshop, bench by bench.",
  visibility: "public",
  content_type: "long_video",
  cover_media_id: COVER_ID,
  media: [{ media_id: VIDEO_ID, kind: "video", position: 0, processing_status: "ready", width: 1920, height: 1080 }],
  author: { display_name: "Raghu", username: "raghu" },
});

describe("resolveShareBases", () => {
  test("trims slashes, falls back to the API base, then to nothing", () => {
    expect(resolveShareBases({ siteUrl: "https://cleestudio.com/", feedMediaBaseUrl: "https://api.cleestudio.com//" })).toEqual(withApi);
    expect(resolveShareBases({ siteUrl: "https://cleestudio.com", apiBaseUrl: "https://api.cleestudio.com" })).toEqual(withApi);
    expect(resolveShareBases({})).toEqual({ siteUrl: "http://localhost:3000", mediaBaseUrl: "" });
  });
});

describe("ids and refs", () => {
  test("a post or media id is a UUID; a handle is tame", () => {
    expect(isShareId(POST_ID)).toBe(true);
    expect(isShareId("../etc")).toBe(false);
    expect(isShareRef("raghu.builds")).toBe(true);
    expect(isShareRef("a/b")).toBe(false);
    expect(isShareRef("..")).toBe(false);
    expect(isShareRef("")).toBe(false);
  });

  test("clip folds whitespace and cuts at a word", () => {
    expect(clip("  two\n words ")).toBe("two words");
    const long = "word ".repeat(60).trim();
    const cut = clip(long, 50);
    expect(cut.length).toBeLessThanOrEqual(50);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut).not.toContain("wor…");
  });
});

describe("postIsPublic", () => {
  test("only a public, un-redacted, un-tiered, un-restricted post", () => {
    expect(postIsPublic(publicVideo())).toBe(true);
    expect(postIsPublic({ ...publicVideo(), visibility: "followers" })).toBe(false);
    expect(postIsPublic({ ...publicVideo(), body_redacted: true })).toBe(false);
    expect(postIsPublic({ ...publicVideo(), tier_required_id: "t1" })).toBe(false);
    expect(postIsPublic({ ...publicVideo(), age_restricted: true })).toBe(false);
    expect(postIsPublic({ ...publicVideo(), id: "nope" })).toBe(false);
    expect(postIsPublic(null)).toBe(false);
  });
});

describe("postCard", () => {
  test("a public long video: title, description, cover and the public MP4 as og:video", () => {
    const card = postCard(publicVideo(), withApi, `/posttube/watch/${POST_ID}`)!;
    expect(card.type).toBe("video.other");
    expect(card.title).toBe("Workshop tour");
    expect(card.description).toBe("A walk through the new workshop, bench by bench.");
    expect(card.image?.url).toBe(`https://api.cleestudio.com/v1/media/${COVER_ID}/serve`);
    expect(card.video).toEqual({ url: `https://api.cleestudio.com/v1/media/${VIDEO_ID}/serve/720p`, width: 1920, height: 1080 });

    const meta = cardMetadata(card, withApi);
    expect(meta.title).toEqual({ absolute: "Workshop tour" });
    expect(meta.alternates?.canonical).toBe(`https://cleestudio.com/posttube/watch/${POST_ID}`);
    const og = meta.openGraph as { type: string; videos: Array<{ url: string; type: string }>; images: Array<{ url: string }> };
    expect(og.type).toBe("video.other");
    expect(og.videos[0]).toMatchObject({ url: `https://api.cleestudio.com/v1/media/${VIDEO_ID}/serve/720p`, type: "video/mp4" });
    expect((meta.twitter as { card: string }).card).toBe("summary_large_image");
  });

  test("og:video only when the API host is known: the proxy never streams a preview", () => {
    const card = postCard(publicVideo(), noApi, `/post/${POST_ID}`)!;
    expect(card.video).toBeNull();
    // The cover still comes through the site's own /v1 proxy.
    expect(card.image?.url).toBe(`https://cleestudio.com/v1/media/${COVER_ID}/serve`);
    expect(mediaVideoUrl(noApi, VIDEO_ID)).toBeNull();
    const og = cardMetadata(card, noApi).openGraph as { videos?: unknown };
    expect(og.videos).toBeUndefined();
  });

  test("a video still processing carries no og:video, and a reel with no title is 'Reel by …'", () => {
    const processing = { ...publicVideo(), title: null, text: null, content_type: "flick", media: [{ media_id: VIDEO_ID, kind: "video", processing_status: "processing" }] };
    const card = postCard(processing, withApi, `/post/${POST_ID}`)!;
    expect(card.video).toBeNull();
    expect(card.type).toBe("article");
    expect(card.title).toBe("Reel by Raghu");
    expect(card.description).toBe("A reel by Raghu on VChat");
  });

  test("a text post with a photo uses the photo; the caption is the title", () => {
    const photo: WirePost = {
      id: POST_ID,
      text: "Bench day",
      media: [{ media_id: COVER_ID, kind: "image", position: 0, width: 800, height: 600 }],
      author: { username: "raghu" },
    };
    const card = postCard(photo, withApi, `/post/${POST_ID}`)!;
    expect(card.title).toBe("Bench day");
    expect(card.image).toEqual({ url: `https://api.cleestudio.com/v1/media/${COVER_ID}/serve`, width: 800, height: 600, alt: "Bench day" });
    expect(card.description).toBe("A post by @raghu on VChat");
  });

  test("anything the public may not see is no card at all", () => {
    for (const post of [
      { ...publicVideo(), visibility: "private" },
      { ...publicVideo(), tier_required_id: "gold" },
      { ...publicVideo(), body_redacted: true },
      { ...publicVideo(), age_restricted: true },
      null,
      undefined,
    ]) {
      expect(postCard(post, withApi, `/post/${POST_ID}`)).toBeNull();
    }
  });
});

describe("neutralMetadata", () => {
  test("names the site and nothing else, carries the fallback picture, and asks not to be indexed", () => {
    const meta = neutralMetadata(withApi, `/post/${POST_ID}`);
    expect(meta.title).toEqual({ absolute: NEUTRAL_TITLE });
    const og = meta.openGraph as { title: string; images: Array<{ url: string; width: number; height: number }>; url: string };
    expect(og.title).toBe(NEUTRAL_TITLE);
    expect(og.images[0]).toMatchObject({ url: "https://cleestudio.com/api/share/image", width: 1200, height: 630 });
    expect(og.url).toBe(`https://cleestudio.com/post/${POST_ID}`);
    expect(meta.robots).toEqual({ index: false });
    const text = JSON.stringify(meta);
    expect(text).not.toContain("Workshop");
    expect(text).not.toContain("/v1/media/");
  });

  test("without a path it names no address", () => {
    const meta = neutralMetadata(withApi);
    expect(meta.alternates).toBeUndefined();
    expect((meta.openGraph as { url?: string }).url).toBeUndefined();
  });
});

describe("cardMetadata", () => {
  test("a card with no picture gets the fallback image on both cards", () => {
    const card = postCard({ id: POST_ID, text: "No picture here", author: { username: "raghu" } }, withApi, `/post/${POST_ID}`)!;
    expect(card.image).toBeNull();
    const meta = cardMetadata(card, withApi);
    expect((meta.openGraph as { images: Array<{ url: string }> }).images[0].url).toBe("https://cleestudio.com/api/share/image");
    expect((meta.twitter as { images: string[] }).images).toEqual(["https://cleestudio.com/api/share/image"]);
  });
});

describe("profileCard", () => {
  test("a public profile: name, handle, bio, avatar, og:profile", () => {
    const card = profileCard({ username: "raghu", display_name: "Raghu", bio: "Builds things", avatar_media_id: COVER_ID, follower_count: 1200 }, withApi)!;
    expect(card.title).toBe("Raghu (@raghu)");
    expect(card.description).toBe("Builds things");
    expect(card.image?.url).toBe(`https://api.cleestudio.com/v1/media/${COVER_ID}/serve`);
    expect(card.path).toBe("/u/raghu");
    expect(card.username).toBe("raghu");
    const og = cardMetadata(card, withApi).openGraph as { type: string; username: string };
    expect(og.type).toBe("profile");
    expect(og.username).toBe("raghu");
  });

  test("a private account: its name, no bio, no picture", () => {
    const card = profileCard({ username: "raghu", display_name: "Raghu", bio: "secret", avatar_media_id: COVER_ID, is_private: true, follower_count: 3 }, withApi)!;
    expect(card.title).toBe("Raghu (@raghu)");
    expect(card.description).toBe("3 followers · Raghu on VChat");
    expect(card.image).toBeNull();
    expect(JSON.stringify(card)).not.toContain("secret");
  });

  test("a relative avatar_url is made absolute on the API host; a bad handle is no card", () => {
    expect(profileCard({ username: "raghu", avatar_url: "/v1/media/x/serve" }, withApi)!.image?.url).toBe("https://api.cleestudio.com/v1/media/x/serve");
    expect(profileCard({ username: "a/b" }, withApi)).toBeNull();
    expect(profileCard(null, withApi)).toBeNull();
  });
});

describe("channelCard", () => {
  test("banner over avatar, about over counts, and the path the route asks for", () => {
    const pathFor = (ref: string) => `/posttube/channel/${ref}`;
    const full = channelCard({ handle: "raghu.builds", name: "Raghu Builds", about: "Workshop videos", avatar_media_id: COVER_ID, banner_media_id: VIDEO_ID }, withApi, pathFor)!;
    expect(full.title).toBe("Raghu Builds (@raghu.builds)");
    expect(full.image?.url).toBe(`https://api.cleestudio.com/v1/media/${VIDEO_ID}/serve`);
    expect(full.path).toBe("/posttube/channel/raghu.builds");
    const bare = channelCard({ handle: "raghu.builds", subscriber_count: 1500, video_count: 1 }, withApi, pathFor)!;
    expect(bare.description).toBe("1.5K subscribers · 1 video on VChat");
    expect(bare.image).toBeNull();
    expect(channelCard({ handle: "" }, withApi, pathFor)).toBeNull();
  });
});

describe("soundCard", () => {
  test("title and artist, how many reels, the origin reel's cover only when that reel is public", () => {
    const sound = { id: POST_ID, title: "Night drive", artist: "Raghu", usage_count: 42, source_post_id: VIDEO_ID, status: "ready" };
    const pub = soundCard(sound, publicVideo(), withApi)!;
    expect(pub.title).toBe("Night drive · Raghu");
    expect(pub.description).toBe("Raghu · 42 reels use this sound on VChat");
    expect(pub.type).toBe("music.song");
    expect(pub.image?.url).toBe(`https://api.cleestudio.com/v1/media/${COVER_ID}/serve`);
    const priv = soundCard(sound, { ...publicVideo(), visibility: "private" }, withApi)!;
    expect(priv.image).toBeNull();
    expect(soundCard({ ...sound, status: "removed" }, null, withApi)).toBeNull();
    expect(soundCard({ ...sound, id: "x" }, null, withApi)).toBeNull();
  });
});

describe("hashtagCard", () => {
  test("the tag, its count, the first public post's cover", () => {
    const card = hashtagCard("#Workshop", 2300, publicVideo(), withApi)!;
    expect(card.title).toBe("#Workshop");
    expect(card.description).toBe("2.3K posts tagged #Workshop on VChat");
    expect(card.path).toBe("/hashtag/Workshop");
    expect(card.image?.url).toBe(`https://api.cleestudio.com/v1/media/${COVER_ID}/serve`);
    expect(hashtagCard("bench", null, { ...publicVideo(), visibility: "private" }, withApi)!.image).toBeNull();
    expect(hashtagCard("bench", null, null, withApi)!.description).toBe("Posts tagged #bench on VChat");
    expect(hashtagCard("a b", null, null, withApi)).toBeNull();
    expect(hashtagCard("a/b", null, null, withApi)).toBeNull();
  });
});

import { afterEach, describe, expect, test } from "bun:test";

import { generateMetadata as postMeta } from "@/app/post/[postId]/page";
import { generateMetadata as reelMeta } from "@/app/reels/[id]/page";
import { generateMetadata as soundMeta } from "@/app/reels/sound/[id]/page";
import { generateMetadata as profileMeta } from "@/app/u/[username]/page";
import { generateMetadata as hashtagMeta } from "@/app/hashtag/[tag]/page";
import { generateMetadata as watchMeta } from "@/app/posttube/watch/[videoId]/page";
import { generateMetadata as channelMeta } from "@/app/channel/[handle]/page";

/*
  The routes' generateMetadata, end to end with the gateway stubbed: each
  asks the public API with no cookie, builds its card, and sends the
  neutral card when the API refuses.
*/

const ID = "3f860f61-ddb6-4be6-98e6-3b892e9c584f";
const COVER = "9a1c2e3d-4b5f-4a6b-8c7d-0e1f2a3b4c5d";
const SOUND = "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

type Seen = { url: string; init?: RequestInit };
function stub(routes: Record<string, { status: number; body: unknown }>): Seen[] {
  const seen: Seen[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    seen.push({ url: String(url), init });
    const path = new URL(String(url)).pathname;
    const hit = Object.entries(routes).find(([k]) => path === k);
    if (!hit) return new Response(JSON.stringify({ error: { code: "NOT_FOUND" } }), { status: 404 });
    return new Response(JSON.stringify(hit[1].body), { status: hit[1].status });
  }) as unknown as typeof fetch;
  return seen;
}

const ogOf = (m: { openGraph?: unknown }) => m.openGraph as { title: string; type: string; url?: string; images: Array<{ url: string }>; videos?: unknown };

describe("post, reel and watch pages", () => {
  test("a public post: its caption and cover, fetched without a cookie", async () => {
    const seen = stub({ [`/v1/posts/${ID}`]: { status: 200, body: { data: { id: ID, text: "Bench day", visibility: "public", cover_media_id: COVER, author: { username: "raghu" } } } } });
    const m = await postMeta({ params: Promise.resolve({ postId: ID }) });
    expect(seen[0].url).toEndWith(`/v1/posts/${ID}`);
    expect(JSON.stringify(seen[0].init?.headers ?? {}).toLowerCase()).not.toContain("cookie");
    expect(m.title).toEqual({ absolute: "Bench day" });
    expect(ogOf(m).images[0].url).toContain(`/v1/media/${COVER}/serve`);
    expect(ogOf(m).url).toEndWith(`/post/${ID}`);
  });

  test("the reel permalink and the watch page send the same post's card under their own address", async () => {
    stub({ [`/v1/posts/${ID}`]: { status: 200, body: { data: { id: ID, text: "Bench day", visibility: "public" } } } });
    expect(ogOf(await reelMeta({ params: Promise.resolve({ id: ID }) })).url).toEndWith(`/reels/${ID}`);
    expect(ogOf(await watchMeta({ params: Promise.resolve({ videoId: ID }) })).url).toEndWith(`/posttube/watch/${ID}`);
  });

  test("a members-only, private or missing post: the neutral card, nothing of it named", async () => {
    stub({ [`/v1/posts/${ID}`]: { status: 200, body: { data: { id: ID, text: "For members", visibility: "public", tier_required_id: "gold", cover_media_id: COVER } } } });
    const members = await postMeta({ params: Promise.resolve({ postId: ID }) });
    expect(members.title).toEqual({ absolute: "Content on Clee Studio" });
    expect(JSON.stringify(members)).not.toContain("members");
    expect(JSON.stringify(members)).not.toContain(COVER);

    stub({});
    const gone = await postMeta({ params: Promise.resolve({ postId: ID }) });
    expect(gone.title).toEqual({ absolute: "Content on Clee Studio" });
    expect(gone.robots).toEqual({ index: false });
  });

  test("an id that is not a UUID asks the API nothing", async () => {
    const seen = stub({});
    const m = await postMeta({ params: Promise.resolve({ postId: "../admin" }) });
    expect(seen).toHaveLength(0);
    expect(m.title).toEqual({ absolute: "Content on Clee Studio" });
  });

  test("an API that does not answer costs the preview, not the page", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const m = await postMeta({ params: Promise.resolve({ postId: ID }) });
    expect(m.title).toEqual({ absolute: "Content on Clee Studio" });
  });
});

describe("profile and channel pages", () => {
  test("a profile by username, a leading @ dropped", async () => {
    const seen = stub({ "/v1/profiles/by-username/raghu": { status: 200, body: { data: { username: "raghu", display_name: "Raghu", bio: "Builds things" } } } });
    const m = await profileMeta({ params: Promise.resolve({ username: "%40raghu" }) });
    expect(seen[0].url).toEndWith("/v1/profiles/by-username/raghu");
    expect(m.title).toEqual({ absolute: "Raghu (@raghu)" });
    expect(ogOf(m).type).toBe("profile");
  });

  test("a profile the public may not see is the neutral card; a bad handle asks nothing", async () => {
    stub({});
    expect((await profileMeta({ params: Promise.resolve({ username: "nobody" }) })).title).toEqual({ absolute: "Content on Clee Studio" });
    const seen = stub({});
    await profileMeta({ params: Promise.resolve({ username: "a%2Fb" }) });
    expect(seen).toHaveLength(0);
  });

  test("the older /channel/<handle> page reads the same channel", async () => {
    const seen = stub({ "/v1/channels/raghu.builds": { status: 200, body: { data: { handle: "raghu.builds", name: "Raghu Builds" } } } });
    const m = await channelMeta({ params: Promise.resolve({ handle: "raghu.builds" }) });
    expect(seen[0].url).toEndWith("/v1/channels/raghu.builds");
    expect(m.title).toEqual({ absolute: "Raghu Builds (@raghu.builds)" });
    expect(ogOf(m).url).toEndWith("/channel/raghu.builds");
  });
});

describe("sound and hashtag pages", () => {
  test("a sound, then the reel it came from for its cover", async () => {
    const seen = stub({
      [`/v1/audio/${SOUND}`]: { status: 200, body: { data: { id: SOUND, title: "Night drive", artist: "Raghu", usage_count: 3, source_post_id: ID, status: "ready" } } },
      [`/v1/posts/${ID}`]: { status: 200, body: { data: { id: ID, visibility: "public", cover_media_id: COVER } } },
    });
    const m = await soundMeta({ params: Promise.resolve({ id: SOUND }) });
    expect(seen.map((s) => new URL(s.url).pathname)).toEqual([`/v1/audio/${SOUND}`, `/v1/posts/${ID}`]);
    expect(m.title).toEqual({ absolute: "Night drive · Raghu" });
    expect(ogOf(m).type).toBe("music.song");
    expect(ogOf(m).images[0].url).toContain(`/v1/media/${COVER}/serve`);
  });

  test("a sound the public may not hear is the neutral card", async () => {
    stub({});
    expect((await soundMeta({ params: Promise.resolve({ id: SOUND }) })).title).toEqual({ absolute: "Content on Clee Studio" });
  });

  test("a tag: its count and the first public post's cover, from one public read", async () => {
    const seen = stub({ "/v1/hashtags/workshop/posts": { status: 200, body: { data: [{ id: ID, visibility: "public", cover_media_id: COVER }], meta: { total: 12 } } } });
    const m = await hashtagMeta({ params: Promise.resolve({ tag: "%23workshop" }) });
    expect(seen[0].url).toContain("/v1/hashtags/workshop/posts?limit=1");
    expect(m.title).toEqual({ absolute: "#workshop" });
    expect(m.description).toBe("12 posts tagged #workshop on Clee Studio");
    expect(ogOf(m).images[0].url).toContain(`/v1/media/${COVER}/serve`);
  });

  test("a tag with nothing public still names the tag, with the fallback picture", async () => {
    stub({ "/v1/hashtags/quiet/posts": { status: 200, body: { data: [], meta: {} } } });
    const m = await hashtagMeta({ params: Promise.resolve({ tag: "quiet" }) });
    expect(m.title).toEqual({ absolute: "#quiet" });
    expect(ogOf(m).images[0].url).toEndWith("/api/share/image");
  });
});

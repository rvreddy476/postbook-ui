import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { channelFeedPath, channelFeedUrl, channelRefFromSegment, feedCategory, isFeedRef } from "../feedUrl";
import {
  absoluteBase,
  absolutize,
  appleCategory,
  buildRss,
  cdata,
  esc,
  feedLastModified,
  FEED_ITEM_CAP,
  itunesDuration,
  normalizeFeed,
  resolveFeedBases,
  rfc2822,
  textToHtml,
  type ChannelFeed,
} from "../rss";

/* The response shape pinned in the plan (post-service GET /v1/channels/:ref/feed), inside the `data` envelope. */
const AVATAR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COVER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MEDIA = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function wireItem(n: number, over: Record<string, unknown> = {}) {
  return {
    id: `post-${n}`,
    title: `Episode ${n}`,
    text: `Notes for episode ${n}`,
    category: "podcasts",
    language: "en",
    hashtags: ["build"],
    published_at: "2026-09-28T10:05:09Z",
    media_id: MEDIA,
    duration_ms: 3_725_000,
    cover_media_id: COVER,
    enclosure: { variant: "720p", path: `/v1/media/${MEDIA}/serve/720p`, mime: "video/mp4", size_bytes: 123_456_789 },
    ...over,
  };
}

function wire(over: Record<string, unknown> = {}, channel: Record<string, unknown> = {}) {
  return {
    data: {
      channel: {
        user_id: "22222222-2222-4222-8222-222222222222",
        name: "Raghu Builds",
        handle: "raghu.builds",
        about: "Weekly builds",
        avatar_media_id: AVATAR,
        avatar_url: `/v1/media/${AVATAR}/serve`,
        contact_email: "hello@example.com",
        language: "en",
        dominant_category: "science-tech",
        ...channel,
      },
      category: "",
      updated_at: "2026-09-29T08:00:00Z",
      items: [wireItem(1)],
      ...over,
    },
  };
}

const OPTS = {
  siteUrl: "https://cleestudio.com",
  mediaBaseUrl: "https://api-dev.cleestudio.com",
  feedUrl: "https://cleestudio.com/posttube/channel/raghu.builds/feed.xml",
};

function build(over: Record<string, unknown> = {}, channel: Record<string, unknown> = {}, opts: Partial<typeof OPTS> = {}): string {
  const feed = normalizeFeed(wire(over, channel));
  if (!feed) throw new Error("fixture did not normalise");
  return buildRss(feed, { ...OPTS, ...opts });
}

const count = (xml: string, needle: string) => xml.split(needle).length - 1;

/** Every URL a feed reader would follow: attribute values and the link/url elements. */
function urlsIn(xml: string): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(/\b(?:href|url)="([^"]*)"/g)) out.push(m[1]);
  for (const m of xml.matchAll(/<(?:link|url)>([^<]*)<\/(?:link|url)>/g)) out.push(m[1]);
  return out;
}

describe("escaping", () => {
  test("the five characters, in element bodies and attributes", () => {
    expect(esc(`Tom & "Jerry" <b>'s</b>`)).toBe("Tom &amp; &quot;Jerry&quot; &lt;b&gt;&apos;s&lt;/b&gt;");
  });
  test("control characters and lone surrogates are removed; tab, newline and a whole emoji stay", () => {
    expect(esc("a\u0000b\u0008c\u000Bd\u001Fe")).toBe("abcde");
    expect(esc("a\tb\nc")).toBe("a\tb\nc");
    expect(esc("ok 😀 \uD83D gone \uDE00")).toBe("ok 😀  gone ");
    expect(esc("x￾y￿z")).toBe("xyz");
  });
  test("a ]]> in the text is split across two CDATA sections", () => {
    const out = cdata("a ]]> b ]]> c");
    expect(out).toBe("<![CDATA[a ]]]]><![CDATA[> b ]]]]><![CDATA[> c]]>");
    // Reading the sections back gives the text unchanged.
    const back = [...out.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)].map((m) => m[1]).join("");
    expect(back).toBe("a ]]> b ]]> c");
  });
  test("a title and notes with markup and ]]> leave a well-formed document", () => {
    const xml = build(
      { items: [wireItem(1, { title: `Q&A <live> "one"`, text: "first ]]> line\nsecond <script>alert(1)</script>\n\nnext & last" })] },
      { name: "R&D <Lab>", about: "5 > 3 & 2 < 4" },
    );
    expect(xml).toContain("<title>R&amp;D &lt;Lab&gt;</title>");
    expect(xml).toContain("<description>5 &gt; 3 &amp; 2 &lt; 4</description>");
    expect(xml).toContain("<title>Q&amp;A &lt;live&gt; &quot;one&quot;</title>");
    expect(xml).not.toContain("<script>");
    expect(xml).toContain("<content:encoded><![CDATA[<p>first ]]&gt; line<br />second &lt;script&gt;alert(1)&lt;/script&gt;</p><p>next &amp; last</p>]]></content:encoded>");
    // One CDATA opened, one closed; no bare ampersand anywhere outside it.
    expect(count(xml, "<![CDATA[")).toBe(count(xml, "]]>"));
    const outside = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
    expect(outside).not.toMatch(/&(?!(amp|lt|gt|quot|apos);)/);
  });
  test("paragraphs from plain text", () => {
    expect(textToHtml("one\r\ntwo\n\n\nthree")).toBe("<p>one<br />two</p><p>three</p>");
    expect(textToHtml("   ")).toBe("");
  });
});

describe("dates and durations", () => {
  test("RFC 2822 in GMT, zero-padded", () => {
    expect(rfc2822("2026-09-28T10:05:09Z")).toBe("Mon, 28 Sep 2026 10:05:09 GMT");
    expect(rfc2822("2026-01-04T23:59:59+05:30")).toBe("Sun, 04 Jan 2026 18:29:59 GMT");
    expect(rfc2822(new Date(Date.UTC(2024, 1, 29, 0, 0, 0)))).toBe("Thu, 29 Feb 2024 00:00:00 GMT");
  });
  test("what is not a time gives nothing", () => {
    expect(rfc2822("")).toBe("");
    expect(rfc2822(null)).toBe("");
    expect(rfc2822("yesterday")).toBe("");
  });
  test("duration is H:MM:SS", () => {
    expect(itunesDuration(3_725_000)).toBe("1:02:05");
    expect(itunesDuration(754_000)).toBe("0:12:34");
    expect(itunesDuration(36_000_000)).toBe("10:00:00");
    expect(itunesDuration(400)).toBe("0:00:01");
    expect(itunesDuration(0)).toBe("");
    expect(itunesDuration(-5)).toBe("");
    expect(itunesDuration(null)).toBe("");
    expect(itunesDuration(Number.NaN)).toBe("");
  });
  test("pubDate, duration and lastBuildDate land in the document", () => {
    const xml = build();
    expect(xml).toContain("<pubDate>Mon, 28 Sep 2026 10:05:09 GMT</pubDate>");
    expect(xml).toContain("<itunes:duration>1:02:05</itunes:duration>");
    expect(xml).toContain("<lastBuildDate>Tue, 29 Sep 2026 08:00:00 GMT</lastBuildDate>");
  });
  test("without updated_at the newest item dates the feed; with neither there is no date", () => {
    const feed = normalizeFeed(
      wire({ updated_at: "", items: [wireItem(1, { published_at: "2026-09-01T00:00:00Z" }), wireItem(2, { published_at: "2026-09-20T00:00:00Z" })] }),
    ) as ChannelFeed;
    expect(feedLastModified(feed)?.toISOString()).toBe("2026-09-20T00:00:00.000Z");
    const none = normalizeFeed(wire({ updated_at: null, items: [] })) as ChannelFeed;
    expect(feedLastModified(none)).toBeNull();
    expect(buildRss(none, OPTS)).not.toContain("lastBuildDate");
  });
});

describe("enclosures and artwork", () => {
  test("the enclosure path is made absolute on the media origin, with length and type", () => {
    const xml = build();
    expect(xml).toContain(`<enclosure url="https://api-dev.cleestudio.com/v1/media/${MEDIA}/serve/720p" length="123456789" type="video/mp4"/>`);
    expect(xml).toContain(`<itunes:image href="https://api-dev.cleestudio.com/v1/media/${COVER}/serve"/>`);
  });
  test("artwork is the avatar's original file", () => {
    const xml = build();
    expect(xml).toContain(`<url>https://api-dev.cleestudio.com/v1/media/${AVATAR}/serve</url>`);
    expect(xml).toContain(`<itunes:image href="https://api-dev.cleestudio.com/v1/media/${AVATAR}/serve"/>`);
  });
  test("no avatar: no image and no itunes:image on the channel", () => {
    for (const empty of [null, "", undefined]) {
      const xml = build({ items: [] }, { avatar_media_id: empty, avatar_url: empty });
      expect(xml).not.toContain("<image>");
      expect(xml).not.toContain("itunes:image");
    }
  });
  test("no cover: the item carries no itunes:image", () => {
    const xml = build({ items: [wireItem(1, { cover_media_id: "" })] }, { avatar_media_id: "", avatar_url: "" });
    expect(xml).not.toContain("itunes:image");
    expect(xml).toContain("<enclosure ");
  });
  test("no media origin: no enclosure and no artwork, the entries stay, and nothing relative is written", () => {
    const xml = build({ items: [wireItem(1), wireItem(2)] }, {}, { mediaBaseUrl: "" });
    expect(xml).not.toContain("<enclosure");
    expect(xml).not.toContain("itunes:image");
    expect(xml).not.toContain("<image>");
    expect(count(xml, "<item>")).toBe(2);
    for (const u of urlsIn(xml)) expect(u).toMatch(/^https:\/\//);
  });
  test("every URL in a full feed is absolute", () => {
    const urls = urlsIn(build());
    expect(urls.length).toBeGreaterThan(5);
    for (const u of urls) expect(u).toMatch(/^https:\/\//);
  });
  test("with a media origin, an entry with nothing to play is left out", () => {
    const xml = build({
      items: [
        wireItem(1, { enclosure: null }),
        wireItem(2, { enclosure: { variant: "720p", path: "", mime: "video/mp4", size_bytes: 5 } }),
        wireItem(3, { enclosure: { path: "//evil.example/x.mp4", size_bytes: 5 } }),
        wireItem(4),
      ],
    });
    expect(count(xml, "<item>")).toBe(1);
    expect(xml).toContain('<guid isPermaLink="false">post-4</guid>');
  });
  test("absolutize: relative paths need a base; schemes other than http(s) never pass", () => {
    expect(absolutize("https://api.example.com", "/v1/media/x/serve")).toBe("https://api.example.com/v1/media/x/serve");
    expect(absolutize("", "/v1/media/x/serve")).toBe("");
    expect(absolutize("https://api.example.com", "v1/media/x")).toBe("");
    expect(absolutize("https://api.example.com", "//other.example/x")).toBe("");
    expect(absolutize("https://api.example.com", "javascript:alert(1)")).toBe("");
    expect(absolutize("https://api.example.com", "https://cdn.example.com/a.mp4")).toBe("https://cdn.example.com/a.mp4");
  });
  test("a media id that is not an id never reaches a URL", () => {
    const xml = build({ items: [] }, { avatar_media_id: "../../etc/passwd", avatar_url: "" });
    expect(xml).not.toContain("passwd");
    expect(xml).not.toContain("<image>");
  });
});

describe("origins", () => {
  test("FEED_MEDIA_BASE_URL first, then NEXT_PUBLIC_API_BASE_URL, then none", () => {
    expect(resolveFeedBases({ siteUrl: "https://cleestudio.com/", feedMediaBaseUrl: "https://api-dev.cleestudio.com/", apiBaseUrl: "https://other.example" })).toEqual({
      siteUrl: "https://cleestudio.com",
      mediaBaseUrl: "https://api-dev.cleestudio.com",
    });
    expect(resolveFeedBases({ siteUrl: "https://cleestudio.com", feedMediaBaseUrl: "", apiBaseUrl: "https://api.cleestudio.com" }).mediaBaseUrl).toBe("https://api.cleestudio.com");
    expect(resolveFeedBases({ siteUrl: "https://cleestudio.com", feedMediaBaseUrl: undefined, apiBaseUrl: "" }).mediaBaseUrl).toBe("");
  });
  test("a base that is not an absolute http(s) origin counts as unset", () => {
    expect(absoluteBase("/v1")).toBe("");
    expect(absoluteBase("api.cleestudio.com")).toBe("");
    expect(absoluteBase("ftp://api.cleestudio.com")).toBe("");
    expect(absoluteBase("  https://api.cleestudio.com//  ")).toBe("https://api.cleestudio.com");
    expect(resolveFeedBases({ feedMediaBaseUrl: "/relative", apiBaseUrl: "" }).mediaBaseUrl).toBe("");
  });
});

describe("the channel", () => {
  test("title, links, description, language, author, owner, explicit, type", () => {
    const xml = build();
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" ')).toBe(true);
    expect(xml).toContain('xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"');
    expect(xml).toContain('xmlns:content="http://purl.org/rss/1.0/modules/content/"');
    expect(xml).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
    expect(xml).toContain("<title>Raghu Builds</title>");
    expect(xml).toContain("<link>https://cleestudio.com/posttube/channel/raghu.builds</link>");
    expect(xml).toContain('<atom:link href="https://cleestudio.com/posttube/channel/raghu.builds/feed.xml" rel="self" type="application/rss+xml"/>');
    expect(xml).toContain("<description>Weekly builds</description>");
    expect(xml).toContain("<language>en</language>");
    expect(xml).toContain("<generator>PostTube</generator>");
    expect(xml).toContain("<itunes:author>Raghu Builds</itunes:author>");
    expect(xml).toContain("<itunes:email>hello@example.com</itunes:email>");
    expect(xml).toContain("<itunes:explicit>false</itunes:explicit>");
    expect(xml).toContain("<itunes:type>episodic</itunes:type>");
  });
  test("the item: guid, title, watch link, description, episode type", () => {
    const xml = build();
    expect(xml).toContain('<guid isPermaLink="false">post-1</guid>');
    expect(xml).toContain("<title>Episode 1</title>");
    expect(xml).toContain("<link>https://cleestudio.com/posttube/watch/post-1</link>");
    expect(xml).toContain("<description>Notes for episode 1</description>");
    expect(xml).toContain("<itunes:episodeType>full</itunes:episodeType>");
  });
  test("empty strings and nulls fall through: about, language, contact email, title", () => {
    const xml = build({ items: [wireItem(1, { title: "", text: "First line of the notes\nmore" })] }, { about: "", language: "", contact_email: null });
    expect(xml).toContain("<description>Videos from Raghu Builds on PostTube</description>");
    expect(xml).toContain("<language>en</language>");
    expect(xml).not.toContain("itunes:owner");
    expect(xml).toContain("<title>First line of the notes</title>");
    const untitled = build({ items: [wireItem(1, { title: null, text: null })] });
    expect(untitled).toContain("<title>Untitled</title>");
    expect(untitled).not.toContain("content:encoded");
  });
  test("a channel with no handle links by its user id; a body that is not a feed is refused", () => {
    const xml = build({}, { handle: "" });
    expect(xml).toContain("<link>https://cleestudio.com/posttube/channel/22222222-2222-4222-8222-222222222222</link>");
    expect(normalizeFeed(null)).toBeNull();
    expect(normalizeFeed({ data: { items: [] } })).toBeNull();
    expect(normalizeFeed({ data: { channel: { name: "No id" } } })).toBeNull();
    // Without the envelope the same body is read.
    expect(normalizeFeed(wire().data)?.channel.handle).toBe("raghu.builds");
  });
  test("a description longer than 4000 characters is cut", () => {
    const xml = build({ items: [wireItem(1, { text: "x".repeat(5000) })] });
    const body = xml.match(/<item>[\s\S]*?<description>([^<]*)<\/description>/)?.[1] ?? "";
    expect(Array.from(body).length).toBe(4000);
    expect(body.endsWith("…")).toBe(true);
  });
});

describe("categories", () => {
  test("the Apple category follows the channel's dominant topic", () => {
    expect(build()).toContain('<itunes:category text="Technology"/>');
    expect(build({}, { dominant_category: "kids" })).toContain('<itunes:category text="Kids &amp; Family"/>');
    expect(appleCategory("podcasts")).toBe("Society & Culture");
    expect(appleCategory("news")).toBe("News");
    expect(appleCategory("music")).toBe("Music");
    expect(appleCategory("education")).toBe("Education");
    expect(appleCategory("comedy")).toBe("Comedy");
    expect(appleCategory("sports")).toBe("Sports");
    expect(appleCategory("entertainment")).toBe("TV & Film");
    expect(appleCategory("film-animation")).toBe("TV & Film");
  });
  test("no topic, or one we do not know, defaults to TV & Film", () => {
    expect(build({}, { dominant_category: "" })).toContain('<itunes:category text="TV &amp; Film"/>');
    expect(build({}, { dominant_category: null })).toContain('<itunes:category text="TV &amp; Film"/>');
    expect(appleCategory("other")).toBe("TV & Film");
    expect(appleCategory("no-such-topic")).toBe("TV & Film");
    expect(appleCategory("constructor")).toBe("TV & Film");
  });
  test("a narrowed feed says so in its title, its category and its self link", () => {
    const feedUrl = channelFeedUrl("https://cleestudio.com", "raghu.builds", "podcasts");
    expect(feedUrl).toBe("https://cleestudio.com/posttube/channel/raghu.builds/feed.xml?category=podcasts");
    const xml = build({ category: "podcasts" }, {}, { feedUrl });
    expect(xml).toContain("<title>Raghu Builds · Podcasts</title>");
    expect(xml).toContain('<itunes:category text="Society &amp; Culture"/>');
    expect(xml).toContain('<atom:link href="https://cleestudio.com/posttube/channel/raghu.builds/feed.xml?category=podcasts" rel="self" type="application/rss+xml"/>');
  });
});

describe("sizes", () => {
  test("zero items is a valid, empty channel", () => {
    for (const items of [[], null, undefined]) {
      const xml = build({ items });
      expect(xml).toContain("<channel>");
      expect(xml).toContain("<title>Raghu Builds</title>");
      expect(xml).not.toContain("<item>");
      expect(xml.trimEnd().endsWith("</channel>\n</rss>")).toBe(true);
    }
  });
  test("at most 50 items, the first 50 as the server ordered them", () => {
    expect(FEED_ITEM_CAP).toBe(50);
    const xml = build({ items: Array.from({ length: 75 }, (_, i) => wireItem(i + 1)) });
    expect(count(xml, "<item>")).toBe(50);
    expect(xml).toContain('<guid isPermaLink="false">post-50</guid>');
    expect(xml).not.toContain('<guid isPermaLink="false">post-51</guid>');
  });
  test("entries left out do not use up the 50", () => {
    const items = [...Array.from({ length: 10 }, (_, i) => wireItem(1000 + i, { enclosure: null })), ...Array.from({ length: 55 }, (_, i) => wireItem(i + 1))];
    expect(count(build({ items }), "<item>")).toBe(50);
  });
  test("the same input gives the same bytes", () => {
    expect(build()).toBe(build());
  });
});

describe("feed addresses", () => {
  test("category is a slug or nothing", () => {
    expect(feedCategory("podcasts")).toBe("podcasts");
    expect(feedCategory("science-tech")).toBe("science-tech");
    expect(feedCategory("")).toBe("");
    expect(feedCategory(null)).toBe("");
    expect(feedCategory("Podcasts")).toBe("");
    expect(feedCategory("a b")).toBe("");
    expect(feedCategory("x&limit=500")).toBe("");
    expect(feedCategory("../me")).toBe("");
    expect(feedCategory("a".repeat(33))).toBe("");
  });
  test("the [handle] segment: decoded, the @ dropped, nothing that walks a path", () => {
    expect(channelRefFromSegment("%40raghu.builds")).toBe("raghu.builds");
    expect(channelRefFromSegment("@raghu.builds")).toBe("raghu.builds");
    expect(channelRefFromSegment("%E0%A4%A")).toBe("%E0%A4%A");
    expect(isFeedRef("raghu.builds")).toBe(true);
    expect(isFeedRef("22222222-2222-4222-8222-222222222222")).toBe(true);
    expect(isFeedRef("..")).toBe(false);
    expect(isFeedRef("a..b")).toBe(false);
    expect(isFeedRef("a/b")).toBe(false);
    expect(isFeedRef("")).toBe(false);
    expect(isFeedRef("me?x=1")).toBe(false);
  });
  test("paths", () => {
    expect(channelFeedPath("raghu.builds")).toBe("/posttube/channel/raghu.builds/feed.xml");
    expect(channelFeedPath("raghu.builds", "BAD CATEGORY")).toBe("/posttube/channel/raghu.builds/feed.xml");
    expect(channelFeedUrl("https://cleestudio.com/", "raghu.builds")).toBe("https://cleestudio.com/posttube/channel/raghu.builds/feed.xml");
  });
});

describe("the builder stays server-safe", () => {
  test("rss.ts and feedUrl.ts import neither the browser API client nor React", () => {
    for (const file of ["../rss.ts", "../feedUrl.ts"]) {
      const src = readFileSync(resolve(import.meta.dir, file), "utf8");
      const imports = [...src.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
      for (const from of imports) {
        expect(from).not.toMatch(/^@\/lib\/api/);
        expect(from).not.toMatch(/channelApi|posttubeApi|^react|^axios/);
      }
    }
  });
});

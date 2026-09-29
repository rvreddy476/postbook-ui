import { describe, expect, test } from "bun:test";

import { generateMetadata } from "../page";

/* The channel page's RSS autodiscovery link (<link rel="alternate" type="application/rss+xml">). */

const meta = (handle: string) => generateMetadata({ params: Promise.resolve({ handle }) });

describe("channel page metadata", () => {
  test("points feed readers at the channel's feed.xml", async () => {
    const m = await meta("raghu.builds");
    expect(m.title).toBe("Channel · PostTube");
    expect(m.alternates?.canonical).toBe("/posttube/channel/raghu.builds");
    expect(m.alternates?.types?.["application/rss+xml"]).toEqual([{ url: "/posttube/channel/raghu.builds/feed.xml", title: "RSS feed" }]);
  });

  test("a leading @ is dropped, encoded or not", async () => {
    for (const handle of ["@raghu.builds", "%40raghu.builds"]) {
      const m = await meta(handle);
      expect(m.alternates?.types?.["application/rss+xml"]).toEqual([{ url: "/posttube/channel/raghu.builds/feed.xml", title: "RSS feed" }]);
    }
  });

  test("a segment that is not a channel ref advertises no feed", async () => {
    for (const handle of ["..", "a%2Fb", "%3Cscript%3E"]) {
      const m = await meta(handle);
      expect(m.title).toBe("Channel · PostTube");
      expect(m.alternates).toBeUndefined();
    }
  });
});

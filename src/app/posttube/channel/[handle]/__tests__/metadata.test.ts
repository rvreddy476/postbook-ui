import { afterEach, describe, expect, test } from "bun:test";

import { generateMetadata } from "../page";

/*
  The channel page's link preview (features/share) and its RSS autodiscovery
  link (<link rel="alternate" type="application/rss+xml">). The API is
  stubbed: a channel the gateway answers gets its name and about; one it
  does not gets the neutral card. The feed link is there either way.
*/

const meta = (handle: string) => generateMetadata({ params: Promise.resolve({ handle }) });
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
const answer = (status: number, body: unknown) => {
  globalThis.fetch = (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
};

describe("channel page metadata", () => {
  test("names the channel and points feed readers at its feed.xml", async () => {
    answer(200, { data: { handle: "raghu.builds", name: "Raghu Builds", about: "Workshop videos", subscriber_count: 12 } });
    const m = await meta("raghu.builds");
    expect(m.title).toEqual({ absolute: "Raghu Builds (@raghu.builds)" });
    expect(m.description).toBe("Workshop videos");
    expect(m.alternates?.canonical).toBe("http://localhost:3000/posttube/channel/raghu.builds");
    expect(m.alternates?.types?.["application/rss+xml"]).toEqual([{ url: "/posttube/channel/raghu.builds/feed.xml", title: "RSS feed" }]);
    expect((m.openGraph as { type: string }).type).toBe("profile");
  });

  test("a channel the public may not see gets the neutral card, and still the feed link", async () => {
    // A refused answer is never read, whatever its body says.
    answer(404, { data: { handle: "raghu.builds", name: "Raghu Builds", about: "Workshop videos" } });
    const m = await meta("raghu.builds");
    expect(m.title).toEqual({ absolute: "Content on Clee Studio" });
    expect(m.description).toBe("Open the link to see it on Clee Studio.");
    expect(JSON.stringify(m)).not.toContain("Raghu Builds");
    expect(JSON.stringify(m)).not.toContain("Workshop");
    expect(m.alternates?.types?.["application/rss+xml"]).toEqual([{ url: "/posttube/channel/raghu.builds/feed.xml", title: "RSS feed" }]);
  });

  test("a leading @ is dropped, encoded or not", async () => {
    answer(404, {});
    for (const handle of ["@raghu.builds", "%40raghu.builds"]) {
      const m = await meta(handle);
      expect(m.alternates?.types?.["application/rss+xml"]).toEqual([{ url: "/posttube/channel/raghu.builds/feed.xml", title: "RSS feed" }]);
    }
  });

  test("a segment that is not a channel ref advertises no feed and asks the API nothing", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    for (const handle of ["..", "a%2Fb", "%3Cscript%3E"]) {
      const m = await meta(handle);
      expect(m.title).toEqual({ absolute: "Content on Clee Studio" });
      expect(m.alternates).toBeUndefined();
    }
    expect(calls).toBe(0);
  });
});

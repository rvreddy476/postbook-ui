import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";

import { middleware } from "../middleware";

/*
  The route gate, for the channel RSS feed: a podcast app has no session,
  so the feed and the channel page it links back to must pass signed out,
  while the rest of PostTube stays behind the gate.
*/

function visit(path: string, cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return middleware(new NextRequest(`https://cleestudio.com${path}`, { headers }));
}

const passes = (res: Response) => res.headers.get("x-middleware-next") === "1" && res.headers.get("location") === null;

describe("middleware: channel feed", () => {
  test("the feed passes signed out, narrowed or not", () => {
    expect(passes(visit("/posttube/channel/raghu.builds/feed.xml"))).toBe(true);
    expect(passes(visit("/posttube/channel/raghu.builds/feed.xml?category=podcasts"))).toBe(true);
    expect(passes(visit("/posttube/channel/%40raghu.builds/feed.xml"))).toBe(true);
    expect(passes(visit("/posttube/channel/22222222-2222-4222-8222-222222222222/feed.xml"))).toBe(true);
  });

  test("the channel page the feed links back to passes signed out", () => {
    expect(passes(visit("/posttube/channel/raghu.builds"))).toBe(true);
    expect(passes(visit("/posttube/channel/raghu.builds?tab=videos"))).toBe(true);
  });

  test("the rest of PostTube is still gated, with the way back kept", () => {
    for (const path of ["/posttube/hub", "/posttube/uploads", "/posttube/channels", "/settings/channel"]) {
      const res = visit(path);
      expect(passes(res)).toBe(false);
      expect(res.status).toBeGreaterThanOrEqual(300);
      expect(res.status).toBeLessThan(400);
      const to = new URL(res.headers.get("location") as string);
      expect(to.pathname).toBe("/login");
      expect(to.searchParams.get("next")).toBe(path);
      expect(res.headers.get("Cache-Control")).toBe("no-store, must-revalidate");
    }
  });

  test("a session passes everywhere", () => {
    expect(passes(visit("/posttube/hub", "pb_auth=1"))).toBe(true);
    expect(passes(visit("/posttube/channel/raghu.builds/feed.xml", "pb_auth=1"))).toBe(true);
  });
});

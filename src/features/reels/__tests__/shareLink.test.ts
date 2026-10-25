import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextRequest } from "next/server";

import { reelPermalink } from "@/features/reels/model";
import { middleware } from "@/middleware";

/*
  Audit T-07 (web): a shared reel link must open for someone who is not
  signed in. /reels/<id> only redirects to the /reels stage, which the route
  gate sends to /login. Share and Copy link now hand out the public post
  permalink, /post/<id>: /post/ is a public prefix, and post-service's
  direct read decides what a stranger sees (a public reel plays, a private
  one reads "Post not found").
*/

const visit = (path: string, cookie?: string) => {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return middleware(new NextRequest(`https://cleestudio.com${path}`, { headers }));
};
const passes = (res: Response) => res.headers.get("x-middleware-next") === "1" && res.headers.get("location") === null;

describe("reelPermalink", () => {
  test("is the public /post/<id> permalink on the given origin", () => {
    expect(reelPermalink("3f860f61-ddb6-4be6-98e6-3b892e9c584f", "https://cleestudio.com")).toBe(
      "https://cleestudio.com/post/3f860f61-ddb6-4be6-98e6-3b892e9c584f",
    );
  });

  test("never points at the gated reels stage", () => {
    expect(reelPermalink("abc", "https://cleestudio.com")).not.toContain("/reels");
    // Without an origin it uses the page's own (or none on the server).
    expect(reelPermalink("abc").endsWith("/post/abc")).toBe(true);
    expect(reelPermalink("abc")).not.toContain("/reels");
  });

  test("escapes the id so it cannot change the path", () => {
    expect(reelPermalink("a/../b?x", "https://cleestudio.com")).toBe("https://cleestudio.com/post/a%2F..%2Fb%3Fx");
  });

  test("the shared link opens signed out; the reels stage does not", () => {
    const url = new URL(reelPermalink("3f860f61-ddb6-4be6-98e6-3b892e9c584f", "https://cleestudio.com"));
    expect(passes(visit(url.pathname))).toBe(true);
    // The single-reel permalink (21 Oct 2026) reaches its page, which sends a
    // stranger to /post/<id> itself (app/reels/[id]); only a UUID gets through.
    expect(passes(visit("/reels/3f860f61-ddb6-4be6-98e6-3b892e9c584f"))).toBe(true);
    for (const gated of ["/reels", "/reels/create", "/reels/liked", "/reels/not-a-uuid"]) {
      const res = visit(gated);
      expect(passes(res)).toBe(false);
      expect(new URL(res.headers.get("location") as string).pathname).toBe("/login");
    }
  });

  test("the embed page under /post/ opens signed out too", () => {
    expect(passes(visit("/post/3f860f61-ddb6-4be6-98e6-3b892e9c584f/embed"))).toBe(true);
  });

  test("the reels stage's Share sheet and Copy link both use it", () => {
    const screen = readFileSync(resolve(import.meta.dir, "../components/ReelsScreen.tsx"), "utf8");
    // Copy link adds the share ref itself; the ShareSheet adds it to the url it is given.
    expect(screen).toContain("navigator.clipboard.writeText(withShareRef(reelPermalink(active.id)))");
    expect(screen).toContain("url={reelPermalink(active.id)}");
  });
});

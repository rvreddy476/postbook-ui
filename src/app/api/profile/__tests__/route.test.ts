import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { API_GATEWAY_URL } from "@/app/api/auth/_lib/session";
import { followButtonState } from "@/components/profile/profileParity";
import type { Relationship } from "@/types/profile";
import { GET } from "../[username]/route";

/*
  The profile BFF against a stubbed API gateway. Every call goes to the
  gateway carrying the caller's own bearer header and nothing that names a
  viewer: a client X-User-Id is ignored, the relationship read sends only
  other_id, and the gateway (which derives the viewer from the token) is
  what makes graph-service answer at all.
*/

const TARGET = "11111111-1111-4111-8111-111111111111";
const VICTIM = "99999999-9999-4999-8999-999999999999";

interface Call {
  url: string;
  init: RequestInit;
}

let calls: Call[] = [];
let route: (url: URL, init: RequestInit) => Response;
const realFetch = globalThis.fetch;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const params = (username: string) => ({ params: Promise.resolve({ username }) });
const headersOf = (init: RequestInit) => new Headers(init.headers);

const profileBody = { data: { user_id: TARGET, username: "raghu", display_name: "Raghuvaran Nalabolu" } };

/** A gateway that answers each route the BFF uses. */
function gateway(over: { relationship?: Record<string, unknown>; profileStatus?: (auth: string | null) => number } = {}) {
  return (url: URL, init: RequestInit) => {
    const auth = headersOf(init).get("authorization");
    const path = url.pathname;
    if (path === "/v1/profiles/by-username/raghu" || path === `/v1/profiles/${TARGET}`) {
      const status = over.profileStatus?.(auth) ?? 200;
      return status === 200 ? json(profileBody) : json({ error: { code: "NOT_FOUND" } }, status);
    }
    if (path === `/v1/profiles/${TARGET}/links`) return json({ data: [] });
    if (path === `/v1/graph/counts/${TARGET}`) {
      return json({ data: { follower_count: 7, following_count: 3, friend_count: 0 } });
    }
    if (path === `/v1/posts/by-author/${TARGET}/counts`) {
      return json({ data: { post: 2, reel: 1, video: 0, total: 3 } });
    }
    if (path === "/v1/graph/relationship") {
      if (!auth) return json({ error: { code: "UNAUTHORIZED" } }, 401);
      return json({ data: over.relationship ?? {} });
    }
    return json({ error: { code: "NOT_FOUND" } }, 404);
  };
}

beforeEach(() => {
  calls = [];
  route = gateway();
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url: String(input), init: init ?? {} });
    return route(url, init ?? {});
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const signedIn = (extra: Record<string, string> = {}) =>
  new Request("http://localhost/api/profile/raghu", {
    headers: { authorization: "Bearer caller.access.token", ...extra },
  });

describe("/api/profile/[username]", () => {
  test("every call goes to the gateway with only the caller's Authorization, never a client X-User-Id", async () => {
    const res = await GET(signedIn({ "x-user-id": VICTIM, cookie: "access_token=x" }) as never, params("raghu"));
    expect(res.status).toBe(200);

    expect(calls.length).toBe(5);
    for (const call of calls) {
      expect(call.url.startsWith(`${API_GATEWAY_URL}/v1/`)).toBe(true);
      const sent = headersOf(call.init);
      expect(sent.get("authorization")).toBe("Bearer caller.access.token");
      expect(sent.get("x-user-id")).toBeNull();
      expect(sent.get("cookie")).toBeNull();
      expect(sent.get("x-internal-service-key")).toBeNull();
      expect(call.url).not.toContain(VICTIM);
    }
    // The relationship names only the target; the token names the viewer.
    const rel = calls.find((c) => c.url.includes("/v1/graph/relationship"))!;
    const q = new URL(rel.url).searchParams;
    expect(q.get("other_id")).toBe(TARGET);
    expect(q.has("user_id")).toBe(false);
    // Counts carry the token too: post-service gates them on the viewer.
    const counts = calls.find((c) => c.url.includes("/counts") && c.url.includes("/v1/posts/"))!;
    expect(headersOf(counts.init).get("authorization")).toBe("Bearer caller.access.token");

    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  test("a follow the gateway reports maps to following=true, so the button reads Following", async () => {
    route = gateway({ relationship: { follows: true, followed_by: false, follow_request_status: "none" } });
    const res = await GET(signedIn() as never, params("raghu"));
    const body = (await res.json()) as {
      data: { relationship: Relationship; stats: Record<string, number>; profile: Record<string, unknown> };
    };

    expect(body.data.relationship.following).toBe(true);
    expect(followButtonState(null, body.data.relationship)).toBe("following");
    expect(body.data.profile.id).toBe(TARGET);
    expect(body.data.stats).toMatchObject({ follower_count: 7, following_count: 3, post: 2, reel: 1, total: 3 });
  });

  test("a pending request and a follow-back map to Requested and Follow back", async () => {
    route = gateway({ relationship: { follows: false, follow_request_status: "pending_sent" } });
    let body = (await (await GET(signedIn() as never, params("raghu"))).json()) as { data: { relationship: Relationship } };
    expect(followButtonState(null, body.data.relationship)).toBe("requested");

    route = gateway({ relationship: { follows: false, followed_by: true } });
    body = (await (await GET(signedIn() as never, params("raghu"))).json()) as { data: { relationship: Relationship } };
    expect(followButtonState(null, body.data.relationship)).toBe("follow_back");
  });

  test("signed out: no Authorization anywhere, no relationship call, a public cache header", async () => {
    const req = new Request("http://localhost/api/profile/raghu", { headers: { "x-user-id": VICTIM } });
    const res = await GET(req as never, params("raghu"));
    const body = (await res.json()) as { data: { relationship: Relationship | null } };

    expect(res.status).toBe(200);
    expect(body.data.relationship).toBeNull();
    expect(calls.some((c) => c.url.includes("/v1/graph/relationship"))).toBe(false);
    for (const call of calls) {
      expect(headersOf(call.init).get("authorization")).toBeNull();
      expect(headersOf(call.init).get("x-user-id")).toBeNull();
    }
    expect(res.headers.get("cache-control")).toContain("public");
  });

  test("blocked by the profile (gateway 404 for this viewer): a plain 404", async () => {
    // The account exists for a stranger, but the viewer has not blocked it:
    // the block runs the other way and stays a not-found.
    route = gateway({
      profileStatus: (auth) => (auth ? 404 : 200),
      relationship: { follows: false, viewer_blocked_target: false, target_blocked_viewer: true },
    });
    const res = await GET(signedIn() as never, params("raghu"));
    expect(res.status).toBe(404);
  });

  test("missing account: 404, signed in or out", async () => {
    route = gateway({ profileStatus: () => 404 });
    expect((await GET(signedIn() as never, params("raghu"))).status).toBe(404);
    expect((await GET(new Request("http://localhost/api/profile/raghu") as never, params("raghu"))).status).toBe(404);
  });

  test("blocked BY the viewer: the minimal blocked-by-you payload so the page can offer Unblock", async () => {
    route = gateway({
      profileStatus: (auth) => (auth ? 404 : 200),
      relationship: { viewer_blocked_target: true, target_blocked_viewer: false },
    });
    const res = await GET(signedIn() as never, params("raghu"));
    const body = (await res.json()) as { data: { relationship: Relationship; profile: Record<string, unknown> } };

    expect(res.status).toBe(200);
    expect(body.data.relationship.blocked).toBe(true);
    expect(body.data.profile).toEqual({
      id: TARGET, user_id: TARGET, username: "raghu", display_name: "Raghuvaran Nalabolu",
    });
    // The existence check is read signed out; only the relationship carries the token.
    const anonRead = calls.filter((c) => c.url.endsWith("/v1/profiles/by-username/raghu"));
    expect(anonRead.map((c) => headersOf(c.init).get("authorization"))).toEqual(["Bearer caller.access.token", null]);
  });

  test("a non-bearer Authorization is not forwarded", async () => {
    const req = new Request("http://localhost/api/profile/raghu", { headers: { authorization: "Basic abc" } });
    await GET(req as never, params("raghu"));
    for (const call of calls) expect(headersOf(call.init).get("authorization")).toBeNull();
  });
});

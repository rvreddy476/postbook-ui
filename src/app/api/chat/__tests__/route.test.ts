import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { DELETE, GET, POST } from "../[[...path]]/route";

/*
  The chat proxy against a stubbed chat-message-service: the caller's own
  access token is what crosses, nothing is minted, nothing names a user id,
  and the proxy works with no signing secret in its environment at all
  (security sweep 2026-10-21, #3).
*/

interface Call {
  url: string;
  init: RequestInit;
}

let calls: Call[] = [];
let upstream: () => Response = () => json({ ok: true });
const realFetch = globalThis.fetch;
const realError = console.error;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const params = (...path: string[]) => ({ params: Promise.resolve({ path }) });
const headersOf = (init: RequestInit) => new Headers(init.headers);

beforeEach(() => {
  calls = [];
  upstream = () => json({ ok: true });
  delete process.env.CHAT_PROXY_SIGNING_SECRET;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return upstream();
  }) as typeof fetch;
  console.error = () => {};
});

afterEach(() => {
  globalThis.fetch = realFetch;
  console.error = realError;
});

describe("/api/chat proxy", () => {
  test("forwards the caller's own bearer token unchanged and nothing that names a user", async () => {
    const req = new Request("http://localhost/api/chat/conversations?limit=20", {
      headers: {
        authorization: "Bearer caller.access.token",
        "x-user-id": "someone-else",
        "idempotency-key": "idem-1",
      },
    });
    const res = await GET(req, params("conversations"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://localhost:8092/v1/chat/conversations?limit=20");
    const sent = headersOf(calls[0].init);
    expect(sent.get("authorization")).toBe("Bearer caller.access.token");
    expect(sent.get("x-user-id")).toBeNull();
    expect(sent.get("idempotency-key")).toBe("idem-1");
    // No signing secret exists in this environment and none was needed.
    expect(process.env.CHAT_PROXY_SIGNING_SECRET).toBeUndefined();
  });

  test("refuses a request without a bearer token before touching the backend", async () => {
    for (const headers of [{}, { authorization: "Basic abc" }, { authorization: "Bearer" }]) {
      const res = await GET(new Request("http://localhost/api/chat/conversations", { headers }), params("conversations"));
      expect(res.status).toBe(401);
    }
    expect(calls).toHaveLength(0);
  });

  test("the retired token sub-route answers 410 and mints nothing", async () => {
    const req = new Request("http://localhost/api/chat/token?userId=victim", {
      headers: { authorization: "Bearer caller.access.token" },
    });
    const res = await GET(req, params("token"));

    expect(res.status).toBe(410);
    const body = (await res.json()) as { error: { code: string }; token?: unknown };
    expect(body.error.code).toBe("CHAT_PROXY_TOKEN_RETIRED");
    expect(body.token).toBeUndefined();
    expect(calls).toHaveLength(0);
  });

  test("passes the body through and relays the backend's status", async () => {
    upstream = () => json({ error: { code: "FORBIDDEN" } }, 403);
    const req = new Request("http://localhost/api/chat/conversations/c1/messages/m1", {
      method: "DELETE",
      headers: { authorization: "Bearer caller.access.token", "content-type": "application/json" },
      body: JSON.stringify({ bucket: "2026-10" }),
    });
    const res = await DELETE(req, params("conversations", "c1", "messages", "m1"));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: { code: "FORBIDDEN" } });
    expect(calls[0].init.method).toBe("DELETE");
    expect(calls[0].init.body).toBe(JSON.stringify({ bucket: "2026-10" }));
  });

  test("answers 502 when the chat service cannot be reached", async () => {
    upstream = () => {
      throw new Error("ECONNREFUSED");
    };
    const req = new Request("http://localhost/api/chat/conversations", {
      method: "POST",
      headers: { authorization: "Bearer caller.access.token" },
      body: "{}",
    });
    const res = await POST(req, params("conversations"));
    expect(res.status).toBe(502);
  });
});

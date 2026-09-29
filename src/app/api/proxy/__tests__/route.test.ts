import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import http from "node:http";
import net, { type AddressInfo } from "node:net";
import { NextRequest } from "next/server";

import { GET, POST } from "../[...path]/route";

/*
  The /v1 proxy against a stubbed gateway and a real local server standing in
  for storage: where a media redirect is fetched from, what it carries, and
  what the browser gets back when the upstream cannot be reached.
*/

const GATEWAY = process.env.API_GATEWAY_URL || "http://localhost:8080";
const PUBLIC_STORAGE = "https://media-dev.example.test";
const SIGNED = `${PUBLIC_STORAGE}/media/user/u1/m1/720p?X-Amz-Expires=300&X-Amz-Signature=abc`;
const FILE = Buffer.from("0123456789abcdefghijklmnopqrstuvwxyz");

interface Call {
  url: string;
  init: RequestInit;
}
interface Seen {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
}

let calls: Call[] = [];
let seen: Seen[] = [];
let storage: http.Server;
let storageOrigin = "";
const realFetch = globalThis.fetch;
const realLog = console.log;
let logged: string[] = [];
const ENV_KEYS = ["MEDIA_STORAGE_PUBLIC_ORIGIN", "MEDIA_STORAGE_INTERNAL_ORIGIN"] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeAll(async () => {
  storage = http.createServer((req, res) => {
    seen.push({ method: req.method ?? "", url: req.url ?? "", headers: req.headers });
    if (!(req.url ?? "").includes("X-Amz-Signature=abc")) {
      res.writeHead(403, { "content-type": "application/xml" });
      res.end("<Error><Code>SignatureDoesNotMatch</Code></Error>");
      return;
    }
    const range = /^bytes=(\d+)-(\d*)$/.exec(String(req.headers.range ?? ""));
    if (!range) {
      res.writeHead(200, { "content-type": "video/mp4", "content-length": String(FILE.length), "accept-ranges": "bytes" });
      res.end(req.method === "HEAD" ? undefined : FILE);
      return;
    }
    const start = Number(range[1]);
    const end = range[2] ? Number(range[2]) : FILE.length - 1;
    const part = FILE.subarray(start, end + 1);
    res.writeHead(206, { "content-type": "video/mp4", "content-length": String(part.length), "content-range": `bytes ${start}-${end}/${FILE.length}`, "accept-ranges": "bytes" });
    res.end(part);
  });
  await new Promise<void>((resolve) => storage.listen(0, "127.0.0.1", resolve));
  storageOrigin = `http://127.0.0.1:${(storage.address() as AddressInfo).port}`;
});

afterAll(() => {
  storage.close();
});

beforeEach(() => {
  calls = [];
  seen = [];
  logged = [];
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  process.env.MEDIA_STORAGE_PUBLIC_ORIGIN = PUBLIC_STORAGE;
  process.env.MEDIA_STORAGE_INTERNAL_ORIGIN = storageOrigin;
  console.log = (...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
  console.log = realLog;
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

function stubFetch(answer: (call: Call, n: number) => Response | Promise<Response>) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input instanceof Request ? input.url : input), init: init ?? {} };
    calls.push(call);
    return answer(call, calls.length);
  }) as typeof fetch;
}

const redirectTo = (location: string, status = 307) => new Response(null, { status, headers: { location } });
const sent = (call: Call) => new Headers(call.init.headers as HeadersInit);

function ask(path: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  const req = new NextRequest(`http://localhost:3000/v1/${path}`, { method: init.method ?? "GET", headers: init.headers, body: init.body });
  const handler = (init.method ?? "GET") === "POST" ? POST : GET;
  return handler(req, { params: Promise.resolve({ path: path.split("?")[0].split("/") }) });
}

const SESSION = { cookie: "access_token=secret", authorization: "Bearer secret", "x-csrf-token": "csrf" };

describe("a media redirect, with a storage route", () => {
  test("is fetched from storage on the private network, under the Host it was signed for", async () => {
    stubFetch(() => redirectTo(SIGNED));
    const res = await ask("media/m1/serve/720p", { headers: { ...SESSION, range: "bytes=10-19" } });

    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(`bytes 10-19/${FILE.length}`);
    expect(res.headers.get("content-type")).toBe("video/mp4");
    expect(await res.text()).toBe("abcdefghij");

    // One call to the gateway, by hand, with the session; none to the public storage host.
    expect(calls.length).toBe(1);
    expect(calls[0].url).toBe(`${GATEWAY}/v1/media/m1/serve/720p`);
    expect(calls[0].init.redirect).toBe("manual");
    expect(sent(calls[0]).get("cookie")).toBe(SESSION.cookie);

    expect(seen.length).toBe(1);
    expect(seen[0].url).toBe("/media/user/u1/m1/720p?X-Amz-Expires=300&X-Amz-Signature=abc");
    expect(seen[0].headers.host).toBe("media-dev.example.test");
    expect(seen[0].headers.range).toBe("bytes=10-19");
  });

  test("never takes the session to storage", async () => {
    stubFetch(() => redirectTo(SIGNED));
    await ask("media/m1/serve/720p", { headers: { ...SESSION, range: "bytes=0-" } });
    expect(seen[0].headers.cookie).toBeUndefined();
    expect(seen[0].headers.authorization).toBeUndefined();
    expect(seen[0].headers["x-csrf-token"]).toBeUndefined();
  });

  test("answers what storage answers when the link is refused", async () => {
    stubFetch(() => redirectTo(`${PUBLIC_STORAGE}/media/user/u1/m1/720p?X-Amz-Signature=tampered`));
    const res = await ask("media/m1/serve/720p");
    expect(res.status).toBe(403);
    expect(await res.text()).toContain("SignatureDoesNotMatch");
  });

  test("passes the browser's abort on, so an abandoned request stops pulling", async () => {
    stubFetch(() => redirectTo(SIGNED));
    await ask("media/m1/serve/720p");
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });

  test("leaves any other redirect to the network", async () => {
    stubFetch((_call, n) => (n === 1 ? redirectTo("https://cdn.example.test/file?sig=1") : new Response("bytes", { status: 200, headers: { "content-type": "video/mp4" } })));
    const res = await ask("media/m1/serve", { headers: { ...SESSION, range: "bytes=0-" } });
    expect(res.status).toBe(200);
    expect(seen.length).toBe(0);
    expect(calls[1].url).toBe("https://cdn.example.test/file?sig=1");
  });
});

describe("a media redirect, without a storage route", () => {
  beforeEach(() => {
    delete process.env.MEDIA_STORAGE_PUBLIC_ORIGIN;
    delete process.env.MEDIA_STORAGE_INTERNAL_ORIGIN;
  });

  test("is followed to the signed link with the byte range and no session", async () => {
    stubFetch((_call, n) => (n === 1 ? redirectTo(SIGNED) : new Response("part", { status: 206, headers: { "content-range": "bytes 0-3/36", "content-type": "video/mp4" } })));
    const res = await ask("media/m1/serve/720p", { headers: { ...SESSION, range: "bytes=0-3" } });

    expect(res.status).toBe(206);
    expect(await res.text()).toBe("part");
    expect(seen.length).toBe(0);
    expect(calls.length).toBe(2);
    expect(calls[1].url).toBe(SIGNED);
    expect(calls[1].init.redirect).toBe("manual");
    const hop = sent(calls[1]);
    expect(hop.get("range")).toBe("bytes=0-3");
    expect(hop.get("cookie")).toBeNull();
    expect(hop.get("authorization")).toBeNull();
    expect(hop.get("x-csrf-token")).toBeNull();
  });

  test("keeps the session on a redirect that stays on the gateway", async () => {
    stubFetch((_call, n) => (n === 1 ? redirectTo("/v1/media/m1/serve/480p") : new Response("ok", { status: 200 })));
    const res = await ask("media/m1/serve/720p", { headers: SESSION });
    expect(res.status).toBe(200);
    expect(calls[1].url).toBe(`${GATEWAY}/v1/media/m1/serve/480p`);
    expect(sent(calls[1]).get("cookie")).toBe(SESSION.cookie);
  });

  test("gives up on a redirect chain that does not end", async () => {
    stubFetch((call) => redirectTo(`${call.url.split("?")[0]}?again=1`));
    const res = await ask("media/m1/serve/720p");
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("UPSTREAM_UNREACHABLE");
  });
});

describe("an upstream that cannot be reached", () => {
  const down = () => Object.assign(new TypeError("fetch failed"), { cause: { code: "ETIMEDOUT" } });

  test("is tried once more for a read", async () => {
    stubFetch((_call, n) => {
      if (n === 1) throw down();
      return new Response(JSON.stringify({ data: { ok: true } }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const res = await ask("channels/raghu");
    expect(res.status).toBe(200);
    expect(calls.length).toBe(2);
  });

  test("answers 502 with a code, not a crash, and does not cache it", async () => {
    stubFetch(() => {
      throw down();
    });
    const res = await ask("media/m1/serve/720p?token=secret-token");
    expect(res.status).toBe(502);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("UPSTREAM_UNREACHABLE");
    expect(calls.length).toBe(2);
    expect(logged.join("\n")).toContain("ETIMEDOUT");
    expect(logged.join("\n")).not.toContain("secret-token");
  });

  test("never repeats a write", async () => {
    stubFetch(() => {
      throw down();
    });
    const res = await ask("posts", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "k1" }, body: "{}" });
    expect(res.status).toBe(502);
    expect(calls.length).toBe(1);
  });
});

describe("connecting", () => {
  test("gives each address at least a second: 250 ms failed every seek over a busy link", () => {
    expect(net.getDefaultAutoSelectFamilyAttemptTimeout()).toBeGreaterThanOrEqual(1000);
  });
});

describe("everything else", () => {
  test("a write is sent once with its headers and body, redirects followed by the network", async () => {
    stubFetch(() => new Response(JSON.stringify({ data: { id: "p1" } }), { status: 201, headers: { "content-type": "application/json" } }));
    const res = await ask("posts", { method: "POST", headers: { ...SESSION, "content-type": "application/json", "idempotency-key": "k1" }, body: '{"text":"hi"}' });
    expect(res.status).toBe(201);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.redirect).toBe("follow");
    expect(sent(calls[0]).get("idempotency-key")).toBe("k1");
    expect(new TextDecoder().decode(calls[0].init.body as ArrayBuffer)).toBe('{"text":"hi"}');
  });

  test("a refusal keeps its status and body", async () => {
    stubFetch(() => new Response(JSON.stringify({ error: { code: "NOT_FOUND" } }), { status: 404, headers: { "content-type": "application/json" } }));
    const res = await ask("media/m1/serve");
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  test("the query reaches the gateway", async () => {
    stubFetch(() => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
    await ask("feed/videos?category=music&limit=5");
    expect(calls[0].url).toBe(`${GATEWAY}/v1/feed/videos?category=music&limit=5`);
  });
});

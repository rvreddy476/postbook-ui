import { afterEach, describe, expect, test } from "bun:test";
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";

import api from "@/lib/api";
import { updatePost } from "../../hub/hubApi";
import { acceptCredit, appearancesPath, declineCredit, getAppearanceRows, getCreditRequests, getGenres, removeMyCredit } from "../creditsApi";
import { creditsEditPatch, EMPTY_CREDITS_FORM, type CreditsForm } from "../creditsModel";
import { contractFixture, requestKeysSent } from "./contracts";

/*
  The credits requests on the wire: each route, method and body, answered
  with the server's golden fixtures (./contracts) through a stub adapter.
*/

interface Seen {
  method: string;
  url: string;
  params: unknown;
  body: unknown;
}

const previous = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = previous;
});

/** Answers every request with `reply(config)`; records what was sent. */
function stub(reply: (config: InternalAxiosRequestConfig) => { status?: number; data: unknown }): Seen[] {
  const seen: Seen[] = [];
  const adapter: AxiosAdapter = async (config) => {
    seen.push({ method: (config.method ?? "get").toUpperCase(), url: config.url ?? "", params: config.params, body: typeof config.data === "string" ? JSON.parse(config.data) : config.data });
    const { status = 200, data } = reply(config);
    const response = { data, status, statusText: String(status), headers: {}, config };
    if (status >= 400) throw Object.assign(new Error(`Request failed with status code ${status}`), { response, config, isAxiosError: true });
    return response;
  };
  api.defaults.adapter = adapter;
  return seen;
}

describe("Appears in", () => {
  test("GET /v1/creators/:creatorId/appearances (post-service; /v1/users is user-service's)", async () => {
    const seen = stub(() => ({ data: contractFixture("appearances.json") }));
    const page = await getAppearanceRows("d3333333-3333-4333-8333-333333333333", "c1", 12);
    expect(seen).toEqual([{ method: "GET", url: "/v1/creators/d3333333-3333-4333-8333-333333333333/appearances", params: { limit: "12", cursor: "c1" }, body: undefined }]);
    expect(appearancesPath("a/b")).toBe("/v1/creators/a%2Fb/appearances");
    expect(page.items.map((r) => r.id)).toEqual(["d1111111-1111-4111-8111-111111111111"]);
    expect(page.nextCursor).toBe("MjAyNi0xMC0yM1QwOTozMDowMFp8ZDExMTExMTEtMTExMS00MTExLTgxMTEtMTExMTExMTExMTEx");
  });
});

describe("consent", () => {
  test("accept and decline POST and read the new status", async () => {
    const seen = stub((config) => ({ data: contractFixture(config.url!.endsWith("/accept") ? "accept_response.json" : "decline_response.json") }));
    expect(await acceptCredit("e2222222-2222-4222-8222-222222222222")).toBe("accepted");
    expect(await declineCredit("e2222222-2222-4222-8222-222222222222")).toBe("declined");
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual(["POST /v1/credits/e2222222-2222-4222-8222-222222222222/accept", "POST /v1/credits/e2222222-2222-4222-8222-222222222222/decline"]);
  });

  test("remove: DELETE answers unlinked; a repeat (404) is the same end state; other failures throw", async () => {
    let calls = 0;
    const seen = stub(() => (++calls === 1 ? { data: contractFixture("remove_response.json") } : { status: 404, data: contractFixture("error_credit_not_found.json") }));
    expect(await removeMyCredit("e1111111-1111-4111-8111-111111111111")).toBe("unlinked");
    expect(await removeMyCredit("e1111111-1111-4111-8111-111111111111")).toBe("unlinked");
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual(["DELETE /v1/credits/e1111111-1111-4111-8111-111111111111", "DELETE /v1/credits/e1111111-1111-4111-8111-111111111111"]);
    stub(() => ({ status: 500, data: { error: { code: "INTERNAL", message: "x" } } }));
    await expect(removeMyCredit("e1")).rejects.toThrow();
  });

  test("the requests list and the genres decode from their fixtures", async () => {
    stub((config) => ({ data: contractFixture(config.url === "/v1/posts/genres" ? "genres.json" : "requests.json") }));
    const page = await getCreditRequests();
    expect(page.items.map((r) => r.id)).toEqual(["e2222222-2222-4222-8222-222222222222"]);
    expect(page.nextCursor).not.toBeNull();
    expect((await getGenres()).map((g) => g.slug).slice(0, 3)).toEqual(["action", "comedy", "drama"]);
  });
});

describe("the Hub's PATCH", () => {
  const filled: CreditsForm = {
    credits: [
      { key: 1, name: "Asha Rao", role: "Director", user: { id: "d3333333-3333-4333-8333-333333333333", username: "asha", displayName: "Asha Rao", avatarUrl: "" }, status: null },
      { key: 2, name: "Meera Iyer", role: "Music", user: null, status: null },
    ],
    genres: ["drama", "romance"],
    releaseYear: "2024",
    productionHouse: "Blue Hour Films",
  };

  test("sends patch_request's body and reads the owner view back", async () => {
    const seen = stub(() => ({ data: contractFixture("post_detail_owner.json") }));
    const saved = await updatePost("d1111111-1111-4111-8111-111111111111", creditsEditPatch(EMPTY_CREDITS_FORM, filled));
    expect(seen[0].method).toBe("PATCH");
    expect(seen[0].url).toBe("/v1/posts/d1111111-1111-4111-8111-111111111111");
    expect(seen[0].body).toEqual(requestKeysSent(contractFixture("patch_request.json") as Record<string, unknown>));
    expect(saved!.credits.credits.map((c) => c.status)).toEqual(["accepted", "pending", "declined", "unlinked", "accepted"]);
  });

  test("the clear goes out as patch_clear_request: [] and null survive the wire", async () => {
    const seen = stub(() => ({ data: contractFixture("post_detail_owner.json") }));
    await updatePost("d1111111-1111-4111-8111-111111111111", creditsEditPatch(filled, EMPTY_CREDITS_FORM));
    expect(seen[0].body).toEqual(requestKeysSent(contractFixture("patch_clear_request.json") as Record<string, unknown>));
  });
});

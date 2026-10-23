import { describe, expect, test } from "bun:test";

import { mediaHref } from "@/features/reels/model";
import { normalizePostDetail, postPatchBody } from "../../hub/hubApi";
import { normalizeWatchDetail, type WatchPostRow } from "../../watch/watchApi";
import type { PostTubeVideo } from "../../types";
import {
  CREDITS_MAX,
  EMPTY_CREDITS_FORM,
  EMPTY_CREDITS_INFO,
  INITIAL_REQUESTS_STATE,
  categoryTakesCredits,
  creditHref,
  creditsCreateFields,
  creditsDraftFields,
  creditsEditPatch,
  creditsErrorProblem,
  creditsFormFrom,
  creditsLine,
  creditsMetaLine,
  creditsProblems,
  creditsToWire,
  decodeCredit,
  decodeCreditAnswer,
  decodeCreditRequestsPage,
  decodeCreditsInfo,
  decodeGenres,
  groupCredits,
  hasCreditsInfo,
  moveCredit,
  requestsReducer,
  roleGroupLabel,
  toggleGenre,
  type CreditDraft,
  type CreditsForm,
  type VideoCredit,
} from "../creditsModel";
import { contractData, contractFixture, creditKeysOf, requestKeysSent } from "./contracts";

/*
  The credits contract (23 Oct 2026) against the server's golden fixtures
  (./contracts, byte copies from post-service). Every response decodes
  strictly: the whole decoded value is pinned, and every key the server
  sends on a credit, a linked user, a request or a genre is one the
  decoder reads. Every request builder's body equals the server's request.
*/

const NOW = new Date("2026-10-23T12:00:00Z");

const ASHA = "d3333333-3333-4333-8333-333333333333";
const RAVI = "d4444444-4444-4444-8444-444444444444";
const DEV = "d5555555-5555-4555-8555-555555555555";
const KIRAN = "d2222222-2222-4222-8222-222222222222";
const AVATAR = mediaHref("/v1/media/d8888888-8888-4888-8888-888888888888/serve/avatar");

const ashaUser = { id: ASHA, username: "asha", displayName: "Asha Rao", avatarUrl: AVATAR };
const kiranUser = { id: KIRAN, username: "kiran", displayName: "Kiran", avatarUrl: "" };

const CREDIT_ROW_KEYS = ["id", "name", "role", "user_id", "user", "status"];
const USER_KEYS = ["id", "username", "display_name", "avatar_url"];

function creditRows(name: string): Record<string, unknown>[] {
  return contractData(name).credits as Record<string, unknown>[];
}

describe("decoding: the owner and viewer fixtures", () => {
  test("owner (post_detail_owner): every status; the accepted user shown; the tagged id kept for pending and declined", () => {
    expect(decodeCreditsInfo(contractData("post_detail_owner.json"))).toEqual({
      credits: [
        { id: "e1111111-1111-4111-8111-111111111111", name: "Asha Rao", role: "Director", status: "accepted", user: ashaUser, userId: ASHA },
        { id: "e2222222-2222-4222-8222-222222222222", name: "Ravi Kumar", role: "Actor", status: "pending", user: null, userId: RAVI },
        { id: "e3333333-3333-4333-8333-333333333333", name: "Dev Menon", role: "Cinematographer", status: "declined", user: null, userId: DEV },
        { id: "e4444444-4444-4444-8444-444444444444", name: "Meera Iyer", role: "Music", status: "unlinked", user: null, userId: null },
        { id: "e5555555-5555-4555-8555-555555555555", name: "Kiran (me)", role: "Producer", status: "accepted", user: kiranUser, userId: KIRAN },
      ],
      genres: ["drama", "romance"],
      releaseYear: 2024,
      productionHouse: "Blue Hour Films",
    });
  });

  test("viewer (post_detail_viewer): no status, the accepted credits' users only, never a tagged id", () => {
    expect(decodeCreditsInfo(contractData("post_detail_viewer.json"))).toEqual({
      credits: [
        { id: "e1111111-1111-4111-8111-111111111111", name: "Asha Rao", role: "Director", status: null, user: ashaUser, userId: null },
        { id: "e2222222-2222-4222-8222-222222222222", name: "Ravi Kumar", role: "Actor", status: null, user: null, userId: null },
        { id: "e3333333-3333-4333-8333-333333333333", name: "Dev Menon", role: "Cinematographer", status: null, user: null, userId: null },
        { id: "e4444444-4444-4444-8444-444444444444", name: "Meera Iyer", role: "Music", status: null, user: null, userId: null },
        { id: "e5555555-5555-4555-8555-555555555555", name: "Kiran (me)", role: "Producer", status: null, user: kiranUser, userId: null },
      ],
      genres: ["drama", "romance"],
      releaseYear: 2024,
      productionHouse: "Blue Hour Films",
    });
  });

  test("the create answer (create_response) carries the owner view of the saved list", () => {
    const info = decodeCreditsInfo(contractData("create_response.json"));
    expect(info.credits.map((c) => [c.name, c.status, c.userId])).toEqual([
      ["Asha Rao", "accepted", ASHA],
      ["Ravi Kumar", "pending", RAVI],
      ["Dev Menon", "declined", DEV],
      ["Meera Iyer", "unlinked", null],
    ]);
    expect(info.credits[0].user).toEqual(ashaUser);
  });

  test("strict: every key the server sends on a credit and a linked user is one the decoder reads", () => {
    for (const name of ["post_detail_owner.json", "post_detail_viewer.json", "create_response.json"]) {
      for (const row of creditRows(name)) {
        for (const key of Object.keys(row)) expect(CREDIT_ROW_KEYS).toContain(key);
        if (row.user) for (const key of Object.keys(row.user as object)) expect(USER_KEYS).toContain(key);
      }
    }
    // The privacy line the fixtures draw: a viewer gets no status and no user_id; the owner gets user_id on every tag.
    for (const row of creditRows("post_detail_viewer.json")) {
      expect("status" in row).toBe(false);
      expect("user_id" in row).toBe(false);
    }
    expect(creditRows("post_detail_owner.json").filter((r) => r.status !== "unlinked").every((r) => typeof r.user_id === "string")).toBe(true);
  });

  test("a pending or declined credit never links, even if the server slipped a user in", () => {
    const user = { id: "u1", username: "ravi", display_name: "Ravi" };
    for (const status of ["pending", "declined", "unlinked"]) {
      const c = decodeCredit({ id: "c1", name: "Ravi", role: "Actor", status, user })!;
      expect(c.user).toBeNull();
      expect(creditHref(c)).toBe("/posttube/search?q=Ravi");
    }
    // A viewer row with a stray user_id: dropped (only the owner may see it).
    expect(decodeCredit({ id: "c1", name: "Ravi", role: "Actor", user_id: "u1" })!.userId).toBeNull();
  });

  test("Go zero values read as absent: null / [] / \"\" / 0, and rows without a name or role; at most 30", () => {
    expect(decodeCreditsInfo({ credits: null, genres: null, release_year: 0, production_house: "" })).toEqual(EMPTY_CREDITS_INFO);
    expect(decodeCreditsInfo({ credits: [], genres: [], production_house: "  " })).toEqual(EMPTY_CREDITS_INFO);
    expect(hasCreditsInfo(decodeCreditsInfo({ credits: [], genres: [], release_year: 0, production_house: "" }))).toBe(false);
    expect(decodeCredit({ name: " ", role: "Actor" })).toBeNull();
    expect(decodeCredit({ name: "A", role: "" })).toBeNull();
    expect(decodeCredit({ id: "c", name: "A", role: "Actor", status: "pending", user_id: "" })!.userId).toBeNull();
    expect(decodeCreditsInfo({ id: "p" })).toEqual(EMPTY_CREDITS_INFO);
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, name: `N${i}`, role: "Actor" }));
    expect(decodeCreditsInfo({ credits: many }).credits).toHaveLength(CREDITS_MAX);
    expect(decodeCreditsInfo({ release_year: 1850, genres: ["Drama", "drama", 3] })).toMatchObject({ releaseYear: null, genres: ["drama"] });
  });

  test("list rows (appearances) carry genres, year and house but no credits", () => {
    const rows = (contractFixture("appearances.json") as { data: Record<string, unknown>[] }).data;
    expect(rows).toHaveLength(1);
    expect("credits" in rows[0]).toBe(false);
    expect(decodeCreditsInfo(rows[0])).toEqual({ credits: [], genres: ["drama", "romance"], releaseYear: 2024, productionHouse: "Blue Hour Films" });
  });

  test("links: an accepted account opens its channel, a plain name searches", () => {
    const info = decodeCreditsInfo(contractData("post_detail_viewer.json"));
    expect(info.credits.map(creditHref)).toEqual([
      "/posttube/channel/asha",
      "/posttube/search?q=Ravi%20Kumar",
      "/posttube/search?q=Dev%20Menon",
      "/posttube/search?q=Meera%20Iyer",
      "/posttube/channel/kiran",
    ]);
  });

  test("genres (genres.json): the server's twenty, in order; duplicates dropped, a missing label from the slug", () => {
    const env = contractFixture("genres.json") as { data: { slug: string; label: string }[] };
    for (const g of env.data) expect(Object.keys(g).sort()).toEqual(["label", "slug"]);
    expect(decodeGenres(env.data)).toEqual(env.data);
    expect(decodeGenres(env.data)).toHaveLength(20);
    expect(decodeGenres([{ slug: "sci-fi" }, { slug: "sci-fi", label: "x" }, { label: "no slug" }])).toEqual([{ slug: "sci-fi", label: "Sci fi" }]);
  });

  test("consent answers: accept / decline / remove decode their status", () => {
    expect(decodeCreditAnswer(contractFixture("accept_response.json"))).toBe("accepted");
    expect(decodeCreditAnswer(contractFixture("decline_response.json"))).toBe("declined");
    expect(decodeCreditAnswer(contractFixture("remove_response.json"))).toBe("unlinked");
    expect(decodeCreditAnswer({ data: { status: "gone" } })).toBeNull();
    expect(decodeCreditAnswer(null)).toBeNull();
  });
});

describe("the surfaces read credits from the post detail", () => {
  test("the Hub's owner detail carries the credits with their status", () => {
    const d = normalizePostDetail(contractData("post_detail_owner.json"))!;
    expect(d.credits.credits.map((c) => c.status)).toEqual(["accepted", "pending", "declined", "unlinked", "accepted"]);
    expect(d.credits.productionHouse).toBe("Blue Hour Films");
  });

  test("the watch page's detail (GET /v1/posts/:id) carries them; a list row gives none", () => {
    const video = { like_count: 0 } as PostTubeVideo;
    const watched = normalizeWatchDetail(contractData("post_detail_viewer.json") as unknown as WatchPostRow, video);
    expect(watched.credits).toEqual(decodeCreditsInfo(contractData("post_detail_viewer.json")));
    const row = (contractFixture("appearances.json") as { data: WatchPostRow[] }).data[0];
    expect(normalizeWatchDetail(row, video).credits.credits).toEqual([]);
  });
});

describe("role grouping and labels", () => {
  const credit = (name: string, role: string): VideoCredit => ({ id: name, name, role, status: null, user: null, userId: null });

  test("Cast for actors, the role as written otherwise, in the order first seen", () => {
    const credits = [credit("A", "Actor"), credit("D", "Director"), credit("B", "actor"), credit("C", "Actress"), credit("E", "director")];
    expect(groupCredits(credits).map((g) => [g.label, g.credits.map((c) => c.name)])).toEqual([
      ["Cast", ["A", "B", "C"]],
      ["Director", ["D", "E"]],
    ]);
    expect(creditsLine(credits)).toBe("Cast: A, B, C · Director: D, E");
  });

  test("the fixture's line", () => {
    const info = decodeCreditsInfo(contractData("post_detail_viewer.json"));
    expect(creditsLine(info.credits)).toBe("Director: Asha Rao · Cast: Ravi Kumar · Cinematographer: Dev Menon · Music: Meera Iyer · Producer: Kiran (me)");
    expect(roleGroupLabel(" Cinematographer ")).toBe("Cinematographer");
  });

  test("meta line: genres (labels when known), year, production house", () => {
    const info = decodeCreditsInfo(contractData("post_detail_owner.json"));
    expect(creditsMetaLine(info, decodeGenres((contractFixture("genres.json") as { data: unknown }).data))).toBe("Drama, Romance · 2024 · Blue Hour Films");
    expect(creditsMetaLine(EMPTY_CREDITS_INFO)).toBe("");
  });
});

describe("the editor form", () => {
  const row = (key: number, name: string, role: string, user: CreditDraft["user"] = null): CreditDraft => ({ key, name, role, user, status: null });
  const form = (credits: CreditDraft[], extra: Partial<CreditsForm> = {}): CreditsForm => ({ ...EMPTY_CREDITS_FORM, credits, ...extra });
  const asha = { id: ASHA, username: "asha", displayName: "Asha Rao", avatarUrl: "" };
  const ravi = { id: RAVI, username: "ravi", displayName: "Ravi Kumar", avatarUrl: "" };

  test("validation: names, roles, 30 max, 3 genres, year range, production house length", () => {
    expect(creditsProblems(form([row(1, "A", "Actor")]), NOW)).toEqual([]);
    const fields = creditsProblems(form([row(1, "", "Actor"), row(2, "B", ""), row(3, "x".repeat(81), "y".repeat(41)), row(4, "Tab\there", "Actor")]), NOW).map((p) => p.field);
    expect(fields).toEqual(["credit-1-name", "credit-2-role", "credit-3-name", "credit-3-role", "credit-4-name"]);
    expect(creditsProblems(form(Array.from({ length: 31 }, (_, i) => row(i, "N", "R"))), NOW).map((p) => p.field)).toContain("credits");
    expect(creditsProblems(form([], { genres: ["a", "b", "c", "d"] }), NOW).map((p) => p.field)).toEqual(["genres"]);
    expect(creditsProblems(form([], { releaseYear: "1899" }), NOW).map((p) => p.field)).toEqual(["releaseYear"]);
    expect(creditsProblems(form([], { releaseYear: "2027" }), NOW)).toEqual([]);
    expect(creditsProblems(form([], { releaseYear: "2028" }), NOW).map((p) => p.field)).toEqual(["releaseYear"]);
    expect(creditsProblems(form([], { productionHouse: "p".repeat(101) }), NOW).map((p) => p.field)).toEqual(["productionHouse"]);
  });

  test("wire: trimmed, in order, user_id only when linked, one tag per (account, role)", () => {
    const wire = creditsToWire([row(1, " Asha ", " Director ", asha), row(2, "Ravi", "Actor"), row(3, "Asha", "director", asha), row(4, "Asha", "Writer", asha), row(5, "", "")]);
    expect(wire).toEqual([
      { name: "Asha", role: "Director", user_id: ASHA },
      { name: "Ravi", role: "Actor" },
      { name: "Asha", role: "director" },
      { name: "Asha", role: "Writer", user_id: ASHA },
    ]);
  });

  test("reorder and genre toggling", () => {
    expect(moveCredit(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveCredit(["a", "b", "c"], 2, -5)).toEqual(["c", "a", "b"]);
    expect(moveCredit(["a", "b"], 5, 0)).toEqual(["a", "b"]);
    expect(toggleGenre(["a", "b", "c"], "d")).toEqual(["a", "b", "c"]);
    expect(toggleGenre(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  test("the owner detail prefills the form, keeping every tag (pending, declined, self) and its status", () => {
    const f = creditsFormFrom(decodeCreditsInfo(contractData("post_detail_owner.json")));
    expect(f.credits.map((c) => [c.name, c.user?.id ?? null, c.status])).toEqual([
      ["Asha Rao", ASHA, "accepted"],
      ["Ravi Kumar", RAVI, "pending"],
      ["Dev Menon", DEV, "declined"],
      ["Meera Iyer", null, "unlinked"],
      ["Kiran (me)", KIRAN, "accepted"],
    ]);
    expect(f).toMatchObject({ genres: ["drama", "romance"], releaseYear: "2024", productionHouse: "Blue Hour Films" });
  });

  describe("request builders = the server's requests", () => {
    const film = { category: "film-animation", longVideo: true };
    // The forms that stand for each fixture.
    const created = form([row(1, "Asha Rao", "Director", asha), row(2, "Ravi Kumar", "Actor", ravi), row(3, "Meera Iyer", "Music")], {
      genres: ["drama", "romance"],
      releaseYear: "2024",
      productionHouse: " Blue Hour Films ",
    });
    const edited = form([row(1, "Asha Rao", "Director", asha), row(3, "Meera Iyer", "Music")], { genres: ["drama", "romance"], releaseYear: "2024", productionHouse: "Blue Hour Films" });
    const drafted = { ...edited, genres: ["drama"] };

    test("which topics take credits", () => {
      for (const slug of ["film-animation", "entertainment", "comedy", "music", "documentary", "podcasts"]) expect(categoryTakesCredits(slug)).toBe(true);
      for (const slug of ["education", "gaming", "", "news"]) expect(categoryTakesCredits(slug)).toBe(false);
    });

    test("create (create_request): the four credit keys, exactly", () => {
      expect(creditsCreateFields(created, film, NOW)).toEqual(creditKeysOf(contractFixture("create_request.json") as Record<string, unknown>));
      expect(creditsCreateFields(created, { category: "education", longVideo: true }, NOW)).toEqual({});
      expect(creditsCreateFields(created, { category: "film-animation", longVideo: false }, NOW)).toEqual({});
      expect(creditsCreateFields(EMPTY_CREDITS_FORM, { category: "music", longVideo: true }, NOW)).toEqual({});
    });

    test("post draft (post_draft_request): the payload's credit keys are the create fields", () => {
      const payload = (contractFixture("post_draft_request.json") as { payload: Record<string, unknown> }).payload;
      expect(creditsCreateFields(drafted, film, NOW)).toEqual(creditKeysOf(payload));
    });

    test("PATCH (patch_request): the body the Hub sends, null pointers aside, is the server's", () => {
      const body = postPatchBody(creditsEditPatch(EMPTY_CREDITS_FORM, edited, NOW));
      expect(body).toEqual(requestKeysSent(contractFixture("patch_request.json") as Record<string, unknown>));
    });

    test("PATCH clear (patch_clear_request): [] for the lists, null for the year and the house", () => {
      const body = postPatchBody(creditsEditPatch(edited, EMPTY_CREDITS_FORM, NOW));
      expect(body).toEqual(requestKeysSent(contractFixture("patch_clear_request.json") as Record<string, unknown>));
      expect(body).toEqual({ credits: [], genres: [], release_year: null, production_house: null });
    });

    test("PATCH: only what moved; omitted = unchanged; a kept pending tag goes back with its user_id", () => {
      expect(creditsEditPatch(edited, { ...edited }, NOW)).toEqual({});
      const reordered = { ...edited, credits: [edited.credits[1], edited.credits[0]] };
      expect(creditsEditPatch(edited, reordered, NOW)).toEqual({
        credits: [
          { name: "Meera Iyer", role: "Music" },
          { name: "Asha Rao", role: "Director", user_id: ASHA },
        ],
      });
      expect(creditsEditPatch(edited, { ...edited, releaseYear: "" }, NOW)).toEqual({ release_year: null });
      expect(creditsEditPatch(edited, { ...edited, productionHouse: "  " }, NOW)).toEqual({ production_house: null });
      expect(creditsEditPatch(edited, { ...edited, genres: [] }, NOW)).toEqual({ genres: [] });
      const saved = creditsFormFrom(decodeCreditsInfo(contractData("post_detail_owner.json")));
      const patch = creditsEditPatch(saved, { ...saved, credits: saved.credits.slice(0, 3) }, NOW);
      expect(patch.credits).toEqual([
        { name: "Asha Rao", role: "Director", user_id: ASHA },
        { name: "Ravi Kumar", role: "Actor", user_id: RAVI },
        { name: "Dev Menon", role: "Cinematographer", user_id: DEV },
      ]);
    });

    test("reel draft (reel_draft_patch_request): content_type plus the four credit keys, exactly", () => {
      expect({ content_type: "long_video", ...creditsDraftFields(drafted, film, NOW) }).toEqual(contractFixture("reel_draft_patch_request.json") as Record<string, unknown>);
    });

    test("reel draft: all four keys replace; blanks clear; a topic without credits clears; a short sends nothing", () => {
      expect(creditsDraftFields(form([]), { category: "music", longVideo: true }, NOW)).toEqual({ credits: [], genres: [], release_year: null, production_house: null });
      expect(creditsDraftFields(drafted, { category: "education", longVideo: true }, NOW)).toEqual({ credits: [], genres: [], release_year: null, production_house: null });
      expect(creditsDraftFields(drafted, { category: "music", longVideo: false }, NOW)).toEqual({});
    });

    test("the reel draft's answer (reel_draft_response) reads back with the same decoder", () => {
      const info = decodeCreditsInfo(contractData("reel_draft_response.json"));
      expect(info.credits.map((c) => [c.name, c.role])).toEqual([
        ["Asha Rao", "Director"],
        ["Meera Iyer", "Music"],
      ]);
      expect(info).toMatchObject({ genres: ["drama"], releaseYear: 2024, productionHouse: "Blue Hour Films" });
    });
  });
});

describe("server refusals", () => {
  test("each credits code is a field and a sentence; never the code or the server's message", () => {
    const cases: [string, string][] = [
      ["CREDITS_NOT_ALLOWED", "credits"],
      ["TOO_MANY_CREDITS", "credits"],
      ["INVALID_CREDIT", "credits"],
      ["INVALID_GENRE", "genres"],
      ["INVALID_RELEASE_YEAR", "releaseYear"],
      ["INVALID_PRODUCTION_HOUSE", "productionHouse"],
    ];
    for (const [code, field] of cases) {
      const p = creditsErrorProblem(code)!;
      expect(p.field).toBe(field);
      expect(p.message).not.toContain(code);
      expect(p.message).not.toContain("_");
    }
    const notAllowed = (contractFixture("error_credits_not_allowed.json") as { error: { code: string; message: string } }).error;
    expect(creditsErrorProblem(notAllowed.code)!.message).not.toBe(notAllowed.message);
    const genre = (contractFixture("error_invalid_genre.json") as { error: { code: string; message: string } }).error;
    expect(creditsErrorProblem(genre.code)).toEqual({ field: "genres", message: "Pick up to 3 genres from the list." });
    expect(creditsErrorProblem((contractFixture("error_credit_not_found.json") as { error: { code: string } }).error.code)).toBeNull();
    expect(creditsErrorProblem(null)).toBeNull();
  });
});

describe("credit requests (requests.json)", () => {
  const page = decodeCreditRequestsPage(contractFixture("requests.json"));

  test("decodes the list and the cursor, strictly", () => {
    const raw = (contractFixture("requests.json") as { data: Record<string, Record<string, unknown>>[] }).data[0];
    expect(Object.keys(raw).sort()).toEqual(["created_at", "from", "id", "name", "post", "role"]);
    expect(Object.keys(raw.post).sort()).toEqual(["channel_name", "cover_url", "id", "title"]);
    for (const key of Object.keys(raw.from)) expect(USER_KEYS).toContain(key);
    expect(page).toEqual({
      nextCursor: "MjAyNi0xMC0yM1QwOTozMDowMFp8ZTIyMjIyMjItMjIyMi00MjIyLTgyMjItMjIyMjIyMjIyMjIy",
      items: [
        {
          id: "e2222222-2222-4222-8222-222222222222",
          role: "Actor",
          name: "Ravi Kumar",
          post: { id: "d1111111-1111-4111-8111-111111111111", title: "Monsoon Letters", coverUrl: mediaHref("/v1/media/d7777777-7777-4777-8777-777777777777/serve"), channelName: "Blue Hour Films" },
          from: { id: KIRAN, username: "kiran", displayName: "Kiran", avatarUrl: AVATAR },
          createdAt: "2026-10-23T09:30:00Z",
        },
      ],
    });
  });

  test("a row without a title reads Untitled; a broken row is dropped", () => {
    const raw = (contractFixture("requests.json") as { data: Record<string, unknown>[] }).data[0];
    const untitled = decodeCreditRequestsPage({ data: [{ ...raw, post: { ...(raw.post as object), title: "" }, from: { id: "x", username: "tunes", display_name: "" } }] });
    expect(untitled.items[0].post.title).toBe("Untitled");
    expect(untitled.items[0].from.displayName).toBe("tunes");
    expect(decodeCreditRequestsPage({ data: [{ id: "x" }, null] })).toEqual({ items: [], nextCursor: null });
  });

  test("accept / decline are optimistic and roll back to the same place on failure", () => {
    const first = page.items[0];
    const second = { ...first, id: "e9999999-9999-4999-8999-999999999999", role: "Singer" };
    const items = [first, second];
    let s = requestsReducer(INITIAL_REQUESTS_STATE, { type: "loaded", items });
    s = requestsReducer(s, { type: "answer", id: first.id, answer: "accept" });
    expect(s.items.map((r) => r.id)).toEqual([second.id]);
    expect(s.inFlight[first.id]).toMatchObject({ index: 0, answer: "accept" });
    // A second press on the same row does nothing while it is in flight.
    expect(requestsReducer(s, { type: "answer", id: first.id, answer: "decline" })).toBe(s);
    // A refetch that still carries the row does not bring it back.
    s = requestsReducer(s, { type: "loaded", items });
    expect(s.items.map((r) => r.id)).toEqual([second.id]);
    // Failure: back at index 0, with the reason.
    const failed = requestsReducer(s, { type: "failed", id: first.id, message: "nope" });
    expect(failed.items.map((r) => r.id)).toEqual([first.id, second.id]);
    expect(failed.error).toBe("nope");
    expect(failed.inFlight).toEqual({});
    // Success: stays gone.
    const done = requestsReducer(requestsReducer(s, { type: "answer", id: second.id, answer: "decline" }), { type: "settled", id: first.id });
    expect(done.items).toEqual([]);
    expect(Object.keys(done.inFlight)).toEqual([second.id]);
    // The next answer clears an old error.
    const cleared = requestsReducer(failed, { type: "answer", id: first.id, answer: "decline" });
    expect(cleared.error).toBeNull();
  });
});

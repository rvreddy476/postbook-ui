import { afterEach, describe, expect, spyOn, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import api from "@/lib/api";
import { fetchTrendingSounds } from "@/features/reels/data/soundsApi";
import { mediaHref } from "@/features/reels/model";
import { soundPageTrending, toSoundInfo, toSoundReelsPage, toSoundTrending, trendingBadges } from "@/features/reels/sounds";
import {
  mergeTrendingPages,
  toTrendingSound,
  toTrendingSoundsPage,
  trendingEmptyText,
  trendingFilterFromSearch,
  trendingSoundsHref,
  trendingSoundsRequest,
  trendingUsesLabel,
  TRENDING_FILTERS,
} from "@/features/reels/trendingSounds";
import { libraryRowsBesideShelf, rowFromLibrary, rowFromSound, rowFromTrending } from "@/features/upload/soundPicker";
import { SoundPickerRows, TrendingShelf } from "@/features/upload/components/SoundPickerSheet";
import { normalizeLibrarySound } from "@/features/posttube/hub/hubApi";

import { SoundPageHeader } from "../components/SoundPageHeader";
import { TrendingSoundsList, previewStateOf } from "../components/TrendingSoundsList";

const soundRow = JSON.parse(readFileSync(resolve(import.meta.dir, "contracts/sounds/sound.json"), "utf8")) as Record<string, unknown>;
const bySound = JSON.parse(readFileSync(resolve(import.meta.dir, "contracts/sounds/by_sound.json"), "utf8")) as Record<string, unknown>;
const noop = () => {};

/** One entry as the pinned contract spells it. */
const entry = (over: Record<string, unknown> = {}, soundOver: Record<string, unknown> = {}) => ({
  rank: 1,
  sound: { ...soundRow, ...soundOver },
  uses_7d: 42,
  uses_prev_7d: 10,
  rising: true,
  ...over,
});

const spies: { mockRestore: () => void }[] = [];
afterEach(() => {
  while (spies.length) spies.pop()!.mockRestore();
});

function spyGet(body: unknown) {
  const calls: { url: string; config: { params?: Record<string, string> } }[] = [];
  const s = spyOn(api, "get").mockImplementation(((url: string, config: { params?: Record<string, string> }) => {
    calls.push({ url, config });
    return Promise.resolve({ data: body });
  }) as never);
  spies.push(s);
  return calls;
}

/* ── the decoder ───────────────────────────────────────────── */

describe("toTrendingSound", () => {
  test("the pinned entry → rank, the sound as the sound page holds it, this week's uses, rising", () => {
    const t = toTrendingSound(entry({ rank: 3 }), 9)!;
    expect(t.rank).toBe(3);
    expect(t.sound).toEqual(toSoundInfo(soundRow)!);
    expect(t.uses7d).toBe(42);
    expect(t.usesPrev7d).toBe(10);
    expect(t.rising).toBe(true);
    expect(t.coverUrl).toBeNull();
  });

  test("rising only when it is exactly true", () => {
    for (const rising of [false, "true", 1, null, undefined]) expect(toTrendingSound(entry({ rising }), 1)!.rising).toBe(false);
  });

  test("a missing or unusable rank falls back to the row's place", () => {
    for (const rank of [undefined, null, 0, -2, 1.5, "3", Number.NaN]) expect(toTrendingSound(entry({ rank }), 7)!.rank).toBe(7);
    expect(toTrendingSound(entry({ rank: undefined }), 0)!.rank).toBe(1);
  });

  test("uses: whole, never negative, 0 when unsaid", () => {
    const t = toTrendingSound(entry({ uses_7d: 12.9, uses_prev_7d: -4 }), 1)!;
    expect(t.uses7d).toBe(12);
    expect(t.usesPrev7d).toBe(0);
    expect(toTrendingSound(entry({ uses_7d: "42", uses_prev_7d: undefined }), 1)!.uses7d).toBe(0);
    expect(toTrendingSound(entry({ uses_7d: Number.POSITIVE_INFINITY }), 1)!.uses7d).toBe(0);
  });

  test("no sound, a sound with no id, or one not ready to play: no row", () => {
    expect(toTrendingSound(null, 1)).toBeNull();
    expect(toTrendingSound([], 1)).toBeNull();
    expect(toTrendingSound("x", 1)).toBeNull();
    expect(toTrendingSound({ rank: 1, uses_7d: 3 }, 1)).toBeNull();
    expect(toTrendingSound(entry({}, { id: "" }), 1)).toBeNull();
    expect(toTrendingSound(entry({}, { status: "processing" }), 1)).toBeNull();
    expect(toTrendingSound(entry({ sound: "s-1" }), 1)).toBeNull();
  });

  test("an older bare sound row still reads: ranked by place, no uses, not rising", () => {
    const t = toTrendingSound({ ...soundRow, rising: true, uses_7d: 99 }, 4)!;
    expect(t.sound.id).toBe(soundRow.id as string);
    expect(t.rank).toBe(4);
    expect(t.uses7d).toBe(0);
    expect(t.rising).toBe(false);
  });

  test("a cover only from a site path, an https URL or a media id; never another scheme", () => {
    expect(toTrendingSound(entry({}, { cover_url: "https://cdn.example/c.jpg" }), 1)!.coverUrl).toBe("https://cdn.example/c.jpg");
    expect(toTrendingSound(entry({}, { cover_url: "/v1/media/m1/serve" }), 1)!.coverUrl).toBe(mediaHref("/v1/media/m1/serve"));
    expect(toTrendingSound(entry({}, { thumbnail_url: "/img/c.png" }), 1)!.coverUrl).toBe("/img/c.png");
    expect(toTrendingSound(entry({}, { cover_media_id: "m 2" }), 1)!.coverUrl).toBe(mediaHref("/v1/media/m%202/serve"));
    for (const bad of ["javascript:alert(1)", "http://x/c.jpg", "//evil/c.jpg", "data:image/png;base64,AA"]) {
      expect(toTrendingSound(entry({}, { cover_url: bad }), 1)!.coverUrl).toBeNull();
    }
  });
});

describe("toTrendingSoundsPage", () => {
  test("the pinned page: rows in order, the cursor, when it was computed", () => {
    const page = toTrendingSoundsPage(
      [entry({ rank: 1 }, { id: "a" }), entry({ rank: 2, rising: false }, { id: "b" })],
      { next_cursor: "c2", updated_at: "2026-10-24T10:15:00Z" },
    );
    expect(page.items.map((i) => [i.rank, i.sound.id, i.rising])).toEqual([[1, "a", true], [2, "b", false]]);
    expect(page.nextCursor).toBe("c2");
    expect(page.updatedAt).toBe("2026-10-24T10:15:00Z");
  });

  test("a sound listed twice is shown once; unusable rows are dropped", () => {
    const page = toTrendingSoundsPage([entry({ rank: 1 }, { id: "a" }), null, { rank: 2 }, entry({ rank: 3 }, { id: "a" }), entry({ rank: 4 }, { id: "d" })]);
    expect(page.items.map((i) => [i.rank, i.sound.id])).toEqual([[1, "a"], [4, "d"]]);
  });

  test("an empty list, null (a Go nil slice) or nonsense is an empty page, not an error", () => {
    for (const data of [[], null, undefined, {}, "x", 4]) {
      const page = toTrendingSoundsPage(data, null);
      expect(page.items).toEqual([]);
      expect(page.nextCursor).toBeUndefined();
      expect(page.updatedAt).toBeNull();
    }
  });

  test("an older {tracks} answer reads, ranked by place", () => {
    const page = toTrendingSoundsPage({ tracks: [{ ...soundRow, id: "x" }, { ...soundRow, id: "y" }] });
    expect(page.items.map((i) => [i.rank, i.sound.id])).toEqual([[1, "x"], [2, "y"]]);
  });

  test("the Rising tab keeps rising rows only, even when a server ignores the filter", () => {
    const rows = [entry({ rank: 1, rising: false }, { id: "a" }), entry({ rank: 2 }, { id: "b" })];
    expect(toTrendingSoundsPage(rows, null, { filter: "rising" }).items.map((i) => i.sound.id)).toEqual(["b"]);
    expect(toTrendingSoundsPage(rows, null, { filter: "all" }).items.map((i) => i.sound.id)).toEqual(["a", "b"]);
  });
});

/* ── pagination ────────────────────────────────────────────── */

describe("paging", () => {
  test("the request: filter, limit 1..50 (20 by default), the cursor only when there is one", () => {
    expect(trendingSoundsRequest()).toEqual({ url: "/v1/audio/trending", params: { filter: "all", limit: "20" } });
    expect(trendingSoundsRequest({ filter: "rising", cursor: " c2 ", limit: 500 })).toEqual({
      url: "/v1/audio/trending",
      params: { filter: "rising", limit: "50", cursor: "c2" },
    });
    expect(trendingSoundsRequest({ limit: 0 }).params.limit).toBe("1");
    expect(trendingSoundsRequest({ limit: 7.8 }).params.limit).toBe("7");
    expect(trendingSoundsRequest({ limit: Number.NaN }).params.limit).toBe("20");
    expect(trendingSoundsRequest({ cursor: "" }).params).not.toHaveProperty("cursor");
    expect(trendingSoundsRequest({ cursor: "   " }).params).not.toHaveProperty("cursor");
    expect(trendingSoundsRequest({ cursor: null }).params).not.toHaveProperty("cursor");
  });

  test("an empty or absent next_cursor is the end", () => {
    expect(toTrendingSoundsPage([], { next_cursor: "" }).nextCursor).toBeUndefined();
    expect(toTrendingSoundsPage([], { next_cursor: null }).nextCursor).toBeUndefined();
    expect(toTrendingSoundsPage([], {}).nextCursor).toBeUndefined();
    expect(toTrendingSoundsPage([]).nextCursor).toBeUndefined();
    expect(toTrendingSoundsPage([], { next_cursor: 5 }).nextCursor).toBeUndefined();
  });

  test("pages merge in order, each sound once", () => {
    const one = toTrendingSoundsPage([entry({ rank: 1 }, { id: "a" }), entry({ rank: 2 }, { id: "b" })], { next_cursor: "c2" });
    const two = toTrendingSoundsPage([entry({ rank: 3 }, { id: "b" }), entry({ rank: 4 }, { id: "c" })]);
    expect(mergeTrendingPages([one, two]).map((i) => [i.rank, i.sound.id])).toEqual([[1, "a"], [2, "b"], [4, "c"]]);
    expect(mergeTrendingPages([one, null, undefined])).toHaveLength(2);
    expect(mergeTrendingPages(null)).toEqual([]);
  });

  test("fetchTrendingSounds sends the request and reads the envelope's data and meta", async () => {
    const calls = spyGet({ data: [entry({ rank: 21 }, { id: "z" })], meta: { next_cursor: "c3", updated_at: "2026-10-24T10:00:00Z" } });
    const page = await fetchTrendingSounds({ filter: "rising", cursor: "c2" });
    expect(calls[0].url).toBe("/v1/audio/trending");
    expect(calls[0].config.params).toEqual({ filter: "rising", limit: "20", cursor: "c2" });
    expect(page.items.map((i) => [i.rank, i.sound.id])).toEqual([[21, "z"]]);
    expect(page.nextCursor).toBe("c3");
  });

  test("fetchTrendingSounds: data null (a Go nil slice) is an empty, final page", async () => {
    spyGet({ data: null, meta: { next_cursor: "" } });
    expect(await fetchTrendingSounds()).toEqual({ items: [], nextCursor: undefined, updatedAt: null });
  });

  test("the hook pages by the cursor", () => {
    const hook = readFileSync(resolve(import.meta.dir, "../hooks/useSounds.ts"), "utf8");
    expect(hook).toContain("fetchTrendingSounds({ filter, cursor: pageParam, limit, signal })");
    expect(hook).toContain("getNextPageParam: (last) => last.nextCursor,");
  });
});

/* ── words ─────────────────────────────────────────────────── */

describe("trendingUsesLabel", () => {
  test('"N reels this week", one reel singular, thousands grouped', () => {
    expect(trendingUsesLabel(42)).toBe("42 reels this week");
    expect(trendingUsesLabel(1)).toBe("1 reel this week");
    expect(trendingUsesLabel(2)).toBe("2 reels this week");
    expect(trendingUsesLabel(1234)).toBe("1,234 reels this week");
    expect(trendingUsesLabel(3.9)).toBe("3 reels this week");
  });

  test("nothing at all when it is unknown (0, negative, not a number)", () => {
    for (const n of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 0.4]) expect(trendingUsesLabel(n)).toBe("");
  });

  test("tabs, links and empty states", () => {
    expect(TRENDING_FILTERS.map((f) => f.label)).toEqual(["All", "Rising"]);
    expect(trendingSoundsHref()).toBe("/reels/sounds/trending");
    expect(trendingSoundsHref("rising")).toBe("/reels/sounds/trending?filter=rising");
    expect(trendingFilterFromSearch("rising")).toBe("rising");
    expect(trendingFilterFromSearch(" RISING ")).toBe("rising");
    expect(trendingFilterFromSearch(["rising", "all"])).toBe("rising");
    for (const v of [undefined, null, "", "all", "top", []]) expect(trendingFilterFromSearch(v as never)).toBe("all");
    expect(trendingEmptyText("all").title).toBe("No trending sounds yet");
    expect(trendingEmptyText("rising").title).toBe("Nothing is rising right now");
  });
});

/* ── the sound page's badge ────────────────────────────────── */

describe("badge selection", () => {
  test("toSoundTrending: a rank, rising, both; null when it says nothing usable", () => {
    expect(toSoundTrending({ rank: 3, rising: false })).toEqual({ rank: 3, rising: false });
    expect(toSoundTrending({ rank: 3, rising: true })).toEqual({ rank: 3, rising: true });
    expect(toSoundTrending({ rising: true })).toEqual({ rank: null, rising: true });
    expect(toSoundTrending({ rank: 0, rising: true })).toEqual({ rank: null, rising: true });
    for (const raw of [null, undefined, "x", 3, [], {}, { rank: 0 }, { rank: -1 }, { rank: 2.5 }, { rank: "3" }, { rising: "true" }, { rank: null, rising: false }]) {
      expect(toSoundTrending(raw)).toBeNull();
    }
  });

  test('trendingBadges: "#N trending" first, then "Rising"; none when not trending', () => {
    expect(trendingBadges({ rank: 3, rising: false })).toEqual([{ kind: "rank", label: "#3 trending" }]);
    expect(trendingBadges({ rank: 1, rising: true })).toEqual([{ kind: "rank", label: "#1 trending" }, { kind: "rising", label: "Rising" }]);
    expect(trendingBadges({ rank: null, rising: true })).toEqual([{ kind: "rising", label: "Rising" }]);
    expect(trendingBadges({ rank: 1200, rising: false })[0].label).toBe("#1,200 trending");
    expect(trendingBadges({ rank: null, rising: false })).toEqual([]);
    expect(trendingBadges({ rank: 0, rising: false })).toEqual([]);
    expect(trendingBadges(null)).toEqual([]);
    expect(trendingBadges(undefined)).toEqual([]);
  });

  test("the sound read: trending kept when said (null included), absent when not", () => {
    expect(toSoundInfo({ ...soundRow, trending: { rank: 2, rising: true } })!.trending).toEqual({ rank: 2, rising: true });
    expect(toSoundInfo({ ...soundRow, trending: null })!.trending).toBeNull();
    expect(toSoundInfo(soundRow)!).not.toHaveProperty("trending");
  });

  test("the reels answer: trending beside the sound, or on it; absent when it says nothing", () => {
    expect(toSoundReelsPage({ ...bySound, trending: { rank: 5, rising: false } }).trending).toEqual({ rank: 5, rising: false });
    expect(toSoundReelsPage({ ...bySound, sound: { ...(bySound.sound as object), trending: { rising: true } } }).trending).toEqual({ rank: null, rising: true });
    expect(toSoundReelsPage({ ...bySound, trending: null }).trending).toBeNull();
    expect(toSoundReelsPage(bySound)).not.toHaveProperty("trending");
  });

  test("soundPageTrending: the reels answer wins when it says (even null), else the sound read", () => {
    const ranked = { rank: 3, rising: false };
    const rising = { rank: null, rising: true };
    expect(soundPageTrending({ trending: ranked }, { trending: rising })).toEqual(ranked);
    expect(soundPageTrending({ trending: null }, { trending: rising })).toBeNull();
    expect(soundPageTrending({}, { trending: rising })).toEqual(rising);
    expect(soundPageTrending(undefined, { trending: rising })).toEqual(rising);
    expect(soundPageTrending({}, {})).toBeNull();
    expect(soundPageTrending(null, null)).toBeNull();
  });

  test("the header draws the badges as links to that tab; nothing without trending or without a sound", () => {
    const base = { loading: false, reelCount: 4, preview: "idle" as const, onTogglePreview: noop, useHref: "/reels/create?sound=s" };
    const sound = toSoundInfo(soundRow)!;
    const both = renderToStaticMarkup(<SoundPageHeader {...base} sound={sound} trending={{ rank: 3, rising: true }} />);
    expect(both).toContain('class="sound-page__trend" data-badge="rank" href="/reels/sounds/trending"');
    expect(both).toContain("#3 trending</a>");
    expect(both).toContain('class="sound-page__trend" data-badge="rising" href="/reels/sounds/trending?filter=rising"');
    expect(both.indexOf('data-badge="rank"')).toBeLessThan(both.indexOf('data-badge="rising"'));
    expect(renderToStaticMarkup(<SoundPageHeader {...base} sound={sound} trending={null} />)).not.toContain("data-trending");
    expect(renderToStaticMarkup(<SoundPageHeader {...base} sound={sound} />)).not.toContain("data-trending");
    expect(renderToStaticMarkup(<SoundPageHeader {...base} sound={null} trending={{ rank: 1, rising: true }} />)).not.toContain("data-trending");
  });

  test("the sound page asks the sound read only when the reels answer did not say", () => {
    const screen = readFileSync(resolve(import.meta.dir, "../components/SoundReelsScreen.tsx"), "utf8");
    expect(screen).toContain("useSoundInfo(sound && pages[0]?.trending === undefined ? soundId : null)");
    expect(screen).toContain("trending={trending}");
  });
});

/* ── the views ─────────────────────────────────────────────── */

describe("the trending page's rows", () => {
  const entries = toTrendingSoundsPage([
    entry({ rank: 1 }, { id: "a", title: "Kitchen take", artist: "Asha" }),
    entry({ rank: 2, rising: false, uses_7d: 1 }, { id: "b", title: "Rain", artist: "", cover_url: "https://cdn.example/b.jpg" }),
  ]).items;
  const html = renderToStaticMarkup(
    <TrendingSoundsList entries={entries} playingId="b" failedIds={new Set()} useHref={(id) => `/reels/create?sound=${id}`} onTogglePreview={noop} />,
  );

  test("rank, title to the sound page, artist, uses, Rising only where rising", () => {
    expect(html).toContain('data-sound-id="a" data-rank="1"');
    expect(html).toContain('<a href="/reels/sound/a">Kitchen take</a>');
    expect(html).toContain('<p class="trending-sounds__artist">Asha</p>');
    expect(html).toContain('<p class="trending-sounds__uses">42 reels this week</p>');
    expect(html).toContain('<p class="trending-sounds__uses">1 reel this week</p>');
    expect(html.match(/data-rising/g)).toHaveLength(1);
    expect(html.indexOf("data-rising")).toBeLessThan(html.indexOf('data-sound-id="b"'));
  });

  test("a cover when there is one, else the disc", () => {
    expect(html).toContain('<img src="https://cdn.example/b.jpg"');
    expect(html.match(/<img /g)).toHaveLength(1);
  });

  test("preview per row, named; Use this sound to the studio with the sound", () => {
    expect(html).toContain('aria-label="Preview Kitchen take"');
    expect(html).toContain('aria-label="Pause Rain"');
    expect(html).toContain('href="/reels/create?sound=a"');
    expect(html).toContain('aria-label="Use Kitchen take"');
    expect(previewStateOf("a", "a", new Set())).toBe("playing");
    expect(previewStateOf("a", "a", new Set(["a"]))).toBe("failed");
    expect(previewStateOf("a", "b", new Set())).toBe("idle");
  });

  test("the page: All/Rising tabs, signed-in route, friendly empty state, theme tokens only", () => {
    const screen = readFileSync(resolve(import.meta.dir, "../components/TrendingSoundsScreen.tsx"), "utf8");
    expect(screen).toContain('role="tablist"');
    expect(screen).toContain("data-trending-empty={filter}");
    expect(screen.split("startPreview(").length - 1).toBe(1);
    const page = readFileSync(resolve(import.meta.dir, "../../../app/reels/sounds/trending/page.tsx"), "utf8");
    expect(page).toContain("trendingFilterFromSearch(filter)");
    const css = readFileSync(resolve(import.meta.dir, "../components/reels-screen.css"), "utf8");
    const ours = css.slice(css.indexOf("/* Trending: the sound page's badges"));
    expect(ours.length).toBeGreaterThan(100);
    expect(ours.match(/#[0-9a-f]{3,8}\b/gi)).toBeNull();
    for (const file of ["../components/TrendingSoundsScreen.tsx", "../components/TrendingSoundsList.tsx", "../trendingSounds.ts"]) {
      const text = readFileSync(resolve(import.meta.dir, file), "utf8");
      expect(text.match(/#[0-9a-f]{3,8}\b/gi)).toBeNull();
      expect(text.toLowerCase()).not.toContain("tiktok");
    }
  });
});

describe("the sound picker's Trending shelf", () => {
  const shelfEntries = toTrendingSoundsPage([entry({ rank: 1 }, { id: "a", title: "Kitchen take" }), entry({ rank: 2, rising: false, uses_7d: 0 }, { id: "b", title: "Rain" })]).items;
  const rows = shelfEntries.map(rowFromTrending);
  const rowsProps = { playingKey: null, onTogglePreview: noop, onUse: noop };

  test("rowFromTrending: the sound's row plus rank, rising and the uses line", () => {
    expect(rows[0]).toEqual({ ...rowFromSound(shelfEntries[0].sound), trending: { rank: 1, rising: true, usesLabel: "42 reels this week" } });
    expect(rows[1].kind === "sound" && rows[1].trending).toEqual({ rank: 2, rising: false, usesLabel: "" });
  });

  test("rows show the rank, a Rising chip on rising ones, and the uses in the meta line", () => {
    const html = renderToStaticMarkup(<SoundPickerRows rows={rows} {...rowsProps} />);
    expect(html).toContain('data-sound-rank="1"');
    expect(html).toContain('data-sound-rank="2"');
    expect(html.match(/data-rising/g)).toHaveLength(1);
    expect(html).toContain("42 reels this week");
    // A plain row is drawn as before: no rank, no chip.
    const plain = renderToStaticMarkup(<SoundPickerRows rows={[rowFromSound(shelfEntries[0].sound)]} {...rowsProps} />);
    expect(plain).not.toContain("data-sound-rank");
    expect(plain).not.toContain("data-rising");
  });

  test("the shelf: its title, See all in a new tab, the rows; a friendly empty state", () => {
    const html = renderToStaticMarkup(<TrendingShelf status="ready" rows={rows} rowsProps={rowsProps} />);
    expect(html).toContain("Trending this week");
    expect(html).toContain('href="/reels/sounds/trending" target="_blank" rel="noopener"');
    expect(html).toContain('data-sound-picker-state="ready"');
    const empty = renderToStaticMarkup(<TrendingShelf status="empty" rows={[]} rowsProps={rowsProps} />);
    expect(empty).toContain("No sounds are trending yet. Pick one from the library below.");
  });

  test("the Trending tab is the shelf (top 20) and then the library", () => {
    const sheet = readFileSync(resolve(import.meta.dir, "../../upload/components/SoundPickerSheet.tsx"), "utf8").split("\r\n").join("\n");
    expect(sheet).toContain('useTrendingSounds("all", { limit: TRENDING_PAGE_SIZE })');
    expect(sheet).toContain(".slice(0, TRENDING_PAGE_SIZE).map(rowFromTrending)");
    expect(sheet.indexOf("<TrendingShelf status=")).toBeLessThan(sheet.indexOf("<LibraryPanel rowsProps={rowsProps} genre={genre} onGenre={onGenre} beside={rows} />"));
  });

  test("a library track already on the shelf is not listed twice", () => {
    const lib = (id: string, track: string | null) =>
      rowFromLibrary(normalizeLibrarySound({ id, title: id, artist: "", duration_ms: 1000, audio_url: `/v1/audio-library/${id}/serve`, genre: "", usage_count: 0, audio_track_id: track })!);
    const library = [lib("11111111-1111-4111-8111-111111111111", "a"), lib("22222222-2222-4222-8222-222222222222", "z"), lib("33333333-3333-4333-8333-333333333333", null)];
    expect(libraryRowsBesideShelf(library, rows).map((r) => r.key)).toEqual([library[1].key, library[2].key]);
    expect(libraryRowsBesideShelf(library, [])).toHaveLength(3);
  });
});

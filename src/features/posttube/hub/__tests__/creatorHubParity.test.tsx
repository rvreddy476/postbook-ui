import { afterEach, describe, expect, spyOn, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import api from "@/lib/api";
import { ToastProvider } from "@/contexts/ToastContext";
import RequestPayoutForm, { PAYOUTS_OFF_TITLE, PayoutsOffNotice } from "@/components/monetization/RequestPayoutForm";
import { isPayoutsNotEnabledError, payoutsAvailableFrom } from "@/hooks/useMonetization";
import {
  deleteDraft,
  draftsParams,
  getLibrarySound,
  listDrafts,
  listSoundLibrary,
  normalizeCreatorInsights,
  normalizeDraft,
  normalizeLibraryRow,
  normalizeLibrarySound,
  normalizeSoundPage,
  normalizeSummary,
  safeMediaUrl,
  soundLibraryParams,
  type HubLibraryRow,
} from "../hubApi";
import { sortLibraryRows } from "../hubModel";
import { csvCell, insightsCsvFilename, insightsCsvRows, toCsv } from "../insightsCsv";
import { LibraryTable } from "../components/LibraryTable";
import { OverviewDashboard } from "../components/OverviewDashboard";
import { DraftsTable, draftStatus, publishedDraftHref } from "../components/DraftsTab";
import { SoundList } from "../components/SoundsPage";

/* TikTok-parity package 3-W6: T-27 (hub numbers, CSV), drafts tab, T-28 sound browse, R-5 payouts off. */

const spies: { mockRestore: () => void }[] = [];
afterEach(() => {
  while (spies.length) spies.pop()!.mockRestore();
});

function spyApi(method: "get" | "delete", data: unknown) {
  const calls: { url: string; config: unknown }[] = [];
  const s = spyOn(api, method).mockImplementation(((url: string, config?: unknown) => {
    calls.push({ url, config });
    return Promise.resolve({ data });
  }) as never);
  spies.push(s);
  return calls;
}

/** The analytics-service creator/me reply, as CreatorStats marshals it. */
const WIRE = {
  user_id: "u1",
  period: "7d",
  total_views: 90,
  total_likes: 14,
  total_comments: 5,
  total_shares: 3,
  follower_growth: 2,
  top_posts: [],
  daily_stats: [
    { date: "2026-10-03T00:00:00Z", views: 30 },
    { date: "2026-10-01T00:00:00Z", views: 10 },
    // 2026-10-02 had no recorded views and is absent on the wire.
  ],
  views: 40,
  likes: 14,
  comments: 5,
  shares: 3,
  followers_gained: 2,
  data_status: "recorded",
  watch_time_ms: 660_000,
  unique_viewers: 21,
  followers_delta: null,
  top_content: [{ content_id: "v1", views: 25, watch_time_ms: 120_000 }],
  realtime: { views_48h: 4, series_48h: [1, 3] },
};

describe("T-27: creator insights normalisation", () => {
  test("maps likes, comments, shares and follows from the wire", () => {
    const d = normalizeCreatorInsights(WIRE, "28d");
    expect(d.period).toBe("7d");
    expect(d).toMatchObject({ views: 40, likes: 14, comments: 5, shares: 3, follows_from_content: 2, followers_delta: null });
  });

  test("daily_stats becomes the daily series: calendar days, oldest first, gaps filled with 0", () => {
    const d = normalizeCreatorInsights(WIRE, "7d");
    expect(d.views_by_day).toEqual([
      { day: "2026-10-01", views: 10 },
      { day: "2026-10-02", views: 0 },
      { day: "2026-10-03", views: 30 },
    ]);
  });

  test("older writers (total_* only, views_by_day) still read; Go zero values fall through", () => {
    const d = normalizeCreatorInsights({ likes: 0, total_likes: 7, total_comments: 2, total_shares: 1, follower_growth: 4, views_by_day: [{ day: "2026-09-01", views: 3 }] }, "28d");
    expect(d).toMatchObject({ likes: 7, comments: 2, shares: 1, follows_from_content: 4 });
    expect(d.views_by_day).toEqual([{ day: "2026-09-01", views: 3 }]);
  });

  test("an empty reply is all zeros, no series and followers not tracked", () => {
    const d = normalizeCreatorInsights({}, "90d");
    expect(d).toMatchObject({ period: "90d", likes: 0, comments: 0, shares: 0, follows_from_content: 0, followers_delta: null, views_by_day: [] });
  });
});

describe("T-27: overview", () => {
  const summary = normalizeSummary({ videos: 1 });
  const latest = normalizeLibraryRow({ id: "v1", title: "One", view_count: 9, like_count: 4, comment_count: 2 })!;
  const insights = normalizeCreatorInsights(WIRE, "7d");

  test("shows views, likes, comments, shares, followers and the daily chart for the chosen period", () => {
    const html = renderToStaticMarkup(
      <OverviewDashboard summary={{ data: summary }} library={{ data: [latest] }} insights={{ data: insights }} period="7d" onPeriodChange={() => {}} />,
    );
    for (const label of ["Views", "Likes", "Comments", "Shares", "Followers", "Watch time"]) expect(html).toContain(`<span>${label}</span>`);
    expect(html).toContain(">14<");
    expect(html).toContain("Channel views by day, last 7 days");
    expect(html).toContain('aria-label="Period"');
    expect(html).toContain("90 days");
    expect(html).toContain("2 followed from a video");
    expect(html).toContain('href="/posttube/hub/insights?period=7d"');
  });

  test("latest comments list the newest comments, with retry and empty states", () => {
    const row = { comment: { id: "c1", body: "Great one", author_id: "a1", created_at: "", post_id: "v1" }, post: { id: "v1", title: "One", content_type: "long_video", cover_media_id: null }, author_replied: false };
    const html = renderToStaticMarkup(
      <OverviewDashboard summary={{ data: summary }} library={{ data: [latest] }} insights={{ data: insights }} comments={{ data: [row as never] }} authorName={() => "Asha"} />,
    );
    expect(html).toContain("Latest comments");
    expect(html).toContain("Great one");
    expect(html).toContain("Asha · ");
    expect(html).toContain('href="/posttube/hub/conversations?status=all&amp;post=v1"');
    expect(renderToStaticMarkup(<OverviewDashboard summary={{ data: summary }} library={{ data: [] }} insights={{ data: insights }} comments={{ data: [] }} />)).toContain("No comments yet");
    expect(renderToStaticMarkup(<OverviewDashboard summary={{ data: summary }} library={{ data: [] }} insights={{ data: insights }} comments={{ error: true, onRetry: () => {} }} />)).toContain("Latest comments couldn&#x27;t load.");
  });
});

describe("Download CSV", () => {
  test("escapes quotes, commas and newlines (RFC 4180)", () => {
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell("cr\rhere")).toBe('"cr\rhere"');
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(Number.NaN)).toBe("");
  });

  test("text that would run as a formula is prefixed with an apostrophe", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("\tcmd")).toBe("'\tcmd");
    expect(csvCell("=1,2")).toBe(`"'=1,2"`);
    // Numbers stay numbers, negative ones included.
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(12)).toBe("12");
  });

  test("the insights CSV carries totals, every day, the hourly series and titled top content", () => {
    const d = normalizeCreatorInsights(WIRE, "7d");
    const csv = toCsv(insightsCsvRows(d, new Map([["v1", "=evil(), \"quoted\""]])));
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Metric,Value");
    expect(lines).toContain("Likes,14");
    expect(lines).toContain("Comments,5");
    expect(lines).toContain("Shares,3");
    expect(lines).toContain("Watch time (minutes),11");
    expect(lines).toContain("Followers (net change),not tracked yet");
    expect(lines).toContain("Day,Views");
    expect(lines).toContain("2026-10-02,0");
    expect(lines).toContain("Hours ago,Views");
    expect(lines).toContain("47,0");
    expect(lines).toContain("1,1");
    expect(lines).toContain("0,3");
    expect(lines).toContain(`1,"'=evil(), ""quoted""",v1,25,2`);
    expect(insightsCsvFilename("28d", new Date("2026-10-15T08:00:00Z"))).toBe("channel-insights-28d-2026-10-15.csv");
  });
});

describe("Library: Likes column", () => {
  function row(id: string, likes: number): HubLibraryRow {
    return normalizeLibraryRow({ id, title: id, view_count: 1, like_count: likes, comment_count: 0 })!;
  }

  test("renders a sortable Likes header and each row's like count", () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <LibraryTable
            rows={[row("a", 1234)]}
            selected={new Set()}
            onToggle={() => {}}
            onToggleAll={() => {}}
            sortKey="likes"
            sortDir="desc"
            onSort={() => {}}
            actions={{ onEdit: () => {}, onCopyLink: () => {}, onDelete: () => {} }}
            ownerId={null}
          />
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(html).toMatch(/aria-sort="descending"><button type="button">Likes/);
    expect(html).toContain("1.2K");
  });

  test("sorts by likes", () => {
    const sorted = sortLibraryRows([row("a", 2), row("b", 9), row("c", 5)], "likes", "desc");
    expect(sorted.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });
});

describe("Drafts tab", () => {
  test("lists GET /v1/reels/drafts with the limit and cursor, and reads the next cursor", async () => {
    const calls = spyApi("get", {
      data: [
        { id: "d1", title: "", caption: "First line\nmore", status: "draft", updated_at: "2026-10-10T00:00:00Z", media_id: "m1" },
        { id: "", title: "dropped" },
        { id: "d2", title: "Out", status: "published", published_post_id: "p9" },
      ],
      meta: { next_cursor: "2026-10-09T00:00:00.123Z" },
    });
    const page = await listDrafts({ cursor: "2026-10-11T00:00:00Z" });
    expect(calls[0].url).toBe("/v1/reels/drafts");
    expect((calls[0].config as { params: unknown }).params).toEqual({ limit: "20", cursor: "2026-10-11T00:00:00Z" });
    expect(page.items.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(page.items[0].title).toBe("First line");
    expect(page.next_cursor).toBe("2026-10-09T00:00:00.123Z");
    expect(draftsParams({ limit: 500 })).toEqual({ limit: "50" });
  });

  test("delete uses the draft route", async () => {
    const calls = spyApi("delete", {});
    await deleteDraft("d1");
    expect(calls[0].url).toBe("/v1/reels/drafts/d1");
  });

  test("a draft waiting on its schedule reads as Scheduled; a published one opens its video", () => {
    const scheduled = normalizeDraft({ id: "d3", status: "draft", schedule_at: "2026-10-20T10:00:00Z" })!;
    const published = normalizeDraft({ id: "d4", status: "published", published_post_id: "p4" })!;
    expect(draftStatus(scheduled)).toBe("scheduled");
    expect(publishedDraftHref(published)).toBe("/posttube/hub/library?edit=p4");
    const html = renderToStaticMarkup(<DraftsTable rows={[scheduled, published]} openId="d3" onOpen={() => {}} onDelete={() => {}} />);
    expect(html).toContain("Scheduled");
    expect(html).toContain("Published");
    expect(html).toContain('href="/posttube/hub/library?edit=p4"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("can&#x27;t be reopened in the upload studio yet");
    expect(html.match(/Delete draft/g)?.length).toBe(2);
  });
});

describe("T-28: sound library (browse only)", () => {
  test("GET /v1/audio-library maps genre, limit and offset, and reads {tracks}", async () => {
    const tracks = Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, title: `Track ${i}`, audio_url: "https://cdn.example.test/a.mp3", duration_ms: 30_000 }));
    const calls = spyApi("get", { data: { tracks, total: 20 } });
    const page = await listSoundLibrary({ genre: " lofi ", offset: 20 });
    expect(calls[0].url).toBe("/v1/audio-library");
    expect((calls[0].config as { params: unknown }).params).toEqual({ genre: "lofi", limit: "20", offset: "20" });
    expect(page.items).toHaveLength(20);
    expect(page.next_offset).toBe(40);
    expect(soundLibraryParams({ limit: 0, offset: -3 })).toEqual({ limit: "1", offset: "0" });
    expect(normalizeSoundPage({ tracks: [{ id: "x" }] }, { limit: 20, offset: 0 }).next_offset).toBeUndefined();
  });

  test("one track by id", async () => {
    const calls = spyApi("get", { data: { id: "s1", title: "One", audio_url: "/v1/audio/s1/serve" } });
    const s = await getLibrarySound("s1");
    expect(calls[0].url).toBe("/v1/audio-library/s1");
    expect(s?.audio_url.endsWith("/v1/audio/s1/serve")).toBe(true);
  });

  test("only http(s) and gateway URLs play; inactive rows are dropped", () => {
    expect(safeMediaUrl("javascript:alert(1)")).toBe("");
    expect(safeMediaUrl("data:audio/mp3;base64,AAA")).toBe("");
    expect(safeMediaUrl("bucket/key.mp3")).toBe("");
    expect(safeMediaUrl("https://cdn.example.test/a.mp3")).toBe("https://cdn.example.test/a.mp3");
    expect(normalizeLibrarySound({ id: "s", is_active: false })).toBeNull();
  });

  test("the list never autoplays: Play buttons only, disabled without a preview", () => {
    const rows = [normalizeLibrarySound({ id: "s1", title: "One", audio_url: "https://cdn.example.test/a.mp3", usage_count: 3 })!, normalizeLibrarySound({ id: "s2", title: "Two" })!];
    const html = renderToStaticMarkup(<SoundList rows={rows} playingId={null} onToggle={() => {}} />);
    expect(html).not.toContain("<audio");
    expect(html).not.toContain("autoplay");
    expect(html).toContain('aria-label="Play One"');
    expect(html).toContain("3 videos");
    expect(html).toMatch(/aria-label="Play Two" disabled/);
  });
});

describe("R-5: payouts off", () => {
  test("availability fails closed: only withdrawable === true opens payouts", () => {
    expect(payoutsAvailableFrom({ data: { withdrawable: true, estimate: false } })).toBe(true);
    expect(payoutsAvailableFrom({ data: { withdrawable: false, estimate: true } })).toBe(false);
    expect(payoutsAvailableFrom({ data: {} })).toBe(false);
    expect(payoutsAvailableFrom(null)).toBe(false);
    expect(isPayoutsNotEnabledError({ response: { data: { error: { code: "PAYOUTS_NOT_ENABLED", message: "x" } } } })).toBe(true);
    expect(isPayoutsNotEnabledError({ response: { data: { error: { code: "KYC_NOT_VERIFIED" } } } })).toBe(false);
  });

  test("the form says payouts are not available yet and is disabled", () => {
    const html = renderToStaticMarkup(
      <RequestPayoutForm balance={500} currency="INR" methods={[{ id: "m1", method_type: "upi", details: { upi_id: "a@b" }, is_verified: true } as never]} onSubmit={() => {}} onCancel={() => {}} isPending={false} payoutsOff />,
    );
    expect(html).toContain(PAYOUTS_OFF_TITLE);
    expect(html).toContain("<fieldset disabled");
    expect(html).toMatch(/type="submit" disabled=""[^>]*>Not available yet/);
    expect(renderToStaticMarkup(<PayoutsOffNotice />)).toContain("Payouts are not available yet");
  });

  test("with payouts on, the form is live", () => {
    const html = renderToStaticMarkup(
      <RequestPayoutForm balance={500} currency="INR" methods={[{ id: "m1", method_type: "upi", details: { upi_id: "a@b" }, is_verified: true } as never]} onSubmit={() => {}} onCancel={() => {}} isPending={false} />,
    );
    expect(html).not.toContain(PAYOUTS_OFF_TITLE);
    expect(html).not.toContain("<fieldset disabled");
    expect(html).toContain("Request Payout</button>");
  });
});

describe("inbox heart field", () => {
  test("post-service's hearted_by_author marks the row hearted", async () => {
    const { normalizeInboxRow } = await import("@/features/posttube/hub/hubApi");
    const row = normalizeInboxRow({
      comment: { id: "c1", post_id: "p1", body: "hi", hearted_by_author: true },
      post: { id: "p1", title: "t", content_type: "long_video" },
    });
    expect(row?.comment.hearted).toBe(true);
    const plain = normalizeInboxRow({ comment: { id: "c2", post_id: "p1", body: "hi" }, post: { id: "p1" } });
    expect(plain?.comment.hearted).toBe(false);
  });
});

import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { HubLibraryRow } from "../hubApi";
import { LIBRARY_FILTER_DEFAULT } from "../hubModel";
import { BulkBar, FilterChips, FilterMenu, RowHoverActions, VisibilityPanel, type BulkBarProps } from "../components/LibraryActions";
import { MoreSettings } from "../components/EditSheet";
import { toDetailsForm } from "../editForm";
import { normalizePostDetail } from "../hubApi";

const noop = () => undefined;
const css = readFileSync(resolve(import.meta.dir, "../hub.css"), "utf8");

function row(extra: Partial<HubLibraryRow> = {}): HubLibraryRow {
  return {
    id: "p1",
    title: "Rain on a tin roof",
    text: "",
    content_type: "long_video",
    cover_media_id: null,
    thumbnail_url: "",
    media_id: "m1",
    duration_seconds: 60,
    visibility: "public",
    scheduled_at: null,
    published_at: null,
    created_at: "2026-09-01T00:00:00Z",
    view_count: 0,
    comment_count: 0,
    like_count: 0,
    processing_status: "ready",
    flags: [],
    allow_download: false,
    source: null,
    description: "",
    made_for_kids: false,
    age_restricted: false,
    hide_like_count: false,
    default_comment_sort: "top",
    related_post_id: null,
    ...extra,
  };
}

const bulkBase: BulkBarProps = {
  count: 2,
  total: 5,
  onSelectAll: noop,
  onClear: noop,
  topics: [{ slug: "music", label: "Music", kind: "all" }],
  collections: [
    { id: "c2", title: "Rainy days" },
    { id: "c1", title: "Cooking" },
  ],
  onApplyEdit: noop,
  onAddToCollection: noop,
  downloadable: 2,
  onDownload: noop,
  onDeleteForever: noop,
};

function order(html: string, needles: string[]): number[] {
  return needles.map((n) => html.indexOf(n));
}

describe("bulk bar", () => {
  test("N selected (Select all M) with Edit, Add to collection and More actions", () => {
    const html = renderToStaticMarkup(<BulkBar {...bulkBase} />);
    expect(html).toContain("2 selected");
    expect(html).toContain("(Select all)");
    const at = order(html, [">Edit<", ">Add to collection<", ">More actions<", ">Clear<"]);
    for (const p of at) expect(p).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).not.toContain("Playlist");
  });

  test("Select all disappears once everything shown is ticked", () => {
    expect(renderToStaticMarkup(<BulkBar {...bulkBase} count={5} />)).not.toContain("Select all");
    // ticked rows hidden by a filter don't count: the shown ones decide
    expect(renderToStaticMarkup(<BulkBar {...bulkBase} count={5} allSelected={false} />)).toContain("(Select all)");
  });

  test("Edit ▾ lists the contract C fields alphabetically, no title or description", () => {
    const html = renderToStaticMarkup(<BulkBar {...bulkBase} defaultOpen="edit" />);
    const labels = [...html.matchAll(/data-bulk-field="([a-z_]+)"[^>]*>([^<]+)</g)].map((m) => m[2]);
    expect(labels.length).toBe(17);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
    expect(labels).toContain("Visibility");
    expect(labels).not.toContain("Title");
    expect(labels).not.toContain("Description");
  });

  test("the Tags editor offers Add / Replace / Remove and an Apply that waits for tags", () => {
    const html = renderToStaticMarkup(<BulkBar {...bulkBase} defaultOpen="edit" defaultField="tags" />);
    expect(order(html, [">Add<", ">Replace<", ">Remove<"]).every((p) => p > -1)).toBe(true);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Apply<\/button>/);
  });

  test("Topic never clears by default: Apply waits for a pick", () => {
    const html = renderToStaticMarkup(<BulkBar {...bulkBase} defaultOpen="edit" defaultField="category" />);
    expect(html).toContain("Pick a topic");
    expect(html).toContain(">Music<");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Apply<\/button>/);
  });

  test("the Visibility editor is Private / Public / Unlisted radios", () => {
    const html = renderToStaticMarkup(<BulkBar {...bulkBase} defaultOpen="edit" defaultField="visibility" />);
    expect(html.match(/type="radio"/g)?.length).toBe(3);
    expect(html).toContain(">Unlisted<");
    expect(html).not.toContain(">Scheduled<");
  });

  test("Add to collection ▾ lists the creator's collections A→Z; none yet points at Collections", () => {
    const html = renderToStaticMarkup(<BulkBar {...bulkBase} defaultOpen="collection" />);
    expect(html.indexOf("Cooking")).toBeLessThan(html.indexOf("Rainy days"));
    const empty = renderToStaticMarkup(<BulkBar {...bulkBase} collections={[]} defaultOpen="collection" />);
    expect(empty).toContain("You have no collections yet.");
    expect(empty).toContain('href="/posttube/playlists"');
    expect(renderToStaticMarkup(<BulkBar {...bulkBase} collections={null} defaultOpen="collection" />)).toContain("Loading collections");
  });

  test("More actions ▾: Keep a copy, then a divider, then Delete forever last", () => {
    const html = renderToStaticMarkup(<BulkBar {...bulkBase} defaultOpen="more" />);
    const keep = html.indexOf("Keep a copy");
    const sep = html.indexOf('role="separator"');
    const del = html.indexOf("Delete forever");
    expect(keep).toBeGreaterThan(-1);
    expect(sep).toBeGreaterThan(keep);
    expect(del).toBeGreaterThan(sep);
    expect(renderToStaticMarkup(<BulkBar {...bulkBase} downloadable={0} defaultOpen="more" />)).toMatch(/disabled=""[^>]*>.*Keep a copy/);
  });

  test("per-row failures are listed with the video's title", () => {
    const html = renderToStaticMarkup(<BulkBar {...bulkBase} failures={[{ id: "b", title: "Bike", message: "Only the creator can change this video." }]} onDismissFailures={noop} />);
    expect(html).toContain("1 video was not changed");
    expect(html).toContain("Bike");
    expect(html).toContain("Only the creator can change this video.");
    expect(html).toContain('role="alert"');
  });
});

describe("row hover actions", () => {
  test("Edit, Insights, Conversations, View and ⋯, each labelled and a real control", () => {
    const html = renderToStaticMarkup(<RowHoverActions row={row()} onEdit={noop} onCopyLink={noop} onDelete={noop} />);
    const at = order(html, ['data-row-action="edit"', 'data-row-action="insights"', 'data-row-action="conversations"', 'data-row-action="view"', 'data-row-action="more"']);
    for (const p of at) expect(p).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).toContain('href="/posttube/hub/insights/p1"');
    expect(html).toContain('href="/posttube/hub/conversations?post=p1"');
    expect(html).toContain('href="/posttube/watch/p1"');
    for (const label of ["Edit", "Insights", "Conversations", "View"]) expect(html).toContain(`aria-label="${label}"`);
    expect(html).not.toContain('tabindex="-1"');
  });

  test("⋯ menu: Copy link, Keep a copy, divider, Delete forever", () => {
    const html = renderToStaticMarkup(<RowHoverActions row={row()} onEdit={noop} onCopyLink={noop} onDelete={noop} defaultMenuOpen />);
    const at = order(html, ["Copy link", "Keep a copy", 'role="separator"', "Delete forever"]);
    for (const p of at) expect(p).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).toContain("/v1/media/m1/download");
    const noFile = renderToStaticMarkup(<RowHoverActions row={row({ media_id: null })} onEdit={noop} onCopyLink={noop} onDelete={noop} defaultMenuOpen />);
    expect(noFile).not.toContain("Keep a copy");
  });

  test("hub.css shows them on hover and on focus, and always on touch widths", () => {
    expect(css).toMatch(/tr:hover \.hub-row-actions, \.hub-table tbody tr:focus-within \.hub-row-actions \{ opacity: 1/);
    expect(css).toMatch(/@media \(hover: none\), \(max-width: 767px\) \{\s*\.hub-row-actions \{[^}]*opacity: 1/);
  });
});

describe("visibility popover", () => {
  const base = { scheduleLocal: "", onScheduleLocal: noop, onChoice: noop, canSave: true, onCancel: noop, onSave: noop, onSharePrivately: noop };

  test("Private / Unlisted / Public radios then a Schedule section, Cancel and Save", () => {
    const html = renderToStaticMarkup(<VisibilityPanel {...base} choice="public" />);
    const at = order(html, ['data-vis-choice="private"', 'data-vis-choice="unlisted"', 'data-vis-choice="public"', 'data-vis-choice="scheduled"', ">Cancel<", ">Save<"]);
    for (const p of at) expect(p).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).not.toContain("Share privately");
    expect(html).not.toContain('type="datetime-local"');
  });

  test("Private shows Share privately", () => {
    expect(renderToStaticMarkup(<VisibilityPanel {...base} choice="private" />)).toContain("Share privately");
  });

  test("Schedule shows the date and time; an error and a disabled Save", () => {
    const html = renderToStaticMarkup(<VisibilityPanel {...base} choice="scheduled" scheduleLocal="2026-10-01T10:00" canSave={false} error="Pick a time in the future." />);
    expect(html).toContain('type="datetime-local"');
    expect(html).toContain('value="2026-10-01T10:00"');
    expect(html).toContain("Pick a time in the future.");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save<\/button>/);
  });

  test("while saving", () => {
    expect(renderToStaticMarkup(<VisibilityPanel {...base} choice="public" pending />)).toContain("Saving…");
  });
});

describe("filters", () => {
  test("the Filter ▾ menu lists its fields alphabetically", () => {
    const html = renderToStaticMarkup(<FilterMenu filter={LIBRARY_FILTER_DEFAULT} onChange={noop} defaultOpen />);
    const keys = [...html.matchAll(/data-filter-field="([a-zA-Z]+)"/g)].map((m) => m[1]);
    expect(keys).toEqual(["ageRestricted", "description", "madeForKids", "title", "views", "visibility"]);
  });

  test("the Views editor has min and max boxes", () => {
    const html = renderToStaticMarkup(<FilterMenu filter={{ ...LIBRARY_FILTER_DEFAULT, viewsMin: 10 }} onChange={noop} defaultOpen defaultKey="views" />);
    expect(html).toContain('aria-label="Views at least"');
    expect(html).toContain('aria-label="Views at most"');
    expect(html).toContain('value="10"');
  });

  test("chips with ✕ for each active filter, Clear all when there are several", () => {
    const html = renderToStaticMarkup(<FilterChips filter={{ ...LIBRARY_FILTER_DEFAULT, ageRestricted: "yes", viewsMin: 100 }} onChange={noop} />);
    expect(html).toContain('data-chip="ageRestricted"');
    expect(html).toContain('data-chip="views"');
    expect(html).toContain('aria-label="Remove filter Views ≥ 100"');
    expect(html).toContain("Clear all");
    expect(renderToStaticMarkup(<FilterChips filter={LIBRARY_FILTER_DEFAULT} onChange={noop} />)).toBe("");
  });
});

describe("edit sheet: More settings", () => {
  const detail = normalizePostDetail({ id: "p1", title: "T", visibility: "public", related_post_id: "p9", related_post: { id: "p9", title: "The first part" } })!;
  const form = toDetailsForm(detail);

  test("every contract A field is there, prefilled", () => {
    const html = renderToStaticMarkup(<MoreSettings form={form} set={noop} open onToggle={noop} notifyEditable={false} relatedOptions={[row({ id: "p2", title: "Other" })]} related={detail.related_post} />);
    for (const label of ["Age restriction (18+)", "Allow embedding", "Altered or AI content", "Hide like count", "Paid promotion", "License", "Remix", "Recording date", "Recording location", "Who can comment", "Comment moderation", "Comments open on", "Related video"]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain("Notify subscribers");
    // the saved related video is outside the loaded rows: its title still shows
    expect(html).toContain(">The first part<");
    expect(html).toContain('aria-label="Clear the related video"');
    expect(html).toContain(">Subscribers only<");
  });

  test("Notify subscribers only while the video is not out; collapsed by default shows just the heading", () => {
    expect(renderToStaticMarkup(<MoreSettings form={form} set={noop} open onToggle={noop} notifyEditable relatedOptions={[]} related={null} />)).toContain("Notify subscribers");
    const closed = renderToStaticMarkup(<MoreSettings form={form} set={noop} open={false} onToggle={noop} notifyEditable relatedOptions={[]} related={null} />);
    expect(closed).toContain("More settings");
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).not.toContain("License");
  });

  test("hub.css draws everything with tokens, no hex colours", () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

import { afterEach, describe, expect, spyOn, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import api from "@/lib/api";
import { PUBLISH_DEFAULTS, type PublishDefaults } from "@/features/posttube/hub/publishDefaults";
import { chapterRowsComplete, chapterRowsToWire, newChapterRow, validateChapterRows, type ChapterDraft } from "@/features/posttube/hub/chaptersModel";
import { ChaptersEditor } from "@/features/posttube/hub/components/ChaptersEditor";

import { seriesChoiceFor, seriesSelectValue } from "../components/SeriesPicker";
import { freshStudioForm, mergePublishDefaults, takesPublishDefaults } from "../studioDefaults";
import { applySeriesChoice, followUpNotice, hubEditHref, nextEpisodeNumber, normalizeEpisodes, normalizeSeriesRow, resolveEpisodeNumber } from "../studioApi";
import { INITIAL_FORM_STATE, type StudioFormState } from "../types";
import { getEnrichErrors, getStepErrors } from "../validation";

const defaults = (d: Partial<PublishDefaults>): PublishDefaults => ({ ...PUBLISH_DEFAULTS, ...d });
const longForm = (over: Partial<StudioFormState> = {}): StudioFormState => ({ ...INITIAL_FORM_STATE, contentType: "long", ...over });
const rows = (...r: [string, string][]): ChapterDraft[] => r.map(([clock, title], key) => ({ key, clock, title }));

/* ── (a) Creator Hub preferences ─────────────────────────── */

describe("mergePublishDefaults", () => {
  test("a fresh draft takes every preference: visibility, topic, comments off, language, license", () => {
    const patch = mergePublishDefaults(longForm(), defaults({ visibility: "unlisted", topic: "science-tech", comments: false, language: "te", license: "cc-by" }));
    expect(patch).toEqual({ visibility: "unlisted", category: "science-tech", commentsEnabled: false, language: "te", license: "creative_commons" });
  });

  test("never overrides what the draft already has", () => {
    const form = longForm({ visibility: "private", category: "music", commentsEnabled: false, language: "hi", license: "creative_commons" });
    expect(mergePublishDefaults(form, defaults({ visibility: "unlisted", topic: "science-tech", comments: true, language: "te", license: "standard" }))).toEqual({});
  });

  test("fills only the untouched fields of a half-filled draft", () => {
    const form = longForm({ category: "music" });
    expect(mergePublishDefaults(form, defaults({ visibility: "private", topic: "science-tech" }))).toEqual({ visibility: "private" });
  });

  test("the stock preferences change nothing; empty topic and language are 'not set'", () => {
    expect(mergePublishDefaults(longForm(), PUBLISH_DEFAULTS)).toEqual({});
    expect(mergePublishDefaults(longForm(), defaults({ topic: "", language: "" }))).toEqual({});
  });

  test("comments:true never turns comments back on", () => {
    expect(mergePublishDefaults(longForm({ commentsEnabled: false }), defaults({ comments: true }))).toEqual({});
  });

  test("only video studios take them; freshStudioForm applies them to a new draft", () => {
    expect(takesPublishDefaults("long")).toBe(true);
    expect(takesPublishDefaults("podcast")).toBe(true);
    expect(takesPublishDefaults("reel")).toBe(false);
    expect(takesPublishDefaults("short")).toBe(false);
    const d = defaults({ visibility: "private", comments: false });
    const long = freshStudioForm("long", "video", d);
    expect(long.visibility).toBe("private");
    expect(long.commentsEnabled).toBe(false);
    expect(long.contentType).toBe("long");
    const reel = freshStudioForm("reel", "details", d);
    expect(reel.visibility).toBe("public");
    expect(reel.commentsEnabled).toBe(true);
    expect(reel.currentStep).toBe("details");
    expect(freshStudioForm("long", "video", null).visibility).toBe("public");
  });
});

/* ── (b) Series ──────────────────────────────────────────── */

describe("episode number", () => {
  test("defaults to one past the highest; 1 for an empty or new series; gaps do not matter", () => {
    expect(nextEpisodeNumber([{ episodeNum: 1 }, { episodeNum: 2 }, { episodeNum: 5 }])).toBe(6);
    expect(nextEpisodeNumber([{ episodeNum: 3 }, { episodeNum: 1 }])).toBe(4);
    expect(nextEpisodeNumber([])).toBe(1);
    expect(nextEpisodeNumber(null)).toBe(1);
  });

  test("the creator's own whole number wins; anything else falls back to the default", () => {
    const eps = [{ episodeNum: 4 }];
    expect(resolveEpisodeNumber(2, eps)).toBe(2);
    expect(resolveEpisodeNumber(null, eps)).toBe(5);
    expect(resolveEpisodeNumber(0, eps)).toBe(5);
    expect(resolveEpisodeNumber(2.5, eps)).toBe(5);
  });

  test("normalizers read the post-service rows and drop the broken ones", () => {
    expect(normalizeSeriesRow({ id: "s1", title: "  ", episode_count: 3 })).toEqual({ id: "s1", title: "Untitled series", episodeCount: 3 });
    expect(normalizeSeriesRow({ title: "no id" })).toBeNull();
    expect(normalizeEpisodes([{ series_id: "s1", post_id: "p1", episode_num: 1 }, { post_id: "p2", episode_num: 0 }, { post_id: "", episode_num: 2 }])).toEqual([{ postId: "p1", episodeNum: 1 }]);
  });

  test("the picker's select value round-trips, keeping a typed new-series name", () => {
    const series = [{ id: "s1", title: "Builds", episodeCount: 2 }];
    expect(seriesSelectValue({ kind: "none" })).toBe("");
    expect(seriesSelectValue({ kind: "new", title: "x" })).toBe("__new__");
    expect(seriesSelectValue({ kind: "existing", id: "s1", title: "Builds" })).toBe("s1");
    expect(seriesChoiceFor("s1", series, { kind: "none" })).toEqual({ kind: "existing", id: "s1", title: "Builds" });
    expect(seriesChoiceFor("__new__", series, { kind: "new", title: "Draft name" })).toEqual({ kind: "new", title: "Draft name" });
    expect(seriesChoiceFor("gone", series, { kind: "none" })).toEqual({ kind: "none" });
  });

  test("validation: a new series needs a name; a typed episode is a whole number ≥ 1", () => {
    const base = longForm({ videoFile: {} as File, category: "music" });
    expect(getStepErrors("publish", { ...base, seriesChoice: { kind: "new", title: " " } }).map((e) => e.field)).toContain("seriesTitle");
    expect(getStepErrors("publish", { ...base, seriesChoice: { kind: "existing", id: "s1", title: "B" }, seriesEpisodeNum: 0 }).map((e) => e.field)).toContain("seriesEpisode");
    expect(getStepErrors("publish", { ...base, seriesChoice: { kind: "existing", id: "s1", title: "B" }, seriesEpisodeNum: null })).toEqual([]);
  });
});

describe("applySeriesChoice: the requests after publish", () => {
  afterEach(() => {
    (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
    (api.post as unknown as { mockRestore?: () => void }).mockRestore?.();
  });

  test("an existing series: reads the episodes, then adds the post as max+1", async () => {
    const get = spyOn(api, "get").mockResolvedValue({ data: { data: [{ post_id: "a", episode_num: 1 }, { post_id: "b", episode_num: 3 }] } } as never);
    const post = spyOn(api, "post").mockResolvedValue({ data: { data: {} } } as never);
    expect(await applySeriesChoice("p9", { kind: "existing", id: "s1", title: "B" }, null)).toEqual({ seriesId: "s1", episodeNum: 4 });
    expect(get).toHaveBeenCalledWith("/v1/video-series/s1/episodes");
    expect(post).toHaveBeenCalledWith("/v1/video-series/s1/episodes", { post_id: "p9", episode_num: 4 });
  });

  test("a typed episode skips the read", async () => {
    const get = spyOn(api, "get").mockResolvedValue({ data: { data: [] } } as never);
    const post = spyOn(api, "post").mockResolvedValue({ data: { data: {} } } as never);
    await applySeriesChoice("p9", { kind: "existing", id: "s1", title: "B" }, 7);
    expect(get).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith("/v1/video-series/s1/episodes", { post_id: "p9", episode_num: 7 });
  });

  test("a new series: POST /v1/video-series {title}, then episode 1", async () => {
    const post = spyOn(api, "post").mockImplementation(((url: string) =>
      Promise.resolve(url === "/v1/video-series" ? { data: { data: { id: "new1", title: "Weekend builds", episode_count: 0 } } } : { data: { data: {} } })) as never);
    expect(await applySeriesChoice("p9", { kind: "new", title: "  Weekend builds " }, null)).toEqual({ seriesId: "new1", episodeNum: 1 });
    expect(post.mock.calls[0]).toEqual(["/v1/video-series", { title: "Weekend builds" }]);
    expect(post.mock.calls[1]).toEqual(["/v1/video-series/new1/episodes", { post_id: "p9", episode_num: 1 }]);
  });

  test("none sends nothing; a failure throws for the caller to catch", async () => {
    const post = spyOn(api, "post").mockRejectedValue(new Error("409"));
    expect(await applySeriesChoice("p9", { kind: "none" }, null)).toBeNull();
    expect(post).not.toHaveBeenCalled();
    await expect(applySeriesChoice("p9", { kind: "existing", id: "s1", title: "B" }, 2)).rejects.toThrow("409");
  });

  test("the follow-up toast points at the right hub sheet", () => {
    expect(hubEditHref("p 1", "elements")).toBe("/posttube/hub/library?edit=p%201&sheet=elements");
    expect(followUpNotice([])).toBeNull();
    expect(followUpNotice(["series"])).toMatchObject({ sheet: "details" });
    expect(followUpNotice(["chapters"])?.description).toContain("the chapters");
    expect(followUpNotice(["series", "chapters"])).toMatchObject({ sheet: "elements" });
  });
});

/* ── (c) Chapters at upload ──────────────────────────────── */

describe("validateChapterRows", () => {
  test("none is valid; a proper list is valid", () => {
    expect(validateChapterRows([])).toEqual([]);
    expect(validateChapterRows(rows(["0:00", "Intro"], ["1:30", "Setup"], ["12:05", "Wrap"]), 15 * 60_000)).toEqual([]);
  });

  test("the first chapter starts at 0:00", () => {
    expect(validateChapterRows(rows(["0:05", "Intro"])).map((i) => i.message)).toEqual(["The first chapter starts at 0:00."]);
  });

  test("each starts after the one before (no ties, no re-sorting)", () => {
    const issues = validateChapterRows(rows(["0:00", "A"], ["2:00", "B"], ["1:00", "C"], ["1:00", "D"]));
    expect(issues.map((i) => i.key)).toEqual([2, 3]);
    expect(issues[0].message).toBe("Chapter 3 must start after chapter 2.");
  });

  test("an unparsable time, a missing title and a start past the end are each named", () => {
    const issues = validateChapterRows(rows(["0:00", ""], ["abc", "B"], ["9:00", "C"]), 5 * 60_000);
    expect(issues.map((i) => i.message)).toEqual(["Chapter 1 needs a title.", "Chapter 2: enter a start time like 1:30.", "Chapter 3 starts after the video ends."]);
  });

  test("the Enrich step blocks on them, one error per issue with distinct fields", () => {
    const form = longForm({ chapterRows: rows(["0:10", ""]), videoDurationSec: 600 });
    const errors = getEnrichErrors(form);
    expect(errors).toHaveLength(2);
    expect(new Set(errors.map((e) => e.field)).size).toBe(2);
    expect(getStepErrors("enrich", longForm())).toEqual([]);
  });

  test("the hub's looser rule and the wire mapping are unchanged", () => {
    const r = rows(["1:00", "B"], ["0:00", "A"]);
    expect(chapterRowsComplete(r)).toBe(true);
    expect(chapterRowsToWire(r)).toEqual([
      { title: "B", start_ms: 60_000 },
      { title: "A", start_ms: 0 },
    ]);
    expect(newChapterRow([], 5)).toEqual({ key: 5, clock: "0:00", title: "" });
    expect(newChapterRow(r, 6)).toEqual({ key: 6, clock: "", title: "" });
  });
});

describe("ChaptersEditor (shared by the hub and the studio)", () => {
  test("rows, the empty hint, invalid marks and the footer slot", () => {
    const empty = renderToStaticMarkup(<ChaptersEditor rows={[]} onChange={() => {}} emptyHint="Optional." />);
    expect(empty).toContain('data-editor="chapters"');
    expect(empty).toContain("Optional.");
    const html = renderToStaticMarkup(
      <ChaptersEditor rows={rows(["0:00", "Intro"], ["0:30", "Next"])} onChange={() => {}} invalidKeys={new Set([1])} footer={<span data-footer>ok</span>} />,
    );
    expect(html).toContain('aria-label="Chapter 1 start"');
    expect(html).toContain('value="Intro"');
    expect(html.match(/aria-invalid="true"/g)?.length).toBe(1);
    expect(html).toContain("data-footer");
  });
});

import api from "@/lib/api";

import { saveChapters } from "@/features/posttube/hub/hubApi";

import { studioSoundFields } from "./studioSound";
import type { StudioFormState } from "./types";

/**
 * Everything the studio collected, as POST /v1/posts fields, for the
 * publish path that creates the post directly (no draft was saved). Before
 * this the direct create sent only the caption, so a long video was refused
 * with TITLE_REQUIRED and its topic, settings and schedule were dropped.
 * Field names are post-service CreatePostRequest's. A chosen sound adds
 * audio_track_id and audio_start_ms; with none chosen neither is sent.
 */
export function studioCreateFields(form: StudioFormState): Record<string, unknown> {
  const out: Record<string, unknown> = {
    title: form.title.trim(),
    no_comments: !form.commentsEnabled,
    no_likes: !form.likesEnabled,
    is_made_for_kids: form.isMadeForKids,
    paid_promotion: form.paidPromotion,
    altered_content: form.alteredContent,
    license: form.license,
    allow_embedding: form.allowEmbedding,
    remix_setting: form.remixSetting,
    comment_moderation: form.commentModeration,
    comment_access: form.commentAccess,
    original_audio_volume: form.originalAudioVolume,
    overlay_audio_volume: form.overlayAudioVolume,
    ...studioSoundFields(form),
  };
  if (form.category) out.category = form.category;
  if (form.language) out.language = form.language;
  if (form.tags.length > 0) out.tags = form.tags;
  if (form.recordingDate) out.recording_date = form.recordingDate;
  if (form.recordingLocation) out.recording_location = form.recordingLocation;
  // The picker holds a local "YYYY-MM-DDTHH:mm"; the create route wants RFC3339.
  if (form.scheduleAt) {
    const at = new Date(form.scheduleAt);
    if (!Number.isNaN(at.getTime())) out.publish_at = at.toISOString();
  }
  return out;
}

/*
  The upload studio's follow-up requests — what runs after the post
  exists: series assignment and chapters. Every request shape the studio
  sends outside reelsApi / posttubeApi lives here (or, for chapters, in
  the hub's adapter, which owns that body).

    GET  /v1/creators/:creatorId/video-series?limit=100   the creator's series (their own copy includes private ones)
    POST /v1/video-series                                  { title }            → the new series row
    GET  /v1/video-series/:seriesId/episodes               [{ series_id, post_id, episode_num, title?, added_at }]
    POST /v1/video-series/:seriesId/episodes               { post_id, episode_num }  (409 when the number is taken)
    DELETE /v1/video-series/:seriesId/episodes/:postId     removes the post from the series (the ref may be a post id or a number)
    POST /v1/posts/:postId/chapters                        hubApi.saveChapters — { chapters: [{chapter_index, title, start_ms, source:"manual"}] }

  Shapes verbatim from post-service internal/http/video_series_handler.go
  and internal/store/postgres/video_series.go.
*/

interface Envelope<T> {
  data: T;
}

export interface StudioSeries {
  id: string;
  title: string;
  episodeCount: number;
}

export interface StudioEpisode {
  postId: string;
  episodeNum: number;
}

function listOf(raw: unknown): Record<string, unknown>[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items) ? (raw as { items: unknown[] }).items : [];
  return list.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
}

export function normalizeSeriesRow(raw: unknown): StudioSeries | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  if (!id) return null;
  const count = typeof o.episode_count === "number" && Number.isFinite(o.episode_count) ? Math.max(0, o.episode_count) : 0;
  return { id, title: (typeof o.title === "string" && o.title.trim()) || "Untitled series", episodeCount: count };
}

export function normalizeEpisodes(raw: unknown): StudioEpisode[] {
  return listOf(raw)
    .map((e) => ({ postId: typeof e.post_id === "string" ? e.post_id : "", episodeNum: typeof e.episode_num === "number" ? e.episode_num : NaN }))
    .filter((e) => e.postId && Number.isInteger(e.episodeNum) && e.episodeNum > 0);
}

export async function listMySeries(creatorId: string): Promise<StudioSeries[]> {
  const res = await api.get<Envelope<unknown>>(`/v1/creators/${encodeURIComponent(creatorId)}/video-series`, { params: { limit: "100" } });
  return listOf(res.data?.data)
    .map(normalizeSeriesRow)
    .filter((s): s is StudioSeries => s !== null);
}

export async function createSeries(title: string): Promise<StudioSeries> {
  const res = await api.post<Envelope<unknown>>("/v1/video-series", { title: title.trim() });
  const row = normalizeSeriesRow(res.data?.data);
  if (!row) throw new Error("The new series came back without an id.");
  return row;
}

export async function listSeriesEpisodes(seriesId: string): Promise<StudioEpisode[]> {
  const res = await api.get<Envelope<unknown>>(`/v1/video-series/${encodeURIComponent(seriesId)}/episodes`);
  return normalizeEpisodes(res.data?.data);
}

export async function addSeriesEpisode(seriesId: string, postId: string, episodeNum: number): Promise<void> {
  await api.post(`/v1/video-series/${encodeURIComponent(seriesId)}/episodes`, { post_id: postId, episode_num: episodeNum });
}

export async function removeSeriesEpisode(seriesId: string, postId: string): Promise<void> {
  await api.delete(`/v1/video-series/${encodeURIComponent(seriesId)}/episodes/${encodeURIComponent(postId)}`);
}

/* ── Pure: moving a published post between series (Creator Hub) ── */

export interface SeriesMembership {
  seriesId: string;
  episodeNum: number;
}

export type SeriesChangePlan =
  | { kind: "noop" }
  | { kind: "remove"; from: string }
  | { kind: "add"; choice: Exclude<SeriesChoice, { kind: "none" }>; episode: number | null }
  | { kind: "move"; from: string; choice: Exclude<SeriesChoice, { kind: "none" }>; episode: number | null };

/**
 * What saving the series control does for a post that may already be an
 * episode: nothing, remove it, add it, or move it (remove then add). A
 * renumber inside the same series is a move to itself.
 */
export function planSeriesChange(current: SeriesMembership | null, choice: SeriesChoice, episode: number | null): SeriesChangePlan {
  if (choice.kind === "none") return current ? { kind: "remove", from: current.seriesId } : { kind: "noop" };
  if (!current) return { kind: "add", choice, episode };
  if (choice.kind === "existing" && choice.id === current.seriesId && (episode === null || episode === current.episodeNum)) return { kind: "noop" };
  return { kind: "move", from: current.seriesId, choice, episode };
}

/**
 * Runs a plan. A move removes first (the backend holds one membership per
 * series); if the add then fails, the old membership is put back so the
 * post is never left out of a series it was in, and the error is rethrown.
 */
export async function applySeriesPlan(postId: string, current: SeriesMembership | null, plan: SeriesChangePlan): Promise<{ seriesId: string; episodeNum: number } | null> {
  if (plan.kind === "noop") return current ? { seriesId: current.seriesId, episodeNum: current.episodeNum } : null;
  if (plan.kind === "remove") {
    await removeSeriesEpisode(plan.from, postId);
    return null;
  }
  if (plan.kind === "add") return applySeriesChoice(postId, plan.choice, plan.episode);
  await removeSeriesEpisode(plan.from, postId);
  try {
    return await applySeriesChoice(postId, plan.choice, plan.episode);
  } catch (err) {
    if (current) await addSeriesEpisode(current.seriesId, postId, current.episodeNum).catch(() => undefined);
    throw err;
  }
}

/** Chapters through the hub's adapter, the one place their body lives. */
export async function saveUploadChapters(postId: string, chapters: { title: string; start_ms: number }[]): Promise<void> {
  await saveChapters(postId, chapters);
}

/* ── Pure: the episode number ───────────────────────────── */

/** The default episode number: one past the highest, 1 for an empty (or new) series. */
export function nextEpisodeNumber(episodes: readonly { episodeNum: number }[] | null | undefined): number {
  let max = 0;
  for (const e of episodes ?? []) if (Number.isInteger(e.episodeNum) && e.episodeNum > max) max = e.episodeNum;
  return max + 1;
}

/** The creator's own pick wins when it is a positive whole number; otherwise the default. */
export function resolveEpisodeNumber(chosen: number | null | undefined, episodes: readonly { episodeNum: number }[] | null | undefined): number {
  if (typeof chosen === "number" && Number.isInteger(chosen) && chosen > 0) return chosen;
  return nextEpisodeNumber(episodes);
}

/* ── Pure: where to finish in the Creator Hub ───────────── */

export type HubSheet = "details" | "elements" | "captions";

/** The Creator Hub library with the edit sheet open on `postId` (LibraryPage reads `edit` and `sheet`). */
export function hubEditHref(postId: string, sheet: HubSheet = "details"): string {
  return `/posttube/hub/library?edit=${encodeURIComponent(postId)}&sheet=${sheet}`;
}

/**
 * The follow-up toast for what did not stick after publish: its words and
 * the sheet to open. Series and chapters both live on the Elements tab.
 * null when nothing failed.
 */
export function followUpNotice(failures: readonly ("series" | "chapters")[]): { title: string; description: string; sheet: HubSheet } | null {
  const series = failures.includes("series");
  const chapters = failures.includes("chapters");
  if (!series && !chapters) return null;
  const what = series && chapters ? "the series and the chapters" : series ? "the series" : "the chapters";
  return {
    title: "Published, with one thing left",
    description: `Your video went through, but ${what} did not save. Finish it in Creator Hub.`,
    sheet: "elements",
  };
}

/* ── The series step after publish ──────────────────────── */

export type SeriesChoice = { kind: "none" } | { kind: "existing"; id: string; title: string } | { kind: "new"; title: string };

/**
 * Puts the published post into the chosen series: creates a new series
 * first when asked, reads the episodes for the default number (fresh, so
 * a parallel upload is counted), then adds it. Throws on any failure —
 * the caller keeps the post published and points at the hub.
 */
export async function applySeriesChoice(postId: string, choice: SeriesChoice, chosenEpisode: number | null): Promise<{ seriesId: string; episodeNum: number } | null> {
  if (choice.kind === "none") return null;
  let seriesId: string;
  let episodes: StudioEpisode[] = [];
  if (choice.kind === "new") {
    const created = await createSeries(choice.title);
    seriesId = created.id;
  } else {
    seriesId = choice.id;
    if (chosenEpisode === null) episodes = await listSeriesEpisodes(seriesId);
  }
  const episodeNum = resolveEpisodeNumber(chosenEpisode, episodes);
  await addSeriesEpisode(seriesId, postId, episodeNum);
  return { seriesId, episodeNum };
}

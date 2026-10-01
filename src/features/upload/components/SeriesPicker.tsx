"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ListVideo, Loader2 } from "lucide-react";

import { useAuthUser } from "@/store/auth";

import { StudioInput, StudioSelect } from "../primitives";
import { listMySeries, listSeriesEpisodes, nextEpisodeNumber, type SeriesChoice, type StudioSeries } from "../studioApi";
import type { StudioFormState } from "../types";

/*
  Series for a long video: none, one of the creator's series, or a new
  one by name. The episode number defaults to one past the series'
  highest (1 for a new series); typing one overrides it. Nothing is sent
  here — the studio creates the series (when new) and adds the episode
  after the post is published (studioApi.applySeriesChoice).
*/

const NONE = "";
const NEW = "__new__";

export const UPLOAD_KEYS = {
  mySeries: (creatorId: string) => ["upload", "my-series", creatorId] as const,
  episodes: (seriesId: string) => ["upload", "series-episodes", seriesId] as const,
};

/** The select's value for a choice. */
export function seriesSelectValue(choice: SeriesChoice): string {
  return choice.kind === "none" ? NONE : choice.kind === "new" ? NEW : choice.id;
}

/** The select's value → a choice; a new-series title typed earlier is kept. */
export function seriesChoiceFor(value: string, series: readonly StudioSeries[], previous: SeriesChoice): SeriesChoice {
  if (value === NONE) return { kind: "none" };
  if (value === NEW) return { kind: "new", title: previous.kind === "new" ? previous.title : "" };
  const found = series.find((s) => s.id === value);
  return found ? { kind: "existing", id: found.id, title: found.title } : { kind: "none" };
}

interface SeriesPickerProps {
  form: StudioFormState;
  patch: (u: Partial<StudioFormState>) => void;
  showErrors?: boolean;
}

export function SeriesPicker({ form, patch, showErrors }: SeriesPickerProps) {
  const user = useAuthUser();
  const creatorId = user?.id ?? "";
  const mySeries = useQuery({
    queryKey: UPLOAD_KEYS.mySeries(creatorId),
    queryFn: () => listMySeries(creatorId),
    enabled: !!creatorId,
    staleTime: 60_000,
  });
  const choice = form.seriesChoice;
  const existingId = choice.kind === "existing" ? choice.id : "";
  const episodes = useQuery({
    queryKey: UPLOAD_KEYS.episodes(existingId),
    queryFn: () => listSeriesEpisodes(existingId),
    enabled: !!existingId,
    staleTime: 30_000,
  });

  const series = mySeries.data ?? [];
  const options = [{ value: NONE, label: "No series" }, ...series.map((s) => ({ value: s.id, label: `${s.title} · ${s.episodeCount} ${s.episodeCount === 1 ? "episode" : "episodes"}` })), { value: NEW, label: "New series…" }];
  const defaultEpisode = choice.kind === "new" ? 1 : choice.kind === "existing" ? (episodes.data ? nextEpisodeNumber(episodes.data) : null) : null;
  const titleError = showErrors && choice.kind === "new" && !choice.title.trim();
  const episodeInvalid = form.seriesEpisodeNum !== null && (!Number.isInteger(form.seriesEpisodeNum) || form.seriesEpisodeNum < 1);

  return (
    <div data-field="series">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-text/10">
          <ListVideo className="h-4 w-4 text-brand-text" />
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-brand-text">Series</h3>
          <p className="text-[11px] text-brand-text/50">Viewers get the next episode when this one ends</p>
        </div>
        {mySeries.isLoading ? <Loader2 className="ml-auto h-4 w-4 animate-spin text-brand-text/50" aria-label="Loading your series" /> : null}
      </div>
      <div className="space-y-3 rounded-xl border border-brand-divider bg-brand-card p-4 shadow-xs">
        <StudioSelect label="Series (optional)" value={seriesSelectValue(choice)} onChange={(v) => patch({ seriesChoice: seriesChoiceFor(v, series, choice), seriesEpisodeNum: null })} options={options} />
        {mySeries.isError ? (
          <p className="flex items-center gap-1.5 text-[12px] text-brand-text/60">
            <AlertCircle className="h-3.5 w-3.5" />
            Your series could not be loaded.
            <button type="button" onClick={() => void mySeries.refetch()} className="font-semibold text-brand-text underline-offset-2 hover:underline">
              Try again
            </button>
          </p>
        ) : null}
        {choice.kind === "new" ? (
          <div>
            <label htmlFor="upload-seriesTitle" className="mb-1.5 block text-[12px] font-semibold text-brand-text/60">Series name <span className="text-danger">*</span></label>
            <StudioInput id="upload-seriesTitle" required invalid={!!titleError} describedBy={titleError ? "upload-series-error" : undefined} value={choice.title} onChange={(v) => patch({ seriesChoice: { kind: "new", title: v } })} placeholder="e.g. Weekend builds" maxLength={120} autoFocus />
            {titleError ? <p id="upload-series-error" className="upload-field-error" role="alert">Add a name for this new series, or choose No series.</p> : null}
          </div>
        ) : null}
        {choice.kind !== "none" ? (
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-brand-text/60">Episode number</p>
            <input
              type="number"
              id="upload-seriesEpisode"
              min={1}
              step={1}
              inputMode="numeric"
              value={form.seriesEpisodeNum ?? ""}
              onChange={(e) => {
                const raw = e.target.value.trim();
                patch({ seriesEpisodeNum: raw === "" ? null : Number(raw) });
              }}
              placeholder={defaultEpisode !== null ? String(defaultEpisode) : "…"}
              aria-invalid={episodeInvalid}
              aria-label="Episode number"
              className="h-11 w-32 rounded-xl border border-brand-text/10 bg-brand-secondary px-4 text-[14px] text-brand-text placeholder:text-brand-text/40 outline-hidden focus:border-brand-text focus:bg-brand-card focus:ring-2 focus:ring-brand-text/10 transition-all"
            />
            <p className="mt-1.5 text-[11px] text-brand-text/50">
              {episodeInvalid
                ? "Use a whole number, 1 or more."
                : defaultEpisode !== null
                  ? `Leave empty for episode ${defaultEpisode}, the next one.`
                  : "The next number is picked when you publish."}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

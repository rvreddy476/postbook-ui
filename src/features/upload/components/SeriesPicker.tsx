"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ListVideo, Loader2 } from "lucide-react";

import { useAuthUser } from "@/store/auth";

import { Section, StudioInput, StudioSelect } from "../primitives";
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
      <Section
        title="Series"
        subtitle="Viewers get the next episode when this one ends"
        icon={ListVideo}
        aside={mySeries.isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading your series" /> : null}
      >
        <div className="upload-group upload-group-pad">
          <StudioSelect label="Series (optional)" value={seriesSelectValue(choice)} onChange={(v) => patch({ seriesChoice: seriesChoiceFor(v, series, choice), seriesEpisodeNum: null })} options={options} />
          {mySeries.isError ? (
            <p className="upload-input-hint flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Your series could not be loaded.
              <button type="button" onClick={() => void mySeries.refetch()} className="upload-link-button">
                Try again
              </button>
            </p>
          ) : null}
          {choice.kind === "new" ? (
            <div>
              <label htmlFor="upload-seriesTitle" className="upload-label"><span>Series name<span className="upload-required" aria-label="required">*</span></span></label>
              <StudioInput id="upload-seriesTitle" required invalid={!!titleError} describedBy={titleError ? "upload-series-error" : undefined} value={choice.title} onChange={(v) => patch({ seriesChoice: { kind: "new", title: v } })} placeholder="e.g. Weekend builds" maxLength={120} autoFocus />
              {titleError ? <p id="upload-series-error" className="upload-field-error" role="alert">Add a name for this new series, or choose No series.</p> : null}
            </div>
          ) : null}
          {choice.kind !== "none" ? (
            <div>
              <label htmlFor="upload-seriesEpisode" className="upload-label"><span>Episode number</span></label>
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
                aria-describedby="upload-seriesEpisode-hint"
                className="upload-input upload-input-narrow"
              />
              <p id="upload-seriesEpisode-hint" className="upload-input-hint">
                {episodeInvalid
                  ? "Use a whole number, 1 or more."
                  : defaultEpisode !== null
                    ? `Leave empty for episode ${defaultEpisode}, the next one.`
                    : "The next number is picked when you publish."}
              </p>
            </div>
          ) : null}
        </div>
      </Section>
    </div>
  );
}

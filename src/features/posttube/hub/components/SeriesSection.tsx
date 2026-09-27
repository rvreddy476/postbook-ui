"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListVideo } from "lucide-react";

import { useGlobalToast } from "@/contexts/ToastContext";
import { getSeries } from "@/features/posttube/data/posttubeApi";
import {
  applySeriesPlan,
  listMySeries,
  listSeriesEpisodes,
  nextEpisodeNumber,
  planSeriesChange,
  type SeriesChoice,
  type SeriesMembership,
} from "@/features/upload/studioApi";
import { useAuthUser } from "@/store/auth";

const NONE = "";
const NEW = "__new__";

export const HUB_SERIES_KEYS = {
  membership: (postId: string) => ["hub", "series", "membership", postId] as const,
  mine: (creatorId: string) => ["hub", "series", "mine", creatorId] as const,
  episodes: (seriesId: string) => ["hub", "series", "episodes", seriesId] as const,
};

/** The default number for a pick, ignoring this post's own row (a renumber in place). */
export function defaultEpisodeFor(episodes: readonly { postId: string; episodeNum: number }[] | undefined, postId: string, choice: SeriesChoice): number | null {
  if (choice.kind === "new") return 1;
  if (choice.kind !== "existing" || !episodes) return null;
  return nextEpisodeNumber(episodes.filter((e) => e.postId !== postId));
}

/*
  The series control in the Creator Hub (Elements tab, long videos only):
  the episode this video is today, and Save to move it to another series,
  a new one, renumber it, or take it out. Moves go through the studio's
  series adapter (planSeriesChange / applySeriesPlan), so the upload
  studio and the hub send the same requests.
*/
export function SeriesSection({ postId }: { postId: string }) {
  const toast = useGlobalToast();
  const qc = useQueryClient();
  const user = useAuthUser();
  const creatorId = user?.id ?? "";

  const membershipQuery = useQuery({
    queryKey: HUB_SERIES_KEYS.membership(postId),
    queryFn: async (): Promise<SeriesMembership | null> => {
      const info = await getSeries(postId);
      const seriesId = info?.series?.id;
      const num = info?.current?.episode_num;
      return seriesId && typeof num === "number" ? { seriesId, episodeNum: num } : null;
    },
    staleTime: 30_000,
  });
  const mineQuery = useQuery({
    queryKey: HUB_SERIES_KEYS.mine(creatorId),
    queryFn: () => listMySeries(creatorId),
    enabled: !!creatorId,
    staleTime: 60_000,
  });

  const current = membershipQuery.data ?? null;
  const [choice, setChoice] = useState<SeriesChoice | null>(null);
  const [episodeText, setEpisodeText] = useState("");
  const [saving, setSaving] = useState(false);

  // Start from where the video is today, once both reads answer.
  useEffect(() => {
    if (choice !== null || membershipQuery.isPending || mineQuery.isPending) return;
    if (!current) {
      setChoice({ kind: "none" });
      return;
    }
    const s = mineQuery.data?.find((x) => x.id === current.seriesId);
    setChoice({ kind: "existing", id: current.seriesId, title: s?.title ?? "This series" });
    setEpisodeText(String(current.episodeNum));
  }, [choice, current, membershipQuery.isPending, mineQuery.isPending, mineQuery.data]);

  const existingId = choice?.kind === "existing" ? choice.id : "";
  const episodesQuery = useQuery({
    queryKey: HUB_SERIES_KEYS.episodes(existingId),
    queryFn: () => listSeriesEpisodes(existingId),
    enabled: !!existingId,
    staleTime: 30_000,
  });

  const series = mineQuery.data ?? [];
  const defaultEpisode = choice ? defaultEpisodeFor(episodesQuery.data, postId, choice) : null;
  const typed = episodeText.trim() === "" ? null : Number(episodeText);
  const episodeInvalid = typed !== null && (!Number.isInteger(typed) || typed < 1);
  const titleMissing = choice?.kind === "new" && !choice.title.trim();
  const plan = useMemo(() => (choice ? planSeriesChange(current, choice, typed) : { kind: "noop" as const }), [choice, current, typed]);

  if (membershipQuery.isPending || mineQuery.isPending || choice === null) {
    return (
      <div className="hub-elem" aria-busy="true">
        <div className="hub-elem-head">
          <span>Series</span>
        </div>
        <span className="hub-hint">Loading…</span>
      </div>
    );
  }

  const selectValue = choice.kind === "none" ? NONE : choice.kind === "new" ? NEW : choice.id;
  const onSelect = (value: string) => {
    setEpisodeText("");
    if (value === NONE) return setChoice({ kind: "none" });
    if (value === NEW) return setChoice({ kind: "new", title: "" });
    const s = series.find((x) => x.id === value);
    if (s) setChoice({ kind: "existing", id: s.id, title: s.title });
    if (current && value === current.seriesId) setEpisodeText(String(current.episodeNum));
  };

  const save = async () => {
    if (plan.kind === "noop" || episodeInvalid || titleMissing) return;
    setSaving(true);
    try {
      const result = await applySeriesPlan(postId, current, plan);
      toast({ type: "success", title: result ? `Saved as episode ${result.episodeNum}` : "Removed from the series" });
      setChoice(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["hub", "series"] }),
        qc.invalidateQueries({ queryKey: ["posttube", "series"] }),
      ]);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      toast({
        type: "error",
        title: "Could not save the series",
        description: status === 409 ? "That episode number is taken in this series. Pick another." : "Nothing changed. Try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hub-elem" data-hub-series>
      <div className="hub-elem-head">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ListVideo size={14} aria-hidden /> Series
        </span>
        {current ? <span className="hub-hint">Episode {current.episodeNum} today</span> : null}
      </div>
      <div className="hub-elem-row hub-elem-row-3">
        <select className="hub-select hub-input-sm" value={selectValue} aria-label="Series" onChange={(e) => onSelect(e.target.value)}>
          <option value={NONE}>No series</option>
          {series.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} · {s.episodeCount} {s.episodeCount === 1 ? "episode" : "episodes"}
            </option>
          ))}
          <option value={NEW}>New series…</option>
        </select>
        {choice.kind === "new" ? (
          <input className="hub-input hub-input-sm" value={choice.title} maxLength={120} aria-label="New series name" placeholder="Series name" onChange={(e) => setChoice({ kind: "new", title: e.target.value })} />
        ) : (
          <span />
        )}
        {choice.kind !== "none" ? (
          <input
            className="hub-input hub-input-sm"
            inputMode="numeric"
            value={episodeText}
            aria-label="Episode number"
            aria-invalid={episodeInvalid || undefined}
            placeholder={defaultEpisode ? `Episode ${defaultEpisode}` : "Episode"}
            onChange={(e) => setEpisodeText(e.target.value.replace(/[^\d]/g, ""))}
          />
        ) : (
          <span />
        )}
      </div>
      {episodeInvalid ? <span className="hub-hint" style={{ color: "rgb(var(--danger))" }}>Episode numbers start at 1.</span> : null}
      <div className="hub-row" style={{ justifyContent: "space-between" }}>
        <span className="hub-hint">Viewers get the next episode when this one ends.</span>
        <button type="button" className="hub-btn hub-btn-sm hub-btn-primary" onClick={save} disabled={saving || plan.kind === "noop" || episodeInvalid || titleMissing}>
          {saving ? "Saving…" : plan.kind === "remove" ? "Remove from series" : "Save series"}
        </button>
      </div>
    </div>
  );
}

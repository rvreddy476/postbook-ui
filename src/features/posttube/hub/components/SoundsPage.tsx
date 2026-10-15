"use client";

import { Music2, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { formatCount, formatDuration } from "@/features/posttube/model";
import type { HubLibrarySound } from "../hubApi";
import { useSoundLibrary } from "../hooks/useHub";
import { HubHead } from "./HubFrame";
import { HubEmpty, HubError, HubSkeleton } from "./HubEmpty";
import { PillGroup } from "./Pills";

/*
  /posttube/hub/sounds — the sound library (GET /v1/audio-library), browse
  and preview only. A library track cannot be put on a video from here:
  the attach routes take an id from the sounds catalogue, a different table.

  Preview: nothing plays until the creator presses Play. The one <audio>
  element starts muted with preload="none", so no sound and no download
  happen on load; Play unmutes it and starts that track.
*/

export interface SoundListProps {
  rows: HubLibrarySound[];
  playingId: string | null;
  onToggle: (sound: HubLibrarySound) => void;
}

/** Pure presentation, rendered by the tests without a query client. */
export function SoundList({ rows, playingId, onToggle }: SoundListProps) {
  return (
    <ul className="hub-list hub-sound-list">
      {rows.map((s) => {
        const playing = playingId === s.id;
        const meta = [s.artist, formatDuration(s.duration_ms / 1000), s.genre, s.mood].filter(Boolean).join(" · ");
        return (
          <li key={s.id}>
            <span className="hub-thumb hub-sound-cover" aria-hidden="true">
              {s.cover_url ? <img src={s.cover_url} alt="" loading="lazy" /> : <Music2 />}
            </span>
            <span className="grow">
              <span className="hub-sound-title">{s.title}</span>
              {meta ? <span className="hub-row-meta">{meta}</span> : null}
            </span>
            {s.is_trending ? <span className="hub-tag hub-tag-info">Popular</span> : null}
            <span className="num">{s.usage_count > 0 ? `${formatCount(s.usage_count)} ${s.usage_count === 1 ? "video" : "videos"}` : ""}</span>
            <button
              type="button"
              className="hub-btn hub-btn-sm"
              aria-pressed={playing}
              aria-label={playing ? `Pause ${s.title}` : `Play ${s.title}`}
              disabled={!s.audio_url}
              title={s.audio_url ? undefined : "No preview for this sound"}
              onClick={() => onToggle(s)}
            >
              {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />} {playing ? "Pause" : "Play"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function SoundsPage() {
  const [genre, setGenre] = useState("");
  const [knownGenres, setKnownGenres] = useState<string[]>([]);
  const sounds = useSoundLibrary(genre);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);

  // Genres seen so far, so the filter keeps its options once one is chosen.
  useEffect(() => {
    const found = sounds.rows.map((s) => s.genre).filter(Boolean);
    if (found.length === 0) return;
    setKnownGenres((prev) => {
      const next = [...new Set([...prev, ...found])].sort((a, b) => a.localeCompare(b));
      return next.length === prev.length ? prev : next;
    });
  }, [sounds.rows]);

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.muted = true;
    }
    setPlayingId(null);
  }, []);

  useEffect(() => stop, [stop]);

  const toggle = useCallback(
    (s: HubLibrarySound) => {
      const a = audioRef.current;
      if (!a || !s.audio_url) return;
      if (playingId === s.id) {
        stop();
        return;
      }
      setPreviewError(false);
      a.pause();
      a.src = s.audio_url;
      a.currentTime = 0;
      a.muted = false;
      setPlayingId(s.id);
      a.play().catch(() => {
        a.muted = true;
        setPlayingId(null);
        setPreviewError(true);
      });
    },
    [playingId, stop],
  );

  const options = useMemo(() => [{ id: "", label: "All" }, ...knownGenres.map((g) => ({ id: g, label: g.charAt(0).toUpperCase() + g.slice(1) }))], [knownGenres]);

  return (
    <>
      <HubHead title="Sounds" sub="Browse the sound library and preview a track." />
      <div className="hub-note" style={{ marginBottom: 10 }}>
        Library sounds can be previewed here. Adding one to a video isn&apos;t available yet.
      </div>
      {options.length > 1 ? (
        <div className="hub-toolbar">
          <PillGroup
            label="Genre"
            value={genre}
            options={options}
            onChange={(g) => {
              stop();
              setGenre(g);
            }}
          />
        </div>
      ) : null}
      {previewError ? <div className="hub-error" role="alert" style={{ marginBottom: 8 }}>That preview could not play.</div> : null}

      {/* Muted and preload="none" until Play is pressed: no sound or download on load. */}
      <audio ref={audioRef} preload="none" muted onEnded={stop} onError={() => {
          if (!playingId) return;
          setPreviewError(true);
          stop();
        }} hidden />

      {sounds.isPending ? (
        <HubSkeleton rows={6} height={44} />
      ) : sounds.isError ? (
        <HubError message="The sound library is not available right now." />
      ) : sounds.rows.length === 0 ? (
        <div className="hub-card">
          <HubEmpty icon={<Music2 aria-hidden="true" />} title="No sounds yet" body={genre ? "Nothing in this genre. Choose All to see every sound." : "The sound library is empty for now."} />
        </div>
      ) : (
        <div className="hub-card hub-card-pad">
          <SoundList rows={sounds.rows} playingId={playingId} onToggle={toggle} />
        </div>
      )}

      {sounds.hasNextPage ? (
        <div className="hub-more">
          <button type="button" className="hub-btn" onClick={() => sounds.fetchNextPage()} disabled={sounds.isFetchingNextPage}>
            {sounds.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </>
  );
}

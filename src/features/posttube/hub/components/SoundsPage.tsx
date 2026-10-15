"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clapperboard, Music2, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { formatCount, formatDuration } from "@/features/posttube/model";
import { createWithSoundHref, signInHref, soundPageHref } from "@/features/reels/sounds";
import { librarySoundUseFailure, type HubLibrarySound, type HubLibrarySoundUse } from "../hubApi";
import { useLibrarySoundUse, useSoundLibrary } from "../hooks/useHub";
import { HUB_ROOT } from "../hubNav";
import { HubHead } from "./HubFrame";
import { HubEmpty, HubError, HubSkeleton } from "./HubEmpty";
import { PillGroup } from "./Pills";

/*
  /posttube/hub/sounds — the sound library (GET /v1/audio-library): preview
  a track, use it in a reel, and see the reels that already use it.

  Use this sound: POST /v1/audio-library/:id/use answers the audio_tracks id
  the library row plays as, and the reel studio opens with THAT id chosen
  (/reels/create?sound=<audio_track_id>, the same door a reel's "Use this
  sound" takes). The library id never leaves this page. A refusal shows the
  server's own line; a signed-out creator is sent to sign in.

  See reels: only once the row has an audio_track_id (someone has used it);
  the sound page lists reels by that id.

  Preview: nothing plays until the creator presses Play. The one <audio>
  element starts muted with preload="none", so no sound and no download
  happen on load; Play unmutes it and starts that track.
*/

/** The reel studio with the used sound chosen: always the audio_tracks id, never the library id. */
export function libraryStudioHref(use: Pick<HubLibrarySoundUse, "audio_track_id">): string {
  return createWithSoundHref(use.audio_track_id);
}

/** The reels that use this sound, or null while nobody has used it (no audio_track_id yet). */
export function libraryReelsHref(sound: Pick<HubLibrarySound, "audio_track_id">): string | null {
  return sound.audio_track_id ? soundPageHref(sound.audio_track_id) : null;
}

export interface SoundListProps {
  rows: HubLibrarySound[];
  playingId: string | null;
  onToggle: (sound: HubLibrarySound) => void;
  /** "Use this sound"; absent = no such button. */
  onUse?: (sound: HubLibrarySound) => void;
  /** The library id whose use is in flight; every Use button waits while one is. */
  usingId?: string | null;
}

/** Pure presentation, rendered by the tests without a query client. */
export function SoundList({ rows, playingId, onToggle, onUse, usingId = null }: SoundListProps) {
  return (
    <ul className="hub-list hub-sound-list">
      {rows.map((s) => {
        const playing = playingId === s.id;
        const meta = [s.artist, formatDuration(s.duration_ms / 1000), s.genre, s.mood].filter(Boolean).join(" · ");
        const reelsHref = libraryReelsHref(s);
        const using = usingId === s.id;
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
            <span className="hub-sound-actions">
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
              {reelsHref ? (
                <Link href={reelsHref} className="hub-btn hub-btn-sm" aria-label={`See reels with ${s.title}`} data-sound-reels>
                  See reels
                </Link>
              ) : null}
              {onUse ? (
                <button
                  type="button"
                  className="hub-btn hub-btn-sm hub-btn-primary"
                  aria-label={`Use ${s.title} in a reel`}
                  aria-busy={using || undefined}
                  disabled={usingId !== null}
                  data-action="use-sound"
                  onClick={() => onUse(s)}
                >
                  <Clapperboard aria-hidden="true" /> {using ? "Opening…" : "Use this sound"}
                </button>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function SoundsPage() {
  const router = useRouter();
  const [genre, setGenre] = useState("");
  const [knownGenres, setKnownGenres] = useState<string[]>([]);
  const sounds = useSoundLibrary(genre);
  const { mutateAsync: requestUse } = useLibrarySoundUse();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [usingId, setUsingId] = useState<string | null>(null);
  const [useError, setUseError] = useState<string | null>(null);

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

  // Use this sound: ask for the audio_tracks id, then open the studio with it.
  const chooseSound = useCallback(
    async (s: HubLibrarySound) => {
      if (usingId) return;
      stop();
      setUseError(null);
      setUsingId(s.id);
      try {
        const answer = await requestUse(s.id);
        // The button keeps saying "Opening…" while the studio loads.
        router.push(libraryStudioHref(answer));
      } catch (err) {
        const failure = librarySoundUseFailure(err);
        if (failure.kind === "signed-out") {
          router.push(signInHref(`${HUB_ROOT}/sounds`));
          return;
        }
        setUseError(failure.message);
        setUsingId(null);
      }
    },
    [usingId, stop, requestUse, router],
  );

  const options = useMemo(() => [{ id: "", label: "All" }, ...knownGenres.map((g) => ({ id: g, label: g.charAt(0).toUpperCase() + g.slice(1) }))], [knownGenres]);

  return (
    <>
      <HubHead title="Sounds" sub="Preview a track from the sound library and use it in a reel." />
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
      {useError ? (
        <div className="hub-error" role="alert" style={{ marginBottom: 8 }} data-sound-use-error>
          {useError}
        </div>
      ) : null}

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
          <SoundList rows={sounds.rows} playingId={playingId} onToggle={toggle} onUse={chooseSound} usingId={usingId} />
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

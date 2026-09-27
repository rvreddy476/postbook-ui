"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type Hls from "hls.js";
import {
  Captions,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  Volume2,
  VolumeX,
} from "lucide-react";

import { clampSpeed, pickHlsLevel, SPEEDS, speedChipLabel } from "@/features/reels/playback/playerPrefs";
import { formatClockMs, type TubePlayerPrefs } from "../model";
import { playerKeyAction, playerKeyPreventsDefault, SEEK_LARGE_S } from "../playerKeys";

/*
  The long-video player. One <video>, HLS through hls.js (native on Safari)
  with the progressive file as the fallback, a quality picker from the
  manifest, speed, captions from the subtitles service, and our keyboard
  (playerKeys.ts). It reports position/duration upward and never persists
  anything itself: the watch page owns progress saving and the end-of-video
  decision.
*/

export interface CaptionTrack {
  lang: string;
  label: string;
  src: string;
}

export interface TubePlayerProps {
  /** Re-keys the resume seek and the end state. */
  videoId: string;
  hlsUrl: string | null;
  fileUrl: string;
  poster?: string;
  captions: CaptionTrack[];
  /** Where playback starts (resume), in ms. 0 = from the top. */
  startPositionMs: number;
  /** Set once the resume position is known; the seek waits for it. */
  startReady: boolean;
  autoPlay: boolean;
  /** Data-saver: show the poster and wait for a tap before loading anything. */
  deferLoad?: boolean;
  trimStartMs?: number;
  trimEndMs?: number;
  prefs: TubePlayerPrefs;
  onPrefsChange: (patch: Partial<TubePlayerPrefs>) => void;
  /** Autoplay-next row in the gear menu; hidden when not in a series. */
  autoplayNext?: { on: boolean; onChange: (on: boolean) => void } | null;
  onPlay?: () => void;
  onPause?: (positionMs: number, durationMs: number) => void;
  onTimeUpdate?: (positionMs: number, durationMs: number) => void;
  onEnded?: (positionMs: number, durationMs: number) => void;
  onDurationKnown?: (durationMs: number) => void;
  /** Drawn over the frame once playback ends (Replay + up next / series countdown). */
  endScreen?: ReactNode;
  ended: boolean;
  onEndedChange: (ended: boolean) => void;
  /** The T key. The player only dispatches; theater itself is the watch page's (W1). */
  onTheater?: () => void;
  /** The N key. The player only dispatches; the watch page decides what "next" is. */
  onNext?: () => void;
}

const HIDE_CONTROLS_AFTER_MS = 2600;

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function TubePlayer({
  videoId,
  hlsUrl,
  fileUrl,
  poster,
  captions,
  startPositionMs,
  startReady,
  autoPlay,
  deferLoad = false,
  trimStartMs = 0,
  trimEndMs,
  prefs,
  onPrefsChange,
  autoplayNext,
  onPlay,
  onPause,
  onTimeUpdate,
  onEnded,
  onDurationKnown,
  endScreen,
  ended,
  onEndedChange,
  onTheater,
  onNext,
}: TubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const levelHeightsRef = useRef<number[]>([]);
  const seekAppliedRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endedRef = useRef(ended);
  endedRef.current = ended;

  const [tapped, setTapped] = useState(!deferLoad);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [bufferedMs, setBufferedMs] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [captionLang, setCaptionLang] = useState<string | null>(captions[0]?.lang ?? null);

  useEffect(() => {
    setTapped(!deferLoad);
    setFailed(false);
    seekAppliedRef.current = false;
    setPositionMs(0);
    setDurationMs(0);
    setBufferedMs(0);
    setLevels([]);
    levelHeightsRef.current = [];
    setSettingsOpen(false);
  }, [videoId, deferLoad]);

  useEffect(() => {
    if (!captionLang || !captions.some((c) => c.lang === captionLang)) {
      setCaptionLang(captions[0]?.lang ?? null);
    }
  }, [captions, captionLang]);

  /* ── source attach ─────────────────────────────────────── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !tapped) return;
    let cancelled = false;
    setFailed(false);
    setBuffering(true);

    const useFile = () => {
      if (cancelled) return;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      levelHeightsRef.current = [];
      setLevels([]);
      if (!fileUrl) {
        setFailed(true);
        setBuffering(false);
        return;
      }
      video.src = fileUrl;
      video.load();
    };

    const attach = async () => {
      if (!hlsUrl) {
        useFile();
        return;
      }
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = hlsUrl;
        video.load();
        return;
      }
      const { default: HlsCtor } = await import("hls.js");
      if (cancelled) return;
      if (!HlsCtor.isSupported()) {
        useFile();
        return;
      }
      const hls = new HlsCtor({
        maxBufferLength: 30,
        capLevelToPlayerSize: false,
        xhrSetup: (xhr) => {
          xhr.withCredentials = true;
        },
      });
      hlsRef.current = hls;
      hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
        const heights = hls.levels.map((l) => l.height);
        levelHeightsRef.current = heights;
        setLevels(heights);
        hls.nextLevel = pickHlsLevel(prefs.quality, heights);
      });
      hls.on(HlsCtor.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }
        // Manifest missing (still transcoding) or a network failure:
        // fall back to the progressive file rather than showing an error.
        useFile();
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
    };

    void attach();
    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
    // prefs.quality is applied by its own effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hlsUrl, fileUrl, tapped]);

  /* ── prefs → element ───────────────────────────────────── */
  useEffect(() => {
    const hls = hlsRef.current;
    if (!hls || levelHeightsRef.current.length === 0) return;
    hls.nextLevel = pickHlsLevel(prefs.quality, levelHeightsRef.current);
  }, [prefs.quality, levels]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = prefs.speed;
    video.volume = prefs.volume;
    video.muted = prefs.muted;
  }, [prefs.speed, prefs.volume, prefs.muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = video.textTracks;
    for (let i = 0; i < tracks.length; i += 1) {
      const t = tracks[i];
      t.mode = prefs.captions && t.language === captionLang ? "showing" : "hidden";
    }
  }, [prefs.captions, captionLang, captions]);

  /* ── element events ────────────────────────────────────── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const currentDuration = () => {
      if (trimEndMs && trimEndMs > 0) return trimEndMs;
      return Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : 0;
    };

    const applyStart = () => {
      if (seekAppliedRef.current || !startReady) return;
      let target = Math.max(trimStartMs, startPositionMs);
      const d = currentDuration();
      if (trimEndMs && target >= trimEndMs) target = trimStartMs;
      if (d > 0 && target >= d) target = trimStartMs;
      if (target > 0) video.currentTime = target / 1000;
      seekAppliedRef.current = true;
    };

    const onLoadedMetadata = () => {
      const d = currentDuration();
      setDurationMs(d);
      onDurationKnown?.(d);
      applyStart();
    };
    const onCanPlay = () => setBuffering(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => {
      setBuffering(false);
      setPlaying(true);
    };
    const onPlayEvt = () => {
      setPlaying(true);
      if (endedRef.current) onEndedChange(false);
      onPlay?.();
    };
    const onPauseEvt = () => {
      setPlaying(false);
      if (video.ended || endedRef.current) return;
      onPause?.(Math.round(video.currentTime * 1000), currentDuration());
    };
    const onTime = () => {
      const pos = Math.round(video.currentTime * 1000);
      const d = currentDuration();
      setPositionMs(pos);
      if (d !== durationMs && d > 0) setDurationMs(d);
      if (trimEndMs && pos >= trimEndMs && !video.paused) {
        video.pause();
        video.currentTime = trimEndMs / 1000;
        onEndedChange(true);
        onEnded?.(trimEndMs, d);
        return;
      }
      onTimeUpdate?.(pos, d);
    };
    const onProgress = () => {
      try {
        const b = video.buffered;
        if (b.length > 0) setBufferedMs(Math.round(b.end(b.length - 1) * 1000));
      } catch {
        /* ignore */
      }
    };
    const onEndedEvt = () => {
      setPlaying(false);
      const d = currentDuration();
      onEndedChange(true);
      onEnded?.(d || Math.round(video.currentTime * 1000), d);
    };
    const onError = () => {
      if (!hlsRef.current) setFailed(true);
      setBuffering(false);
    };

    if (video.readyState >= 1) onLoadedMetadata();
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("play", onPlayEvt);
    video.addEventListener("pause", onPauseEvt);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("progress", onProgress);
    video.addEventListener("ended", onEndedEvt);
    video.addEventListener("error", onError);
    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("play", onPlayEvt);
      video.removeEventListener("pause", onPauseEvt);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("ended", onEndedEvt);
      video.removeEventListener("error", onError);
    };
  }, [durationMs, onDurationKnown, onEnded, onEndedChange, onPause, onPlay, onTimeUpdate, startPositionMs, startReady, trimEndMs, trimStartMs]);

  // The resume position can arrive after metadata; seek as soon as both are known.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !startReady || seekAppliedRef.current || video.readyState < 1) return;
    let target = Math.max(trimStartMs, startPositionMs);
    if (trimEndMs && target >= trimEndMs) target = trimStartMs;
    if (target > 0) video.currentTime = target / 1000;
    seekAppliedRef.current = true;
  }, [startReady, startPositionMs, trimStartMs, trimEndMs]);

  /* ── fullscreen ────────────────────────────────────────── */
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  /* ── actions ───────────────────────────────────────────── */
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!tapped) {
      setTapped(true);
      queueMicrotask(() => videoRef.current?.play().catch(() => undefined));
      return;
    }
    if (video.paused || video.ended) void video.play().catch(() => undefined);
    else video.pause();
  }, [tapped]);

  const seekBy = useCallback((deltaS: number) => {
    const video = videoRef.current;
    if (!video) return;
    const max = (trimEndMs ? trimEndMs / 1000 : video.duration) || 0;
    const next = Math.max(trimStartMs / 1000, Math.min(max || Infinity, video.currentTime + deltaS));
    video.currentTime = Number.isFinite(next) ? next : 0;
  }, [trimEndMs, trimStartMs]);

  const seekTo = useCallback((ms: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, ms / 1000);
    if (endedRef.current) onEndedChange(false);
  }, [onEndedChange]);

  const toggleMute = useCallback(() => onPrefsChange({ muted: !prefs.muted }), [onPrefsChange, prefs.muted]);
  const toggleCaptions = useCallback(() => onPrefsChange({ captions: !prefs.captions }), [onPrefsChange, prefs.captions]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void el.requestFullscreen().catch(() => undefined);
  }, []);

  const replay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    onEndedChange(false);
    video.currentTime = trimStartMs / 1000;
    void video.play().catch(() => undefined);
  }, [onEndedChange, trimStartMs]);

  /* ── controls visibility ───────────────────────────────── */
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!settingsOpen) setControlsVisible(false);
    }, HIDE_CONTROLS_AFTER_MS);
  }, [settingsOpen]);

  useEffect(() => {
    if (!playing || settingsOpen) {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      return;
    }
    showControls();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [playing, settingsOpen, showControls]);

  /** 0–100 → that point of the playable range (trim-aware). */
  const seekPercent = useCallback((percent: number) => {
    const video = videoRef.current;
    if (!video) return;
    const startS = trimStartMs / 1000;
    const endS = (trimEndMs ? trimEndMs / 1000 : video.duration) || 0;
    if (!Number.isFinite(endS) || endS <= startS) return;
    const ratio = Math.max(0, Math.min(1, percent / 100));
    seekTo((startS + (endS - startS) * ratio) * 1000);
  }, [seekTo, trimEndMs, trimStartMs]);

  /* ── keyboard: the bindings live in playerKeys.ts; this only dispatches ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const action = playerKeyAction(e.key, { shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey, meta: e.metaKey });
      if (!action) return;
      if (playerKeyPreventsDefault(e.key)) e.preventDefault();
      switch (action.type) {
        case "toggle-play":
          togglePlay();
          break;
        case "seek-by":
          seekBy(action.seconds);
          break;
        case "seek-percent":
          seekPercent(action.percent);
          break;
        case "toggle-mute":
          toggleMute();
          break;
        case "toggle-fullscreen":
          toggleFullscreen();
          break;
        case "toggle-captions":
          toggleCaptions();
          break;
        case "toggle-theater":
          onTheater?.();
          break;
        case "next":
          onNext?.();
          break;
      }
      showControls();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [togglePlay, seekBy, seekPercent, toggleMute, toggleFullscreen, toggleCaptions, onTheater, onNext, showControls]);

  const pct = durationMs > 0 ? Math.min(100, (positionMs / durationMs) * 100) : 0;
  const bufferedPct = durationMs > 0 ? Math.min(100, (bufferedMs / durationMs) * 100) : 0;
  const showEnd = ended && !!endScreen;
  const chromeVisible = controlsVisible || !playing || ended;

  return (
    <div
      ref={containerRef}
      className="group/player relative aspect-video w-full overflow-hidden rounded-xl bg-black select-none focus:outline-none"
      onMouseMove={showControls}
      onMouseLeave={() => playing && !settingsOpen && setControlsVisible(false)}
      tabIndex={0}
      aria-label="Video player"
    >
      <video
        ref={videoRef}
        poster={poster || undefined}
        className="h-full w-full object-contain"
        playsInline
        autoPlay={autoPlay && tapped}
        preload={tapped ? "auto" : "none"}
        crossOrigin="use-credentials"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      >
        {captions.map((c) => (
          <track key={c.lang} kind="subtitles" src={c.src} srcLang={c.lang} label={c.label} default={false} />
        ))}
      </video>

      {/* Poster tap (data-saver) */}
      {!tapped ? (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/40"
          aria-label="Play video"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-black shadow-lg">
            <Play className="ml-1 h-7 w-7 fill-current" />
          </span>
        </button>
      ) : null}

      {/* Buffering */}
      {tapped && buffering && !ended && !failed ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-white/80" />
        </div>
      ) : null}

      {failed ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/80 text-center text-white">
          <p className="text-[14px] font-semibold">This video can&apos;t be played right now.</p>
          <p className="text-[12px] text-white/70">It may still be processing. Try again in a moment.</p>
        </div>
      ) : null}

      {/* End screen */}
      {showEnd ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-4">
          <div className="flex w-full max-w-[560px] flex-col items-center gap-5">
            {endScreen}
            <button
              type="button"
              onClick={replay}
              className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black hover:bg-white/90"
            >
              <RotateCcw className="h-4 w-4" /> Replay
            </button>
          </div>
        </div>
      ) : null}

      {/* Big centre play (paused, not ended) */}
      {tapped && !playing && !ended && !buffering && !failed ? (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 z-10 flex items-center justify-center"
          aria-label="Play"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm">
            <Play className="ml-1 h-7 w-7 fill-current" />
          </span>
        </button>
      ) : null}

      {/* Controls */}
      <div
        className={`absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-3 pb-2 pt-10 transition-opacity duration-200 ${
          chromeVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {/* Seek bar */}
        <div className="group/seek relative h-3 w-full cursor-pointer" onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          seekTo(ratio * durationMs);
        }}>
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/25 group-hover/seek:h-1.5">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/40" style={{ width: `${bufferedPct}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-brand-accent" style={{ width: `${pct}%` }} />
          </div>
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-accent opacity-0 shadow group-hover/seek:opacity-100"
            style={{ left: `${pct}%` }}
          />
          <input
            type="range"
            min={0}
            max={durationMs || 1}
            step={250}
            value={Math.min(positionMs, durationMs || 1)}
            onChange={(e) => seekTo(Number(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Seek"
          />
        </div>

        <div className="mt-1 flex items-center gap-1 text-white">
          <ControlButton label={playing ? "Pause" : "Play"} onClick={togglePlay}>
            {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
          </ControlButton>
          <ControlButton label="Back 10 seconds" onClick={() => seekBy(-SEEK_LARGE_S)}>
            <RotateCcw className="h-[18px] w-[18px]" />
          </ControlButton>
          <ControlButton label="Forward 10 seconds" onClick={() => seekBy(SEEK_LARGE_S)}>
            <RotateCw className="h-[18px] w-[18px]" />
          </ControlButton>
          <div className="group/vol flex items-center">
            <ControlButton label={prefs.muted ? "Unmute" : "Mute"} onClick={toggleMute}>
              {prefs.muted || prefs.volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </ControlButton>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={prefs.muted ? 0 : prefs.volume}
              onChange={(e) => onPrefsChange({ volume: Number(e.target.value), muted: Number(e.target.value) === 0 })}
              className="h-1 w-0 cursor-pointer accent-brand-accent opacity-0 transition-all group-hover/vol:w-20 group-hover/vol:opacity-100"
              aria-label="Volume"
            />
          </div>
          <span className="ml-1 text-[12px] font-medium tabular-nums text-white/90">
            {formatClockMs(positionMs)} / {formatClockMs(durationMs)}
          </span>
          <div className="flex-1" />
          {captions.length > 0 ? (
            <ControlButton label={prefs.captions ? "Hide captions" : "Show captions"} onClick={toggleCaptions} active={prefs.captions}>
              <Captions className="h-5 w-5" />
            </ControlButton>
          ) : null}
          <div className="relative">
            <ControlButton label="Settings" onClick={() => setSettingsOpen((o) => !o)} active={settingsOpen}>
              <Settings className="h-5 w-5" />
            </ControlButton>
            {settingsOpen ? (
              <TubeSettingsMenu
                prefs={prefs}
                onChange={onPrefsChange}
                levels={levels}
                captions={captions}
                captionLang={captionLang}
                onCaptionLang={setCaptionLang}
                autoplayNext={autoplayNext ?? null}
                onClose={() => setSettingsOpen(false)}
              />
            ) : null}
          </div>
          <ControlButton label={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </ControlButton>
        </div>
      </div>
    </div>
  );
}

function ControlButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/15 ${active ? "text-brand-accent" : "text-white"}`}
    >
      {children}
    </button>
  );
}

/* ── Settings (gear) menu ───────────────────────────────── */

type Pane = "root" | "quality" | "speed" | "captions";

function TubeSettingsMenu({
  prefs,
  onChange,
  levels,
  captions,
  captionLang,
  onCaptionLang,
  autoplayNext,
  onClose,
}: {
  prefs: TubePlayerPrefs;
  onChange: (patch: Partial<TubePlayerPrefs>) => void;
  levels: number[];
  captions: CaptionTrack[];
  captionLang: string | null;
  onCaptionLang: (lang: string) => void;
  autoplayNext: { on: boolean; onChange: (on: boolean) => void } | null;
  onClose: () => void;
}) {
  const [pane, setPane] = useState<Pane>("root");
  const rungs = Array.from(new Set(levels.filter((h) => h > 0))).sort((a, b) => b - a);
  const qualityLabel = prefs.quality === "auto" ? "Auto" : prefs.quality;
  const captionLabel = !prefs.captions ? "Off" : captions.find((c) => c.lang === captionLang)?.label ?? "On";

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("[data-tube-settings]")) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  return (
    <div
      data-tube-settings
      role="menu"
      className="absolute bottom-11 right-0 z-50 w-[260px] overflow-hidden rounded-xl border border-border bg-brand-card text-brand-text shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      {pane === "root" ? (
        <div className="py-1">
          <MenuRow label="Quality" value={qualityLabel} onClick={() => setPane("quality")} />
          <MenuRow label="Playback speed" value={prefs.speed === 1 ? "Normal" : `${speedChipLabel(prefs.speed)}×`} onClick={() => setPane("speed")} />
          <MenuRow label="Captions" value={captions.length === 0 ? "None" : captionLabel} onClick={() => captions.length > 0 && setPane("captions")} disabled={captions.length === 0} />
          {autoplayNext ? (
            <MenuToggle
              label="Autoplay next episode"
              hint={autoplayNext.on ? "Plays the next episode when this one ends" : "Stops at the end of this episode"}
              on={autoplayNext.on}
              onToggle={() => autoplayNext.onChange(!autoplayNext.on)}
            />
          ) : null}
        </div>
      ) : pane === "quality" ? (
        <div className="py-1">
          <MenuBack label="Quality" onClick={() => setPane("root")} />
          <MenuOption label="Auto" selected={prefs.quality === "auto"} onClick={() => onChange({ quality: "auto" })} />
          {rungs.map((h) => (
            <MenuOption key={h} label={`${h}p`} selected={prefs.quality === `${h}p`} onClick={() => onChange({ quality: `${h}p` })} />
          ))}
          {rungs.length === 0 ? <p className="px-4 py-2 text-[11px] text-muted-foreground">Only Auto is available for this video.</p> : null}
        </div>
      ) : pane === "speed" ? (
        <div className="py-1">
          <MenuBack label="Playback speed" onClick={() => setPane("root")} />
          {/* The reels presets for now; W1 swaps this list for the reels speed slider (0.25–2 in 0.05 steps). */}
          {SPEEDS.map((s) => (
            <MenuOption key={s} label={s === 1 ? "Normal" : `${speedChipLabel(s)}×`} selected={prefs.speed === s} onClick={() => onChange({ speed: clampSpeed(s) })} />
          ))}
          {!(SPEEDS as readonly number[]).includes(prefs.speed) ? (
            <MenuOption label={`${speedChipLabel(prefs.speed)}×`} selected onClick={() => undefined} />
          ) : null}
        </div>
      ) : (
        <div className="py-1">
          <MenuBack label="Captions" onClick={() => setPane("root")} />
          <MenuOption label="Off" selected={!prefs.captions} onClick={() => onChange({ captions: false })} />
          {captions.map((c) => (
            <MenuOption
              key={c.lang}
              label={c.label}
              selected={prefs.captions && captionLang === c.lang}
              onClick={() => {
                onCaptionLang(c.lang);
                onChange({ captions: true });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MenuRow({ label, value, onClick, disabled }: { label: string; value: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-between px-4 py-2.5 text-[13px] font-medium hover:bg-brand-secondary disabled:opacity-50"
    >
      <span>{label}</span>
      <span className="flex items-center gap-1 text-muted-foreground">
        {value} <ChevronRight className="h-4 w-4" />
      </span>
    </button>
  );
}

function MenuToggle({ label, hint, on, onToggle }: { label: string; hint?: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={on}
      onClick={onToggle}
      className="flex w-full items-center justify-between px-4 py-2.5 text-[13px] font-medium hover:bg-brand-secondary"
    >
      <span className="min-w-0 text-left">
        <span className="block">{label}</span>
        {hint ? <span className="block text-[11px] font-normal text-muted-foreground">{hint}</span> : null}
      </span>
      <span className={`relative ml-3 h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-brand-accent" : "bg-brand-divider"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function MenuBack({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-[13px] font-semibold hover:bg-brand-secondary"
    >
      <ChevronLeft className="h-4 w-4" /> {label}
    </button>
  );
}

function MenuOption({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onClick}
      className="flex w-full items-center justify-between px-4 py-2 text-[13px] hover:bg-brand-secondary"
    >
      <span className={selected ? "font-semibold" : ""}>{label}</span>
      {selected ? <Check className="h-4 w-4 text-brand-accent" /> : null}
    </button>
  );
}

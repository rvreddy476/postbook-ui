"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Loader2, Play, VolumeX } from "lucide-react";
import type Hls from "hls.js";

import type { ReelItem } from "@/features/reels/model";
import { pickHlsLevel, type PlayerPrefs } from "@/features/reels/playback/playerPrefs";
import { useSubtitleTrack } from "@/features/reels/playback/useSubtitleTrack";
import { useWatchTelemetry } from "@/features/reels/playback/useWatchTelemetry";
import { ReelScrubber } from "@/features/reels/components/ReelScrubber";

/*
  The reel player: one <video>, HLS through hls.js (native on Safari), the
  viewer's prefs applied live, and the gestures a reel needs — tap to pause,
  double-tap to like, drag the bar to seek. Playback auth rides on the
  access_token cookie scoped to /v1/media, so no header plumbing here.

  Autoplay policy: the browser may refuse an unmuted autoplay. When that
  happens the reel starts muted and a "Tap to unmute" pill appears; the tap
  is the gesture that lets sound through, and it also records the choice.
*/

export interface ReelVideoHandle {
  togglePlay(): void;
  seekBy(seconds: number): void;
  seekTo(ms: number): void;
  isPaused(): boolean;
  setVolume(volume: number): void;
}

interface ReelVideoProps {
  reel: ReelItem;
  /** Plays when true; a warm (inactive) instance only attaches its source. */
  active: boolean;
  position: number;
  prefs: PlayerPrefs;
  onPrefsChange: (patch: Partial<PlayerPrefs>) => void;
  /** Fires at the natural end when prefs.onEnd is "next". */
  onEnded: () => void;
  onDoubleTap: () => void;
  onQualityLevels?: (heights: number[]) => void;
  onProgress?: (currentMs: number, durationMs: number) => void;
}

const DOUBLE_TAP_MS = 260;

export const ReelVideo = forwardRef<ReelVideoHandle, ReelVideoProps>(function ReelVideo(
  { reel, active, position, prefs, onPrefsChange, onEnded, onDoubleTap, onQualityLevels, onProgress },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMutedRef = useRef(!prefs.sound);
  const autoplayRef = useRef(true);
  const levelHeightsRef = useRef<number[]>([]);

  const [paused, setPaused] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [failed, setFailed] = useState(false);
  const [forcedMuted, setForcedMuted] = useState(false);
  const [posterOk, setPosterOk] = useState(Boolean(reel.media.posterUrl));
  const [heartKey, setHeartKey] = useState(0);
  const [clock, setClock] = useState({ currentMs: 0, durationMs: reel.media.durationMs, bufferedMs: 0 });
  const [scrubbing, setScrubbing] = useState(false);

  const captions = useSubtitleTrack(reel.media.mediaId, prefs.captions && active);

  useWatchTelemetry({
    videoRef,
    contentId: reel.id,
    durationMs: reel.media.durationMs,
    position,
    active,
    speed: prefs.speed,
    isMutedRef,
    autoplayRef,
  });

  /* ── source attach ─────────────────────────────────────── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    setFailed(false);
    setBuffering(true);

    const useFile = () => {
      if (cancelled) return;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.src = reel.media.fileUrl;
      video.load();
    };

    const attach = async () => {
      const hlsUrl = reel.media.hlsUrl;
      if (!hlsUrl) {
        useFile();
        return;
      }
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = hlsUrl;
        video.load();
        onQualityLevels?.([]);
        return;
      }
      const { default: HlsCtor } = await import("hls.js");
      if (cancelled) return;
      if (!HlsCtor.isSupported()) {
        useFile();
        return;
      }
      const hls = new HlsCtor({
        maxBufferLength: active ? 20 : 6,
        capLevelToPlayerSize: false,
        xhrSetup: (xhr) => {
          xhr.withCredentials = true;
        },
      });
      hlsRef.current = hls;
      hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
        const heights = hls.levels.map((l) => l.height);
        levelHeightsRef.current = heights;
        onQualityLevels?.(heights);
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
  }, [reel.media.hlsUrl, reel.media.fileUrl]);

  /* ── prefs → element ───────────────────────────────────── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = prefs.speed;
    video.volume = prefs.volume;
    video.loop = prefs.onEnd === "loop";
    if (!forcedMuted) {
      video.muted = !prefs.sound;
      isMutedRef.current = !prefs.sound;
    }
  }, [prefs.speed, prefs.volume, prefs.onEnd, prefs.sound, forcedMuted]);

  useEffect(() => {
    const hls = hlsRef.current;
    if (!hls || levelHeightsRef.current.length === 0) return;
    hls.nextLevel = pickHlsLevel(prefs.quality, levelHeightsRef.current);
  }, [prefs.quality]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    for (const track of Array.from(video.textTracks)) {
      track.mode = prefs.captions && captions.source ? "showing" : "hidden";
    }
  }, [prefs.captions, captions.source]);

  /* ── play / pause with the active flag ─────────────────── */
  const tryPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
      setPaused(false);
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === "NotAllowedError" && !video.muted) {
        // Sound autoplay refused: start muted and ask for the tap.
        video.muted = true;
        isMutedRef.current = true;
        setForcedMuted(true);
        try {
          await video.play();
          setPaused(false);
        } catch {
          setPaused(true);
        }
      } else if (name !== "AbortError") {
        setPaused(true);
      }
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      autoplayRef.current = true;
      video.currentTime = 0;
      void tryPlay();
    } else {
      video.pause();
      setPaused(false);
    }
  }, [active, tryPlay]);

  /* ── element events ────────────────────────────────────── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      const durationMs = (video.duration && Number.isFinite(video.duration) ? video.duration : reel.media.durationMs / 1000) * 1000;
      let bufferedMs = 0;
      try {
        const b = video.buffered;
        if (b.length) bufferedMs = b.end(b.length - 1) * 1000;
      } catch {
        /* ignore */
      }
      const currentMs = video.currentTime * 1000;
      setClock({ currentMs, durationMs, bufferedMs });
      onProgress?.(currentMs, durationMs);
    };
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => {
      setBuffering(false);
      setPaused(false);
    };
    const onPause = () => setPaused(video.ended ? false : true);
    const onEndedEvt = () => {
      if (!video.loop) onEnded();
    };
    const onError = () => {
      if (!hlsRef.current) setFailed(true);
    };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("durationchange", onTime);
    video.addEventListener("progress", onTime);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", () => setBuffering(false));
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEndedEvt);
    video.addEventListener("error", onError);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("durationchange", onTime);
      video.removeEventListener("progress", onTime);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEndedEvt);
      video.removeEventListener("error", onError);
    };
  }, [onEnded, onProgress, reel.media.durationMs]);

  /* ── imperative surface for the screen's keyboard handling ── */
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      autoplayRef.current = false;
      void tryPlay();
    } else {
      video.pause();
      setPaused(true);
    }
  }, [tryPlay]);

  useImperativeHandle(
    ref,
    () => ({
      togglePlay,
      setVolume: (volume) => {
        const video = videoRef.current;
        if (!video) return;
        const level = Math.max(0, Math.min(1, volume));
        video.volume = level;
        video.muted = level === 0;
        isMutedRef.current = level === 0;
        setForcedMuted(false);
      },
      seekBy: (seconds) => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
      },
      seekTo: (ms) => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = Math.max(0, ms / 1000);
      },
      isPaused: () => videoRef.current?.paused ?? true,
    }),
    [togglePlay],
  );

  /* ── gestures ──────────────────────────────────────────── */
  const onTap = () => {
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      setHeartKey((k) => k + 1);
      onDoubleTap();
      return;
    }
    tapTimerRef.current = setTimeout(() => {
      tapTimerRef.current = null;
      togglePlay();
    }, DOUBLE_TAP_MS);
  };

  const unmute = () => {
    const video = videoRef.current;
    setForcedMuted(false);
    if (video) {
      video.muted = false;
      isMutedRef.current = false;
    }
    onPrefsChange({ sound: true });
  };

  const portrait = reel.media.height >= reel.media.width;

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-black" onClick={onTap}>
      {reel.media.posterUrl && posterOk ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={reel.media.posterUrl}
          alt=""
          aria-hidden
          onError={() => setPosterOk(false)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            buffering && clock.currentMs < 200 ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : null}

      <video
        ref={videoRef}
        playsInline
        preload={active ? "auto" : "metadata"}
        crossOrigin="use-credentials"
        poster={undefined}
        className={`absolute inset-0 h-full w-full ${portrait ? "object-cover" : "object-contain"}`}
      >
        {captions.source ? (
          <track kind="subtitles" src={captions.source.src} srcLang={captions.source.lang} default />
        ) : null}
      </video>

      {/* paused glyph */}
      <AnimatePresence>
        {paused && !failed ? (
          <motion.div
            key="paused"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur">
              <Play className="ml-1 h-8 w-8 fill-current" />
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* buffering */}
      {buffering && !paused && !failed && active ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-9 w-9 animate-spin text-white/80" />
        </div>
      ) : null}

      {/* double-tap heart burst */}
      <AnimatePresence>
        {heartKey > 0 ? (
          <motion.div
            key={heartKey}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.15, 1, 1.3] }}
            transition={{ duration: 0.9, times: [0, 0.2, 0.6, 1] }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <Heart className="h-24 w-24 fill-white text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* forced-mute pill */}
      {forcedMuted && active ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            unmute();
          }}
          className="reel-unmute-hint absolute left-3 bottom-10 z-20 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur hover:bg-black/80"
        >
          <VolumeX className="h-4 w-4" /> Tap to unmute
        </button>
      ) : null}

      {/* processing / failure */}
      {reel.isProcessing || failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-center text-white">
          <span className="text-[14px] font-semibold">{failed ? "This reel can't be played right now" : "Still processing"}</span>
          <span className="text-[12px] text-white/70">{failed ? "Try again in a moment." : "It will be ready shortly."}</span>
        </div>
      ) : null}

      <ReelScrubber
        currentMs={clock.currentMs}
        durationMs={clock.durationMs}
        bufferedMs={clock.bufferedMs}
        onSeek={(ms) => {
          const video = videoRef.current;
          if (video) video.currentTime = ms / 1000;
        }}
        onScrubbing={setScrubbing}
      />
      {scrubbing ? <div className="pointer-events-none absolute inset-0 bg-black/20" /> : null}
    </div>
  );
});

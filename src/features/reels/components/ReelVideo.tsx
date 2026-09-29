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
import { onSoundError, onSoundPlayRefused, planSoundSync, SOUND_LOAD_TIMEOUT_MS, soundDurationS, type SoundLoad, type SyncReason } from "@/features/reels/playback/soundSync";
import { soundServeHref } from "@/features/reels/sounds";
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

  An added sound (reel.sound) is a second file played by a hidden <audio>
  beside the video — nothing is mixed on the server. The video is the
  clock: every event that moves or stops it (play, pause, seek, rate,
  loop, a source switch, the tab coming back) asks soundSync.ts what the
  sound should be set to, and that answer is copied onto the element. Only
  media events drive it, never an animation frame, so it holds in a hidden
  tab. A sound that cannot be loaded is no sound: the reel plays alone at
  the viewer's full volume and nothing is said about it.
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
  /**
   * Whether media-service holds a caption track for this reel. Fires once
   * the subtitle lookup answers (captions must be on for it to run); the
   * settings menu turns it into "None for this reel".
   */
  onCaptionsAvailable?: (available: boolean) => void;
  /** The clock, on every timeupdate — what the theater bar draws. */
  onTime?: (currentMs: number, durationMs: number, bufferedMs: number) => void;
  /** Paused / playing, as the element reports it — for the theater bar's play button. */
  onPlayState?: (paused: boolean) => void;
  /** The element's real pixel size once metadata loads; the frame takes this shape. */
  onDimensions?: (width: number, height: number) => void;
  /** No in-frame scrubber (the theater bar carries its own, driving this same element). */
  chromeless?: boolean;
  /**
   * Play this progressive file instead of the reel's own sources: an
   * alternate audio track muxed into the same picture. Switching keeps the
   * playhead and the play/pause state.
   */
  sourceOverride?: string | null;
}

const DOUBLE_TAP_MS = 260;

export const ReelVideo = forwardRef<ReelVideoHandle, ReelVideoProps>(function ReelVideo(
  { reel, active, position, prefs, onPrefsChange, onEnded, onDoubleTap, onQualityLevels, onProgress, onCaptionsAvailable, onTime, onPlayState, onDimensions, chromeless = false, sourceOverride = null },
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

  /* ── the added sound ───────────────────────────────────── */
  const audioRef = useRef<HTMLAudioElement>(null);
  const soundId = reel.sound?.id ?? null;
  const soundRef = useRef(reel.sound ?? null);
  soundRef.current = reel.sound ?? null;
  const mixRef = useRef({ original: 1, overlay: 1 });
  mixRef.current = { original: reel.originalVolume ?? 1, overlay: reel.overlayVolume ?? 1 };
  const soundLoadRef = useRef<SoundLoad>(soundId ? "loading" : "none");
  const viewerVolumeRef = useRef(prefs.volume);
  // The video is waiting for data: its clock stands still though it is not paused.
  const stalledRef = useRef(false);

  const playSound = useCallback(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;
    void audio.play().catch((err: unknown) => {
      if (onSoundPlayRefused((err as { name?: string })?.name, audio.muted) !== "mute-both") return;
      // The browser refused sound: both sides go quiet together and the pill asks for the tap.
      video.muted = true;
      audio.muted = true;
      isMutedRef.current = true;
      setForcedMuted(true);
      void audio.play().catch(() => undefined);
    });
  }, []);

  /** Copies what soundSync decides onto the two elements. */
  const syncSound = useCallback(
    (reason: SyncReason = "tick") => {
      const video = videoRef.current;
      if (!video) return;
      const audio = audioRef.current;
      const sound = soundRef.current;
      const plan = planSoundSync({
        videoTime: video.currentTime,
        videoPlaying: !video.paused && !video.ended && !video.seeking && !stalledRef.current,
        rate: video.playbackRate,
        viewerVolume: viewerVolumeRef.current,
        muted: video.muted,
        originalVolume: mixRef.current.original,
        overlayVolume: mixRef.current.overlay,
        startOffsetS: (sound?.startMs ?? 0) / 1000,
        soundDurationS: soundDurationS(audio?.duration, sound?.durationMs),
        load: audio && sound ? soundLoadRef.current : "none",
        soundTime: audio?.currentTime ?? 0,
        soundSeeking: audio?.seeking ?? false,
        reason,
      });
      if (video.volume !== plan.videoVolume) video.volume = plan.videoVolume;
      if (!audio) return;
      const next = plan.sound;
      if (!next) {
        if (!audio.paused) audio.pause();
        return;
      }
      if (audio.volume !== next.volume) audio.volume = next.volume;
      if (audio.muted !== next.muted) audio.muted = next.muted;
      if (audio.playbackRate !== next.rate) audio.playbackRate = next.rate;
      if (next.seekTo !== null) {
        try {
          audio.currentTime = next.seekTo;
        } catch {
          /* not seekable yet: the next event tries again */
        }
      }
      if (next.play) {
        if (audio.paused) playSound();
      } else if (!audio.paused) {
        audio.pause();
      }
    },
    [playSound],
  );

  // The sound's source, and whether it could be loaded.
  useEffect(() => {
    const audio = audioRef.current;
    stalledRef.current = false;
    soundLoadRef.current = soundId && audio ? "loading" : "none";
    syncSound("jump");
    if (!audio || !soundId) return;
    const settle = (load: SoundLoad) => {
      soundLoadRef.current = load;
      syncSound("jump");
    };
    let loadedAt = Date.now();
    const onReady = () => settle("ready");
    const onFailed = () => {
      // A link that expired under a long pause: ask /serve again (soundSync.onSoundError).
      if (onSoundError(soundLoadRef.current, Date.now() - loadedAt) === "reload") {
        loadedAt = Date.now();
        soundLoadRef.current = "loading";
        audio.src = soundServeHref(soundId);
        audio.load();
        syncSound("jump");
        return;
      }
      settle("failed");
    };
    audio.addEventListener("loadedmetadata", onReady);
    audio.addEventListener("canplay", onReady);
    audio.addEventListener("error", onFailed);
    audio.src = soundServeHref(soundId);
    audio.load();
    const timer = setTimeout(() => {
      if (soundLoadRef.current === "loading") onFailed();
    }, SOUND_LOAD_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
      audio.removeEventListener("loadedmetadata", onReady);
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("error", onFailed);
      // A detached element keeps playing: stop it and drop the download.
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, [soundId, syncSound]);

  // The video is the clock; these are the events that move or stop it.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTick = () => {
      if (!video.paused && video.readyState >= 3) stalledRef.current = false;
      syncSound("tick");
    };
    const onJump = () => syncSound("jump");
    const onWaiting = () => {
      stalledRef.current = true;
      syncSound("tick");
    };
    const onResumed = () => {
      stalledRef.current = false;
      syncSound("jump");
    };
    const onVisibility = () => {
      if (!document.hidden) syncSound("jump");
    };
    const jumps = ["play", "pause", "seeking", "seeked", "ratechange", "volumechange", "ended", "emptied", "loadedmetadata"] as const;
    video.addEventListener("timeupdate", onTick);
    for (const name of jumps) video.addEventListener(name, onJump);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onResumed);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      video.removeEventListener("timeupdate", onTick);
      for (const name of jumps) video.removeEventListener(name, onJump);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onResumed);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [syncSound]);

  const captions = useSubtitleTrack(reel.media.mediaId, prefs.captions && active);
  const onCaptionsAvailableRef = useRef(onCaptionsAvailable);
  onCaptionsAvailableRef.current = onCaptionsAvailable;
  useEffect(() => {
    if (captions.status === "ready") onCaptionsAvailableRef.current?.(true);
    else if (captions.status === "none") onCaptionsAvailableRef.current?.(false);
  }, [captions.status, reel.media.mediaId]);

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
  // Where the clock was when the source last changed (an audio-track switch), restored after load.
  const resumeRef = useRef<{ at: number; paused: boolean } | null>(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    setFailed(false);
    setBuffering(true);

    const resume = resumeRef.current;
    resumeRef.current = null;
    if (resume) {
      const onLoaded = () => {
        video.removeEventListener("loadedmetadata", onLoaded);
        if (cancelled) return;
        video.playbackRate = prefsRef.current.speed;
        video.currentTime = resume.at;
        if (!resume.paused) void video.play().catch(() => undefined);
      };
      video.addEventListener("loadedmetadata", onLoaded);
    }

    const useFile = (url = reel.media.fileUrl) => {
      if (cancelled) return;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.src = url;
      video.load();
    };

    const attach = async () => {
      if (sourceOverride) {
        // An alternate audio track: one muxed MP4, no rungs to choose from.
        onQualityLevels?.([]);
        useFile(sourceOverride);
        return;
      }
      const hlsUrl = reel.media.hlsUrl;
      if (!hlsUrl) {
        useFile();
        return;
      }
      // hls.js first wherever Media Source exists: some Chromes answer "maybe"
      // to native HLS and then never load a byte. Native only where MSE is
      // absent (iOS Safari), the MP4 after that.
      const { default: HlsCtor } = await import("hls.js");
      if (cancelled) return;
      if (!HlsCtor.isSupported()) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = hlsUrl;
          video.load();
          onQualityLevels?.([]);
          return;
        }
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
      // Leaving for a source switch on the same reel: remember the clock so it carries over.
      if (video.currentTime > 0) resumeRef.current = { at: video.currentTime, paused: video.paused };
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
    // prefs.quality is applied by its own effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reel.media.hlsUrl, reel.media.fileUrl, sourceOverride]);

  /* ── prefs → element ───────────────────────────────────── */
  // Re-applied after every source switch too: load() resets playbackRate to 1.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = prefs.speed;
    viewerVolumeRef.current = prefs.volume;
    video.loop = prefs.onEnd === "loop";
    if (!forcedMuted) {
      video.muted = !prefs.sound;
      isMutedRef.current = !prefs.sound;
    }
    // The volume itself: the viewer's level times the creator's, and the sound follows.
    syncSound("jump");
  }, [prefs.speed, prefs.volume, prefs.onEnd, prefs.sound, forcedMuted, sourceOverride, reel.media.hlsUrl, reel.media.fileUrl, reel.originalVolume, reel.overlayVolume, syncSound]);

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
      const started = video.play();
      // Inside the viewer's tap when there is one: the sound starts in the same gesture.
      syncSound("jump");
      await started;
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
  }, [syncSound]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      autoplayRef.current = true;
      resumeRef.current = null;
      video.currentTime = 0;
      void tryPlay();
    } else {
      video.pause();
      setPaused(false);
    }
  }, [active, tryPlay]);

  /* ── element events ────────────────────────────────────── */
  const onTimeRef = useRef(onTime);
  onTimeRef.current = onTime;
  const onPlayStateRef = useRef(onPlayState);
  onPlayStateRef.current = onPlayState;
  const onDimensionsRef = useRef(onDimensions);
  onDimensionsRef.current = onDimensions;
  useEffect(() => {
    onPlayStateRef.current?.(paused);
  }, [paused]);
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
      onTimeRef.current?.(currentMs, durationMs, bufferedMs);
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
    const onMeta = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) onDimensionsRef.current?.(video.videoWidth, video.videoHeight);
    };
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("resize", onMeta);
    if (video.readyState >= 1) onMeta();
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
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("resize", onMeta);
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
        viewerVolumeRef.current = level;
        video.muted = level === 0;
        isMutedRef.current = level === 0;
        setForcedMuted(false);
        syncSound("jump");
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
    [togglePlay, syncSound],
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
      syncSound("jump");
    }
    onPrefsChange({ sound: true });
  };

  // The frame already has the media's aspect ratio (stage.ts), so contain
  // shows the whole picture with no bars in either orientation.
  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-black" onClick={onTap}>
      {reel.media.posterUrl && posterOk ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={reel.media.posterUrl}
          alt=""
          aria-hidden
          onError={() => setPosterOk(false)}
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
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
        className="absolute inset-0 h-full w-full object-contain"
      >
        {captions.source ? (
          <track kind="subtitles" src={captions.source.src} srcLang={captions.source.lang} default />
        ) : null}
      </video>

      {/* The added sound. No src here: the effect above owns it, as the video's is owned. */}
      {soundId ? <audio ref={audioRef} preload="auto" loop hidden aria-hidden data-reel-sound={soundId} /> : null}

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

      {!chromeless ? (
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
      ) : null}
      {scrubbing ? <div className="pointer-events-none absolute inset-0 bg-black/20" /> : null}
    </div>
  );
});

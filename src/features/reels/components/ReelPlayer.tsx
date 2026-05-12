"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, Maximize2 } from "lucide-react";

interface ReelPlayerProps {
  videoUrl: string;
  posterUrl: string;
  muted: boolean;
  active: boolean;
  contain?: boolean;
  loadingTitle?: string;
  loadingHint?: string;
  errorTitle?: string;
  errorHint?: string;
  /** When true, suppress autoplay and require an explicit user tap before
   *  fetching video bytes. Used by data-saver mode (recon §F.2). */
  suppressAutoplay?: boolean;
  onToggleMuted: () => void;
  onBoost: () => void;
  onProgressChange?: (progressPercent: number) => void;
  onExpand?: () => void;
  onPlaybackStateChange?: (state: "loading" | "playing" | "error") => void;
}

export function ReelPlayer({
  videoUrl,
  posterUrl,
  muted,
  active,
  contain,
  loadingTitle,
  loadingHint,
  errorTitle,
  errorHint,
  suppressAutoplay = false,
  onToggleMuted,
  onBoost,
  onProgressChange,
  onExpand,
  onPlaybackStateChange,
}: ReelPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceReadyRef = useRef(false);
  const [boostBurstKey, setBoostBurstKey] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  // Data-saver: until the viewer taps the play overlay we never
  // attach a video source. Resets whenever the URL changes (next
  // reel scrolled into view).
  const [userTappedPlay, setUserTappedPlay] = useState(false);

  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);

  useEffect(() => {
    setCoverSrc(null);
    setVideoPlaying(false);
    setPlaybackError(null);
    setUserTappedPlay(false);
    onPlaybackStateChange?.("loading");

    if (posterUrl) {
      const img = new Image();
      img.onload = () => setCoverSrc(posterUrl);
      img.onerror = () => setCoverSrc(null);
      img.src = posterUrl;
    }
  }, [onPlaybackStateChange, posterUrl, videoUrl]);

  useEffect(() => {
    const mediaElement = videoRef.current;
    if (!mediaElement) return;

    const handleLoaded = () => {
      setCoverSrc((prev) => {
        if (prev) return prev;
        try {
          const canvas = document.createElement("canvas");
          canvas.width = mediaElement.videoWidth || 360;
          canvas.height = mediaElement.videoHeight || 640;
          const ctx = canvas.getContext("2d");
          if (!ctx) return null;
          ctx.drawImage(mediaElement, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL("image/jpeg", 0.75);
        } catch {
          return null;
        }
      });
    };

    mediaElement.addEventListener("loadeddata", handleLoaded, { once: true });
    return () => mediaElement.removeEventListener("loadeddata", handleLoaded);
  }, [videoUrl]);

  useEffect(() => {
    const mediaElement = videoRef.current;
    if (!mediaElement) return;

    const onPlaying = () => {
      setVideoPlaying(true);
      setPlaybackError(null);
      onPlaybackStateChange?.("playing");
    };
    const onWaiting = () => {
      setVideoPlaying(false);
      if (!playbackError) {
        onPlaybackStateChange?.("loading");
      }
    };
    const onError = () => {
      setVideoPlaying(false);
      setPlaybackError("Playback failed");
      onPlaybackStateChange?.("error");
    };

    mediaElement.addEventListener("playing", onPlaying);
    mediaElement.addEventListener("waiting", onWaiting);
    mediaElement.addEventListener("error", onError);
    return () => {
      mediaElement.removeEventListener("playing", onPlaying);
      mediaElement.removeEventListener("waiting", onWaiting);
      mediaElement.removeEventListener("error", onError);
    };
  }, [onPlaybackStateChange, playbackError, videoUrl]);

  useEffect(() => {
    const currentElement = videoRef.current;
    if (!currentElement) return;
    const mediaElement: HTMLVideoElement = currentElement;

    // Data-saver gate: defer attaching the source — and therefore
    // any HLS network calls — until the viewer taps the play
    // overlay. Without this we would still kick off a manifest
    // request on every reel that scrolls into view.
    if (suppressAutoplay && !userTappedPlay) {
      sourceReadyRef.current = false;
      return;
    }

    let mounted = true;
    let hlsInstance: { destroy: () => void } | null = null;
    const isHls = videoUrl.includes(".m3u8");
    sourceReadyRef.current = false;

    async function attachVideoSource() {
      if (isHls) {
        const canUseNativeHls = mediaElement.canPlayType("application/vnd.apple.mpegurl");
        if (canUseNativeHls) {
          mediaElement.src = videoUrl;
          sourceReadyRef.current = true;
          return;
        }
        const { default: Hls } = await import("hls.js");
        if (!mounted) return;
        if (Hls.isSupported()) {
          const instance = new Hls({ lowLatencyMode: true });
          instance.loadSource(videoUrl);
          instance.attachMedia(mediaElement);
          hlsInstance = instance;
          instance.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!mounted) return;
            sourceReadyRef.current = true;
            setPlaybackError(null);
            onPlaybackStateChange?.("loading");
            if (active) mediaElement.play().catch(() => undefined);
          });
          instance.on(Hls.Events.ERROR, (_event, data) => {
            if (!mounted || !data?.fatal) return;
            setVideoPlaying(false);
            setPlaybackError(data.details || data.type || "Playback failed");
            onPlaybackStateChange?.("error");
          });
          return;
        }
      }
      mediaElement.src = videoUrl;
      sourceReadyRef.current = true;
    }

    void attachVideoSource();

    return () => {
      mounted = false;
      if (hlsInstance) hlsInstance.destroy();
      mediaElement.removeAttribute("src");
      mediaElement.load();
    };
  }, [active, onPlaybackStateChange, videoUrl, suppressAutoplay, userTappedPlay]);

  useEffect(() => {
    const mediaElement = videoRef.current;
    if (!mediaElement) return;
    mediaElement.muted = muted;
  }, [muted]);

  useEffect(() => {
    const mediaElement = videoRef.current;
    if (!mediaElement) return;
    mediaElement.volume = volume;
  }, [volume]);

  useEffect(() => {
    const mediaElement = videoRef.current;
    if (!mediaElement) return;
    if (active) {
      if (suppressAutoplay && !userTappedPlay) {
        // Keep paused until the user opts in.
        mediaElement.pause();
        setIsPaused(false);
        return;
      }
      if (sourceReadyRef.current) {
        mediaElement.play().catch(() => undefined);
      }
      setIsPaused(false);
      return;
    }
    mediaElement.pause();
    setVideoPlaying(false);
  }, [active, videoUrl, suppressAutoplay, userTappedPlay]);

  useEffect(() => {
    const mediaElement = videoRef.current;
    if (!mediaElement) return;

    const onTimeUpdate = () => {
      if (!mediaElement.duration) return;
      onProgressChange?.((mediaElement.currentTime / mediaElement.duration) * 100);
    };

    mediaElement.addEventListener("timeupdate", onTimeUpdate);
    return () => mediaElement.removeEventListener("timeupdate", onTimeUpdate);
  }, [onProgressChange, videoUrl]);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  const togglePlayPause = useCallback(() => {
    const mediaElement = videoRef.current;
    if (!mediaElement) return;
    if (mediaElement.paused) {
      mediaElement.play().catch(() => undefined);
      setIsPaused(false);
    } else {
      mediaElement.pause();
      setIsPaused(true);
    }
  }, []);

  function handleClick() {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      onBoost();
      setBoostBurstKey((prev) => prev + 1);
      return;
    }

    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      togglePlayPause();
    }, 250);
  }

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      const newVol = parseFloat(e.target.value);
      setVolume(newVol);
      if (muted && newVol > 0) {
        onToggleMuted();
      } else if (!muted && newVol === 0) {
        onToggleMuted();
      }
    },
    [muted, onToggleMuted]
  );

  const showCover = coverSrc && !videoPlaying;
  const stateTitle = playbackError ? errorTitle : loadingTitle;
  const stateHint = playbackError ? errorHint : loadingHint;
  const showStateOverlay = !!stateTitle && (!videoPlaying || !!playbackError);

  return (
    <div
      className="relative h-full w-full cursor-pointer select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <video
        ref={videoRef}
        loop
        playsInline
        muted={muted}
        className={"h-full w-full " + (contain ? "object-contain" : "object-cover")}
        onClick={handleClick}
      />

      {suppressAutoplay && !userTappedPlay ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setUserTappedPlay(true);
          }}
          className="absolute inset-0 z-[3] flex items-center justify-center bg-black/35"
          aria-label="Play video"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/60 bg-black/50 backdrop-blur-sm">
            <Play className="ml-1 h-7 w-7 text-white" fill="white" />
          </span>
        </button>
      ) : null}

      <AnimatePresence>
        {showCover ? (
          <motion.img
            src={coverSrc}
            alt=""
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={"pointer-events-none absolute inset-0 z-[1] h-full w-full " + (contain ? "object-contain" : "object-cover")}
            onClick={handleClick}
          />
        ) : null}
      </AnimatePresence>

      {showStateOverlay ? (
        <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center bg-black/35 px-8 text-center">
          <div className="max-w-md">
            <p className="text-[15px] font-semibold text-white">{stateTitle}</p>
            {stateHint ? (
              <p className="mt-2 text-[12px] leading-relaxed text-white/75">{stateHint}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <AnimatePresence>
        {isHovered ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-8 left-0 right-0 z-30 flex items-center gap-2 px-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex w-full items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur-md">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayPause();
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/90 transition hover:text-white"
                aria-label={isPaused ? "Play" : "Pause"}
              >
                {isPaused ? (
                  <Play className="ml-0.5 h-3.5 w-3.5" fill="white" />
                ) : (
                  <Pause className="h-3.5 w-3.5" fill="white" />
                )}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMuted();
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/90 transition hover:text-white"
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? (
                  <VolumeX className="h-3.5 w-3.5" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                onClick={(e) => e.stopPropagation()}
                className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-brand-card/30 accent-white [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-card"
                aria-label="Volume"
              />

              <div className="flex-1" />

              {onExpand ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExpand();
                  }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/90 transition hover:text-white"
                  aria-label="Expand"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isPaused && !isHovered ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
              <Play className="ml-1 h-7 w-7 text-white" fill="white" />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {boostBurstKey > 0 ? (
          <motion.div
            key={boostBurstKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.15, opacity: 0.8 }}
              animate={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-24 w-24 rounded-full border-2 border-white/60"
            />
            <motion.span
              initial={{ y: 10, opacity: 0, scale: 0.86 }}
              animate={{ y: -8, opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute rounded-full bg-brand-card/20 px-5 py-2 text-sm font-bold tracking-[0.14em] text-white backdrop-blur-sm"
            >
              BOOST
            </motion.span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

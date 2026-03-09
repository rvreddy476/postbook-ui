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
  onToggleMuted: () => void;
  onBoost: () => void;
  onProgressChange?: (progressPercent: number) => void;
  onExpand?: () => void;
}

export function ReelPlayer({
  videoUrl,
  posterUrl,
  muted,
  active,
  contain,
  onToggleMuted,
  onBoost,
  onProgressChange,
  onExpand,
}: ReelPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceReadyRef = useRef(false);
  const [boostBurstKey, setBoostBurstKey] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [volume, setVolume] = useState(1);

  // Cover image state — visible overlay that hides black frame until video plays
  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);

  // Resolve cover: try posterUrl first, fall back to canvas capture from video
  useEffect(() => {
    setCoverSrc(null);
    setVideoPlaying(false);

    // If we have a poster URL, probe it
    if (posterUrl) {
      const img = new Image();
      img.onload = () => setCoverSrc(posterUrl);
      img.onerror = () => setCoverSrc(null); // will rely on canvas fallback
      img.src = posterUrl;
    }
  }, [posterUrl, videoUrl]);

  // Canvas fallback: capture first frame once video has data
  useEffect(() => {
    const mediaElement = videoRef.current;
    if (!mediaElement) return;

    const handleLoaded = () => {
      // Only generate if we don't already have a working cover
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

  // Track when video actually starts rendering frames
  useEffect(() => {
    const mediaElement = videoRef.current;
    if (!mediaElement) return;

    const onPlaying = () => setVideoPlaying(true);
    const onWaiting = () => setVideoPlaying(false);

    mediaElement.addEventListener("playing", onPlaying);
    mediaElement.addEventListener("waiting", onWaiting);
    return () => {
      mediaElement.removeEventListener("playing", onPlaying);
      mediaElement.removeEventListener("waiting", onWaiting);
    };
  }, [videoUrl]);

  // Attach HLS or plain source
  useEffect(() => {
    const currentElement = videoRef.current;
    if (!currentElement) return;
    const mediaElement: HTMLVideoElement = currentElement;

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
          // Play once HLS has parsed manifest and buffered enough
          instance.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!mounted) return;
            sourceReadyRef.current = true;
            if (active) mediaElement.play().catch(() => undefined);
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
  }, [videoUrl, active]);

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
      // For non-HLS, source is set synchronously so sourceReady is already true.
      // For HLS, play is triggered by MANIFEST_PARSED callback instead.
      if (sourceReadyRef.current) {
        mediaElement.play().catch(() => undefined);
      }
      setIsPaused(false);
      return;
    }
    mediaElement.pause();
    setVideoPlaying(false);
  }, [active, videoUrl]);

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

  // Show cover overlay when video isn't visibly playing yet
  const showCover = coverSrc && !videoPlaying;

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
        className={`h-full w-full ${contain ? "object-contain" : "object-cover"}`}
        onClick={handleClick}
      />

      {/* Cover image overlay — hides black frame until video actually plays */}
      <AnimatePresence>
        {showCover ? (
          <motion.img
            src={coverSrc}
            alt=""
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={`pointer-events-none absolute inset-0 z-[1] h-full w-full ${contain ? "object-contain" : "object-cover"}`}
            onClick={handleClick}
          />
        ) : null}
      </AnimatePresence>

      {/* ── Hover controls bar ─────────────────────────── */}
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
              {/* Play / Pause */}
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
                  <Play className="h-3.5 w-3.5 ml-0.5" fill="white" />
                ) : (
                  <Pause className="h-3.5 w-3.5" fill="white" />
                )}
              </button>

              {/* Mute toggle */}
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

              {/* Volume slider */}
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                onClick={(e) => e.stopPropagation()}
                className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/30 accent-white [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                aria-label="Volume"
              />

              <div className="flex-1" />

              {/* Expand */}
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

      {/* Paused overlay (center play icon when not hovered) */}
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
              <Play className="h-7 w-7 text-white ml-1" fill="white" />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Boost burst animation (double-tap) */}
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
              className="absolute rounded-full bg-white/20 px-5 py-2 text-sm font-bold tracking-[0.14em] text-white backdrop-blur-sm"
            >
              BOOST
            </motion.span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

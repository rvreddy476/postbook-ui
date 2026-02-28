"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Check,
} from "lucide-react"
import { useMediaVariants } from "@/hooks/useMediaVariants"

interface VideoPlayerProps {
  mediaId: string
  className?: string
}

const CONTROLS_HIDE_DELAY = 3000

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export default function VideoPlayer({ mediaId, className = "" }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)

  // Volume state
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [prevVolume, setPrevVolume] = useState(1)

  // UI state
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showQualityMenu, setShowQualityMenu] = useState(false)
  const [isSeeking, setIsSeeking] = useState(false)

  // Quality state
  const [currentQuality, setCurrentQuality] = useState<string>("auto")
  const [qualityMenuOpened, setQualityMenuOpened] = useState(false)

  const { data: mediaInfo, isLoading: variantsLoading } = useMediaVariants(
    mediaId,
    qualityMenuOpened
  )

  // Video source URL
  const videoSrc =
    currentQuality === "auto"
      ? `/v1/media/${mediaId}/serve`
      : `/v1/media/${mediaId}/serve/${currentQuality}`

  // --- Playback controls ---

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [])

  const skip = useCallback((seconds: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds))
  }, [])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (isMuted) {
      video.muted = false
      setIsMuted(false)
      video.volume = prevVolume
      setVolume(prevVolume)
    } else {
      setPrevVolume(volume)
      video.muted = true
      setIsMuted(true)
    }
  }, [isMuted, prevVolume, volume])

  const handleVolumeChange = useCallback(
    (newVolume: number) => {
      const video = videoRef.current
      if (!video) return
      video.volume = newVolume
      setVolume(newVolume)
      if (newVolume === 0) {
        setIsMuted(true)
        video.muted = true
      } else if (isMuted) {
        video.muted = false
        setIsMuted(false)
      }
    },
    [isMuted]
  )

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  // --- Quality switching ---

  const handleQualityChange = useCallback(
    (quality: string) => {
      if (quality === currentQuality) {
        setShowQualityMenu(false)
        return
      }
      const video = videoRef.current
      if (!video) return

      const wasPlaying = !video.paused
      const savedTime = video.currentTime

      setCurrentQuality(quality)
      setShowQualityMenu(false)

      // Wait for React to update src, then reload
      requestAnimationFrame(() => {
        if (!videoRef.current) return
        videoRef.current.addEventListener(
          "loadedmetadata",
          () => {
            if (!videoRef.current) return
            videoRef.current.currentTime = savedTime
            if (wasPlaying) {
              videoRef.current.play().catch(() => {})
            }
          },
          { once: true }
        )
        videoRef.current.load()
      })
    },
    [currentQuality]
  )

  // --- Controls auto-hide ---

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true)
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current)
    }
    if (isPlaying) {
      controlsTimerRef.current = setTimeout(() => {
        setShowControls(false)
        setShowQualityMenu(false)
      }, CONTROLS_HIDE_DELAY)
    }
  }, [isPlaying])

  const handleInteraction = useCallback(() => {
    showControlsTemporarily()
  }, [showControlsTemporarily])

  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true)
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current)
      }
    } else {
      showControlsTemporarily()
    }
  }, [isPlaying, showControlsTemporarily])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    }
  }, [])

  // --- Progress bar seek ---

  const seekToPosition = useCallback(
    (clientX: number) => {
      const rect = progressRef.current?.getBoundingClientRect()
      if (!rect || !videoRef.current) return
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      videoRef.current.currentTime = fraction * duration
    },
    [duration]
  )

  const handleProgressMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setIsSeeking(true)
      seekToPosition(e.clientX)
    },
    [seekToPosition]
  )

  useEffect(() => {
    if (!isSeeking) return
    const handleMouseMove = (e: MouseEvent) => seekToPosition(e.clientX)
    const handleMouseUp = () => setIsSeeking(false)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isSeeking, seekToPosition])

  // --- Fullscreen change listener ---

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", handler)
    return () => document.removeEventListener("fullscreenchange", handler)
  }, [])

  // --- Keyboard shortcuts ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        !containerRef.current?.contains(document.activeElement) &&
        document.activeElement !== containerRef.current
      )
        return

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault()
          togglePlay()
          break
        case "ArrowLeft":
          e.preventDefault()
          skip(-10)
          break
        case "ArrowRight":
          e.preventDefault()
          skip(10)
          break
        case "ArrowUp":
          e.preventDefault()
          handleVolumeChange(Math.min(1, volume + 0.1))
          break
        case "ArrowDown":
          e.preventDefault()
          handleVolumeChange(Math.max(0, volume - 0.1))
          break
        case "m":
          toggleMute()
          break
        case "f":
          toggleFullscreen()
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [volume, togglePlay, skip, handleVolumeChange, toggleMute, toggleFullscreen])

  // --- Video event handlers ---

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime)
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration)
  }

  const handleProgress = () => {
    const video = videoRef.current
    if (video && video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1)
      setBuffered((bufferedEnd / video.duration) * 100)
    }
  }

  const progress = duration ? (currentTime / duration) * 100 : 0

  // Close quality menu on click outside
  useEffect(() => {
    if (!showQualityMenu) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest("[data-quality-menu]")) {
        setShowQualityMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showQualityMenu])

  return (
    <div
      ref={containerRef}
      className={`relative bg-black ${className}`}
      tabIndex={0}
      onMouseMove={handleInteraction}
      onTouchStart={handleInteraction}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-controls]")) return
        togglePlay()
      }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={videoSrc}
        className="w-full h-full object-contain"
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onProgress={handleProgress}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Big center play button */}
      <AnimatePresence>
        {!isPlaying && showControls && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center shadow-2xl">
              <Play className="w-10 h-10 text-white translate-x-0.5" fill="white" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom controls overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            data-controls
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent pt-16 pb-3 px-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Progress bar */}
            <div
              ref={progressRef}
              className="w-full h-1.5 bg-white/20 rounded-full mb-3 cursor-pointer group/progress relative hover:h-2.5 transition-all"
              onMouseDown={handleProgressMouseDown}
            >
              {/* Buffered */}
              <div
                className="absolute inset-y-0 left-0 bg-white/30 rounded-full transition-all"
                style={{ width: `${buffered}%` }}
              />
              {/* Progress fill */}
              <div
                className="absolute inset-y-0 left-0 orchid-gradient rounded-full"
                style={{ width: `${progress}%` }}
              />
              {/* Scrubber thumb */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-violet-500 opacity-0 group-hover/progress:opacity-100 transition-opacity pointer-events-none"
                style={{ left: `calc(${progress}% - 8px)` }}
              />
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-1">
              {/* Skip back 10s */}
              <button
                onClick={() => skip(-10)}
                className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-all active:scale-90"
                title="Skip back 10s"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              {/* Play / Pause */}
              <button
                onClick={togglePlay}
                className="p-2 rounded-xl text-white hover:bg-white/10 transition-all active:scale-90"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" fill="white" />
                ) : (
                  <Play className="w-6 h-6" fill="white" />
                )}
              </button>

              {/* Skip forward 10s */}
              <button
                onClick={() => skip(10)}
                className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-all active:scale-90"
                title="Skip forward 10s"
              >
                <RotateCw className="w-5 h-5" />
              </button>

              {/* Volume */}
              <div className="flex items-center gap-0.5 group/vol">
                <button
                  onClick={toggleMute}
                  className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-all active:scale-90"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-0 group-hover/vol:w-20 transition-all duration-300 overflow-hidden accent-violet-500 h-1 cursor-pointer"
                />
              </div>

              {/* Time display */}
              <span className="text-white/80 text-[11px] font-bold tabular-nums ml-1 select-none">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Quality selector */}
              <div className="relative" data-quality-menu>
                <button
                  onClick={() => {
                    setShowQualityMenu(!showQualityMenu)
                    if (!qualityMenuOpened) setQualityMenuOpened(true)
                  }}
                  className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-all active:scale-90 flex items-center gap-1"
                  title="Quality"
                >
                  <Settings className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {currentQuality === "auto" ? "Auto" : currentQuality}
                  </span>
                </button>

                <AnimatePresence>
                  {showQualityMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute bottom-full right-0 mb-2 w-40 bg-black/80 backdrop-blur-xl rounded-2xl border border-white/20 p-1.5 overflow-hidden"
                    >
                      {variantsLoading ? (
                        <div className="px-4 py-3 text-white/60 text-[10px] font-bold uppercase tracking-widest text-center">
                          Loading...
                        </div>
                      ) : (
                        (mediaInfo?.availableQualities || ["auto"]).map((q) => (
                          <button
                            key={q}
                            onClick={() => handleQualityChange(q)}
                            className={`w-full px-4 py-2.5 rounded-xl text-left text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-between ${
                              currentQuality === q
                                ? "text-white orchid-gradient"
                                : "text-white/70 hover:text-white hover:bg-white/10"
                            }`}
                          >
                            <span>{q === "auto" ? "Auto" : q}</span>
                            {currentQuality === q && <Check className="w-3.5 h-3.5" />}
                          </button>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-all active:scale-90"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize className="w-5 h-5" />
                ) : (
                  <Maximize className="w-5 h-5" />
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

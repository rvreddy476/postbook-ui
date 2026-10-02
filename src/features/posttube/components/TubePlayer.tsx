"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import type Hls from "hls.js";
import {
  AudioLines,
  AudioWaveform,
  Captions,
  Gauge,
  Keyboard,
  Loader2,
  Maximize,
  Minimize,
  Moon,
  Pause,
  PictureInPicture2,
  Play,
  RectangleHorizontal,
  RotateCcw,
  RotateCw,
  Settings,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";

import {
  ChoiceMenuBack,
  ChoiceMenuChoiceRow,
  ChoiceMenuOption,
  ChoiceMenuRow,
  ChoiceMenuSwitchRow,
  SpeedPanel,
} from "@/features/reels/components/ChoiceMenu";
import { Popover } from "@/features/reels/components/Popover";
import { pickHlsLevel, SPEEDS, speedChipLabel } from "@/features/reels/playback/playerPrefs";
import { fitFrame, type FrameBox } from "../endScreenGeometry";
import { formatClockMs, type TubePlayerPrefs } from "../model";
import { playerKeyAction, playerKeyPreventsDefault, SEEK_LARGE_S } from "../playerKeys";
import { startAmbient } from "../watch/ambient";
import { chapterAt, chapterTicks, type Chapter } from "../watch/chapters";
import { countdownSpot, END_SCREEN_MIN_FRAME_WIDTH } from "../watch/endScreenView";
import { keyHelpRows } from "../watch/keysHelp";
import { scheduleSleep, SLEEP_CHOICES, sleepRemainingMs, sleepValueLabel, type SleepChoice, type SleepSchedule } from "../watch/sleepTimer";
import { createStableVolume, type StableVolumeHandle } from "../watch/stableVolume";
import { storyboardCueAt, type StoryboardCue } from "../watch/storyboard";
import "./tube-player.css";

/*
  The long-video player. One <video>, HLS through hls.js (native on Safari)
  with the progressive file as the fallback, a quality picker from the
  manifest, speed, captions from the subtitles service, and our keyboard
  (playerKeys.ts). It reports position/duration upward and never persists
  anything itself: the watch page owns progress saving and the end-of-video
  decision.

  W1 added, all on this one element: chapter ticks and the storyboard
  preview above the seek bar; theater and miniplayer controls (the page
  owns both states — the player only asks); the settings menu as the reels
  choice-pane shell (Ambient mode · Audio track · Auto play · Captions ·
  Keys · Playback speed · Quality · Sleep timer · Stable volume); an
  alternate audio track as a muxed MP4 with the clock carried across the
  switch; the ambient canvas behind the frame; the sleep timer; a Web Audio
  compressor for stable volume, built on first enable.
*/

export interface CaptionTrack {
  lang: string;
  label: string;
  src: string;
}

export interface AudioTrackChoice {
  id: string;
  label: string;
}

/** What the page's overlay layer is told on every render (the frame is the 16:9 box, in px). */
export interface TubeOverlayState {
  positionMs: number;
  durationMs: number;
  ended: boolean;
  playing: boolean;
  frameWidth: number;
  frameHeight: number;
}

/** What the page can drive from outside (the chapter strip seeks, the collection bar skips). */
export interface TubePlayerHandle {
  seekTo: (ms: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
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
  /** The Auto play switch in the settings menu; null hides the row. */
  autoplayNext?: { on: boolean; onChange: (on: boolean) => void } | null;
  onPlay?: () => void;
  onPause?: (positionMs: number, durationMs: number) => void;
  onTimeUpdate?: (positionMs: number, durationMs: number) => void;
  onEnded?: (positionMs: number, durationMs: number) => void;
  onDurationKnown?: (durationMs: number) => void;
  /**
    Drawn over the frame once playback ends (Replay + up next / series
    countdown). A function gets `compact`: true when `endAvoid` holds
    boxes, and the card is then drawn small, off those boxes, without the
    dark backdrop.
  */
  endScreen?: ReactNode | ((compact: boolean) => ReactNode);
  /** Frame-fraction boxes (end-screen elements still up at the end) the Up next card must not cover; used on frames ≥ 480px, where they are drawn. */
  endAvoid?: readonly FrameBox[] | null;
  /** A layer over the 16:9 frame (end-screen elements, cards). Painted above the end card, below the controls. */
  overlay?: (state: TubeOverlayState) => ReactNode;
  ended: boolean;
  onEndedChange: (ended: boolean) => void;
  /** The T key and the theater control. The page owns the state. */
  onTheater?: () => void;
  theater?: boolean;
  /** The I key and the miniplayer control. The page owns the state. */
  onMiniplayer?: () => void;
  miniplayer?: boolean;
  /** The N key and the collection bar. The page decides what "next" is. */
  onNext?: () => void;
  chapters?: Chapter[];
  storyboard?: StoryboardCue[] | null;
  /** Ambient glow: the page has already applied the switch, reduced motion and theater; fullscreen is dropped here. */
  ambient?: boolean;
  onAmbientChange?: (on: boolean) => void;
  stableVolume?: boolean;
  onStableVolumeChange?: (on: boolean) => void;
  /** Alternate audio (the reels helpers): the choices, the current one, and the owner's manage row. */
  audioTracks?: { options: AudioTrackChoice[]; current: string; onChange: (id: string) => void; onManage?: () => void } | null;
  /** A muxed MP4 for the chosen alternate track; the clock carries across the switch. */
  sourceOverride?: string | null;
  /** The sleep timer fired (paused by the clock, or the video ended under "End of video"). */
  onSleep?: () => void;
  /** The manifest's rung heights, whenever they change: the page's More menu offers Quality from them. */
  onLevels?: (heights: number[]) => void;
  /** The chosen caption language when the page owns it (its More menu drives it too); absent = the player keeps its own. */
  captionLang?: string | null;
  onCaptionLang?: (lang: string | null) => void;
  controller?: MutableRefObject<TubePlayerHandle | null>;
}

const HIDE_CONTROLS_AFTER_MS = 2600;
const PREVIEW_W = 160;

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
  endAvoid = null,
  overlay,
  ended,
  onEndedChange,
  onTheater,
  theater = false,
  onMiniplayer,
  miniplayer = false,
  onNext,
  chapters = [],
  storyboard = null,
  ambient = false,
  onAmbientChange,
  stableVolume = false,
  onStableVolumeChange,
  audioTracks = null,
  sourceOverride = null,
  onSleep,
  onLevels,
  captionLang: captionLangProp,
  onCaptionLang,
  controller,
}: TubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ambientRef = useRef<HTMLCanvasElement>(null);
  const seekRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const levelHeightsRef = useRef<number[]>([]);
  const seekAppliedRef = useRef(false);
  /** The clock at the moment the source is switched (an audio track), replayed once the new source has metadata. */
  const carryRef = useRef<{ at: number; paused: boolean } | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stableRef = useRef<StableVolumeHandle | null>(null);
  const endedRef = useRef(ended);
  endedRef.current = ended;
  const onSleepRef = useRef(onSleep);
  onSleepRef.current = onSleep;

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
  const [ownCaptionLang, setOwnCaptionLang] = useState<string | null>(captions[0]?.lang ?? null);
  const captionLang = captionLangProp !== undefined ? captionLangProp : ownCaptionLang;
  const onCaptionLangRef = useRef(onCaptionLang);
  onCaptionLangRef.current = onCaptionLang;
  const setCaptionLang = useCallback((lang: string | null) => {
    setOwnCaptionLang(lang);
    onCaptionLangRef.current?.(lang);
  }, []);
  const onLevelsRef = useRef(onLevels);
  onLevelsRef.current = onLevels;
  useEffect(() => {
    onLevelsRef.current?.(levels);
  }, [levels]);
  const [hoverMs, setHoverMs] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const [sleepChoice, setSleepChoice] = useState<SleepChoice>("off");
  const [sleepSchedule, setSleepSchedule] = useState<SleepSchedule>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const sleepScheduleRef = useRef<SleepSchedule>(null);
  sleepScheduleRef.current = sleepSchedule;

  useEffect(() => {
    setTapped(!deferLoad);
    setFailed(false);
    seekAppliedRef.current = false;
    carryRef.current = null;
    setPositionMs(0);
    setDurationMs(0);
    setBufferedMs(0);
    setLevels([]);
    levelHeightsRef.current = [];
    setSettingsOpen(false);
    setHoverMs(null);
  }, [videoId, deferLoad]);

  useEffect(() => {
    if (!captionLang || !captions.some((c) => c.lang === captionLang)) {
      setCaptionLang(captions[0]?.lang ?? null);
    }
  }, [captions, captionLang, setCaptionLang]);

  /* ── source attach ─────────────────────────────────────── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !tapped) return;
    let cancelled = false;
    setFailed(false);
    setBuffering(true);

    const useFile = (url = fileUrl) => {
      if (cancelled) return;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      levelHeightsRef.current = [];
      setLevels([]);
      if (!url) {
        setFailed(true);
        setBuffering(false);
        return;
      }
      video.src = url;
      video.load();
    };

    const attach = async () => {
      if (sourceOverride) {
        // An alternate audio track: one muxed MP4, no rungs to choose from.
        useFile(sourceOverride);
        return;
      }
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
          return;
        }
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
      // Leaving for a source switch on the same video (an audio track): remember the clock so it carries over.
      if (video.currentTime > 0 && seekAppliedRef.current) carryRef.current = { at: video.currentTime, paused: video.paused };
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
    // prefs.quality is applied by its own effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hlsUrl, fileUrl, tapped, sourceOverride]);

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
    // load() resets playbackRate to 1, so this runs after every source switch too.
  }, [prefs.speed, prefs.volume, prefs.muted, sourceOverride, hlsUrl, fileUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = video.textTracks;
    for (let i = 0; i < tracks.length; i += 1) {
      const t = tracks[i];
      t.mode = prefs.captions && t.language === captionLang ? "showing" : "hidden";
    }
  }, [prefs.captions, captionLang, captions]);

  /* ── stable volume (Web Audio compressor, built on first enable) ── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stableVolume) {
      if (!stableRef.current) stableRef.current = createStableVolume(video);
      stableRef.current.enable();
    } else {
      stableRef.current?.disable();
    }
  }, [stableVolume]);

  useEffect(() => {
    return () => {
      stableRef.current?.dispose();
      stableRef.current = null;
    };
  }, []);

  /* ── ambient canvas ────────────────────────────────────── */
  const ambientOn = ambient && !fullscreen && !theater && tapped;
  useEffect(() => {
    const video = videoRef.current;
    const canvas = ambientRef.current;
    if (!ambientOn || !video || !canvas) return;
    return startAmbient(video, canvas);
  }, [ambientOn]);

  /* ── element events ────────────────────────────────────── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const currentDuration = () => {
      if (trimEndMs && trimEndMs > 0) return trimEndMs;
      return Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : 0;
    };

    const applyStart = () => {
      const carry = carryRef.current;
      if (carry) {
        carryRef.current = null;
        video.currentTime = carry.at;
        if (!carry.paused) void video.play().catch(() => undefined);
        seekAppliedRef.current = true;
        return;
      }
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
        if (sleepScheduleRef.current?.kind === "end") onSleepRef.current?.();
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
      if (sleepScheduleRef.current?.kind === "end") onSleepRef.current?.();
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

  /* ── the frame's size (the overlay's 16:9 box follows it: theater, fullscreen, the dock) ── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setFrameSize((cur) => (Math.abs(cur.width - r.width) < 0.5 && Math.abs(cur.height - r.height) < 0.5 ? cur : { width: r.width, height: r.height }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── fullscreen ────────────────────────────────────────── */
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  /* ── sleep timer ───────────────────────────────────────── */
  const chooseSleep = useCallback((choice: SleepChoice) => {
    setSleepChoice(choice);
    setSleepSchedule(scheduleSleep(choice, Date.now()));
  }, []);

  useEffect(() => {
    if (!sleepSchedule || sleepSchedule.kind !== "at") return;
    const wait = sleepRemainingMs(sleepSchedule, Date.now()) ?? 0;
    const id = setTimeout(() => {
      videoRef.current?.pause();
      setSleepChoice("off");
      setSleepSchedule(null);
      onSleepRef.current?.();
    }, wait);
    return () => clearTimeout(id);
  }, [sleepSchedule]);

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
    if (!tapped) setTapped(true);
    video.currentTime = Math.max(0, ms / 1000);
    if (endedRef.current) onEndedChange(false);
  }, [onEndedChange, tapped]);

  useEffect(() => {
    if (!controller) return;
    controller.current = {
      seekTo,
      togglePlay,
      play: () => void videoRef.current?.play().catch(() => undefined),
      pause: () => videoRef.current?.pause(),
    };
    return () => {
      controller.current = null;
    };
  }, [controller, seekTo, togglePlay]);

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
        case "toggle-miniplayer":
          onMiniplayer?.();
          break;
        case "next":
          onNext?.();
          break;
      }
      showControls();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [togglePlay, seekBy, seekPercent, toggleMute, toggleFullscreen, toggleCaptions, onTheater, onMiniplayer, onNext, showControls]);

  /* ── seek bar hover: storyboard + chapter title ────────── */
  const onSeekHover = useCallback(
    (clientX: number) => {
      const bar = seekRef.current;
      if (!bar || durationMs <= 0) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      setHoverMs(Math.round(ratio * durationMs));
      // Keep the 160px card inside the bar.
      setHoverX(Math.max(PREVIEW_W / 2, Math.min(rect.width - PREVIEW_W / 2, clientX - rect.left)));
    },
    [durationMs],
  );

  const ticks = useMemo(() => chapterTicks(chapters, durationMs), [chapters, durationMs]);
  const hoverCue = hoverMs !== null && storyboard ? storyboardCueAt(storyboard, hoverMs) : null;
  const hoverChapter = hoverMs !== null ? chapterAt(chapters, hoverMs) : null;

  const pct = durationMs > 0 ? Math.min(100, (positionMs / durationMs) * 100) : 0;
  const bufferedPct = durationMs > 0 ? Math.min(100, (bufferedMs / durationMs) * 100) : 0;
  const showEnd = ended && !!endScreen;
  const chromeVisible = controlsVisible || !playing || ended;
  const fit = fitFrame(frameSize.width, frameSize.height);
  const endCompact = showEnd && !!endAvoid && endAvoid.length > 0 && fit.width >= END_SCREEN_MIN_FRAME_WIDTH;
  const endNode = typeof endScreen === "function" ? endScreen(endCompact) : endScreen;
  const compactSpot = endCompact ? countdownSpot(endAvoid ?? [], fit) : null;
  const overlayNode = overlay ? overlay({ positionMs, durationMs, ended, playing, frameWidth: fit.width, frameHeight: fit.height }) : null;

  return (
    <div className="tube-player" data-ambient={ambientOn ? "" : undefined} data-mini={miniplayer ? "" : undefined}>
      <canvas ref={ambientRef} className="tube-player__ambient" aria-hidden />
      <div
        ref={containerRef}
        className="tube-player__frame group/player"
        onMouseMove={showControls}
        onMouseLeave={() => playing && !settingsOpen && setControlsVisible(false)}
        tabIndex={0}
        aria-label="Video player"
      >
        <video
          ref={videoRef}
          poster={poster || undefined}
          className="tube-player__video"
          playsInline
          autoPlay={autoPlay && tapped}
          preload={tapped ? "auto" : "none"}
          crossOrigin="use-credentials"
          controlsList="nodownload"
          onContextMenu={(e) => e.preventDefault()}
          onClick={togglePlay}
          onDoubleClick={toggleFullscreen}
        >
          {captions.map((c) => (
            <track key={c.lang} kind="subtitles" src={c.src} srcLang={c.lang} label={c.label} default={false} />
          ))}
        </video>

        {/* Poster tap (data-saver) */}
        {!tapped ? (
          <button type="button" onClick={togglePlay} className="tube-player__tap" aria-label="Play video">
            <span className="tube-player__big">
              <Play className="ml-1 h-7 w-7 fill-current" />
            </span>
          </button>
        ) : null}

        {/* Buffering */}
        {tapped && buffering && !ended && !failed ? (
          <div className="tube-player__spinner">
            <Loader2 className="h-10 w-10 animate-spin" />
          </div>
        ) : null}

        {failed ? (
          <div className="tube-player__failed">
            <p className="text-[14px] font-semibold">This video can&apos;t be played right now.</p>
            <p className="text-[12px] opacity-70">It may still be processing. Try again in a moment.</p>
          </div>
        ) : null}

        {/* End screen */}
        {showEnd && !endCompact ? (
          <div className="tube-player__end">
            <div className="flex w-full max-w-[560px] flex-col items-center gap-5">
              {endNode}
              <button type="button" onClick={replay} className="tube-player__replay">
                <RotateCcw className="h-4 w-4" /> Replay
              </button>
            </div>
          </div>
        ) : null}

        {/* The 16:9 layer: the compact Up next card, then the page's overlay (end-screen elements, cards) above it */}
        {(overlayNode || compactSpot) && fit.width > 0 ? (
          <div className="tube-player__overlay" style={{ left: fit.left, top: fit.top, width: fit.width, height: fit.height }}>
            {compactSpot ? (
              <div className="tube-player__end-compact" style={{ left: compactSpot.left, top: compactSpot.top }} data-end-compact>
                {endNode}
                <button type="button" onClick={replay} className="tube-player__replay is-compact">
                  <RotateCcw className="h-4 w-4" /> Replay
                </button>
              </div>
            ) : null}
            {overlayNode}
          </div>
        ) : null}

        {/* Big centre play (paused, not ended) */}
        {tapped && !playing && !ended && !buffering && !failed ? (
          <button type="button" onClick={togglePlay} className="tube-player__tap is-paused" aria-label="Play">
            <span className="tube-player__big">
              <Play className="ml-1 h-7 w-7 fill-current" />
            </span>
          </button>
        ) : null}

        {/* Controls */}
        <div className={`tube-player__controls ${chromeVisible ? "is-visible" : ""}`} data-controls>
          {/* Seek bar */}
          <div
            ref={seekRef}
            className="tube-seek"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              seekTo(ratio * durationMs);
            }}
            onMouseMove={(e) => onSeekHover(e.clientX)}
            onMouseLeave={() => setHoverMs(null)}
          >
            {hoverMs !== null ? (
              <div className="tube-seek__preview" style={{ left: hoverX }} aria-hidden>
                {hoverCue ? (
                  <div
                    className="tube-seek__thumb"
                    style={{
                      width: hoverCue.w,
                      height: hoverCue.h,
                      backgroundImage: `url("${hoverCue.image}")`,
                      backgroundPosition: `-${hoverCue.x}px -${hoverCue.y}px`,
                    }}
                  />
                ) : null}
                <div className="tube-seek__label">
                  {hoverChapter ? <span className="tube-seek__chapter">{hoverChapter.title}</span> : null}
                  <span className="tube-seek__time">{formatClockMs(hoverMs)}</span>
                </div>
              </div>
            ) : null}
            <div className="tube-seek__track">
              <div className="tube-seek__buffered" style={{ width: `${bufferedPct}%` }} />
              <div className="tube-seek__played" style={{ width: `${pct}%` }} />
              {ticks.map((t) => (
                <span key={t.startMs} className="tube-seek__tick" style={{ left: `${t.pct}%` }} title={t.title} />
              ))}
            </div>
            <div className="tube-seek__knob" style={{ left: `${pct}%` }} />
            <input
              type="range"
              min={0}
              max={durationMs || 1}
              step={250}
              value={Math.min(positionMs, durationMs || 1)}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="tube-seek__input"
              aria-label="Seek"
            />
          </div>

          <div className="tube-player__bar">
            <ControlButton label={playing ? "Pause" : "Play"} onClick={togglePlay}>
              {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
            </ControlButton>
            <ControlButton label="Back 10 seconds" onClick={() => seekBy(-SEEK_LARGE_S)}>
              <RotateCcw className="h-[18px] w-[18px]" />
            </ControlButton>
            <ControlButton label="Forward 10 seconds" onClick={() => seekBy(SEEK_LARGE_S)}>
              <RotateCw className="h-[18px] w-[18px]" />
            </ControlButton>
            {onNext ? (
              <ControlButton label="Next video" onClick={onNext}>
                <SkipForward className="h-[18px] w-[18px]" />
              </ControlButton>
            ) : null}
            <div className="tube-player__volume">
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
                aria-label="Volume"
              />
            </div>
            <span className="tube-player__time">
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
              <TubeSettingsMenu
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                prefs={prefs}
                onChange={onPrefsChange}
                levels={levels}
                captions={captions}
                captionLang={captionLang}
                onCaptionLang={setCaptionLang}
                autoplayNext={autoplayNext ?? null}
                ambient={ambient}
                onAmbient={onAmbientChange}
                stableVolume={stableVolume}
                onStableVolume={onStableVolumeChange}
                audioTracks={audioTracks}
                sleepChoice={sleepChoice}
                sleepSchedule={sleepSchedule}
                onSleep={chooseSleep}
              />
            </div>
            {onMiniplayer ? (
              <ControlButton label={miniplayer ? "Leave miniplayer" : "Miniplayer"} onClick={onMiniplayer} active={miniplayer}>
                <PictureInPicture2 className="h-5 w-5" />
              </ControlButton>
            ) : null}
            {onTheater ? (
              <ControlButton label={theater ? "Leave theater" : "Theater"} onClick={onTheater} active={theater}>
                <RectangleHorizontal className="h-5 w-5" />
              </ControlButton>
            ) : null}
            <ControlButton label={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen}>
              {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </ControlButton>
          </div>
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
      aria-pressed={active}
      className={`tube-player__button ${active ? "is-active" : ""}`}
    >
      {children}
    </button>
  );
}

/* ── Settings menu: the reels choice-pane shell ─────────── */

type Pane = "root" | "audio" | "captions" | "keys" | "speed" | "quality" | "sleep";

export function TubeSettingsMenu({
  open,
  onClose,
  prefs,
  onChange,
  levels,
  captions,
  captionLang,
  onCaptionLang,
  autoplayNext,
  ambient,
  onAmbient,
  stableVolume,
  onStableVolume,
  audioTracks,
  sleepChoice,
  sleepSchedule,
  onSleep,
}: {
  open: boolean;
  onClose: () => void;
  prefs: TubePlayerPrefs;
  onChange: (patch: Partial<TubePlayerPrefs>) => void;
  levels: number[];
  captions: CaptionTrack[];
  captionLang: string | null;
  onCaptionLang: (lang: string) => void;
  autoplayNext: { on: boolean; onChange: (on: boolean) => void } | null;
  ambient: boolean;
  onAmbient?: (on: boolean) => void;
  stableVolume: boolean;
  onStableVolume?: (on: boolean) => void;
  audioTracks: { options: AudioTrackChoice[]; current: string; onChange: (id: string) => void; onManage?: () => void } | null;
  sleepChoice: SleepChoice;
  sleepSchedule: SleepSchedule;
  onSleep: (choice: SleepChoice) => void;
}) {
  const [pane, setPane] = useState<Pane>("root");
  useEffect(() => {
    if (!open) setPane("root");
  }, [open]);

  const rungs = Array.from(new Set(levels.filter((h) => h > 0))).sort((a, b) => b - a);
  const qualityLabel = prefs.quality === "auto" ? "Auto" : prefs.quality;
  const captionLabel = captions.length === 0 ? "None" : !prefs.captions ? "Off" : captions.find((c) => c.lang === captionLang)?.label ?? "On";
  const audioChoices = audioTracks?.options.length ? audioTracks.options : [{ id: "original", label: "Original" }];
  const audioLabel = audioChoices.find((t) => t.id === (audioTracks?.current ?? "original"))?.label ?? audioChoices[0].label;
  const keys = useMemo(() => keyHelpRows(), []);
  const close = () => {
    setPane("root");
    onClose();
  };

  // Ascending order, the founder's rule: Ambient mode · Audio track · Auto play · Captions · Keys · Playback speed · Quality · Sleep timer · Stable volume.
  const root = (
    <div className="reel-more-menu__list" data-pane="root">
      <ChoiceMenuSwitchRow icon={<Sparkles />} label="Ambient mode" dataRow="ambient" on={ambient} onToggle={() => onAmbient?.(!ambient)} disabled={!onAmbient} />
      <ChoiceMenuChoiceRow icon={<AudioLines />} label="Audio track" value={audioLabel} dataRow="audio" onClick={() => setPane("audio")} />
      {autoplayNext ? (
        <ChoiceMenuSwitchRow icon={<SkipForward />} label="Auto play" dataRow="autoplay" on={autoplayNext.on} onToggle={() => autoplayNext.onChange(!autoplayNext.on)} />
      ) : null}
      <ChoiceMenuChoiceRow icon={<Captions />} label="Captions" value={captionLabel} dataRow="captions" disabled={captions.length === 0} onClick={() => setPane("captions")} />
      <ChoiceMenuChoiceRow icon={<Keyboard />} label="Keys" value="" dataRow="keys" onClick={() => setPane("keys")} />
      <ChoiceMenuChoiceRow icon={<Gauge />} label="Playback speed" value={prefs.speed === 1 ? "Normal" : `${speedChipLabel(prefs.speed)}x`} dataRow="speed" onClick={() => setPane("speed")} />
      <ChoiceMenuChoiceRow icon={<SlidersHorizontal />} label="Quality" value={qualityLabel} dataRow="quality" onClick={() => setPane("quality")} />
      <ChoiceMenuChoiceRow icon={<Moon />} label="Sleep timer" value={sleepValueLabel(sleepChoice, sleepSchedule, Date.now())} dataRow="sleep" onClick={() => setPane("sleep")} />
      <ChoiceMenuSwitchRow icon={<AudioWaveform />} label="Stable volume" dataRow="stable-volume" on={stableVolume} onToggle={() => onStableVolume?.(!stableVolume)} disabled={!onStableVolume} />
    </div>
  );

  const panes: Record<Exclude<Pane, "root">, ReactNode> = {
    audio: (
      <div className="reel-more-menu__list" data-pane="audio">
        <ChoiceMenuBack label="Audio track" onClick={() => setPane("root")} />
        {audioChoices.map((t) => (
          <ChoiceMenuOption key={t.id} label={t.label} selected={t.id === (audioTracks?.current ?? "original")} onClick={() => audioTracks?.onChange(t.id)} />
        ))}
        {audioChoices.length < 2 ? <p className="reel-more-menu__note">No other languages for this video yet.</p> : null}
        {audioTracks?.onManage ? (
          <ChoiceMenuRow
            icon={<AudioLines />}
            label="Manage tracks"
            hint="Upload or generate a dub"
            dataRow="manage-audio"
            onClick={() => {
              close();
              audioTracks.onManage?.();
            }}
          />
        ) : null}
      </div>
    ),
    captions: (
      <div className="reel-more-menu__list" data-pane="captions">
        <ChoiceMenuBack label="Captions" onClick={() => setPane("root")} />
        <ChoiceMenuOption label="Off" selected={!prefs.captions} onClick={() => onChange({ captions: false })} />
        {captions.map((c) => (
          <ChoiceMenuOption
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
    ),
    keys: (
      <div className="reel-more-menu__list" data-pane="keys">
        <ChoiceMenuBack label="Keys" onClick={() => setPane("root")} />
        <dl className="tube-keys">
          {keys.map((row) => (
            <div key={row.action} className="tube-keys__row">
              <dt>
                {row.keys.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </dt>
              <dd>{row.action}</dd>
            </div>
          ))}
        </dl>
      </div>
    ),
    speed: (
      <div className="reel-more-menu__list" data-pane="speed">
        <ChoiceMenuBack label="Playback speed" onClick={() => setPane("root")} />
        <SpeedPanel speed={prefs.speed} presets={SPEEDS} onChange={(speed) => onChange({ speed })} />
      </div>
    ),
    quality: (
      <div className="reel-more-menu__list" data-pane="quality">
        <ChoiceMenuBack label="Quality" onClick={() => setPane("root")} />
        <ChoiceMenuOption label="Auto" selected={prefs.quality === "auto"} onClick={() => onChange({ quality: "auto" })} />
        {rungs.map((h) => (
          <ChoiceMenuOption key={h} label={`${h}p`} selected={prefs.quality === `${h}p`} onClick={() => onChange({ quality: `${h}p` })} />
        ))}
        {rungs.length === 0 ? <p className="reel-more-menu__note">Only Auto is available for this video.</p> : null}
      </div>
    ),
    sleep: (
      <div className="reel-more-menu__list" data-pane="sleep">
        <ChoiceMenuBack label="Sleep timer" onClick={() => setPane("root")} />
        {SLEEP_CHOICES.map((c) => (
          <ChoiceMenuOption key={c.value} label={c.label} selected={sleepChoice === c.value} onClick={() => onSleep(c.value)} />
        ))}
      </div>
    ),
  };

  return (
    <Popover open={open} onClose={close} align="right" label="Player settings" placement="up" tone="stage" className="reel-more-menu tube-settings-menu">
      {pane === "root" ? root : panes[pane]}
    </Popover>
  );
}

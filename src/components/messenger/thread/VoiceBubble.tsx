'use client'

/*
  A voice message inside a chat bubble: play/pause, the waveform the sender's
  browser measured (played part solid, the rest faded), and the time. Every
  colour is currentColor, so it reads on a coloured outgoing bubble and on a
  neutral incoming one alike.
*/

import { useEffect, useMemo, useRef, useState } from 'react'
import type { JSX, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import { Pause, Play } from 'lucide-react'
import { formatVoiceDuration, resampleBars } from '@/lib/chat/voice'

export interface VoiceBubbleProps {
  src: string
  durationMs: number
  waveform: number[]
  mine: boolean
}

const BAR_COUNT = 32

/** Only one voice message plays at a time across the whole page. */
let nowPlaying: HTMLAudioElement | null = null

export function VoiceBubble({ src, durationMs, waveform, mine }: VoiceBubbleProps): JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentMs, setCurrentMs] = useState(0)
  /** The element's own duration when the message carried none. */
  const [mediaMs, setMediaMs] = useState(0)
  const [failed, setFailed] = useState(false)

  const bars = useMemo(() => resampleBars(waveform, BAR_COUNT), [waveform])
  // Recorder WebM often reports Infinity until fully read, so the message's
  // own duration wins whenever it has one.
  const totalMs = durationMs > 0 ? durationMs : mediaMs
  const fraction = totalMs > 0 ? Math.max(0, Math.min(1, currentMs / totalMs)) : 0

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => setCurrentMs(a.currentTime * 1000)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => { setPlaying(false); setCurrentMs(0) }
    const onMeta = () => { if (Number.isFinite(a.duration) && a.duration > 0) setMediaMs(a.duration * 1000) }
    const onError = () => { setPlaying(false); setFailed(true) }
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    a.addEventListener('ended', onEnded)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('durationchange', onMeta)
    a.addEventListener('error', onError)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('ended', onEnded)
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('durationchange', onMeta)
      a.removeEventListener('error', onError)
      a.pause()
      if (nowPlaying === a) nowPlaying = null
    }
  }, [])

  // A new source starts from the beginning.
  useEffect(() => {
    setCurrentMs(0)
    setFailed(false)
  }, [src])

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (!a.paused) {
      a.pause()
      return
    }
    if (nowPlaying && nowPlaying !== a) nowPlaying.pause()
    nowPlaying = a
    setFailed(false)
    a.play().catch(() => { setPlaying(false) })
  }

  const seekTo = (f: number) => {
    const a = audioRef.current
    if (!a || !(totalMs > 0)) return
    const ms = Math.max(0, Math.min(1, f)) * totalMs
    try {
      a.currentTime = ms / 1000
    } catch { /* not seekable yet */ }
    setCurrentMs(ms)
  }

  const onBarsClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width <= 0) return
    seekTo((e.clientX - rect.left) / rect.width)
  }

  const onBarsKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); seekTo(fraction + 0.05) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); seekTo(fraction - 0.05) }
    else if (e.key === 'Home') { e.preventDefault(); seekTo(0) }
    else if (e.key === 'End') { e.preventDefault(); seekTo(1) }
  }

  // Elapsed once it has started, otherwise the whole length.
  const shownMs = playing || currentMs > 0 ? currentMs : totalMs
  const label = mine ? 'Your voice message' : 'Voice message'

  return (
    <div className="flex w-[220px] max-w-full items-center gap-2.5" role="group" aria-label={`${label}, ${formatVoiceDuration(totalMs)}`}>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-current/15 transition-opacity hover:opacity-80 active:scale-95"
      >
        {playing
          ? <Pause className="h-4 w-4 fill-current" strokeWidth={1.75} />
          : <Play className="ml-0.5 h-4 w-4 fill-current" strokeWidth={1.75} />}
      </button>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(totalMs / 1000)}
        aria-valuenow={Math.round(currentMs / 1000)}
        aria-valuetext={`${formatVoiceDuration(currentMs)} of ${formatVoiceDuration(totalMs)}`}
        onClick={onBarsClick}
        onKeyDown={onBarsKey}
        className="flex h-7 min-w-0 flex-1 cursor-pointer items-center gap-[2px] rounded-sm outline-hidden focus-visible:ring-2 focus-visible:ring-current/40"
      >
        {bars.map((v, i) => {
          const played = (i + 0.5) / bars.length <= fraction
          return (
            <span
              key={i}
              aria-hidden
              className={`min-w-[2px] flex-1 rounded-full bg-current transition-opacity ${played ? 'opacity-100' : 'opacity-35'}`}
              style={{ height: `${Math.max(12, Math.round((v / 255) * 100))}%` }}
            />
          )
        })}
      </div>
      <span className="w-9 shrink-0 text-right text-[11px] tabular-nums opacity-80">
        {failed ? '—' : formatVoiceDuration(shownMs)}
      </span>
    </div>
  )
}

import { useCallback, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import api from '@/lib/api'

interface VideoTrackerConfig {
  contentId: string
  creatorId: string
  contentType: 'reel' | 'long_video'
  contentDurationMs: number
  surface: string
  position: number
  isAutoplay: boolean
}

const REEL_HEARTBEAT_MS = 2000
const LONG_HEARTBEAT_MS = 5000
const BATCH_FLUSH_INTERVAL = 10000  // 10s
const MAX_BATCH_SIZE = 50

const REEL_TIME_MILESTONES = [1000, 3000, 10000]     // 1s, 3s, 10s
const LONG_TIME_MILESTONES = [10000, 30000, 60000, 120000]
const PERCENT_MILESTONES = [25, 50, 75, 95]

function getMilestoneType(timeMs: number): string {
  return `VIEW_${Math.round(timeMs / 1000)}S`
}

function getPercentMilestoneType(pct: number): string {
  return `PCT_${pct}`
}

export function useVideoTracker(config: VideoTrackerConfig) {
  const sessionId = useRef(uuidv4())
  const eventBuffer = useRef<any[]>([])
  const firedTimeMilestones = useRef(new Set<number>())
  const firedPercentMilestones = useRef(new Set<number>())
  const lastHeartbeatTime = useRef(0)
  const totalWatchedMs = useRef(0)
  const maxContinuousWatchMs = useRef(0)
  const currentContinuousMs = useRef(0)
  const loopCount = useRef(0)
  const playStarted = useRef(false)
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const heartbeatInterval = config.contentType === 'reel' ? REEL_HEARTBEAT_MS : LONG_HEARTBEAT_MS
  const timeMilestones = config.contentType === 'reel' ? REEL_TIME_MILESTONES : LONG_TIME_MILESTONES

  const getCommonFields = useCallback(() => ({
    event_id: uuidv4(),
    timestamp_ms: Date.now(),
    content_id: config.contentId,
    creator_id: config.creatorId,
    viewer_user_id: '', // filled by server from X-User-Id header
    session_id: sessionId.current,
    surface: config.surface,
    position: config.position,
    country: '',
    language: navigator.language || 'en',
    device_id_hash: '',
    app_version: '1.0.0',
    os: navigator.platform || 'web',
    network_type: (navigator as any).connection?.effectiveType || 'unknown',
    is_autoplay: config.isAutoplay,
  }), [config])

  const queueEvent = useCallback((event: any) => {
    eventBuffer.current.push(event)
    if (eventBuffer.current.length >= MAX_BATCH_SIZE) {
      flushEvents()
    }
  }, [])

  const flushEvents = useCallback(() => {
    if (eventBuffer.current.length === 0) return
    const events = eventBuffer.current.splice(0)
    api.post('/v1/analytics/events', {
      events: events.map(e => ({
        type: e.event_name,
        payload: e,
        timestamp: new Date().toISOString(),
      })),
    }).catch(() => {
      // On failure, silently drop — analytics are best-effort
    })
  }, [])

  // Set up periodic flush
  useEffect(() => {
    flushTimer.current = setInterval(flushEvents, BATCH_FLUSH_INTERVAL)
    return () => {
      if (flushTimer.current) clearInterval(flushTimer.current)
      flushEvents() // flush remaining on unmount
    }
  }, [flushEvents])

  const onPlayStart = useCallback(() => {
    if (playStarted.current) return
    playStarted.current = true

    queueEvent({
      ...getCommonFields(),
      event_name: 'play_start',
      content_duration_ms: config.contentDurationMs,
      content_type: config.contentType,
      start_method: config.isAutoplay ? 'autoplay' : 'tap',
      is_muted: false,
      time_to_first_frame_ms: 0,
      initial_buffer_ms: 0,
    })
  }, [config, getCommonFields, queueEvent])

  const onTimeUpdate = useCallback((currentTimeMs: number) => {
    const now = Date.now()
    const increment = currentTimeMs - totalWatchedMs.current
    if (increment <= 0) return

    totalWatchedMs.current = currentTimeMs
    currentContinuousMs.current += increment
    if (currentContinuousMs.current > maxContinuousWatchMs.current) {
      maxContinuousWatchMs.current = currentContinuousMs.current
    }

    // Check time milestones
    for (const ms of timeMilestones) {
      if (currentTimeMs >= ms && !firedTimeMilestones.current.has(ms)) {
        firedTimeMilestones.current.add(ms)
        queueEvent({
          ...getCommonFields(),
          event_name: 'milestone',
          milestone_type: getMilestoneType(ms),
          watched_ms: currentTimeMs,
        })
      }
    }

    // Check percent milestones
    if (config.contentDurationMs > 0) {
      const pct = (currentTimeMs / config.contentDurationMs) * 100
      for (const threshold of PERCENT_MILESTONES) {
        if (pct >= threshold && !firedPercentMilestones.current.has(threshold)) {
          firedPercentMilestones.current.add(threshold)
          queueEvent({
            ...getCommonFields(),
            event_name: 'milestone',
            milestone_type: getPercentMilestoneType(threshold),
            watched_ms: currentTimeMs,
          })
        }
      }
    }

    // Heartbeat (throttled)
    if (now - lastHeartbeatTime.current >= heartbeatInterval) {
      lastHeartbeatTime.current = now
      queueEvent({
        ...getCommonFields(),
        event_name: 'watch_heartbeat',
        watched_ms_increment: increment,
        watched_ms_total: totalWatchedMs.current,
        playhead_position_ms: currentTimeMs,
        buffering_ms_increment: 0,
        seek_count_increment: 0,
        playback_speed: 1.0,
      })
    }
  }, [config, getCommonFields, queueEvent, heartbeatInterval, timeMilestones])

  const onLoop = useCallback(() => {
    loopCount.current++
    currentContinuousMs.current = 0 // reset continuous watch on loop
  }, [])

  const onPlayEnd = useCallback((reason: string = 'ended') => {
    const percentViewed = config.contentDurationMs > 0
      ? (totalWatchedMs.current / config.contentDurationMs) * 100
      : 0

    queueEvent({
      ...getCommonFields(),
      event_name: 'play_end',
      end_reason: reason,
      watched_ms_total: totalWatchedMs.current,
      max_continuous_watch_ms: maxContinuousWatchMs.current,
      content_duration_ms: config.contentDurationMs,
      content_type: config.contentType,
      percent_viewed: Math.min(percentViewed, 100),
      loop_count: loopCount.current,
    })

    // Flush immediately on play end
    flushEvents()
  }, [config, getCommonFields, queueEvent, flushEvents])

  return { onPlayStart, onTimeUpdate, onPlayEnd, onLoop }
}

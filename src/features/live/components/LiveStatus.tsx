import { AlertCircle, CalendarClock, Radio, RefreshCw, WifiOff } from "lucide-react"

import type { LiveStatusView } from "../status"

export function LiveStatusBadge({ view }: { view: LiveStatusView }) {
  return (
    <span className={`live-badge live-badge--${view.tone}`} data-status={view.kind}>
      <span className="live-badge__dot" aria-hidden="true" />
      {view.label}
    </span>
  )
}

/** The calm notice shown while the host's connection is being waited for. */
export function ReconnectingNotice({ view }: { view: LiveStatusView }) {
  if (view.kind !== "reconnecting") return null
  return (
    <div className="live-notice" role="status" aria-live="polite">
      <RefreshCw className="live-notice__icon h-4 w-4" aria-hidden="true" />
      <span>{view.body}</span>
    </div>
  )
}

/** One centred block for every state the video is not the content of. */
export function LiveStatusPanel({ view, action }: { view: LiveStatusView; action?: React.ReactNode }) {
  const Icon =
    view.kind === "scheduled" ? CalendarClock
      : view.kind === "failed" ? AlertCircle
        : view.kind === "unknown" ? WifiOff
          : Radio
  return (
    <div className={`live-panel${view.tone === "danger" ? " live-panel--danger" : ""}`} data-status={view.kind}>
      <Icon className="live-panel__icon h-8 w-8" aria-hidden="true" />
      <div className="live-panel__title">{view.title}</div>
      {view.body && <div className="live-panel__body">{view.body}</div>}
      {action}
    </div>
  )
}

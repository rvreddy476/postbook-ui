'use client'

import { useSyncExternalStore } from 'react'
import { WifiOff } from 'lucide-react'

/*
  "No connection", the way the Android thread shows it (ChatThreadScreen.kt):
  one quiet line under the header while the browser reports it is offline,
  gone the moment it is back. Sends still fail per message as they did; this
  only says why before the reader tries.
*/

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** True while the browser reports a connection; always true on the server. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}

export function OfflineBanner({ className = '' }: { className?: string }) {
  const online = useOnline()
  if (online) return null
  return (
    <div
      role="status"
      data-offline-banner
      className={`flex shrink-0 items-center gap-2 border-b border-brand-divider bg-brand-secondary px-4 py-2 text-xs text-muted-foreground ${className}`}
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>No connection. Messages will send when you are back online.</span>
    </div>
  )
}

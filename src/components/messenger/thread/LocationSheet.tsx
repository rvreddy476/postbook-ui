'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, LocateFixed, MapPin } from 'lucide-react'

import {
  LOCATION_PLACE_MAX,
  accuracyText,
  capPlaceText,
  coordsText,
  geoProblemOf,
  geoProblemText,
  roundCoord,
  validCoords,
  type ChatLocation,
  type GeoProblem,
} from '@/lib/chat/location'
import { PickerSheetShell } from './PickerSheetShell'
import { LocationMap } from './LocationMap'

/*
  "Send your current location" (founder, 23 Oct 2026). Three steps:

    1. explain first — what is shared and with whom — before the browser's
       own permission prompt appears;
    2. one fix from the browser (high accuracy, 20 s, nothing cached older
       than a minute) — never watched, never stored here;
    3. a confirm card with the map and an optional name, then Send.

  The coordinates leave this component only in the send. Nothing is logged.
*/

type Step =
  | { kind: 'intro' }
  | { kind: 'locating' }
  | { kind: 'ready'; location: ChatLocation }
  | { kind: 'error'; problem: GeoProblem }

const GEO_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 }

export function LocationSheet({
  onClose,
  onSend,
}: {
  onClose(): void
  /** Resolves when sent; rejects with a user-facing message on failure. */
  onSend(location: ChatLocation): Promise<void>
}) {
  const [step, setStep] = useState<Step>({ kind: 'intro' })
  const [label, setLabel] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  // A site already refused: say so up front instead of a button that fails.
  useEffect(() => {
    const perms = typeof navigator !== 'undefined' ? navigator.permissions : undefined
    if (!perms?.query) return
    perms.query({ name: 'geolocation' as PermissionName }).then(
      (s) => { if (alive.current && s.state === 'denied') setStep({ kind: 'error', problem: 'denied' }) },
      () => {},
    )
  }, [])

  const locate = useCallback(() => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setStep({ kind: 'error', problem: 'insecure' })
      return
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStep({ kind: 'error', problem: 'unsupported' })
      return
    }
    setStep({ kind: 'locating' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!alive.current) return
        const { latitude, longitude, accuracy } = pos.coords
        if (!validCoords(latitude, longitude)) {
          setStep({ kind: 'error', problem: 'unavailable' })
          return
        }
        setStep({
          kind: 'ready',
          location: {
            lat: roundCoord(latitude),
            lng: roundCoord(longitude),
            accuracyM: Number.isFinite(accuracy) ? accuracy : null,
            label: null,
            address: null,
          },
        })
      },
      (err) => { if (alive.current) setStep({ kind: 'error', problem: geoProblemOf(err?.code) }) },
      GEO_OPTIONS,
    )
  }, [])

  const send = async () => {
    if (step.kind !== 'ready' || sending) return
    setSending(true)
    setSendError(null)
    try {
      await onSend({ ...step.location, label: capPlaceText(label) || null })
    } catch (err) {
      if (alive.current) setSendError(err instanceof Error && err.message ? err.message : "Couldn't send your location. Try again.")
    } finally {
      if (alive.current) setSending(false)
    }
  }

  const footer =
    step.kind === 'ready' ? (
      <div className="flex flex-col gap-2">
        {sendError && <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-medium text-danger" role="alert">{sendError}</p>}
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-ink text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-60"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MapPin className="h-4 w-4" aria-hidden />}
          Send this location
        </button>
      </div>
    ) : step.kind === 'intro' || step.kind === 'error' ? (
      <button
        type="button"
        onClick={locate}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-ink text-sm font-semibold text-primary-foreground"
      >
        <LocateFixed className="h-4 w-4" aria-hidden />
        {step.kind === 'error' ? 'Try again' : 'Use my current location'}
      </button>
    ) : null

  return (
    <PickerSheetShell title="Share location" onClose={onClose} busy={sending} footer={footer}>
      <div className="flex flex-col gap-3 px-4 pb-3">
        {step.kind === 'intro' && (
          <div className="flex items-start gap-3 rounded-xl bg-brand-secondary p-3 text-sm text-brand-text">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary-ink" aria-hidden />
            <p>
              Your browser will ask to share your location once. Only your current position is sent, to this chat only;
              it is not updated after you send it.
            </p>
          </div>
        )}

        {step.kind === 'locating' && (
          <div className="flex h-36 items-center justify-center gap-2 rounded-xl bg-brand-secondary text-sm text-brand-text/70" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Finding your location…
          </div>
        )}

        {step.kind === 'error' && (
          <p className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger" role="alert">{geoProblemText(step.problem)}</p>
        )}

        {step.kind === 'ready' && (
          <>
            <div className="mx-auto overflow-hidden rounded-xl border border-brand-divider">
              <LocationMap location={step.location} />
            </div>
            <p className="text-center text-xs text-brand-text/60 tabular-nums">
              {coordsText(step.location.lat, step.location.lng)}
              {accuracyText(step.location.accuracyM) ? ` · ${accuracyText(step.location.accuracyM)}` : ''}
            </p>
            <label className="flex flex-col gap-1 text-xs font-medium text-brand-text/70">
              Name this place (optional)
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={LOCATION_PLACE_MAX}
                placeholder="e.g. Home, the café"
                className="rounded-xl border border-brand-divider bg-brand-bg px-3 py-2 text-sm text-brand-text outline-hidden focus:border-primary-ink"
              />
            </label>
          </>
        )}
      </div>
    </PickerSheetShell>
  )
}

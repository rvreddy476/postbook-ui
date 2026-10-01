"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Copy, Eye, EyeOff, RefreshCw } from "lucide-react"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ENCODER_STEPS, shownKey, type StreamIngress } from "../encoder"
import type { LiveStatusView } from "../status"
import "../encoder.css"

type Copied = "url" | "key" | null

/**
 * Server URL + stream key for the host's streaming software. The key is
 * masked until Show is pressed; it is only ever rendered into this card and
 * written to the clipboard on Copy. It is never logged, stored or linked.
 */
export function EncoderSetup({
  ingress,
  loading,
  resetting,
  error,
  view,
  onRetry,
  onReset,
}: {
  ingress: StreamIngress | null
  loading: boolean
  resetting: boolean
  /** Human copy (ingressErrorCopy), or null. */
  error: string | null
  view: LiveStatusView
  onRetry: () => void
  onReset: () => void
}) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState<Copied>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  // A new key starts hidden again.
  const keyId = ingress?.ingress_id ?? ""
  useEffect(() => setRevealed(false), [keyId])

  async function copy(which: Exclude<Copied, null>, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopyFailed(false)
      setCopied(which)
    } catch {
      setCopied(null)
      setCopyFailed(true)
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { setCopied(null); setCopyFailed(false) }, 2000)
  }

  const busy = loading || resetting

  return (
    <section className="live-encoder" aria-labelledby="live-encoder-title">
      <div>
        <h2 className="live-encoder__title" id="live-encoder-title">Connect your streaming software</h2>
        <p className="live-encoder__hint">Works with OBS, hardware encoders and cameras that stream over RTMP.</p>
      </div>

      <div className="live-encoder__state" role="status" aria-live="polite" data-status={view.kind}>
        <div className="live-encoder__state-title">{view.title || view.label}</div>
        {view.body && <div className="live-encoder__state-body">{view.body}</div>}
      </div>

      {error && !busy ? (
        <div className="live-error flex flex-wrap items-center justify-between gap-2" role="alert">
          <span>{error}</span>
          <button type="button" className="live-encoder__btn" onClick={onRetry}>Try again</button>
        </div>
      ) : !ingress ? (
        <div aria-busy="true" aria-label={resetting ? "Getting a new stream key" : "Getting your stream key"} className="flex flex-col gap-3">
          <div className="live-encoder__skeleton" />
          <div className="live-encoder__skeleton" />
        </div>
      ) : (
        <>
          <div className="live-encoder__field">
            <span className="live-encoder__label" id="live-encoder-url">Server URL</span>
            <div className="live-encoder__row">
              <span className="live-encoder__value" data-revealed="true" aria-labelledby="live-encoder-url">{ingress.server_url}</span>
              <div className="live-encoder__actions">
                <button type="button" className="live-encoder__btn" onClick={() => copy("url", ingress.server_url)} aria-label="Copy server URL">
                  {copied === "url" ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                  {copied === "url" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>

          <div className="live-encoder__field">
            <span className="live-encoder__label" id="live-encoder-key">Stream key</span>
            <div className="live-encoder__row">
              <span className="live-encoder__value" data-revealed={revealed} aria-labelledby="live-encoder-key">
                {shownKey(ingress.stream_key, revealed)}
              </span>
              <div className="live-encoder__actions">
                <button
                  type="button"
                  className="live-encoder__btn"
                  onClick={() => setRevealed((v) => !v)}
                  aria-pressed={revealed}
                  aria-label={revealed ? "Hide stream key" : "Show stream key"}
                >
                  {revealed ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                  {revealed ? "Hide" : "Show"}
                </button>
                <button type="button" className="live-encoder__btn" onClick={() => copy("key", ingress.stream_key)} aria-label="Copy stream key">
                  {copied === "key" ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                  {copied === "key" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <p className="live-encoder__hint">Anyone with this key can stream as you. Don&apos;t share it or show it on screen.</p>
            {copyFailed && <p className="live-encoder__hint" role="alert">Couldn&apos;t copy. Press Show and copy it by hand.</p>}
          </div>
        </>
      )}

      <ol className="live-encoder__steps">
        {ENCODER_STEPS.map((step) => <li key={step}><span>{step}</span></li>)}
      </ol>

      <div className="live-encoder__foot">
        <span>Reset the key if someone else has seen it.</span>
        <button type="button" className="live-encoder__btn" onClick={() => setConfirmReset(true)} disabled={busy || !ingress}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {resetting ? "Resetting…" : "Reset key"}
        </button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => { setConfirmReset(false); onReset() }}
        title="Reset your stream key?"
        description="The current key stops working straight away. You'll need to paste the new key into your streaming software before you can go live."
        confirmLabel="Reset key"
        destructive
      />
    </section>
  )
}

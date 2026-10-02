"use client"

/* /dating/settings — privacy, pausing, consents, the data export, deleting the profile. */

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Download, FileDown, PauseCircle, PlayCircle, Trash2 } from "lucide-react"

import { useGlobalToast } from "@/contexts/ToastContext"

import { ErrorState, Guard } from "../components/Guard"
import { Button, Confirm, Loading, PageHead, Panel, Pill, Toggle } from "../components/kit"
import { useConsents, useDeleteProfile, useGate, usePatchPrivacy, usePrivacy, useSetConsent, useSetPaused } from "../hooks/profile"
import { useDataExports, useDownloadDataExport, useRequestDataExport } from "../hooks/safety"
import { CONSENT_COPY, isGranted, type Consents, type ConsentType } from "../model/consents"
import { exportView, hasPendingExport, type DataExport } from "../model/dataExport"
import { datingErrorCopy } from "../model/errors"
import { DATING_BASE, PRIVACY_TOGGLES, STATUS, privacyPatch, type Privacy, type PrivacyKey } from "../model/profile"

/** Alphabetical. */
const EDIT_LINKS = [
  { label: "Basics", href: `${DATING_BASE}/onboarding/basics` },
  { label: "Looking for", href: `${DATING_BASE}/onboarding/intent` },
  { label: "Photos", href: `${DATING_BASE}/onboarding/photos` },
  { label: "Preferences", href: `${DATING_BASE}/onboarding/preferences` },
  { label: "Prompts", href: `${DATING_BASE}/onboarding/prompts` },
  { label: "Selfie check", href: `${DATING_BASE}/verify` },
] as const

export function PrivacyToggles({ privacy, busy, onChange }: { privacy: Privacy; busy: boolean; onChange: (key: PrivacyKey, value: boolean) => void }) {
  return (
    <div className="pulse-stack">
      {PRIVACY_TOGGLES.map((t) => (
        <Toggle key={t.key} id={`pulse-privacy-${t.key}`} label={t.label} help={t.help} checked={privacy[t.key]} disabled={busy} onChange={(v) => onChange(t.key, v)} />
      ))}
    </div>
  )
}

export function ConsentToggles({ consents, busy, onChange }: { consents: Consents; busy: boolean; onChange: (type: ConsentType, granted: boolean) => void }) {
  return (
    <div className="pulse-stack">
      {CONSENT_COPY.map((c) => (
        <Toggle key={c.type} id={`pulse-consent-${c.type}`} label={c.title} help={c.body} checked={isGranted(consents, c.type)} disabled={busy} onChange={(v) => onChange(c.type, v)} />
      ))}
    </div>
  )
}

export function ExportList({ exports, busyId, onDownload }: { exports: DataExport[]; busyId: string; onDownload: (id: string) => void }) {
  if (exports.length === 0) return <p className="pulse-text pulse-text--muted">You haven&apos;t asked for a copy yet.</p>
  return (
    <ul className="pulse-plain">
      {exports.map((e) => {
        const view = exportView(e)
        return (
          <li key={e.id} className="pulse-plain__row">
            <span>
              {e.requestedAt ? new Date(e.requestedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Requested"}{" "}
              <Pill tone={view.downloadable ? "success" : "muted"}>{view.label}</Pill>
            </span>
            {view.downloadable ? (
              <Button variant="quiet" icon={Download} busy={busyId === e.id} onClick={() => onDownload(e.id)}>
                Download
              </Button>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function SettingsBody() {
  const router = useRouter()
  const toast = useGlobalToast()
  const gate = useGate()
  const privacy = usePrivacy()
  const patch = usePatchPrivacy()
  const consents = useConsents()
  const setConsent = useSetConsent()
  const pause = useSetPaused()
  const exports = useDataExports()
  const requestExport = useRequestDataExport()
  const download = useDownloadDataExport()
  const remove = useDeleteProfile()
  const [deleting, setDeleting] = useState(false)
  const [withdrawing, setWithdrawing] = useState<ConsentType | null>(null)
  const [downloadId, setDownloadId] = useState("")

  const profile = gate.kind === "open" ? gate.profile : null
  const fail = (e: unknown) => toast({ type: "error", title: datingErrorCopy(e) })
  const withdrawCopy = CONSENT_COPY.find((c) => c.type === withdrawing)

  if (!profile) {
    return <p className="pulse-text">Set up your profile first, then your settings appear here.</p>
  }
  const paused = profile.paused || profile.status === STATUS.paused

  return (
    <>
      <Panel title="Your profile">
        <ul className="pulse-links">
          {EDIT_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href}>{l.label}</Link>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Privacy">
        {privacy.isPending ? <Loading /> : privacy.isError ? <ErrorState error={privacy.error} onRetry={() => void privacy.refetch()} /> : <PrivacyToggles privacy={privacy.data} busy={patch.isPending} onChange={(key, value) => patch.mutate(privacyPatch(key, value), { onError: fail })} />}
      </Panel>

      <Panel title={paused ? "Your profile is paused" : "Pause your profile"} sub="While paused, nobody sees you in their deck. Your matches stay.">
        <Button
          icon={paused ? PlayCircle : PauseCircle}
          busy={pause.isPending}
          onClick={() => pause.mutate(!paused, { onSuccess: () => toast({ type: "success", title: paused ? "You're back on Pulse" : "Profile paused" }), onError: fail })}
        >
          {paused ? "Resume" : "Pause"}
        </Button>
      </Panel>

      <Panel title="Consents" sub="Turning one off deletes what it covered.">
        {consents.isPending ? (
          <Loading />
        ) : consents.isError ? (
          <ErrorState error={consents.error} onRetry={() => void consents.refetch()} />
        ) : (
          <ConsentToggles consents={consents.data} busy={setConsent.isPending} onChange={(type, granted) => (granted ? setConsent.mutate({ type, granted }, { onError: fail }) : setWithdrawing(type))} />
        )}
      </Panel>

      <Panel
        title="Your data"
        sub="Ask for a copy of everything Pulse holds about you. It's prepared in the background and stays downloadable for a few days."
        actions={
          <Button
            icon={FileDown}
            busy={requestExport.isPending}
            disabled={hasPendingExport(exports.data ?? [])}
            onClick={() => requestExport.mutate(undefined, { onSuccess: () => toast({ type: "success", title: "We're preparing your copy" }), onError: fail })}
          >
            Request a copy
          </Button>
        }
      >
        {exports.isPending ? (
          <Loading />
        ) : exports.isError ? (
          <ErrorState error={exports.error} onRetry={() => void exports.refetch()} />
        ) : (
          <ExportList
            exports={exports.data}
            busyId={downloadId}
            onDownload={(id) => {
              setDownloadId(id)
              download.mutate(id, { onError: fail, onSettled: () => setDownloadId("") })
            }}
          />
        )}
      </Panel>

      <Panel title="Delete your Pulse profile" sub="Your profile is hidden straight away and kept for a 30-day grace period, then erased for good. Your Momentum account is not affected.">
        <Button variant="danger" icon={Trash2} onClick={() => setDeleting(true)}>
          Delete profile
        </Button>
      </Panel>

      <Confirm
        open={withdrawing !== null}
        title="Withdraw consent?"
        body={<p>{withdrawCopy ? `${withdrawCopy.title}: what this covered is deleted from Pulse.` : ""}{withdrawing === "biometric_selfie" ? " You may need to do the selfie check again." : ""}</p>}
        confirmLabel="Withdraw"
        danger
        busy={setConsent.isPending}
        onClose={() => setWithdrawing(null)}
        onConfirm={() => withdrawing && setConsent.mutate({ type: withdrawing, granted: false }, { onError: fail, onSettled: () => setWithdrawing(null) })}
      />
      <Confirm
        open={deleting}
        title="Delete your Pulse profile?"
        body={
          <p>
            Your profile, photos, sparks and matches are hidden now and erased after a 30-day grace period. Until then, support can restore it. This doesn&apos;t delete your Momentum account.
          </p>
        }
        confirmLabel="Delete profile"
        danger
        busy={remove.isPending}
        onClose={() => setDeleting(false)}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => {
              setDeleting(false)
              toast({ type: "success", title: "Your Pulse profile is deleted" })
              router.replace("/")
            },
            onError: (e) => {
              setDeleting(false)
              fail(e)
            },
          })
        }
      />
    </>
  )
}

export function SettingsScreen() {
  return (
    <Guard need="access">
      <div className="pulse-page pulse-page--narrow">
        <PageHead title="Settings" back={{ href: DATING_BASE, label: "Pulse" }} />
        <SettingsBody />
      </div>
    </Guard>
  )
}

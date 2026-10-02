"use client"

/* /dating/settings — privacy, first move, pausing, consents, the data export, deleting the profile. */

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Download, FileDown, PauseCircle, PlayCircle, Trash2 } from "lucide-react"

import { useGlobalToast } from "@/contexts/ToastContext"

import { FIRST_MOVE_TITLE, FirstMoveEditor } from "../components/FirstMove"
import { ErrorState, Guard } from "../components/Guard"
import { Button, Confirm, Loading, PageHead, Panel, Pill, Toggle } from "../components/kit"
import { useConsents, useDeleteProfile, useGate, usePatchPrivacy, usePreferences, usePrivacy, useSetConsent, useSetPaused } from "../hooks/profile"
import { useFirstMove, useSaveFirstMove } from "../hooks/discovery"
import { useDataExports, useDownloadDataExport, useRequestDataExport } from "../hooks/safety"
import { CONSENT_COPY, isGranted, type Consents, type ConsentType } from "../model/consents"
import { exportView, hasPendingExport, type DataExport } from "../model/dataExport"
import { datingErrorCopy } from "../model/errors"
import { isFirstMoveOff, questionsProblem } from "../model/firstMove"
import { DATING_BASE, PRIVACY_TOGGLES, STATUS, filtersEnabled, privacyPatch, visiblePrivacyToggles, type Privacy, type PrivacyKey } from "../model/profile"
import { FILTERS_HREF } from "../components/Filters"
import { ABOUT_HREF } from "./OnboardingScreens"

const EDIT_LINKS: readonly { label: string; href: string }[] = [
  { label: "About me", href: ABOUT_HREF },
  { label: "Basics", href: `${DATING_BASE}/onboarding/basics` },
  { label: "Looking for", href: `${DATING_BASE}/onboarding/intent` },
  { label: "Photos", href: `${DATING_BASE}/onboarding/photos` },
  { label: "Preferences", href: `${DATING_BASE}/onboarding/preferences` },
  { label: "Prompts", href: `${DATING_BASE}/onboarding/prompts` },
  { label: "Selfie check", href: `${DATING_BASE}/verify` },
]

/** Alphabetical; Filters only while the server's filters flag is on. */
export function editLinks(withFilters: boolean): { label: string; href: string }[] {
  const links = withFilters ? [...EDIT_LINKS, { label: "Filters", href: FILTERS_HREF }] : [...EDIT_LINKS]
  return links.sort((a, b) => a.label.localeCompare(b.label))
}

export function PrivacyToggles({
  privacy,
  busy,
  onChange,
  toggles = PRIVACY_TOGGLES,
}: {
  privacy: Privacy
  busy: boolean
  onChange: (key: PrivacyKey, value: boolean) => void
  /** Which toggles to draw; with the filters flag on, "verified only" moves to Filters. */
  toggles?: typeof PRIVACY_TOGGLES
}) {
  return (
    <div className="pulse-stack">
      {toggles.map((t) => (
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

/**
  First move (M5). Hidden while the read is in flight and when the server
  says the mechanic is off (404 MECHANIC_NOT_ENABLED). The switch saves at
  once; the questions save with their own button.
*/
function FirstMoveSection() {
  const toast = useGlobalToast()
  const firstMove = useFirstMove()
  const save = useSaveFirstMove()
  /** null: nothing edited, so the saved questions are shown. */
  const [drafts, setDrafts] = useState<string[] | null>(null)
  const [error, setError] = useState("")

  if (firstMove.isPending) return null
  if (firstMove.isError) {
    if (isFirstMoveOff(firstMove.error)) return null
    return (
      <Panel title={FIRST_MOVE_TITLE}>
        <ErrorState error={firstMove.error} onRetry={() => void firstMove.refetch()} />
      </Panel>
    )
  }

  const settings = firstMove.data
  const current = drafts ?? settings.questions.map((q) => q.text)
  const refused = (e: unknown) => {
    // Switched off since the page loaded: read again, and the section goes.
    if (isFirstMoveOff(e)) void firstMove.refetch()
    return datingErrorCopy(e)
  }
  const edit = (next: string[]) => {
    setDrafts(next)
    setError("")
  }

  return (
    <Panel title={FIRST_MOVE_TITLE}>
      <FirstMoveEditor
        settings={settings}
        drafts={current}
        toggleBusy={save.isPending && save.variables?.enabled !== undefined}
        saveBusy={save.isPending && save.variables?.questions !== undefined}
        error={error}
        onToggle={(enabled) =>
          save.mutate(
            { enabled },
            {
              onSuccess: () => toast({ type: "success", title: enabled ? "You'll say hello first in new matches" : "First move is off" }),
              onError: (e) => toast({ type: "error", title: refused(e) }),
            },
          )
        }
        onDraft={(index, text) => edit(current.map((q, i) => (i === index ? text : q)))}
        onAdd={() => edit([...current, ""])}
        onRemove={(index) => edit(current.filter((_, i) => i !== index))}
        onSave={() => {
          const problem = questionsProblem(current, settings.maxQuestions, settings.maxLength)
          if (problem) {
            setError(problem)
            return
          }
          save.mutate(
            { questions: current },
            {
              onSuccess: () => {
                setDrafts(null)
                setError("")
                toast({ type: "success", title: "Questions saved" })
              },
              onError: (e) => setError(refused(e)),
            },
          )
        }}
      />
    </Panel>
  )
}

function SettingsBody() {
  const router = useRouter()
  const toast = useGlobalToast()
  const gate = useGate()
  const privacy = usePrivacy()
  const patch = usePatchPrivacy()
  const preferences = usePreferences(gate.kind === "open" && gate.profile !== null)
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
          {editLinks(filtersEnabled(preferences.data)).map((l) => (
            <li key={l.href}>
              <Link href={l.href}>{l.label}</Link>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Privacy">
        {privacy.isPending || preferences.isPending ? (
          <Loading />
        ) : privacy.isError ? (
          <ErrorState error={privacy.error} onRetry={() => void privacy.refetch()} />
        ) : (
          // A failed preferences read keeps the old set of toggles (the flag reads as off).
          <PrivacyToggles privacy={privacy.data} busy={patch.isPending} toggles={visiblePrivacyToggles(preferences.data, privacy.data)} onChange={(key, value) => patch.mutate(privacyPatch(key, value), { onError: fail })} />
        )}
      </Panel>

      <FirstMoveSection />

      <Panel title={paused ? "Your profile is paused": "Pause your profile"} sub="While paused, nobody sees you in their deck. Your matches stay.">
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

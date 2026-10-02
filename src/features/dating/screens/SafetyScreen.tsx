"use client"

/*
  /dating/safety — the block list, reporting, past matches to report (M19),
  trusted contacts. Scam alerts (M17) deep-link here.
*/

import { useState } from "react"
import { Flag, Smartphone, Trash2, UserPlus } from "lucide-react"

import { useGlobalToast } from "@/contexts/ToastContext"

import { ErrorState, Guard } from "../components/Guard"
import { Button, Field, Loading, Notice, PageHead, Panel, Toggle } from "../components/kit"
import { PastMatchList } from "../components/PastMatches"
import { ReportDialog } from "../components/SafetyActions"
import { useMatches } from "../hooks/discovery"
import { useBlocks, useDeleteTrustedContact, usePastMatches, usePutTrustedContact, useTrustedContacts, useUnblock } from "../hooks/safety"
import { datingErrorCopy, isMechanicOff } from "../model/errors"
import { pastMatchesSub, pastMatchName, type PastMatch } from "../model/pastMatches"
import { errorStatus } from "../model/wire"
import { isOpen, type Match } from "../model/matches"
import { nameLine } from "../model/people"
import { DATING_BASE } from "../model/profile"
import type { BlockedPerson, TrustedContacts } from "../model/safety"

export const MOBILE_SAFETY_LINE = "The panic button and live location sharing are in the Momentum mobile app only."

export function BlockList({ blocks, busyId, onUnblock }: { blocks: BlockedPerson[]; busyId: string; onUnblock: (b: BlockedPerson) => void }) {
  if (blocks.length === 0) return <p className="pulse-text pulse-text--muted">You haven&apos;t blocked anyone.</p>
  return (
    <ul className="pulse-plain">
      {blocks.map((b) => (
        <li key={b.userId} className="pulse-plain__row">
          <span>{nameLine(b)}</span>
          <Button variant="quiet" busy={busyId === b.userId} onClick={() => onUnblock(b)}>
            Unblock
          </Button>
        </li>
      ))}
    </ul>
  )
}

/** People who can be added: current matches not already on the list, by name. */
export function contactCandidates(matches: Match[], contacts: TrustedContacts): { userId: string; name: string }[] {
  const taken = new Set(contacts.items.map((c) => c.contactId))
  return matches
    .filter((m) => isOpen(m) && m.person && !taken.has(m.person.userId))
    .map((m) => ({ userId: m.person!.userId, name: nameLine(m.person!) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function Blocks() {
  const toast = useGlobalToast()
  const blocks = useBlocks()
  const unblock = useUnblock()
  const [busyId, setBusyId] = useState("")
  if (blocks.isPending) return <Loading />
  if (blocks.isError) return <ErrorState error={blocks.error} onRetry={() => void blocks.refetch()} />
  return (
    <BlockList
      blocks={blocks.data}
      busyId={busyId}
      onUnblock={(b) => {
        setBusyId(b.userId)
        unblock.mutate(b.userId, {
          onSuccess: () => toast({ type: "success", title: `${b.firstName || "They"} can see you on Pulse again` }),
          onError: (e) => toast({ type: "error", title: datingErrorCopy(e) }),
          onSettled: () => setBusyId(""),
        })
      }}
    />
  )
}

function Trusted({ matches }: { matches: Match[] }) {
  const toast = useGlobalToast()
  const contacts = useTrustedContacts()
  const put = usePutTrustedContact()
  const remove = useDeleteTrustedContact()
  const [pick, setPick] = useState("")
  if (contacts.isPending) return <Loading />
  if (contacts.isError) return <ErrorState error={contacts.error} onRetry={() => void contacts.refetch()} />
  const data = contacts.data
  const full = data.items.length >= data.max
  const candidates = contactCandidates(matches, data)
  const fail = (e: unknown) => toast({ type: "error", title: datingErrorCopy(e) })

  return (
    <>
      {data.items.length === 0 ? <p className="pulse-text pulse-text--muted">No trusted contacts yet.</p> : null}
      <ul className="pulse-plain">
        {data.items.map((c) => (
          <li key={c.contactId} className="pulse-plain__block">
            <div className="pulse-plain__row">
              <span>{c.person ? nameLine(c.person) : "Someone who has left Pulse"}</span>
              <Button variant="quiet" icon={Trash2} disabled={remove.isPending} onClick={() => remove.mutate(c.contactId, { onError: fail })}>
                Remove
              </Button>
            </div>
            <Toggle
              id={`pulse-trusted-${c.contactId}`}
              label="Send my location if I use the panic button"
              checked={c.shareLocationOnPanic}
              disabled={put.isPending}
              onChange={(next) => put.mutate({ contactId: c.contactId, shareLocationOnPanic: next }, { onError: fail })}
            />
          </li>
        ))}
      </ul>
      {full ? (
        <Notice tone="muted">You have {data.max} trusted contacts, the most allowed. Remove one to add another.</Notice>
      ) : candidates.length === 0 ? (
        <p className="pulse-field__help">You can add one of your matches here. To add a Momentum connection instead, use the mobile app.</p>
      ) : (
        <form
          className="pulse-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!pick) return
            put.mutate({ contactId: pick, shareLocationOnPanic: true }, { onSuccess: () => setPick(""), onError: fail })
          }}
        >
          <Field id="pulse-trusted-pick" label="Add a match as a trusted contact" help="To add a Momentum connection instead, use the mobile app.">
            <select id="pulse-trusted-pick" className="pulse-input" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Choose a match</option>
              {candidates.map((c) => (
                <option key={c.userId} value={c.userId}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" icon={UserPlus} busy={put.isPending} disabled={!pick}>
            Add
          </Button>
        </form>
      )}
    </>
  )
}

function ReportSomeone({ matches }: { matches: Match[] }) {
  const [pick, setPick] = useState("")
  const [open, setOpen] = useState(false)
  const people = matches
    .filter((m) => m.person)
    .map((m) => ({ userId: m.person!.userId, name: nameLine(m.person!), firstName: m.person!.firstName || "this person" }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const chosen = people.find((p) => p.userId === pick)
  return (
    <>
      <p className="pulse-text">You can report anyone from their profile or from your match with them. Reports are confidential.</p>
      {people.length ? (
        <div className="pulse-form">
          <Field id="pulse-report-pick" label="Report one of your matches">
            <select id="pulse-report-pick" className="pulse-input" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Choose a match</option>
              {people.map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Button icon={Flag} disabled={!chosen} onClick={() => setOpen(true)}>
            Report
          </Button>
        </div>
      ) : null}
      {chosen ? <ReportDialog open={open} userId={chosen.userId} name={chosen.firstName} onClose={() => setOpen(false)} onDone={() => setPick("")} /> : null}
    </>
  )
}

/**
  Report someone from a past match (M19). Hidden while the read is pending
  and when it answers 404 (MECHANIC_NOT_ENABLED); the report goes to the
  other person, by their user id.
*/
function PastMatchesSection() {
  const past = usePastMatches()
  const [target, setTarget] = useState<PastMatch | null>(null)
  if (past.isPending) return null
  if (past.isError && (isMechanicOff(past.error) || errorStatus(past.error) === 404)) return null
  return (
    <Panel title="Report someone from a past match" sub={past.data ? pastMatchesSub(past.data.windowDays) : undefined}>
      {past.isError ? <ErrorState error={past.error} onRetry={() => void past.refetch()} /> : <PastMatchList items={past.data.items} onReport={setTarget} />}
      {target ? <ReportDialog open userId={target.person.userId} name={pastMatchName(target)} onClose={() => setTarget(null)} /> : null}
    </Panel>
  )
}

function SafetyBody() {
  const matches = useMatches()
  const list = matches.data ?? []
  return (
    <>
      <Notice tone="info">
        <Smartphone size={14} aria-hidden="true" /> {MOBILE_SAFETY_LINE}
      </Notice>
      <Panel title="Blocked people" sub="Unblocking doesn't bring back a match the block ended.">
        <Blocks />
      </Panel>
      <Panel title="Report">
        <ReportSomeone matches={list} />
      </Panel>
      <PastMatchesSection />
      <Panel title="Trusted contacts" sub="Up to 3 people who can be told if you need help.">
        <Trusted matches={list} />
      </Panel>
    </>
  )
}

export function SafetyScreen() {
  return (
    <Guard need="access">
      <div className="pulse-page pulse-page--narrow">
        <PageHead title="Safety" back={{ href: DATING_BASE, label: "Pulse" }} />
        <SafetyBody />
      </div>
    </Guard>
  )
}

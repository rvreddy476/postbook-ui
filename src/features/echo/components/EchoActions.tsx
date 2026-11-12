"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Dialog } from "@/components/ui/dialog"
import { useGlobalToast } from "@/contexts/ToastContext"
import { ReelReportDialog } from "@/features/reels/components/ReelReportDialog"
import { useAuthUser } from "@/store/auth"

import { deleteNote, editNote, setRepost, toggleLike } from "../api"
import { updateNoteEverywhere, useEligibilityReader } from "../hooks"
import {
  ECHO_WORDS,
  REPLY_POLICIES,
  canEditText,
  composerGate,
  echoErrorMessage,
  entryProblem,
  notePath,
  withLike,
  withRepost,
  type Note,
  type ReplyPolicy,
} from "../model"
import { Composer, Counter, type ComposerPurpose } from "./Composer"

/*
  Every action a note card offers, in one place so the timeline, the note
  page and the profile tab behave the same: reply, quote and post open the
  composer after GET /v1/notes/me/eligibility says yes; like and repost are
  optimistic; edit, delete and report open their dialogs. A signed-out
  visitor is sent to sign in and back.
*/

export interface EchoActionsValue {
  viewerId: string | null
  /** Check eligibility, then open the composer for a new note (or say why not). */
  compose: () => void
  reply: (note: Note) => void
  quote: (note: Note) => void
  like: (note: Note) => void
  repost: (note: Note) => void
  share: (note: Note) => void
  edit: (note: Note) => void
  remove: (note: Note) => void
  report: (note: Note) => void
  /** Ask before an inline composer opens; resolves true when it may. */
  ensureCanCompose: (purpose: "note" | "reply") => Promise<boolean>
  showPremiumRequired: () => void
}

const EchoActionsContext = createContext<EchoActionsValue | null>(null)

export function useEchoActions(): EchoActionsValue {
  const ctx = useContext(EchoActionsContext)
  if (!ctx) throw new Error("useEchoActions must be used inside EchoActionsProvider")
  return ctx
}

interface Notice {
  title: string
  detail: string
}

/** The eligibility refusal. No purchase button: the web has no Momentum Premium page yet. */
export function EligibilityDialog({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  return (
    <Dialog open={!!notice} onClose={onClose} title={notice?.title}>
      <div className="space-y-5" data-echo-eligibility>
        <p className="text-sm text-brand-text/80">{notice?.detail}</p>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="rounded-full bg-primary-ink px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
            OK
          </button>
        </div>
      </div>
    </Dialog>
  )
}

function EditNoteDialog({ note, viewerId, onClose }: { note: Note | null; viewerId: string | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [text, setText] = useState(note?.text ?? "")
  const [policy, setPolicy] = useState<ReplyPolicy>(note?.replyPolicy ?? "everyone")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!note) return null
  const textEditable = canEditText(note, viewerId)
  const textProblem = textEditable ? entryProblem(text, note.media.map((m) => ({ key: m.mediaId, isGif: m.isGif, mediaId: m.mediaId }))) : null
  const save = async () => {
    const patch: { text?: string; reply_policy?: ReplyPolicy } = {}
    if (textEditable && text.trim() !== note.text.trim()) patch.text = text.trim()
    if (policy !== note.replyPolicy) patch.reply_policy = policy
    if (!patch.text && !patch.reply_policy) return onClose()
    setBusy(true)
    setError(null)
    try {
      const updated = await editNote(note.id, patch)
      updateNoteEverywhere(qc, (n) => (n.id === updated.id ? { ...updated, quoted: updated.quoted ?? n.quoted } : n))
      onClose()
    } catch (err) {
      setError(echoErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open onClose={onClose} title={textEditable ? "Edit note" : "Who can reply"}>
      <div className="space-y-4">
        {textEditable ? (
          <>
            <textarea
              aria-label="Note text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-border bg-brand-bg px-3 py-2 text-base text-brand-text focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>You can edit a note for 30 minutes after posting.</span>
              <Counter text={text} />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Notes can only be edited for 30 minutes after posting. You can still change who can reply.</p>
        )}
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Who can reply</span>
          <select value={policy} onChange={(e) => setPolicy(e.target.value as ReplyPolicy)} className="rounded-lg border border-border bg-brand-bg px-2 py-1 text-sm text-brand-text">
            {REPLY_POLICIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {(error || textProblem) && (
          <p role="alert" className="text-sm text-danger">
            {error ?? textProblem}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium text-brand-text hover:bg-brand-secondary">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={busy || !!textProblem} className="rounded-full bg-primary-ink px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

export function EchoActionsProvider({ children, onDeleted }: { children: React.ReactNode; onDeleted?: (note: Note) => void }) {
  const qc = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const toast = useGlobalToast()
  const user = useAuthUser()
  const viewerId = user?.id ?? null
  const readEligibility = useEligibilityReader()

  const [composer, setComposer] = useState<ComposerPurpose | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [editing, setEditing] = useState<Note | null>(null)
  const [deleting, setDeleting] = useState<Note | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [reporting, setReporting] = useState<Note | null>(null)
  const [pending, setPending] = useState(new Set<string>())

  const signIn = useCallback(() => {
    router.push(`/login?redirect=${encodeURIComponent(pathname || "/echo")}`)
  }, [router, pathname])

  const showPremiumRequired = useCallback(() => setNotice({ title: ECHO_WORDS.premiumRequired, detail: ECHO_WORDS.premiumRequiredDetail }), [])

  const ensureCanCompose = useCallback(
    async (purpose: "note" | "reply") => {
      if (!viewerId) {
        signIn()
        return false
      }
      try {
        const gate = composerGate(await readEligibility(), purpose)
        if (gate.open) return true
        setNotice({ title: gate.title, detail: gate.detail })
        return false
      } catch (err) {
        toast({ type: "error", title: echoErrorMessage(err) })
        return false
      }
    },
    [viewerId, signIn, readEligibility, toast],
  )

  const once = useCallback(
    async (id: string, fn: () => Promise<void>) => {
      if (pending.has(id)) return
      setPending((s) => new Set(s).add(id))
      try {
        await fn()
      } finally {
        setPending((s) => {
          const next = new Set(s)
          next.delete(id)
          return next
        })
      }
    },
    [pending],
  )

  const value = useMemo<EchoActionsValue>(
    () => ({
      viewerId,
      ensureCanCompose,
      showPremiumRequired,
      compose: () => {
        void ensureCanCompose("note").then((ok) => ok && setComposer({ kind: "note" }))
      },
      reply: (note) => {
        if (!viewerId) return signIn()
        if (!note.viewerCanReply) {
          toast({ type: "info", title: ECHO_WORDS.replyNotAllowed })
          return
        }
        void ensureCanCompose("reply").then((ok) => ok && setComposer({ kind: "reply", to: note }))
      },
      quote: (note) => {
        void ensureCanCompose("note").then((ok) => ok && setComposer({ kind: "quote", of: note }))
      },
      like: (note) => {
        if (!viewerId) return signIn()
        void once(`like:${note.id}`, async () => {
          const next = !note.liked
          updateNoteEverywhere(qc, (n) => withLike(n, note.id, next))
          try {
            const res = await toggleLike(note.id)
            updateNoteEverywhere(qc, (n) => withLike(n, note.id, res.liked, res.count ?? undefined))
          } catch (err) {
            updateNoteEverywhere(qc, (n) => withLike(n, note.id, note.liked, note.likeCount))
            toast({ type: "error", title: echoErrorMessage(err) })
          }
        })
      },
      repost: (note) => {
        if (!viewerId) return signIn()
        void once(`repost:${note.id}`, async () => {
          const next = !note.reposted
          updateNoteEverywhere(qc, (n) => withRepost(n, note.id, next))
          try {
            await setRepost(note.id, next)
          } catch (err) {
            updateNoteEverywhere(qc, (n) => withRepost(n, note.id, note.reposted))
            toast({ type: "error", title: echoErrorMessage(err) })
          }
        })
      },
      share: (note) => {
        const url = `${window.location.origin}${notePath(note.id)}`
        void navigator.clipboard?.writeText(url).then(
          () => toast({ type: "success", title: "Link copied" }),
          () => toast({ type: "error", title: "Couldn't copy the link" }),
        )
      },
      edit: (note) => setEditing(note),
      remove: (note) => setDeleting(note),
      report: (note) => (viewerId ? setReporting(note) : signIn()),
    }),
    [viewerId, ensureCanCompose, showPremiumRequired, signIn, toast, once, qc],
  )

  const confirmDelete = async () => {
    const note = deleting
    if (!note) return
    setDeleteBusy(true)
    try {
      await deleteNote(note.id)
      updateNoteEverywhere(qc, (n) => (n.id === note.id ? null : n))
      toast({ type: "success", title: "Note deleted" })
      setDeleting(null)
      onDeleted?.(note)
    } catch (err) {
      toast({ type: "error", title: echoErrorMessage(err) })
    } finally {
      setDeleteBusy(false)
    }
  }

  const composerTitle = composer?.kind === "reply" ? "Reply" : composer?.kind === "quote" ? "Quote" : "New note"

  return (
    <EchoActionsContext.Provider value={value}>
      {children}
      <Dialog open={!!composer} onClose={() => setComposer(null)} title={composerTitle}>
        {composer && (
          <Composer
            key={composer.kind + (composer.kind === "reply" ? composer.to.id : composer.kind === "quote" ? composer.of.id : "")}
            purpose={composer}
            autoFocus
            onPremiumRequired={() => {
              setComposer(null)
              showPremiumRequired()
            }}
            onPosted={() => {
              setComposer(null)
              toast({ type: "success", title: "Posted" })
            }}
          />
        )}
      </Dialog>
      <EligibilityDialog notice={notice} onClose={() => setNotice(null)} />
      {editing && <EditNoteDialog key={editing.id} note={editing} viewerId={viewerId} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete note?"
        description="This note will be removed from Echo, your profile and any timelines."
        confirmLabel="Delete"
        destructive
        loading={deleteBusy}
      />
      <ReelReportDialog open={!!reporting} targetId={reporting?.id ?? ""} targetType="post" onClose={() => setReporting(null)} />
    </EchoActionsContext.Provider>
  )
}

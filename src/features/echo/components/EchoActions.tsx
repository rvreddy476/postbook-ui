"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Dialog } from "@/components/ui/dialog"
import { SendInMessagesPanel } from "@/components/messenger/SendInMessagesPanel"
import { useGlobalToast } from "@/contexts/ToastContext"
import { ReelReportDialog } from "@/features/reels/components/ReelReportDialog"
import { useBlockUser } from "@/hooks/useBlocking"
import { followUser, unfollowUser } from "@/hooks/useEditProfile"
import { useMuteUser } from "@/hooks/useMuting"
import api from "@/lib/api"
import { useAuthUser } from "@/store/auth"

import { deleteNote, editNote, recordNoteShare, setBookmark, setRepost, toggleLike, votePoll } from "../api"
import { updateNoteEverywhere, useEligibilityReader } from "../hooks"
import {
  ECHO_WORDS,
  REPLY_POLICIES,
  canEditText,
  composerGate,
  echoErrorMessage,
  entryProblem,
  fullCount,
  statusPath,
  withLike,
  withRepost,
  type Note,
  type ReplyPolicy,
} from "../model"
import { withBookmark, withVote } from "../v2"
import { Composer, Counter, type ComposerPurpose } from "./Composer"

/*
  Every action a note offers, in one place, so the timeline, the post page,
  the profile and every list behave the same. Reply and quote open the
  composer after GET /v1/notes/me/eligibility says yes; like, repost,
  bookmark and vote are optimistic; Copy link and Send via Chat count a
  share (POST /v1/posts/:id/share). A signed-out visitor is sent to sign in
  and back. Mounted once by the Echo shell.
*/

export interface EchoActionsValue {
  viewerId: string | null
  /** The compose modal (/echo/compose). */
  compose: () => void
  reply: (note: Note) => void
  quote: (note: Note) => void
  like: (note: Note) => void
  repost: (note: Note) => void
  bookmark: (note: Note) => void
  copyLink: (note: Note) => void
  sendViaChat: (note: Note) => void
  vote: (note: Note, optionIndex: number) => void
  edit: (note: Note) => void
  remove: (note: Note) => void
  report: (note: Note) => void
  notInterested: (note: Note) => void
  activity: (note: Note) => void
  follow: (note: Note, follow: boolean) => void
  mute: (note: Note) => void
  block: (note: Note) => void
  /** Ask before a composer opens; resolves true when it may. */
  ensureCanCompose: (purpose: "note" | "reply") => Promise<boolean>
  showPremiumRequired: () => void
  signIn: () => void
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
  /** The refusal is "needs Premium": offer the way to buy it. */
  premium?: boolean
}

/** Where "Get Premium" goes: the Momentum Premium purchase page. */
export const PREMIUM_PAGE = "/premium"

const primaryButton = "rounded-full bg-brand-text px-5 py-2 text-sm font-bold text-brand-bg hover:opacity-90"
const plainButton = "rounded-full px-4 py-2 text-sm font-semibold text-brand-text hover:bg-brand-secondary"

/** The eligibility refusal. A Premium refusal also offers "Get Premium" (/premium); OK still closes. */
export function EligibilityDialog({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  return (
    <Dialog open={!!notice} onClose={onClose} title={notice?.title}>
      <div className="space-y-5" data-echo-eligibility>
        <p className="text-sm text-muted-foreground">{notice?.detail}</p>
        <div className="flex justify-end gap-2">
          {notice?.premium ? (
            <>
              <button type="button" onClick={onClose} className={plainButton}>
                OK
              </button>
              <Link href={PREMIUM_PAGE} onClick={onClose} data-echo-get-premium className={primaryButton}>
                Get Premium
              </Link>
            </>
          ) : (
            <button type="button" onClick={onClose} className={primaryButton}>
              OK
            </button>
          )}
        </div>
      </div>
    </Dialog>
  )
}

function EditNoteDialog({ note, viewerId, onClose }: { note: Note; viewerId: string | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [text, setText] = useState(note.text)
  const [policy, setPolicy] = useState<ReplyPolicy>(note.replyPolicy)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    <Dialog open onClose={onClose} title={textEditable ? "Edit post" : "Who can reply"}>
      <div className="space-y-4">
        {textEditable ? (
          <>
            <textarea
              aria-label="Post text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-border bg-brand-bg px-3 py-2 text-base text-brand-text focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>You can edit a post for 30 minutes after posting.</span>
              <Counter text={text} />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Posts can only be edited for 30 minutes after posting. You can still change who can reply.</p>
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
          <button type="button" onClick={onClose} className={plainButton}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={busy || !!textProblem} className={`${primaryButton} disabled:opacity-50`}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

/** View post activity (the author's own numbers). */
function ActivityDialog({ note, onClose }: { note: Note; onClose: () => void }) {
  const rows: [string, number][] = [
    ["Views", note.viewCount],
    ["Likes", note.likeCount],
    ["Replies", note.replyCount],
    ["Reposts", note.repostCount],
    ["Quotes", note.quoteCount],
    ["Bookmarks", note.bookmarkCount],
    ["Shares", note.shareCount],
  ]
  return (
    <Dialog open onClose={onClose} title="Post activity">
      <dl className="grid grid-cols-2 gap-3" data-echo-activity>
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border px-4 py-3">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-xl font-bold tabular-nums text-brand-text">{fullCount(value)}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  )
}

function handleOf(note: Note): string {
  return note.author?.username ? `@${note.author.username}` : "this account"
}

export function EchoActionsProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const toast = useGlobalToast()
  const user = useAuthUser()
  const viewerId = user?.id ?? null
  const readEligibility = useEligibilityReader()
  const muteUser = useMuteUser()
  const blockUser = useBlockUser()

  const [composer, setComposer] = useState<ComposerPurpose | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [editing, setEditing] = useState<Note | null>(null)
  const [deleting, setDeleting] = useState<Note | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [reporting, setReporting] = useState<Note | null>(null)
  const [sending, setSending] = useState<Note | null>(null)
  const [activity, setActivity] = useState<Note | null>(null)
  const [blocking, setBlocking] = useState<Note | null>(null)
  const pending = useRef(new Set<string>())

  const signIn = useCallback(() => {
    router.push(`/login?redirect=${encodeURIComponent(pathname || "/echo")}`)
  }, [router, pathname])

  const showPremiumRequired = useCallback(() => setNotice({ title: ECHO_WORDS.premiumRequired, detail: ECHO_WORDS.premiumRequiredDetail, premium: true }), [])

  const ensureCanCompose = useCallback(
    async (purpose: "note" | "reply") => {
      if (!viewerId) {
        signIn()
        return false
      }
      try {
        const gate = composerGate(await readEligibility(), purpose)
        if (gate.open) return true
        setNotice({ title: gate.title, detail: gate.detail, premium: gate.premium })
        return false
      } catch (err) {
        toast({ type: "error", title: echoErrorMessage(err) })
        return false
      }
    },
    [viewerId, signIn, readEligibility, toast],
  )

  /** One request at a time per key: a double click does not send twice. */
  const once = useCallback(async (key: string, fn: () => Promise<void>) => {
    if (pending.current.has(key)) return
    pending.current.add(key)
    try {
      await fn()
    } finally {
      pending.current.delete(key)
    }
  }, [])

  const countShare = useCallback(
    (note: Note) => {
      void recordNoteShare(note.id).then(
        (count) => {
          updateNoteEverywhere(qc, (n) => {
            const apply = (x: Note): Note => (x.id === note.id ? { ...x, shareCount: count ?? x.shareCount + 1 } : x)
            const next = apply(n)
            return next.quoted ? { ...next, quoted: apply(next.quoted) } : next
          })
        },
        () => {
          // Counting a share is best-effort; the link was still copied or sent.
        },
      )
    },
    [qc],
  )

  const muteMutate = muteUser.mutate

  const value = useMemo<EchoActionsValue>(
    () => ({
      viewerId,
      ensureCanCompose,
      showPremiumRequired,
      signIn,
      compose: () => (viewerId ? router.push("/echo/compose") : signIn()),
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
      bookmark: (note) => {
        if (!viewerId) return signIn()
        void once(`bookmark:${note.id}`, async () => {
          const next = !note.bookmarked
          updateNoteEverywhere(qc, (n) => withBookmark(n, note.id, next))
          try {
            const res = await setBookmark(note.id, next)
            updateNoteEverywhere(qc, (n) => withBookmark(n, note.id, res.bookmarked, res.count ?? undefined))
            void qc.invalidateQueries({ queryKey: ["echo", "list", "bookmarks"] })
            toast({ type: "success", title: res.bookmarked ? "Added to your Bookmarks" : "Removed from your Bookmarks" })
          } catch (err) {
            updateNoteEverywhere(qc, (n) => withBookmark(n, note.id, note.bookmarked, note.bookmarkCount))
            toast({ type: "error", title: echoErrorMessage(err) })
          }
        })
      },
      copyLink: (note) => {
        const url = `${window.location.origin}${statusPath(note)}`
        void navigator.clipboard?.writeText(url).then(
          () => {
            toast({ type: "success", title: "Copied to clipboard" })
            if (viewerId) countShare(note)
          },
          () => toast({ type: "error", title: "Couldn't copy the link" }),
        )
      },
      sendViaChat: (note) => (viewerId ? setSending(note) : signIn()),
      vote: (note, optionIndex) => {
        if (!viewerId) return signIn()
        void once(`vote:${note.id}`, async () => {
          updateNoteEverywhere(qc, (n) => withVote(n, note.id, optionIndex))
          try {
            const updated = await votePoll(note.id, optionIndex)
            updateNoteEverywhere(qc, (n) => (n.id === updated.id ? { ...updated, quoted: updated.quoted ?? n.quoted } : n))
          } catch (err) {
            updateNoteEverywhere(qc, (n) => (n.id === note.id ? { ...n, poll: note.poll } : n))
            toast({ type: "error", title: echoErrorMessage(err) })
          }
        })
      },
      edit: (note) => setEditing(note),
      remove: (note) => setDeleting(note),
      report: (note) => (viewerId ? setReporting(note) : signIn()),
      activity: (note) => setActivity(note),
      notInterested: (note) => {
        if (!viewerId) return signIn()
        updateNoteEverywhere(qc, (n) => (n.id === note.id ? null : n))
        void api.post("/v1/feed/feedback", { post_id: note.id, signal: "not_interested" }).then(
          () => toast({ type: "success", title: "You'll see fewer posts like this" }),
          () => toast({ type: "error", title: ECHO_WORDS.generic }),
        )
      },
      follow: (note, follow) => {
        if (!viewerId) return signIn()
        void once(`follow:${note.authorId}`, async () => {
          try {
            if (follow) await followUser(note.authorId)
            else await unfollowUser(note.authorId)
            void qc.invalidateQueries({ queryKey: ["echo", "relationship", note.authorId] })
            void qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
            toast({ type: "success", title: follow ? `You followed ${handleOf(note)}` : `You unfollowed ${handleOf(note)}` })
          } catch (err) {
            toast({ type: "error", title: echoErrorMessage(err) })
          }
        })
      },
      mute: (note) => {
        if (!viewerId) return signIn()
        muteMutate(
          { muted_id: note.authorId },
          {
            onSuccess: () => {
              updateNoteEverywhere(qc, (n) => (n.authorId === note.authorId ? null : n))
              toast({ type: "success", title: `You muted ${handleOf(note)}` })
            },
          },
        )
      },
      block: (note) => (viewerId ? setBlocking(note) : signIn()),
    }),
    [viewerId, ensureCanCompose, showPremiumRequired, signIn, toast, once, qc, router, countShare, muteMutate],
  )

  const confirmDelete = async () => {
    const note = deleting
    if (!note) return
    setDeleteBusy(true)
    try {
      await deleteNote(note.id)
      updateNoteEverywhere(qc, (n) => (n.id === note.id ? null : n))
      qc.removeQueries({ queryKey: ["echo", "note", note.id] })
      toast({ type: "success", title: "Your post was deleted" })
      setDeleting(null)
      if (pathname?.includes(`/status/${note.id}`)) router.replace("/echo")
    } catch (err) {
      toast({ type: "error", title: echoErrorMessage(err) })
    } finally {
      setDeleteBusy(false)
    }
  }

  const confirmBlock = () => {
    const note = blocking
    if (!note) return
    blockUser.mutate(note.authorId, {
      onSuccess: () => {
        updateNoteEverywhere(qc, (n) => (n.authorId === note.authorId ? null : n))
        toast({ type: "success", title: `You blocked ${handleOf(note)}` })
      },
      onSettled: () => setBlocking(null),
    })
  }

  const composerTitle = composer?.kind === "reply" ? "Reply" : composer?.kind === "quote" ? "Quote" : "New post"

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
              toast({ type: "success", title: composer.kind === "reply" ? "Your reply was sent" : "Your post was sent" })
            }}
          />
        )}
      </Dialog>
      <EligibilityDialog notice={notice} onClose={() => setNotice(null)} />
      {editing && <EditNoteDialog key={editing.id} note={editing} viewerId={viewerId} onClose={() => setEditing(null)} />}
      {activity && <ActivityDialog note={activity} onClose={() => setActivity(null)} />}
      <Dialog open={!!sending} onClose={() => setSending(null)} title="Send via Chat">
        {sending && (
          <SendInMessagesPanel
            postId={sending.id}
            onBack={() => setSending(null)}
            onSent={(recipient) => {
              countShare(sending)
              setSending(null)
              toast({ type: "success", title: `Sent to ${recipient.name}` })
            }}
          />
        )}
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete post?"
        description="This can't be undone. It will be removed from your profile, the timeline of anyone who follows you, and search results."
        confirmLabel="Delete"
        destructive
        loading={deleteBusy}
      />
      <ConfirmDialog
        open={!!blocking}
        onClose={() => setBlocking(null)}
        onConfirm={confirmBlock}
        title={blocking ? `Block ${handleOf(blocking)}?` : "Block?"}
        description="They won't be able to follow you or see your posts, and you won't see their posts or notifications."
        confirmLabel="Block"
        destructive
        loading={blockUser.isPending}
      />
      <ReelReportDialog open={!!reporting} targetId={reporting?.id ?? ""} targetType="post" onClose={() => setReporting(null)} />
    </EchoActionsContext.Provider>
  )
}

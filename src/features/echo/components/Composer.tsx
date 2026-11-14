"use client"

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { AtSign, CalendarClock, Globe, ImagePlus, ListChecks, Plus, Smile, UserCheck, X } from "lucide-react"

import EmojiPickerPopover from "@/components/comments/EmojiPickerPopover"
import Avatar from "@/components/ui/Avatar"
import { Dialog } from "@/components/ui/dialog"
import { giphyKey, type GifSendPayload } from "@/lib/chat/giphy"
import { createIdempotencyKeyHolder } from "@/lib/idempotency"
import { uploadMedia } from "@/lib/mediaUpload"
import { useAuthUser } from "@/store/auth"

import { createNote, createNoteBody, createThread } from "../api"
import { showCreatedNotes } from "../hooks"
import {
  ECHO_RULES,
  REPLY_POLICIES,
  acceptedPicks,
  echoErrorMessage,
  entryProblem,
  isAcceptedFile,
  readFailure,
  remaining,
  threadProblem,
  MEDIA_LIMIT_MESSAGE,
  type Eligibility,
  type Note,
  type ReplyPolicy,
  type StagedMedia,
} from "../model"
import {
  POLL_RULES,
  newPollDraft,
  pollBody,
  pollProblem,
  scheduleEarliest,
  scheduleLabel,
  scheduleLatest,
  scheduleProblem,
  fromLocalInputValue,
  toLocalInputValue,
  type PollDraft,
} from "../v2"
import { QuotedNote } from "./NoteCard"

const GiphyGrid = lazy(() => import("@/components/messenger/thread/GiphyGrid"))

/*
  The Echo composer, X's shape: avatar, a growing text box, the staged
  pictures or GIF or poll, "Everyone can reply", and the toolbar — photos
  (images only in v1), GIF, poll, emoji, schedule — with the character
  ring, the thread "+" and Post on the right.

  Rules (echo-contract.md + echo-v2-contract.md): 500 characters; up to 4
  images or exactly 1 GIF; a poll note has no media; a thread (2–25) has
  neither poll nor schedule (POST /v1/notes/thread takes text and media
  only); a reply is never scheduled. A GIF picked from Giphy (the chat's
  web SDK, NEXT_PUBLIC_GIPHY_SDK_KEY) is downloaded and uploaded through
  the media flow as image/gif; no external URL is stored. One
  Idempotency-Key per intent: any change to the draft starts a new one.
*/

export type ComposerPurpose = { kind: "note" } | { kind: "reply"; to: Note } | { kind: "quote"; of: Note }

interface StagedFile extends StagedMedia {
  file: File
  previewUrl: string
}

interface Entry {
  key: string
  text: string
  media: StagedFile[]
}

let seq = 0
const nextKey = (p: string) => `${p}${Date.now().toString(36)}-${(seq += 1)}`
const newEntry = (): Entry => ({ key: nextKey("e"), text: "", media: [] })

const iconButton = "rounded-full p-2 text-primary hover:bg-primary-tint disabled:opacity-40 disabled:hover:bg-transparent"

export function Counter({ text }: { text: string }) {
  const left = remaining(text)
  const tone = left < 0 ? "text-danger" : left <= ECHO_RULES.warnAtRemaining ? "text-warning" : "text-muted-foreground"
  return (
    <span className={`text-xs tabular-nums ${tone}`} aria-live="polite" data-remaining={left}>
      {left}
    </span>
  )
}

/** X's character ring: fills as the text grows, shows the number in the last 20, red past the limit. */
export function CharRing({ text }: { text: string }) {
  const left = remaining(text)
  const used = ECHO_RULES.maxChars - left
  const r = 9
  const c = 2 * Math.PI * r
  const ratio = Math.min(1, Math.max(0, used / ECHO_RULES.maxChars))
  const tone = left < 0 ? "text-danger" : left <= ECHO_RULES.warnAtRemaining ? "text-warning" : "text-primary"
  const big = left <= ECHO_RULES.warnAtRemaining
  if (used <= 0) return <span className="inline-block h-6 w-6" aria-hidden data-remaining={left} />
  return (
    <span className="relative inline-flex items-center justify-center" data-remaining={left} aria-label={`${left} characters left`}>
      <svg width={big ? 30 : 22} height={big ? 30 : 22} viewBox="0 0 24 24" className="-rotate-90" aria-hidden>
        <circle cx="12" cy="12" r={r} fill="none" strokeWidth="2" className="stroke-current text-border" />
        {left >= -9 && (
          <circle cx="12" cy="12" r={r} fill="none" strokeWidth="2" strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} className={`stroke-current ${tone}`} />
        )}
      </svg>
      {big && <span className={`absolute text-xs tabular-nums ${left < 0 ? "text-danger" : "text-muted-foreground"}`}>{left}</span>}
    </span>
  )
}

const POLICY_ICON: Record<ReplyPolicy, React.ReactNode> = {
  everyone: <Globe className="h-4 w-4" aria-hidden />,
  following: <UserCheck className="h-4 w-4" aria-hidden />,
  mentioned: <AtSign className="h-4 w-4" aria-hidden />,
}

const POLICY_PILL: Record<ReplyPolicy, string> = {
  everyone: "Everyone can reply",
  following: "Accounts you follow can reply",
  mentioned: "Only accounts you mention can reply",
}

/** "Everyone can reply" and its menu. */
export function ReplyPolicyPicker({ value, onChange }: { value: ReplyPolicy; onChange: (p: ReplyPolicy) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", outside)
    return () => document.removeEventListener("pointerdown", outside)
  }, [open])
  return (
    <div ref={ref} className="relative" data-reply-policy={value}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold text-primary-ink hover:bg-primary-tint"
      >
        {POLICY_ICON[value]} {POLICY_PILL[value]}
      </button>
      {open && (
        <div role="menu" aria-label="Who can reply?" className="absolute left-0 z-40 mt-1 w-72 rounded-xl border border-border bg-brand-card py-2 shadow-lg">
          <p className="px-4 pb-1 text-base font-bold text-brand-text">Who can reply?</p>
          <p className="px-4 pb-2 text-sm text-muted-foreground">Pick who can reply to this post. Anyone mentioned can always reply.</p>
          {REPLY_POLICIES.map((p) => (
            <button
              key={p.value}
              type="button"
              role="menuitemradio"
              aria-checked={p.value === value}
              onClick={() => {
                onChange(p.value)
                setOpen(false)
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-brand-text hover:bg-brand-secondary"
            >
              <span className="rounded-full bg-primary p-2 text-primary-foreground">{POLICY_ICON[p.value]}</span>
              {p.value === "everyone" ? "Everyone" : p.value === "following" ? "Accounts you follow" : "Only accounts you mention"}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
}

/** The poll's choices (2 to 4, 25 characters each) and its length (5 minutes to 7 days). */
export function PollEditor({ draft, onChange, onRemove }: { draft: PollDraft; onChange: (d: PollDraft) => void; onRemove: () => void }) {
  const select = "rounded-lg border border-border bg-brand-bg px-2 py-1.5 text-sm text-brand-text"
  const setOption = (i: number, value: string) => onChange({ ...draft, options: draft.options.map((o, j) => (j === i ? value : o)) })
  return (
    <div className="mt-3 rounded-2xl border border-border" data-poll-editor>
      <div className="space-y-2 p-3">
        {draft.options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Choice {i + 1}</span>
              <input
                value={o}
                maxLength={POLL_RULES.maxLabel}
                onChange={(e) => setOption(i, e.target.value)}
                placeholder={i < POLL_RULES.minOptions ? `Choice ${i + 1}` : `Choice ${i + 1} (optional)`}
                className="w-full rounded-lg border border-border bg-brand-bg px-3 py-2.5 text-base text-brand-text placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <span className="absolute right-2 top-1 text-xs tabular-nums text-muted-foreground">
                {Array.from(o).length} / {POLL_RULES.maxLabel}
              </span>
            </label>
            {i === draft.options.length - 1 && draft.options.length < POLL_RULES.maxOptions ? (
              <button type="button" aria-label="Add a choice" onClick={() => onChange({ ...draft, options: [...draft.options, ""] })} className={iconButton}>
                <Plus className="h-5 w-5" />
              </button>
            ) : (
              <span className="w-9" aria-hidden />
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-border p-3">
        <p className="mb-2 text-sm font-semibold text-brand-text">Poll length</p>
        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <label className="flex flex-col gap-1">
            Days
            <select aria-label="Days" value={draft.days} onChange={(e) => onChange({ ...draft, days: Number(e.target.value) })} className={select}>
              {range(8).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Hours
            <select aria-label="Hours" value={draft.hours} onChange={(e) => onChange({ ...draft, hours: Number(e.target.value) })} className={select}>
              {range(24).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Minutes
            <select aria-label="Minutes" value={draft.minutes} onChange={(e) => onChange({ ...draft, minutes: Number(e.target.value) })} className={select}>
              {range(60).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <button type="button" onClick={onRemove} className="w-full rounded-b-2xl border-t border-border py-3 text-sm font-semibold text-danger hover:bg-danger/10">
        Remove poll
      </button>
    </div>
  )
}

/** Schedule: pick a date and time 5 minutes to 18 months ahead. */
export function ScheduleDialog({ open, value, onClose, onConfirm, onClear }: { open: boolean; value: Date | null; onClose: () => void; onConfirm: (d: Date) => void; onClear: () => void }) {
  const [input, setInput] = useState(() => toLocalInputValue(value ?? new Date(Date.now() + 60 * 60_000)))
  const picked = fromLocalInputValue(input)
  const problem = scheduleProblem(picked)
  return (
    <Dialog open={open} onClose={onClose} title="Schedule">
      <div className="space-y-4" data-echo-schedule>
        {picked && !problem && <p className="text-sm text-muted-foreground">{scheduleLabel(picked)}</p>}
        <label className="flex flex-col gap-1 text-sm text-muted-foreground">
          Date and time
          <input
            type="datetime-local"
            value={input}
            min={toLocalInputValue(scheduleEarliest())}
            max={toLocalInputValue(scheduleLatest())}
            onChange={(e) => setInput(e.target.value)}
            className="rounded-lg border border-border bg-brand-bg px-3 py-2 text-base text-brand-text"
          />
        </label>
        {problem && (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          {value ? (
            <button type="button" onClick={onClear} className="rounded-full px-4 py-2 text-sm font-semibold text-primary-ink hover:bg-primary-tint">
              Clear
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            disabled={!!problem || !picked}
            onClick={() => picked && onConfirm(picked)}
            className="rounded-full bg-brand-text px-5 py-2 text-sm font-bold text-brand-bg hover:opacity-90 disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      </div>
    </Dialog>
  )
}

function GifPickerDialog({ open, apiKey, onClose, onPick }: { open: boolean; apiKey: string; onClose: () => void; onPick: (g: GifSendPayload) => void }) {
  const [query, setQuery] = useState("")
  const [width, setWidth] = useState(440)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open && box.current) setWidth(Math.max(240, box.current.clientWidth))
  }, [open])
  return (
    <Dialog open={open} onClose={onClose} title="Choose a GIF">
      <div ref={box} className="space-y-3" data-echo-gif-picker>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for GIFs"
          aria-label="Search for GIFs"
          className="w-full rounded-full border border-border bg-brand-bg px-4 py-2 text-base text-brand-text placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <div className="max-h-[55vh] overflow-y-auto">
          <Suspense fallback={<p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}>
            {open && <GiphyGrid apiKey={apiKey} query={query.trim()} width={width} onPick={onPick} />}
          </Suspense>
        </div>
      </div>
    </Dialog>
  )
}

/** Download a picked GIF so it can go up through the media flow as image/gif. */
export async function gifFileFromPick(gif: Pick<GifSendPayload, "id" | "url">, fetcher: typeof fetch = fetch): Promise<File> {
  const res = await fetcher(gif.url)
  if (!res.ok) throw new Error(`GIF download failed: ${res.status}`)
  const blob = await res.blob()
  return new File([blob], `giphy-${gif.id}.gif`, { type: "image/gif" })
}

/** "Posting on Echo needs Premium" with Get Premium, shown instead of the composer to free members. */
export function PremiumGateCard() {
  return (
    <div className="border-b border-border px-4 py-4" data-echo-premium-gate>
      <div className="rounded-2xl border border-border bg-brand-card p-4">
        <p className="text-lg font-extrabold text-brand-text">Posting on Echo needs Premium</p>
        <p className="mt-1 text-sm text-muted-foreground">You can still reply, like, bookmark and vote. Premium members can post, start threads and quote.</p>
        <Link href="/premium" data-echo-get-premium className="mt-3 inline-flex rounded-full bg-brand-text px-5 py-2 text-sm font-bold text-brand-bg hover:opacity-90">
          Get Premium
        </Link>
      </div>
    </div>
  )
}

/**
 * What sits at the top of Home: the composer for someone who may post, the
 * Premium card for a free member, a plain line for any other refusal.
 * Pure on its inputs so the gate is tested without a server.
 */
export function ComposerGateView({ eligibility, loading, children }: { eligibility: Eligibility | undefined; loading: boolean; children: React.ReactNode }) {
  if (loading) return <div className="h-24 border-b border-border" aria-busy="true" />
  if (!eligibility) return <>{children}</>
  if (eligibility.canPost) return <>{children}</>
  if (eligibility.reason === "premium_required" || eligibility.reason === "") return <PremiumGateCard />
  const words = eligibility.reason === "account_too_new" ? "Your account is too new to post on Echo." : "Your account can't post on Echo right now."
  return (
    <p className="border-b border-border px-4 py-4 text-sm text-muted-foreground" data-echo-cannot-post>
      {words}
    </p>
  )
}

export function Composer({
  purpose,
  autoFocus = false,
  onPosted,
  onPremiumRequired,
  inline = false,
}: {
  purpose: ComposerPurpose
  autoFocus?: boolean
  onPosted?: (notes: Note[]) => void
  /** A 403 PREMIUM_REQUIRED at submit (Premium lapsed since the composer opened). */
  onPremiumRequired?: () => void
  /** Home's composer: no "Replying to" line, a border below. */
  inline?: boolean
}) {
  const qc = useQueryClient()
  const user = useAuthUser()
  const name = user?.name || user?.username || "?"
  const [entries, setEntries] = useState<Entry[]>([newEntry()])
  const [activeKey, setActiveKey] = useState<string>(() => "")
  const [policy, setPolicy] = useState<ReplyPolicy>("everyone")
  const [poll, setPoll] = useState<PollDraft | null>(null)
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null)
  const [scheduling, setScheduling] = useState(false)
  const [gifOpen, setGifOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const keyHolder = useRef(createIdempotencyKeyHolder())
  const fileInput = useRef<HTMLInputElement | null>(null)
  const emojiAnchor = useRef<HTMLButtonElement | null>(null)
  const textareas = useRef(new Map<string, HTMLTextAreaElement | null>())
  const blobs = useRef(new Set<string>())
  const gifKey = giphyKey()

  useEffect(() => {
    const owned = blobs.current
    return () => owned.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  const thread = entries.length > 1
  const active = entries.find((e) => e.key === activeKey) ?? entries[entries.length - 1]
  const canThread = purpose.kind === "note" && !poll && !scheduledAt
  const canPoll = purpose.kind !== "reply" && !thread && entries[0].media.length === 0
  const canSchedule = purpose.kind !== "reply" && !thread
  const showPolicy = purpose.kind !== "reply"
  const mediaBlocked = !!poll || active.media.some((m) => m.isGif) || active.media.length >= ECHO_RULES.maxImages

  const problem = useMemo(() => {
    if (thread) return threadProblem(entries)
    if (poll) {
      const length = Array.from(entries[0].text.trim()).length
      if (length === 0) return "Ask a question for your poll."
      if (length > ECHO_RULES.maxChars) return `Posts can be up to ${ECHO_RULES.maxChars} characters.`
      return pollProblem(poll)
    }
    return entryProblem(entries[0].text, entries[0].media)
  }, [entries, thread, poll])

  /** Any change to the draft is a new intent: a new Idempotency-Key on the next submit. */
  const change = (fn: (current: Entry[]) => Entry[]) => {
    keyHolder.current.reset()
    setError(null)
    setEntries(fn)
  }
  const touch = () => {
    keyHolder.current.reset()
    setError(null)
  }

  const setText = (key: string, text: string) => change((cur) => cur.map((e) => (e.key === key ? { ...e, text } : e)))

  const stage = (key: string, files: File[]) => {
    const entry = entries.find((e) => e.key === key)
    if (!entry) return
    const take = acceptedPicks(entry.media, files.map((f) => f.type === "image/gif"))
    const added: StagedFile[] = files.slice(0, take).map((file) => {
      const previewUrl = URL.createObjectURL(file)
      blobs.current.add(previewUrl)
      return { key: nextKey("m"), file, previewUrl, isGif: file.type === "image/gif" }
    })
    change((cur) => cur.map((e) => (e.key === key ? { ...e, media: [...e.media, ...added] } : e)))
    return take
  }

  const addFiles = (list: FileList | null) => {
    const files = Array.from(list ?? [])
    if (files.length === 0) return
    const images = files.filter(isAcceptedFile)
    const take = stage(active.key, images) ?? 0
    if (images.length < files.length) setError("Echo takes photos and GIFs only.")
    else if (take < images.length) setError(MEDIA_LIMIT_MESSAGE)
  }

  const pickGif = async (gif: GifSendPayload) => {
    setGifOpen(false)
    try {
      const file = await gifFileFromPick(gif)
      if (!stage(active.key, [file])) setError(MEDIA_LIMIT_MESSAGE)
    } catch {
      setError("Couldn't add that GIF. Try another one.")
    }
  }

  const insertEmoji = (emoji: string) => {
    const el = textareas.current.get(active.key)
    const text = active.text
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    setText(active.key, text.slice(0, start) + emoji + text.slice(end))
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const caret = start + emoji.length
      el.setSelectionRange(caret, caret)
    })
  }

  const removeMedia = (entryKey: string, mediaKey: string) =>
    change((cur) => cur.map((e) => (e.key === entryKey ? { ...e, media: e.media.filter((m) => m.key !== mediaKey) } : e)))

  const addEntry = () => {
    const entry = newEntry()
    change((cur) => (cur.length >= ECHO_RULES.threadMax ? cur : [...cur, entry]))
    setActiveKey(entry.key)
    requestAnimationFrame(() => textareas.current.get(entry.key)?.focus())
  }
  const removeEntry = (key: string) => change((cur) => (cur.length > 1 ? cur.filter((e) => e.key !== key) : cur))

  /** Upload what is not uploaded yet; ids are kept so a retry re-uploads nothing. */
  const uploadAll = async (): Promise<Entry[]> => {
    const done = await Promise.all(
      entries.map(async (e) => ({
        ...e,
        media: await Promise.all(
          e.media.map(async (m) => {
            if (m.mediaId) return m
            try {
              return { ...m, mediaId: await uploadMedia(m.file, "image", "general"), failed: false }
            } catch {
              return { ...m, failed: true }
            }
          }),
        ),
      })),
    )
    // Not through change(): the words did not change, so the key stays.
    setEntries(done)
    return done
  }

  const reset = () => {
    entries.forEach((e) =>
      e.media.forEach((m) => {
        URL.revokeObjectURL(m.previewUrl)
        blobs.current.delete(m.previewUrl)
      }),
    )
    setEntries([newEntry()])
    setPolicy("everyone")
    setPoll(null)
    setScheduledAt(null)
  }

  const submit = async () => {
    if (busy || problem) return
    if (scheduledAt) {
      const late = scheduleProblem(scheduledAt)
      if (late) return setError(late)
    }
    setBusy(true)
    setError(null)
    try {
      const ready = poll ? entries : await uploadAll()
      if (!poll) {
        const stillWrong = ready.length > 1 ? threadProblem(ready) : entryProblem(ready[0].text, ready[0].media)
        if (stillWrong) {
          setError(stillWrong)
          return
        }
      }
      const key = keyHolder.current.current()
      const ids = (e: Entry) => e.media.map((m) => m.mediaId as string)
      let created: Note[]
      if (ready.length > 1) {
        created = await createThread(
          { entries: ready.map((e) => ({ text: e.text.trim(), ...(e.media.length ? { media_ids: ids(e) } : {}) })), reply_policy: policy },
          key,
        )
      } else {
        const body = createNoteBody({
          text: ready[0].text,
          mediaIds: poll ? [] : ids(ready[0]),
          replyToId: purpose.kind === "reply" ? purpose.to.id : null,
          quoteOfId: purpose.kind === "quote" ? purpose.of.id : null,
          replyPolicy: showPolicy ? policy : undefined,
          poll: poll ? pollBody(poll) : null,
          scheduledAt: canSchedule ? scheduledAt : null,
        })
        created = [await createNote(body, key)]
      }
      keyHolder.current.reset()
      showCreatedNotes(qc, created)
      reset()
      onPosted?.(created)
    } catch (err) {
      if (readFailure(err).code === "PREMIUM_REQUIRED") onPremiumRequired?.()
      setError(echoErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const placeholder = purpose.kind === "reply" ? "Post your reply" : purpose.kind === "quote" ? "Add a comment" : poll ? "Ask a question" : "What's happening?"
  const submitLabel = scheduledAt ? "Schedule" : purpose.kind === "reply" ? "Reply" : thread ? "Post all" : "Post"
  const anyText = entries.some((e) => e.text.length > 0)

  return (
    <div className={inline ? "border-b border-border px-4 pt-3" : ""} data-echo-composer={purpose.kind}>
      {purpose.kind === "reply" && !inline && (
        <p className="mb-2 pl-14 text-sm text-muted-foreground">
          Replying to <span className="text-primary-ink">@{purpose.to.author?.username || "someone"}</span>
        </p>
      )}
      {scheduledAt && (
        <p className="mb-2 flex items-center gap-2 pl-14 text-sm text-muted-foreground" data-echo-scheduled-for>
          <CalendarClock className="h-4 w-4" aria-hidden /> {scheduleLabel(scheduledAt)}
        </p>
      )}
      {entries.map((entry, index) => (
        <div key={entry.key} className="flex gap-3" data-entry={index}>
          <div className="flex shrink-0 flex-col items-center">
            <Avatar src={user?.avatar || null} name={name} className="h-10 w-10" />
            {index < entries.length - 1 && <span className="mt-1 w-0.5 flex-1 bg-border" aria-hidden />}
          </div>
          <div className="min-w-0 flex-1 pb-2">
            <div className="flex items-start gap-2">
              <label className="sr-only" htmlFor={`echo-text-${entry.key}`}>
                {thread ? `Post ${index + 1} of ${entries.length}` : placeholder}
              </label>
              <textarea
                id={`echo-text-${entry.key}`}
                ref={(el) => {
                  textareas.current.set(entry.key, el)
                }}
                value={entry.text}
                autoFocus={autoFocus && index === 0}
                onFocus={() => setActiveKey(entry.key)}
                onChange={(e) => {
                  setText(entry.key, e.target.value)
                  e.target.style.height = "auto"
                  e.target.style.height = `${e.target.scrollHeight}px`
                }}
                placeholder={index === 0 ? placeholder : "Add another post"}
                rows={index === 0 && !inline ? 3 : 2}
                className="w-full resize-none bg-transparent py-2 text-xl text-brand-text placeholder:text-muted-foreground focus:outline-none"
              />
              {thread && (
                <button type="button" aria-label={`Remove post ${index + 1}`} onClick={() => removeEntry(entry.key)} className="rounded-full p-1.5 text-muted-foreground hover:bg-brand-secondary hover:text-brand-text">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {entry.media.length > 0 && (
              <div className={`mt-2 grid gap-2 ${entry.media.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                {entry.media.map((m) => (
                  <div key={m.key} className="relative overflow-hidden rounded-2xl border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.previewUrl} alt="" className={`w-full object-cover ${entry.media.length === 1 ? "max-h-80" : "aspect-square"}`} />
                    {m.isGif && <span className="absolute bottom-2 left-2 rounded bg-brand-text/70 px-1.5 text-xs font-bold text-brand-bg">GIF</span>}
                    {m.failed && <span className="absolute inset-x-0 bottom-0 bg-danger px-1 text-center text-xs text-primary-foreground">Failed</span>}
                    <button type="button" aria-label={m.isGif ? "Remove GIF" : "Remove photo"} onClick={() => removeMedia(entry.key, m.key)} className="absolute right-2 top-2 rounded-full bg-brand-text/70 p-1 text-brand-bg">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {index === 0 && poll && (
              <PollEditor
                draft={poll}
                onChange={(d) => {
                  touch()
                  setPoll(d)
                }}
                onRemove={() => {
                  touch()
                  setPoll(null)
                }}
              />
            )}
          </div>
        </div>
      ))}

      {purpose.kind === "quote" && (
        <div className="pl-14">
          <QuotedNote note={purpose.of} quoteOfId={purpose.of.id} />
        </div>
      )}

      <div className="pl-14">
        {showPolicy && (anyText || !inline) && (
          <div className="border-b border-border pb-2">
            <ReplyPolicyPicker
              value={policy}
              onChange={(p) => {
                touch()
                setPolicy(p)
              }}
            />
          </div>
        )}
        <div className="flex items-center gap-0.5 py-2" role="toolbar" aria-label="Post options">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ""
            }}
          />
          <button type="button" aria-label="Add photos" title="Media" onClick={() => fileInput.current?.click()} disabled={mediaBlocked} className={iconButton}>
            <ImagePlus className="h-5 w-5" />
          </button>
          {gifKey && (
            <button type="button" aria-label="Add a GIF" title="GIF" onClick={() => setGifOpen(true)} disabled={!!poll || active.media.length > 0} className={iconButton} data-echo-gif-button>
              <span className="inline-flex h-5 items-center justify-center rounded border-2 border-current px-0.5 text-xs font-black leading-none">GIF</span>
            </button>
          )}
          <button
            type="button"
            aria-label="Add a poll"
            title="Poll"
            onClick={() => {
              touch()
              setPoll(newPollDraft())
            }}
            disabled={!canPoll || !!poll}
            className={iconButton}
          >
            <ListChecks className="h-5 w-5" />
          </button>
          <button ref={emojiAnchor} type="button" aria-label="Add an emoji" title="Emoji" onClick={() => setEmojiOpen((v) => !v)} className={iconButton}>
            <Smile className="h-5 w-5" />
          </button>
          {purpose.kind !== "reply" && (
            <button type="button" aria-label="Schedule post" title="Schedule" onClick={() => setScheduling(true)} disabled={!canSchedule} className={iconButton}>
              <CalendarClock className="h-5 w-5" />
            </button>
          )}
          <div className="ml-auto flex items-center gap-3">
            <CharRing text={active.text} />
            {canThread && (
              <>
                <span className="h-6 w-px bg-border" aria-hidden />
                <button
                  type="button"
                  aria-label="Add post"
                  title="Add post"
                  onClick={addEntry}
                  disabled={entries.length >= ECHO_RULES.threadMax || !active.text.trim()}
                  className="rounded-full border border-border p-1 text-primary hover:bg-primary-tint disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={busy || !!problem}
              title={problem ?? undefined}
              className="rounded-full bg-brand-text px-4 py-1.5 text-sm font-bold text-brand-bg hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Posting…" : submitLabel}
            </button>
          </div>
        </div>
        {(error || (problem && entries.some((e) => remaining(e.text) < 0))) && (
          <p role="alert" className="pb-3 text-sm text-danger">
            {error ?? problem}
          </p>
        )}
      </div>

      {emojiOpen && <EmojiPickerPopover anchorRef={emojiAnchor} onSelect={insertEmoji} onClose={() => setEmojiOpen(false)} />}
      {gifKey && <GifPickerDialog open={gifOpen} apiKey={gifKey} onClose={() => setGifOpen(false)} onPick={(g) => void pickGif(g)} />}
      {scheduling && (
        <ScheduleDialog
          open
          value={scheduledAt}
          onClose={() => setScheduling(false)}
          onClear={() => {
            touch()
            setScheduledAt(null)
            setScheduling(false)
          }}
          onConfirm={(d) => {
            touch()
            setScheduledAt(d)
            setScheduling(false)
          }}
        />
      )}
    </div>
  )
}

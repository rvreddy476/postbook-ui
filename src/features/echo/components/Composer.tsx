"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ImagePlus, ListPlus, X } from "lucide-react"

import { createIdempotencyKeyHolder } from "@/lib/idempotency"
import { uploadMedia } from "@/lib/mediaUpload"

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
  type Note,
  type ReplyPolicy,
  type StagedMedia,
} from "../model"
import { QuotedNote } from "./NoteCard"

/*
  The Echo composer: a note, a thread (2–25 notes), a quote or a reply.
  500 characters per note, up to 4 photos or 1 GIF each, uploaded through
  the same media-service flow as the post composer (lib/mediaUpload). One
  Idempotency-Key per submit: a retry of the same words reuses it, so a
  post that landed before its answer was lost is not posted twice; any
  change to the draft starts a new one.
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

export function Counter({ text }: { text: string }) {
  const left = remaining(text)
  const tone = left < 0 ? "text-danger" : left <= ECHO_RULES.warnAtRemaining ? "text-warning" : "text-muted-foreground"
  return (
    <span className={`text-xs tabular-nums ${tone}`} aria-live="polite" data-remaining={left}>
      {left}
    </span>
  )
}

export function Composer({
  purpose,

  autoFocus = false,
  onPosted,
  onPremiumRequired,
}: {
  purpose: ComposerPurpose

  autoFocus?: boolean
  onPosted?: (notes: Note[]) => void
  /** A 403 PREMIUM_REQUIRED at submit (Premium lapsed since the composer opened). */
  onPremiumRequired?: () => void
}) {
  const qc = useQueryClient()
  const [entries, setEntries] = useState<Entry[]>([newEntry()])
  const [policy, setPolicy] = useState<ReplyPolicy>("everyone")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const keyHolder = useRef(createIdempotencyKeyHolder())
  const fileInputs = useRef(new Map<string, HTMLInputElement | null>())
  const blobs = useRef(new Set<string>())

  useEffect(() => {
    const owned = blobs.current
    return () => owned.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  const thread = entries.length > 1
  const canThread = purpose.kind === "note"
  const showPolicy = purpose.kind !== "reply"

  const problem = useMemo(() => (thread ? threadProblem(entries) : entryProblem(entries[0].text, entries[0].media)), [entries, thread])

  /** Any change to the draft is a new intent: a new Idempotency-Key on the next submit. */
  const change = (fn: (current: Entry[]) => Entry[]) => {
    keyHolder.current.reset()
    setError(null)
    setEntries(fn)
  }

  const setText = (key: string, text: string) => change((cur) => cur.map((e) => (e.key === key ? { ...e, text } : e)))

  const addFiles = (key: string, list: FileList | null) => {
    const files = Array.from(list ?? [])
    if (files.length === 0) return
    const images = files.filter(isAcceptedFile)
    const entry = entries.find((e) => e.key === key)
    if (!entry) return
    const take = acceptedPicks(entry.media, images.map((f) => f.type === "image/gif"))
    const added: StagedFile[] = images.slice(0, take).map((file) => {
      const previewUrl = URL.createObjectURL(file)
      blobs.current.add(previewUrl)
      return { key: nextKey("m"), file, previewUrl, isGif: file.type === "image/gif" }
    })
    change((cur) => cur.map((e) => (e.key === key ? { ...e, media: [...e.media, ...added] } : e)))
    if (images.length < files.length) setError("Echo takes photos and GIFs only.")
    else if (take < images.length) setError(MEDIA_LIMIT_MESSAGE)
  }

  const removeMedia = (entryKey: string, mediaKey: string) =>
    change((cur) => cur.map((e) => (e.key === entryKey ? { ...e, media: e.media.filter((m) => m.key !== mediaKey) } : e)))

  const addEntry = () => change((cur) => (cur.length >= ECHO_RULES.threadMax ? cur : [...cur, newEntry()]))
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

  const submit = async () => {
    if (busy || problem) return
    setBusy(true)
    setError(null)
    try {
      const ready = await uploadAll()
      const stillWrong = ready.length > 1 ? threadProblem(ready) : entryProblem(ready[0].text, ready[0].media)
      if (stillWrong) {
        setError(stillWrong)
        return
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
          mediaIds: ids(ready[0]),
          replyToId: purpose.kind === "reply" ? purpose.to.id : null,
          quoteOfId: purpose.kind === "quote" ? purpose.of.id : null,
          replyPolicy: showPolicy ? policy : undefined,
        })
        created = [await createNote(body, key)]
      }
      keyHolder.current.reset()
      showCreatedNotes(qc, created)
      ready.forEach((e) => e.media.forEach((m) => {
        URL.revokeObjectURL(m.previewUrl)
        blobs.current.delete(m.previewUrl)
      }))
      setEntries([newEntry()])
      setPolicy("everyone")
      onPosted?.(created)
    } catch (err) {
      if (readFailure(err).code === "PREMIUM_REQUIRED") onPremiumRequired?.()
      setError(echoErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const placeholder = purpose.kind === "reply" ? "Post your reply" : purpose.kind === "quote" ? "Add a comment" : thread ? "Add another note" : "What's happening?"
  const submitLabel = purpose.kind === "reply" ? "Reply" : thread ? "Post all" : "Post"

  return (
    <div className="flex flex-col gap-3" data-echo-composer={purpose.kind}>
      {entries.map((entry, index) => (
        <div key={entry.key} className="flex flex-col gap-2" data-entry={index}>
          <div className="flex items-start gap-2">
            <label className="sr-only" htmlFor={`echo-text-${entry.key}`}>
              {thread ? `Note ${index + 1} of ${entries.length}` : placeholder}
            </label>
            <textarea
              id={`echo-text-${entry.key}`}
              value={entry.text}
              autoFocus={autoFocus && index === 0}
              onChange={(e) => setText(entry.key, e.target.value)}
              placeholder={index === 0 ? placeholder : "Add another note"}
              rows={index === 0 ? 3 : 2}
              className="min-h-[4.5rem] w-full resize-y rounded-xl border border-border bg-brand-bg px-3 py-2 text-base text-brand-text placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {thread && (
              <button type="button" aria-label={`Remove note ${index + 1}`} onClick={() => removeEntry(entry.key)} className="rounded-full p-1.5 text-muted-foreground hover:bg-brand-secondary hover:text-brand-text">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {entry.media.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {entry.media.map((m) => (
                <div key={m.key} className="relative h-20 w-20 overflow-hidden rounded-lg border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.previewUrl} alt="" className="h-full w-full object-cover" />
                  {m.failed && <span className="absolute inset-x-0 bottom-0 bg-danger px-1 text-center text-xs text-primary-foreground">Failed</span>}
                  <button type="button" aria-label="Remove photo" onClick={() => removeMedia(entry.key, m.key)} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={(el) => {
                fileInputs.current.set(entry.key, el)
              }}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                addFiles(entry.key, e.target.files)
                e.target.value = ""
              }}
            />
            <button
              type="button"
              aria-label="Add photos or a GIF"
              onClick={() => fileInputs.current.get(entry.key)?.click()}
              disabled={entry.media.some((m) => m.isGif) || entry.media.length >= ECHO_RULES.maxImages}
              className="rounded-full p-2 text-primary-ink hover:bg-primary-tint disabled:opacity-40"
            >
              <ImagePlus className="h-5 w-5" />
            </button>
            <span className="ml-auto">
              <Counter text={entry.text} />
            </span>
          </div>
        </div>
      ))}

      {purpose.kind === "quote" && <QuotedNote note={purpose.of} quoteOfId={purpose.of.id} />}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {canThread && (
          <button
            type="button"
            onClick={addEntry}
            disabled={entries.length >= ECHO_RULES.threadMax}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-primary-ink hover:bg-primary-tint disabled:opacity-40"
          >
            <ListPlus className="h-4 w-4" /> {thread ? "Add to thread" : "Make a thread"}
          </button>
        )}
        {showPolicy && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Who can reply</span>
            <select
              value={policy}
              onChange={(e) => {
                keyHolder.current.reset()
                setPolicy(e.target.value as ReplyPolicy)
              }}
              className="rounded-lg border border-border bg-brand-bg px-2 py-1 text-sm text-brand-text"
            >
              {REPLY_POLICIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={busy || !!problem}
          title={problem ?? undefined}
          className="ml-auto rounded-full bg-primary-ink px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
        >
          {busy ? "Posting…" : submitLabel}
        </button>
      </div>
      {(error || (problem && entries.some((e) => remaining(e.text) < 0))) && (
        <p role="alert" className="text-sm text-danger">
          {error ?? problem}
        </p>
      )}
    </div>
  )
}

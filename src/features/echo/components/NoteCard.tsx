"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { BadgeCheck, Ellipsis, Flag, Heart, MessageCircle, Pencil, Quote, Repeat2, Share2, Trash2 } from "lucide-react"

import Avatar from "@/components/ui/Avatar"
import { onImageError, resolveImageUrl } from "@/lib/imageUrl"

import { MARK_LABEL, canEditText, compactCount, isAuthor, noteMediaPath, notePath, profilePath, shortAge, type Note, type VerificationMark } from "../model"
import { useEchoActions } from "./EchoActions"
import { NoteText } from "./NoteText"

const MARK_CLASS: Record<VerificationMark, string> = {
  none: "",
  person: "text-primary-ink",
  official: "text-warning",
  government: "text-muted-foreground",
}

export function VerifiedMark({ mark }: { mark: VerificationMark }) {
  if (mark === "none") return null
  return (
    <span title={MARK_LABEL[mark]} aria-label={MARK_LABEL[mark]} className={`inline-flex shrink-0 ${MARK_CLASS[mark]}`} data-mark={mark}>
      <BadgeCheck className="h-4 w-4" aria-hidden />
    </span>
  )
}

function AuthorLine({ note, compact = false }: { note: Note; compact?: boolean }) {
  const a = note.author
  const name = a?.displayName || a?.username || "Someone"
  return (
    <div className="flex min-w-0 items-center gap-1 text-sm">
      <Link href={profilePath(a, note.authorId)} className="truncate font-semibold text-brand-text hover:underline" onClick={(e) => e.stopPropagation()}>
        {name}
      </Link>
      <VerifiedMark mark={a?.mark ?? "none"} />
      {a?.username && <span className="truncate text-muted-foreground">@{a.username}</span>}
      <span className="text-muted-foreground" aria-hidden>
        ·
      </span>
      <time dateTime={note.createdAt} className="shrink-0 text-muted-foreground">
        {shortAge(note.createdAt)}
      </time>
      {note.editedAt && !compact && <span className="shrink-0 text-muted-foreground">· Edited</span>}
    </div>
  )
}

/** Up to 4 images in a grid, or one GIF. */
export function NoteMediaGrid({ note }: { note: Pick<Note, "media"> }) {
  if (note.media.length === 0) return null
  const cols = note.media.length === 1 ? "grid-cols-1" : "grid-cols-2"
  return (
    <div className={`mt-3 grid gap-1 overflow-hidden rounded-2xl border border-border ${cols}`}>
      {note.media.map((m) => {
        const src = m.isGif ? noteMediaPath(m.mediaId) : resolveImageUrl(noteMediaPath(m.mediaId), { dataSaver: false, size: note.media.length === 1 ? "large" : "medium" })
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={m.mediaId}
            src={src}
            alt={m.altText}
            loading="lazy"
            onError={onImageError}
            className={`w-full bg-brand-secondary object-cover ${note.media.length === 1 ? "max-h-[32rem]" : "aspect-square"}`}
          />
        )
      })}
    </div>
  )
}

/** The quoted note inside a quote: one level, no actions. A gone quote says so. */
export function QuotedNote({ note, quoteOfId }: { note: Note | null; quoteOfId: string | null }) {
  const router = useRouter()
  if (!quoteOfId) return null
  if (!note) {
    return <div className="mt-3 rounded-2xl border border-border px-4 py-3 text-sm text-muted-foreground">This note isn&apos;t available.</div>
  }
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        router.push(notePath(note.id))
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(notePath(note.id))
      }}
      className="mt-3 cursor-pointer rounded-2xl border border-border px-4 py-3 hover:bg-brand-secondary/50"
      data-quoted-note={note.id}
    >
      <AuthorLine note={note} compact />
      <NoteText text={note.text} className="mt-1 text-sm" />
      <NoteMediaGrid note={note} />
    </div>
  )
}

function ActionButton({
  label,
  count,
  active = false,
  activeClass = "",
  onClick,
  children,
}: {
  label: string
  count?: number
  active?: boolean
  activeClass?: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`flex min-w-0 items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors hover:bg-brand-secondary ${active ? activeClass : "text-muted-foreground hover:text-brand-text"}`}
    >
      {children}
      {count !== undefined && <span className="tabular-nums">{compactCount(count)}</span>}
    </button>
  )
}

function NoteMenu({ note }: { note: Note }) {
  const actions = useEchoActions()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const own = isAuthor(note, actions.viewerId)
  const editable = canEditText(note, actions.viewerId)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  if (!actions.viewerId) return null
  const item = "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-brand-secondary"
  const pick = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }
  return (
    <div ref={ref} className="relative ml-auto shrink-0" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="More options" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="rounded-full p-1.5 text-muted-foreground hover:bg-brand-secondary hover:text-brand-text">
        <Ellipsis className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-8 z-30 w-56 overflow-hidden rounded-xl border border-border bg-brand-card py-1 text-brand-text shadow-lg">
          {own ? (
            <>
              {/* Text within 30 minutes; who can reply at any time. Both are PATCH /v1/notes/:id. */}
              <button role="menuitem" type="button" className={item} onClick={pick(() => actions.edit(note))}>
                <Pencil className="h-4 w-4" /> {editable ? "Edit note" : "Change who can reply"}
              </button>
              <button role="menuitem" type="button" className={`${item} text-danger`} onClick={pick(() => actions.remove(note))}>
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </>
          ) : (
            <button role="menuitem" type="button" className={item} onClick={pick(() => actions.report(note))}>
              <Flag className="h-4 w-4" /> Report note
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** One note: author, words, pictures, the quoted note, counts and the actions. */
export function NoteCard({ note, focused = false, threadLine = false }: { note: Note; focused?: boolean; threadLine?: boolean }) {
  const router = useRouter()
  const actions = useEchoActions()
  const a = note.author
  const name = a?.displayName || a?.username || "Someone"
  const open = () => {
    if (!focused) router.push(notePath(note.id))
  }
  return (
    <article
      data-note-id={note.id}
      onClick={open}
      className={`flex gap-3 px-4 py-3 ${focused ? "" : "cursor-pointer hover:bg-brand-secondary/40"}`}
    >
      <div className="flex shrink-0 flex-col items-center">
        <Link href={profilePath(a, note.authorId)} onClick={(e) => e.stopPropagation()} aria-label={name}>
          <Avatar src={a?.avatarUrl} name={name} className="h-10 w-10" />
        </Link>
        {threadLine && <span className="mt-1 w-0.5 flex-1 rounded-full bg-border" aria-hidden />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <AuthorLine note={note} />
          <NoteMenu note={note} />
        </div>
        <NoteText text={note.text} className={focused ? "mt-1 text-lg" : "mt-0.5"} />
        <NoteMediaGrid note={note} />
        <QuotedNote note={note.quoted} quoteOfId={note.quoteOfId} />
        <div className="mt-2 flex max-w-md items-center justify-between">
          <ActionButton label="Reply" count={note.replyCount} onClick={() => actions.reply(note)}>
            <MessageCircle className="h-4 w-4" />
          </ActionButton>
          <ActionButton label={note.reposted ? "Undo repost" : "Repost"} count={note.repostCount} active={note.reposted} activeClass="text-success" onClick={() => actions.repost(note)}>
            <Repeat2 className="h-4 w-4" />
          </ActionButton>
          <ActionButton label="Quote" onClick={() => actions.quote(note)}>
            <Quote className="h-4 w-4" />
          </ActionButton>
          <ActionButton label={note.liked ? "Unlike" : "Like"} count={note.likeCount} active={note.liked} activeClass="text-danger" onClick={() => actions.like(note)}>
            <Heart className={`h-4 w-4 ${note.liked ? "fill-current" : ""}`} />
          </ActionButton>
          <ActionButton label="Share" onClick={() => actions.share(note)}>
            <Share2 className="h-4 w-4" />
          </ActionButton>
        </div>
      </div>
    </article>
  )
}

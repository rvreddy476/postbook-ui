"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, type RefObject } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  BadgeCheck,
  BarChart2,
  Ban,
  Bookmark,
  Check,
  Ellipsis,
  Flag,
  Frown,
  Heart,
  Link2,
  MessageCircle,
  MessageSquareShare,
  Pencil,
  PenLine,
  Repeat2,
  Trash2,
  UserMinus,
  UserPlus,
  VolumeX,
} from "lucide-react"

import Avatar from "@/components/ui/Avatar"
import api from "@/lib/api"
import { relationshipFromGraph } from "@/lib/graphApi"
import { onImageError, resolveImageUrl } from "@/lib/imageUrl"

import { flattenPages, useNote, useReplies, useTopReplies } from "../hooks"
import {
  MARK_LABEL,
  canEditText,
  compactCount,
  fullCount,
  fullDate,
  hashtagPath,
  isAuthor,
  noteMediaPath,
  profilePath,
  quotesPath,
  shortAge,
  statusPath,
  type Note,
  type VerificationMark,
} from "../model"
import { bubbleText, childReplyPlacement, echoesLabel, heartsLabel, isLongNote, metaLine, replyCountLabel, timelineBubbles, topicLine, viewRepliesLabel, type TopicLine } from "../look"
import { canVote, pollCountsVisible, pollPercent, pollTimeLeft, repostMenu, shareMenu } from "../v2"
import { useEchoActions } from "./EchoActions"
import { MenuButton, type MenuItem } from "./Menu"
import { NoteText } from "./NoteText"
import { useTrackView } from "./ViewTracking"

/*
  Echo look v3, "serif conversation cards" (docs/designs/echo-look-v3.md).
  A note is a rounded card: the topic line on top in ember, the words in
  the serif, media / poll / quote inside, the author's signature below
  (no avatar column), up to two reply bubbles, then labelled pills —
  Reply, Echo it, the heart, More. Every action, route and rule is the one
  the X-style card had; only the look changed.
*/

const MARK_CLASS: Record<VerificationMark, string> = {
  none: "",
  person: "text-primary",
  official: "text-warning",
  government: "text-muted-foreground",
}

export function VerifiedMark({ mark, small = false }: { mark: VerificationMark; small?: boolean }) {
  if (mark === "none") return null
  return (
    <span title={MARK_LABEL[mark]} aria-label={MARK_LABEL[mark]} className={`inline-flex shrink-0 ${MARK_CLASS[mark]}`} data-mark={mark}>
      <BadgeCheck className={small ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
    </span>
  )
}

const authorName = (note: Pick<Note, "author">) => note.author?.displayName || note.author?.username || "Someone"

/** Once the element has come near the screen, stays true. False wherever IntersectionObserver is missing (the server render). */
function useSeen(ref: RefObject<HTMLElement | null>): boolean {
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (seen || !el || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true)
          io.disconnect()
        }
      },
      { rootMargin: "200px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, seen])
  return seen
}

/** `#firsthashtag · 2h`, `Thread · 3 parts · 5h`, `Quote · 2h`, `Reply to @name · 2h`; the time alone in secondary text. */
export function TopicLineView({ note, topic }: { note: Pick<Note, "id" | "author" | "createdAt" | "editedAt">; topic: TopicLine }) {
  const tone = topic.accent ? "text-echo-accent" : "text-muted-foreground"
  return (
    <p className={`flex min-w-0 items-center gap-1 text-xs font-semibold ${tone}`} data-echo-topic={topic.kind}>
      {topic.kind === "hashtag" && topic.tag ? (
        <Link href={hashtagPath(topic.tag)} onClick={(e) => e.stopPropagation()} className="truncate hover:underline">
          {topic.lead}
        </Link>
      ) : (
        topic.lead && <span className="truncate">{topic.lead}</span>
      )}
      {topic.lead && topic.age && <span aria-hidden>·</span>}
      <Link href={statusPath(note)} onClick={(e) => e.stopPropagation()} className="shrink-0 hover:underline">
        <time dateTime={note.createdAt} title={fullDate(note.createdAt)}>
          {topic.age}
        </time>
      </Link>
      {note.editedAt && <span className="shrink-0 font-normal">· Edited</span>}
    </p>
  )
}

/**
 * The top of a timeline card: avatar, name and mark, then how long ago it
 * was posted ("· 2h", "· Edited"); the topic (#tag, Thread, Quote, Reply
 * to @x) sits at the right end in the accent. No @handle here.
 */
export function CardHeader({ note, topic }: { note: Pick<Note, "id" | "author" | "authorId" | "createdAt" | "editedAt">; topic: TopicLine }) {
  const a = note.author
  const name = authorName(note)
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm" data-echo-card-header>
      <Link href={profilePath(a, note.authorId)} onClick={(e) => e.stopPropagation()} aria-label={name} className="shrink-0">
        <Avatar src={a?.avatarUrl} name={name} className="h-6 w-6" />
      </Link>
      <Link href={profilePath(a, note.authorId)} onClick={(e) => e.stopPropagation()} className="truncate font-semibold text-brand-text hover:underline" data-echo-author>
        {name}
      </Link>
      <VerifiedMark mark={a?.mark ?? "none"} small />
      <Link href={statusPath(note)} onClick={(e) => e.stopPropagation()} className="shrink-0 text-muted-foreground hover:underline" data-echo-age>
        <span aria-hidden>· </span>
        <time dateTime={note.createdAt} title={fullDate(note.createdAt)}>
          {topic.age}
        </time>
      </Link>
      {note.editedAt && <span className="shrink-0 text-xs text-muted-foreground">· Edited</span>}
      {topic.lead && (
        <span className="ml-auto min-w-0 shrink truncate text-xs font-semibold text-echo-accent" data-echo-topic={topic.kind}>
          {topic.kind === "hashtag" && topic.tag ? (
            <Link href={hashtagPath(topic.tag)} onClick={(e) => e.stopPropagation()} className="hover:underline">
              {topic.lead}
            </Link>
          ) : (
            topic.lead
          )}
        </span>
      )}
    </div>
  )
}

/** A small avatar and the name, then @handle and the mark in secondary text. */
export function Signature({ note, right, className = "mt-3" }: { note: Pick<Note, "author" | "authorId">; right?: React.ReactNode; className?: string }) {
  const a = note.author
  const name = authorName(note)
  return (
    <div className={`flex min-w-0 items-center gap-2 text-sm ${className}`} data-echo-signature>
      <Link href={profilePath(a, note.authorId)} onClick={(e) => e.stopPropagation()} aria-label={name} className="shrink-0">
        <Avatar src={a?.avatarUrl} name={name} className="h-5 w-5" />
      </Link>
      <Link href={profilePath(a, note.authorId)} onClick={(e) => e.stopPropagation()} className="truncate font-semibold text-brand-text hover:underline">
        {name}
      </Link>
      {a?.username && <span className="truncate text-muted-foreground">@{a.username}</span>}
      <VerifiedMark mark={a?.mark ?? "none"} small />
      {right && <div className="ml-auto shrink-0">{right}</div>}
    </div>
  )
}

/** Up to 4 images in a grid, or one GIF, inside the card at radius 12. */
export function NoteMediaGrid({ note }: { note: Pick<Note, "media"> }) {
  if (note.media.length === 0) return null
  const cols = note.media.length === 1 ? "grid-cols-1" : "grid-cols-2"
  return (
    <div className={`mt-3 grid gap-0.5 overflow-hidden rounded-echo-inner border border-border ${cols}`}>
      {note.media.map((m) => {
        const src = m.isGif ? noteMediaPath(m.mediaId) : resolveImageUrl(noteMediaPath(m.mediaId), { dataSaver: false, size: note.media.length === 1 ? "large" : "medium" })
        return (
          <div key={m.mediaId} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={m.altText}
              loading="lazy"
              onError={onImageError}
              className={`w-full bg-brand-secondary object-cover ${note.media.length === 1 ? "max-h-[32rem]" : "aspect-square"}`}
            />
            {m.isGif && <span className="absolute bottom-2 left-2 rounded bg-brand-text/70 px-1.5 text-xs font-bold text-brand-bg">GIF</span>}
          </div>
        )
      })}
    </div>
  )
}

/**
 * A poll (contract §1). Before the viewer may see counts it is a set of
 * choices to vote on; after voting, once closed, or for the author it is
 * bars with percentages. Counts the server withholds (null) are never drawn.
 */
export function PollView({ note }: { note: Note }) {
  const actions = useEchoActions()
  const poll = note.poll
  if (!poll) return null
  const showCounts = pollCountsVisible(note, actions.viewerId)
  const votable = canVote(note, actions.viewerId)
  const votes = `${fullCount(poll.totalVotes)} ${poll.totalVotes === 1 ? "vote" : "votes"}`
  const leader = showCounts ? Math.max(...poll.options.map((o) => o.votes ?? 0)) : -1
  return (
    <div className="mt-3 space-y-2" data-echo-poll data-poll-counts={showCounts ? "shown" : "hidden"} onClick={(e) => e.stopPropagation()}>
      {poll.options.map((o) =>
        showCounts ? (
          <div key={o.index} className="relative overflow-hidden rounded-echo-inner bg-brand-secondary" data-poll-option={o.index}>
            <div className={`absolute inset-y-0 left-0 ${o.votes === leader ? "bg-echo-accent-tint" : "bg-border"}`} style={{ width: `${pollPercent(o.votes, poll.totalVotes)}%` }} aria-hidden />
            <div className="relative flex items-center justify-between px-3 py-2 text-sm text-brand-text">
              <span className={`flex items-center gap-1.5 ${o.votes === leader ? "font-bold" : ""}`}>
                {o.label}
                {poll.viewerVote === o.index && <Check className="h-4 w-4 text-echo-accent" aria-label="Your vote" />}
              </span>
              <span className={o.votes === leader ? "font-bold" : ""} data-poll-percent>
                {pollPercent(o.votes, poll.totalVotes)}%
              </span>
            </div>
          </div>
        ) : (
          <button
            key={o.index}
            type="button"
            data-poll-option={o.index}
            disabled={!votable && !!actions.viewerId}
            onClick={() => actions.vote(note, o.index)}
            className="w-full rounded-echo-inner border border-border bg-brand-secondary px-4 py-2 text-left text-sm font-semibold text-brand-text hover:border-echo-accent hover:bg-echo-accent-tint disabled:opacity-60"
          >
            {o.label}
          </button>
        ),
      )}
      <p className="text-xs text-muted-foreground">
        {votes} · {pollTimeLeft(poll)}
      </p>
    </div>
  )
}

/** The quoted note inside a quote: a smaller nested serif card, one level, no actions. A gone quote says so. */
export function QuotedNote({ note, quoteOfId }: { note: Note | null; quoteOfId: string | null }) {
  const router = useRouter()
  if (!quoteOfId) return null
  if (!note) {
    return <div className="mt-3 rounded-echo-inner border border-border bg-brand-secondary px-3 py-2.5 text-sm text-muted-foreground">This post is unavailable.</div>
  }
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        router.push(statusPath(note))
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(statusPath(note))
      }}
      className="mt-3 cursor-pointer rounded-echo-inner border border-border bg-brand-secondary/60 p-3 hover:border-echo-accent"
      data-quoted-note={note.id}
    >
      <div className="mb-1.5 flex min-w-0 items-center gap-1.5 text-xs">
        <Avatar src={note.author?.avatarUrl} name={authorName(note)} className="h-4 w-4" />
        <span className="truncate font-semibold text-brand-text">{authorName(note)}</span>
        <VerifiedMark mark={note.author?.mark ?? "none"} small />
        <span className="shrink-0 text-muted-foreground">· {shortAge(note.createdAt)}</span>
      </div>
      <NoteText text={note.text} size="quote" />
      <NoteMediaGrid note={note} />
    </div>
  )
}

/** The Echo it menu: Re-echo (or Undo re-echo) and Quote. Keys and actions are the repost menu's. */
export function repostMenuItems(note: Note, onRepost: () => void, onQuote: () => void): MenuItem[] {
  return repostMenu(note).map((o) => ({
    key: o.key,
    label: o.key === "repost" ? (note.reposted ? "Undo re-echo" : "Re-echo") : o.label,
    icon: o.key === "repost" ? <Repeat2 className="h-5 w-5" /> : <PenLine className="h-5 w-5" />,
    onSelect: o.key === "repost" ? onRepost : onQuote,
  }))
}

/** The share items: Copy link, and Send via Chat when signed in. */
export function shareMenuItems(signedIn: boolean, onCopy: () => void, onChat: () => void): MenuItem[] {
  return shareMenu(signedIn).map((o) => ({
    key: o.key,
    label: o.label,
    icon: o.key === "copy" ? <Link2 className="h-5 w-5" /> : <MessageSquareShare className="h-5 w-5" />,
    onSelect: o.key === "copy" ? onCopy : onChat,
  }))
}

function useRelationship(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["echo", "relationship", userId],
    queryFn: async () => relationshipFromGraph(((await api.get("/v1/graph/relationship", { params: { other_id: userId } })).data?.data ?? null) as Record<string, unknown> | null),
    enabled: enabled && !!userId,
    staleTime: 30_000,
    retry: false,
  })
}

const PILL = "inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-brand-secondary"

function Pill({
  label,
  active = false,
  tone = "plain",
  onClick,
  children,
  testId,
}: {
  label: string
  active?: boolean
  tone?: "plain" | "danger" | "success" | "accent"
  onClick?: () => void
  children: React.ReactNode
  testId?: string
}) {
  const on = tone === "danger" ? "border-danger/40 text-danger" : tone === "success" ? "border-success/40 text-success" : tone === "accent" ? "border-echo-accent text-echo-accent" : "text-brand-text"
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      data-echo-pill={testId}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className={`${PILL} ${active ? on : "text-brand-text"}`}
    >
      {children}
    </button>
  )
}

/**
 * More (…): Save, Copy link and Send via Chat for everyone the share menu
 * allows, then the author's items (Edit, View post activity, Delete) or a
 * stranger's (Not interested, Follow, Mute, Block, Report). With `echo`, the
 * Re-echo and Quote items too (the note page's reply bubbles carry no Echo it pill).
 */
function useMoreItems(note: Note, opened: boolean, echo: boolean): MenuItem[] {
  const actions = useEchoActions()
  const own = isAuthor(note, actions.viewerId)
  const rel = useRelationship(note.authorId, opened && !own && !!actions.viewerId)
  const handle = note.author?.username ? `@${note.author.username}` : "this account"
  const head: MenuItem[] = [
    ...(echo ? repostMenuItems(note, () => actions.repost(note), () => actions.quote(note)) : []),
    { key: "bookmark", label: note.bookmarked ? "Remove from Saved" : "Save", icon: <Bookmark className={`h-5 w-5 ${note.bookmarked ? "fill-current" : ""}`} />, onSelect: () => actions.bookmark(note) },
    ...shareMenuItems(!!actions.viewerId, () => actions.copyLink(note), () => actions.sendViaChat(note)),
  ]
  if (!actions.viewerId) return head
  const tail: MenuItem[] = own
    ? [
        { key: "edit", label: canEditText(note, actions.viewerId) ? "Edit" : "Change who can reply", icon: <Pencil className="h-5 w-5" />, onSelect: () => actions.edit(note) },
        { key: "activity", label: "View post activity", icon: <BarChart2 className="h-5 w-5" />, onSelect: () => actions.activity(note) },
        { key: "delete", label: "Delete", icon: <Trash2 className="h-5 w-5" />, danger: true, onSelect: () => actions.remove(note) },
      ]
    : [
        { key: "not-interested", label: "Not interested in this post", icon: <Frown className="h-5 w-5" />, onSelect: () => actions.notInterested(note) },
        ...(rel.data
          ? [
              rel.data.following
                ? { key: "unfollow", label: `Unfollow ${handle}`, icon: <UserMinus className="h-5 w-5" />, onSelect: () => actions.follow(note, false) }
                : { key: "follow", label: `Follow ${handle}`, icon: <UserPlus className="h-5 w-5" />, onSelect: () => actions.follow(note, true) },
            ]
          : []),
        { key: "mute", label: `Mute ${handle}`, icon: <VolumeX className="h-5 w-5" />, onSelect: () => actions.mute(note) },
        { key: "block", label: `Block ${handle}`, icon: <Ban className="h-5 w-5" />, onSelect: () => actions.block(note) },
        { key: "report", label: "Report post", icon: <Flag className="h-5 w-5" />, danger: true, onSelect: () => actions.report(note) },
      ]
  return [...head, ...tail]
}

function MoreMenu({ note, initialOpen = false, echo = false, small = false }: { note: Note; initialOpen?: boolean; echo?: boolean; small?: boolean }) {
  const [opened, setOpened] = useState(initialOpen)
  const items = useMoreItems(note, opened, echo)
  return (
    <MenuButton
      label="More"
      items={items}
      initialOpen={initialOpen}
      onOpen={() => setOpened(true)}
      className={small ? "rounded-full p-1 text-muted-foreground hover:bg-brand-secondary hover:text-brand-text" : `${PILL} text-brand-text`}
      buttonProps={{ "data-echo-pill": "more" } as React.ButtonHTMLAttributes<HTMLButtonElement>}
    >
      <Ellipsis className="h-4 w-4" aria-hidden />
    </MenuButton>
  )
}

/** The Echo it pill: the repost / quote menu. */
function EchoItPill({ note, initialOpen, children }: { note: Note; initialOpen: boolean; children: React.ReactNode }) {
  const actions = useEchoActions()
  return (
    <MenuButton
      label="Echo it"
      align="left"
      initialOpen={initialOpen}
      items={repostMenuItems(note, () => actions.repost(note), () => actions.quote(note))}
      buttonProps={{ "aria-pressed": note.reposted, "data-echo-pill": "echo" } as React.ButtonHTMLAttributes<HTMLButtonElement>}
      className={`${PILL} ${note.reposted ? "border-success/40 text-success" : "text-brand-text"}`}
    >
      <Repeat2 className="h-4 w-4" aria-hidden />
      {children}
    </MenuButton>
  )
}

/**
 * Labelled pills. Timeline: Reply, Echo it, heart + count, More, and the
 * views to the right (they open the note page, as the views button did).
 * Note page (`big`): `42 hearts`, `3 echoes`, `Save`, Reply, More.
 */
export function ActionBar({ note, big = false, initialMenu }: { note: Note; big?: boolean; initialMenu?: "repost" | "more" }) {
  const actions = useEchoActions()
  const router = useRouter()
  const heart = <Heart className={`h-4 w-4 ${note.liked ? "fill-current" : ""}`} aria-hidden />
  if (big) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-2" data-echo-action-bar="big">
        <Pill label={note.liked ? "Unlike" : "Like"} active={note.liked} tone="danger" onClick={() => actions.like(note)} testId="heart">
          {heart} {heartsLabel(note.likeCount)}
        </Pill>
        <EchoItPill note={note} initialOpen={initialMenu === "repost"}>
          {echoesLabel(note)}
        </EchoItPill>
        <Pill label={note.bookmarked ? "Remove from Saved" : "Save"} active={note.bookmarked} tone="accent" onClick={() => actions.bookmark(note)} testId="save">
          <Bookmark className={`h-4 w-4 ${note.bookmarked ? "fill-current" : ""}`} aria-hidden />
          {note.bookmarked ? "Saved" : "Save"}
          {note.bookmarkCount > 0 && <span className="tabular-nums text-muted-foreground">{compactCount(note.bookmarkCount)}</span>}
        </Pill>
        <Pill label={`${note.replyCount} Replies. Reply`} onClick={() => actions.reply(note)} testId="reply">
          <MessageCircle className="h-4 w-4" aria-hidden /> Reply
        </Pill>
        <MoreMenu note={note} initialOpen={initialMenu === "more"} />
      </div>
    )
  }
  const echoes = note.repostCount + note.quoteCount
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2" data-echo-action-bar>
      <Pill label={`${note.replyCount} Replies. Reply`} onClick={() => actions.reply(note)} testId="reply">
        <MessageCircle className="h-4 w-4" aria-hidden /> Reply
      </Pill>
      <EchoItPill note={note} initialOpen={initialMenu === "repost"}>
        Echo it{echoes > 0 && <span className="tabular-nums text-muted-foreground">{compactCount(echoes)}</span>}
      </EchoItPill>
      <Pill label={note.liked ? "Unlike" : "Like"} active={note.liked} tone="danger" onClick={() => actions.like(note)} testId="heart">
        {heart}
        {note.likeCount > 0 && <span className="tabular-nums">{compactCount(note.likeCount)}</span>}
      </Pill>
      <MoreMenu note={note} initialOpen={initialMenu === "more"} />
      {note.viewCount > 0 && (
        <button
          type="button"
          aria-label={`${note.viewCount} views. View post analytics`}
          onClick={(e) => {
            e.stopPropagation()
            router.push(statusPath(note))
          }}
          className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-brand-text"
        >
          <BarChart2 className="h-3.5 w-3.5" aria-hidden /> {compactCount(note.viewCount)}
        </button>
      )}
    </div>
  )
}

/**
 * Up to two top replies as chat bubbles inside a timeline card, then
 * "N replies" to the note page. Nothing at all when there are none.
 */
export function ReplyBubbles({ note, replies }: { note: Note; replies: readonly Note[] }) {
  const { bubbles } = timelineBubbles(note, replies)
  if (bubbles.length === 0) return null
  return (
    <div className="mt-3 space-y-1.5" data-echo-reply-bubbles>
      {bubbles.map((r) => (
        <Link
          key={r.id}
          href={statusPath(r)}
          onClick={(e) => e.stopPropagation()}
          data-echo-reply-bubble={r.id}
          className="block truncate rounded-echo-inner bg-brand-secondary px-3 py-1.5 text-sm text-brand-text hover:bg-border"
        >
          <b className="font-semibold">{authorName(r)}</b> <span>{bubbleText(r)}</span>
        </Link>
      ))}
      {note.replyCount > 0 && (
        <Link href={statusPath(note)} onClick={(e) => e.stopPropagation()} data-echo-replies-link className="inline-block px-1 text-xs text-muted-foreground hover:underline">
          {replyCountLabel(note.replyCount)}
        </Link>
      )}
    </div>
  )
}

/** One note as a card on any list: topic line, serif words, media / poll / quote, signature, reply bubbles, pills. */
export function NoteCard({
  note,
  threadLine = false,
  bubbles = true,
  replyToHandle,
  threadPart = false,
}: {
  note: Note
  /** A later part of the author's own thread on the note page: its topic line says Thread. */
  threadPart?: boolean
  /** The note page's earlier thread parts: a thin ember line joins this card to the next. */
  threadLine?: boolean
  /** Fetch and show the first replies as bubbles (timeline lists). */
  bubbles?: boolean
  /** Who a reply answers, when the list already knows it (null: unknown, do not look it up). */
  replyToHandle?: string | null
}) {
  const router = useRouter()
  const ref = useRef<HTMLElement>(null)
  useTrackView(ref, note.id)
  const seen = useSeen(ref)
  const top = useTopReplies(note.id, bubbles && seen && note.replyCount > 0)
  // A reply's topic line names who it answers: the parent note, read once it is on screen (the existing note call, cached).
  const parent = useNote(note.replyToId ?? "", seen && !!note.replyToId && !threadPart && replyToHandle === undefined)
  const replies = top.data?.items ?? []
  // The server counts a thread's parts on its first note; the replies only hint at one.
  const thread = timelineBubbles(note, replies).thread || note.threadParts > 1
  const topic = topicLine(note, { thread, threadParts: note.threadParts, threadPart, replyToHandle: replyToHandle ?? parent.data?.author?.username ?? null })
  return (
    <>
      <article
        ref={ref}
        data-note-id={note.id}
        onClick={() => router.push(statusPath(note))}
        className="cursor-pointer rounded-echo-card border border-border bg-brand-card p-3.5 transition-colors hover:border-echo-accent/40"
      >
        <CardHeader note={note} topic={topic} />
        <NoteText text={note.text} size={isLongNote(note.text) ? "long" : "timeline"} className="mt-2" />
        <NoteMediaGrid note={note} />
        <PollView note={note} />
        <QuotedNote note={note.quoted} quoteOfId={note.quoteOfId} />
        {thread && (
          <Link href={statusPath(note)} onClick={(e) => e.stopPropagation()} data-echo-read-thread className="mt-2 inline-block text-xs font-semibold text-echo-accent hover:underline">
            Read the thread
          </Link>
        )}
        {bubbles && <ReplyBubbles note={note} replies={replies} />}
        <ActionBar note={note} />
      </article>
      {threadLine && <span className="mx-auto block h-3 w-0.5 bg-echo-accent" aria-hidden data-echo-thread-line />}
    </>
  )
}

/** The follow pill beside the note page's signature; nothing for the author or a signed-out reader. */
function FollowPill({ note }: { note: Note }) {
  const actions = useEchoActions()
  const own = isAuthor(note, actions.viewerId)
  const rel = useRelationship(note.authorId, !!actions.viewerId && !own)
  if (!actions.viewerId || own || !rel.data) return null
  const following = rel.data.following
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        actions.follow(note, !following)
      }}
      data-echo-follow={following ? "following" : "follow"}
      className={
        following
          ? "rounded-full border border-border px-3 py-1 text-xs font-semibold text-brand-text hover:border-danger hover:text-danger"
          : "rounded-full bg-echo-accent px-3 py-1 text-xs font-semibold text-echo-on-accent hover:bg-echo-accent-hover"
      }
    >
      {following ? "Following" : "Follow"}
    </button>
  )
}

/** The note page's note: a larger card with an ember border, `#tag · 2:14 pm · 1.2k views`, the 22px serif, signature + Follow, count pills. */
export function BigNote({ note }: { note: Note }) {
  const ref = useRef<HTMLElement>(null)
  useTrackView(ref, note.id)
  const meta = metaLine(note)
  return (
    <article ref={ref} data-note-id={note.id} data-big-note className="rounded-echo-card border-2 border-echo-accent bg-brand-card p-4">
      <Signature note={note} right={<FollowPill note={note} />} className="" />
      <p className="mt-1.5 flex flex-wrap items-center gap-x-1 text-xs font-semibold text-echo-accent" data-echo-full-date>
        {meta.tag && (
          <>
            <Link href={hashtagPath(meta.tag)} className="hover:underline">
              #{meta.tag}
            </Link>
            <span aria-hidden>·</span>
          </>
        )}
        <time dateTime={note.createdAt} title={fullDate(note.createdAt)}>
          {meta.time}
        </time>
        {note.editedAt && <span>· Edited</span>}
        <span aria-hidden>·</span>
        <span>{meta.views}</span>
      </p>
      <NoteText text={note.text} size="lead" className="mt-2" />
      <NoteMediaGrid note={note} />
      <PollView note={note} />
      <QuotedNote note={note.quoted} quoteOfId={note.quoteOfId} />
      {note.quoteCount > 0 && (
        <Link href={quotesPath(note)} className="mt-3 inline-block text-xs font-semibold text-muted-foreground hover:underline">
          {fullCount(note.quoteCount)} {note.quoteCount === 1 ? "quote" : "quotes"}
        </Link>
      )}
      <ActionBar note={note} big />
    </article>
  )
}

/**
 * A reply on the note page: a small avatar beside a bubble (bold name and
 * the words, its media, poll or quote), then `Heart · Reply · 1h` and More.
 * One step in for a reply to a reply, two at most; deeper says who it answers.
 */
export function ReplyBubble({ note, depth = 0, replyingTo = null }: { note: Note; depth?: number; replyingTo?: string | null }) {
  const actions = useEchoActions()
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  useTrackView(ref, note.id)
  const a = note.author
  const name = authorName(note)
  const indent = depth >= 2 ? "ml-16" : depth === 1 ? "ml-8" : ""
  return (
    <div ref={ref} className={`flex gap-2 ${indent}`} data-note-id={note.id} data-echo-reply-depth={depth}>
      <Link href={profilePath(a, note.authorId)} aria-label={name} className="mt-1 shrink-0">
        <Avatar src={a?.avatarUrl} name={name} className="h-7 w-7" />
      </Link>
      <div className="min-w-0 flex-1">
        <div
          role="link"
          tabIndex={0}
          onClick={() => router.push(statusPath(note))}
          onKeyDown={(e) => {
            if (e.key === "Enter") router.push(statusPath(note))
          }}
          className="cursor-pointer rounded-echo-inner bg-brand-secondary px-3 py-2"
        >
          <p className="flex min-w-0 items-center gap-1 text-sm">
            <Link href={profilePath(a, note.authorId)} onClick={(e) => e.stopPropagation()} className="truncate font-bold text-brand-text hover:underline">
              {name}
            </Link>
            <VerifiedMark mark={a?.mark ?? "none"} small />
            {a?.username && <span className="truncate text-xs text-muted-foreground">@{a.username}</span>}
          </p>
          {replyingTo && <p className="text-xs text-muted-foreground">Replying to @{replyingTo}</p>}
          <NoteText text={note.text} size="quote" className="mt-0.5" />
          <NoteMediaGrid note={note} />
          <PollView note={note} />
          <QuotedNote note={note.quoted} quoteOfId={note.quoteOfId} />
        </div>
        <div className="mt-1 flex items-center gap-2 px-1 text-xs text-muted-foreground" data-echo-reply-actions>
          <button
            type="button"
            aria-label={note.liked ? "Unlike" : "Like"}
            aria-pressed={note.liked}
            onClick={() => actions.like(note)}
            className={`inline-flex items-center gap-1 font-semibold hover:text-danger ${note.liked ? "text-danger" : ""}`}
          >
            <Heart className={`h-3.5 w-3.5 ${note.liked ? "fill-current" : ""}`} aria-hidden /> Heart
            {note.likeCount > 0 && <span className="tabular-nums">{compactCount(note.likeCount)}</span>}
          </button>
          <span aria-hidden>·</span>
          <button type="button" aria-label={`${note.replyCount} Replies. Reply`} onClick={() => actions.reply(note)} className="font-semibold hover:text-brand-text">
            Reply{note.replyCount > 0 && <span className="ml-1 tabular-nums">{compactCount(note.replyCount)}</span>}
          </button>
          <span aria-hidden>·</span>
          <Link href={statusPath(note)} className="hover:underline">
            <time dateTime={note.createdAt} title={fullDate(note.createdAt)}>
              {shortAge(note.createdAt)}
            </time>
          </Link>
          {note.editedAt && <span>· Edited</span>}
          <span className="ml-auto">
            <MoreMenu note={note} echo small />
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * A reply on the note page with its own replies one tap away: "View N
 * replies" loads them under it (the same cached replies list the reply's
 * own page uses, so likes, edits and new replies show here too), one step
 * further in, flat with "Replying to @x" past the second step.
 */
export function ReplyThread({ note, depth = 0, replyingTo = null }: { note: Note; depth?: number; replyingTo?: string | null }) {
  const [open, setOpen] = useState(false)
  const children = useReplies(note.id, open)
  const kids = flattenPages(children.data)
  const place = childReplyPlacement(depth, note.author?.username)
  const indent = place.depth >= 2 ? "ml-16" : place.depth === 1 ? "ml-8" : ""
  const link = "text-xs font-semibold text-echo-accent hover:underline disabled:opacity-60"
  return (
    <div data-echo-reply-thread={note.id}>
      <ReplyBubble note={note} depth={depth} replyingTo={replyingTo} />
      {!open && note.replyCount > 0 && (
        <div className={`mt-1.5 pl-9 ${depth >= 2 ? "ml-16" : depth === 1 ? "ml-8" : ""}`}>
          <button type="button" onClick={() => setOpen(true)} className={link} data-echo-view-replies={note.id}>
            {viewRepliesLabel(note.replyCount)}
          </button>
        </div>
      )}
      {open && (
        <div className="mt-3 space-y-3" data-echo-child-replies={note.id}>
          {kids.map((k) => (
            <ReplyThread key={k.id} note={k} depth={place.depth} replyingTo={place.replyingTo} />
          ))}
          {children.isLoading && <p className={`pl-9 text-xs text-muted-foreground ${indent}`}>Loading replies…</p>}
          {children.isError && (
            <p className={`pl-9 ${indent}`}>
              <button type="button" onClick={() => void children.refetch()} className={link}>
                Couldn&apos;t load replies. Try again
              </button>
            </p>
          )}
          {children.hasNextPage && (
            <p className={`pl-9 ${indent}`}>
              <button type="button" disabled={children.isFetchingNextPage} onClick={() => void children.fetchNextPage()} className={link} data-echo-more-replies={note.id}>
                Show more replies
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
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
  Share,
  Trash2,
  UserMinus,
  UserPlus,
  VolumeX,
} from "lucide-react"

import Avatar from "@/components/ui/Avatar"
import api from "@/lib/api"
import { relationshipFromGraph } from "@/lib/graphApi"
import { onImageError, resolveImageUrl } from "@/lib/imageUrl"

import {
  MARK_LABEL,
  canEditText,
  compactCount,
  fullCount,
  fullDate,
  isAuthor,
  noteMediaPath,
  profilePath,
  quotesPath,
  shortAge,
  statusPath,
  type Note,
  type VerificationMark,
} from "../model"
import { canVote, pollCountsVisible, pollPercent, pollTimeLeft, repostMenu, shareMenu } from "../v2"
import { useEchoActions } from "./EchoActions"
import { MenuButton, type MenuItem } from "./Menu"
import { NoteText } from "./NoteText"
import { useTrackView } from "./ViewTracking"

const MARK_CLASS: Record<VerificationMark, string> = {
  none: "",
  person: "text-primary",
  official: "text-warning",
  government: "text-muted-foreground",
}

export function VerifiedMark({ mark }: { mark: VerificationMark }) {
  if (mark === "none") return null
  return (
    <span title={MARK_LABEL[mark]} aria-label={MARK_LABEL[mark]} className={`inline-flex shrink-0 ${MARK_CLASS[mark]}`} data-mark={mark}>
      <BadgeCheck className="h-[18px] w-[18px]" aria-hidden />
    </span>
  )
}

function AuthorLine({ note, compact = false }: { note: Note; compact?: boolean }) {
  const a = note.author
  const name = a?.displayName || a?.username || "Someone"
  return (
    <div className="flex min-w-0 items-center gap-1 text-base">
      <Link href={profilePath(a, note.authorId)} className="truncate font-bold text-brand-text hover:underline" onClick={(e) => e.stopPropagation()}>
        {name}
      </Link>
      <VerifiedMark mark={a?.mark ?? "none"} />
      {a?.username && <span className="truncate text-muted-foreground">@{a.username}</span>}
      <span className="text-muted-foreground" aria-hidden>
        ·
      </span>
      <Link href={statusPath(note)} onClick={(e) => e.stopPropagation()} className="shrink-0 text-muted-foreground hover:underline">
        <time dateTime={note.createdAt} title={fullDate(note.createdAt)}>
          {shortAge(note.createdAt)}
        </time>
      </Link>
      {note.editedAt && !compact && <span className="shrink-0 text-muted-foreground">· Edited</span>}
    </div>
  )
}

/** Up to 4 images in a grid, or one GIF. */
export function NoteMediaGrid({ note }: { note: Pick<Note, "media"> }) {
  if (note.media.length === 0) return null
  const cols = note.media.length === 1 ? "grid-cols-1" : "grid-cols-2"
  return (
    <div className={`mt-3 grid gap-0.5 overflow-hidden rounded-2xl border border-border ${cols}`}>
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
          <div key={o.index} className="relative overflow-hidden rounded-md" data-poll-option={o.index}>
            <div className={`absolute inset-y-0 left-0 rounded-md ${o.votes === leader ? "bg-primary/30" : "bg-brand-secondary"}`} style={{ width: `${pollPercent(o.votes, poll.totalVotes)}%` }} aria-hidden />
            <div className="relative flex items-center justify-between px-3 py-1.5 text-base text-brand-text">
              <span className={`flex items-center gap-1.5 ${o.votes === leader ? "font-bold" : ""}`}>
                {o.label}
                {poll.viewerVote === o.index && <Check className="h-4 w-4" aria-label="Your vote" />}
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
            className="w-full rounded-full border border-primary px-4 py-1.5 text-center text-base font-bold text-primary-ink hover:bg-primary-tint disabled:opacity-60"
          >
            {o.label}
          </button>
        ),
      )}
      <p className="text-sm text-muted-foreground">
        {votes} · {pollTimeLeft(poll)}
      </p>
    </div>
  )
}

/** The quoted note inside a quote: one level, no actions. A gone quote says so. */
export function QuotedNote({ note, quoteOfId }: { note: Note | null; quoteOfId: string | null }) {
  const router = useRouter()
  if (!quoteOfId) return null
  if (!note) {
    return <div className="mt-3 rounded-2xl border border-border bg-brand-secondary/40 px-4 py-3 text-sm text-muted-foreground">This post is unavailable.</div>
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
      className="mt-3 cursor-pointer rounded-2xl border border-border px-3 py-2.5 hover:bg-brand-secondary/50"
      data-quoted-note={note.id}
    >
      <div className="flex items-center gap-1.5">
        <Avatar src={note.author?.avatarUrl} name={note.author?.displayName || note.author?.username || "?"} className="h-5 w-5" />
        <AuthorLine note={note} compact />
      </div>
      <NoteText text={note.text} className="mt-1 text-base" />
      <NoteMediaGrid note={note} />
    </div>
  )
}

function ActionButton({
  label,
  count,
  active = false,
  tone,
  onClick,
  children,
}: {
  label: string
  count?: number
  active?: boolean
  tone: "primary" | "success" | "danger"
  onClick?: () => void
  children: React.ReactNode
}) {
  const hover = tone === "success" ? "group-hover:bg-success/10 group-hover:text-success" : tone === "danger" ? "group-hover:bg-danger/10 group-hover:text-danger" : "group-hover:bg-primary-tint group-hover:text-primary"
  const on = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-primary"
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className={`group flex min-w-0 items-center text-sm ${active ? on : "text-muted-foreground"}`}
    >
      <span className={`rounded-full p-2 transition-colors ${hover}`}>{children}</span>
      {count !== undefined && <span className={`-ml-0.5 min-w-[1ch] tabular-nums ${active ? "" : "group-hover:" + on}`}>{compactCount(count)}</span>}
    </button>
  )
}

/** The repost menu items: Repost (or Undo repost) and Quote. */
export function repostMenuItems(note: Note, onRepost: () => void, onQuote: () => void): MenuItem[] {
  return repostMenu(note).map((o) => ({
    key: o.key,
    label: o.label,
    icon: o.key === "repost" ? <Repeat2 className="h-5 w-5" /> : <PenLine className="h-5 w-5" />,
    onSelect: o.key === "repost" ? onRepost : onQuote,
  }))
}

/** The share menu items: Copy link, and Send via Chat when signed in. */
export function shareMenuItems(signedIn: boolean, onCopy: () => void, onChat: () => void): MenuItem[] {
  return shareMenu(signedIn).map((o) => ({
    key: o.key,
    label: o.label,
    icon: o.key === "copy" ? <Link2 className="h-5 w-5" /> : <MessageSquareShare className="h-5 w-5" />,
    onSelect: o.key === "copy" ? onCopy : onChat,
  }))
}

/** Reply, repost (menu), like, views, then bookmark and share (menu). */
export function ActionBar({ note, big = false, initialMenu }: { note: Note; big?: boolean; initialMenu?: "repost" | "share" }) {
  const actions = useEchoActions()
  const router = useRouter()
  const icon = big ? "h-[22px] w-[22px]" : "h-[18px] w-[18px]"
  return (
    <div className={`flex items-center justify-between ${big ? "border-y border-border py-1" : "-ml-2 mt-1 max-w-[34rem]"}`} data-echo-action-bar>
      <ActionButton label={`${note.replyCount} Replies. Reply`} count={note.replyCount} tone="primary" onClick={() => actions.reply(note)}>
        <MessageCircle className={icon} />
      </ActionButton>
      <MenuButton
        label={note.reposted ? "Undo repost or quote" : "Repost or quote"}
        align="left"
        initialOpen={initialMenu === "repost"}
        items={repostMenuItems(note, () => actions.repost(note), () => actions.quote(note))}
        buttonProps={{ "aria-pressed": note.reposted } as React.ButtonHTMLAttributes<HTMLButtonElement>}
        className={`group flex items-center text-sm ${note.reposted ? "text-success" : "text-muted-foreground"}`}
      >
        <span className="rounded-full p-2 transition-colors group-hover:bg-success/10 group-hover:text-success">
          <Repeat2 className={icon} />
        </span>
        <span className="-ml-0.5 min-w-[1ch] tabular-nums">{compactCount(note.repostCount + note.quoteCount)}</span>
      </MenuButton>
      <ActionButton label={note.liked ? "Unlike" : "Like"} count={note.likeCount} active={note.liked} tone="danger" onClick={() => actions.like(note)}>
        <Heart className={`${icon} ${note.liked ? "fill-current" : ""}`} />
      </ActionButton>
      {!big && (
        <ActionButton label={`${note.viewCount} views. View post analytics`} count={note.viewCount} tone="primary" onClick={() => router.push(statusPath(note))}>
          <BarChart2 className={icon} />
        </ActionButton>
      )}
      <div className="flex items-center">
        <ActionButton label={note.bookmarked ? "Remove bookmark" : "Bookmark"} active={note.bookmarked} tone="primary" onClick={() => actions.bookmark(note)}>
          <Bookmark className={`${icon} ${note.bookmarked ? "fill-current" : ""}`} />
        </ActionButton>
        <MenuButton
          label="Share post"
          initialOpen={initialMenu === "share"}
          items={shareMenuItems(!!actions.viewerId, () => actions.copyLink(note), () => actions.sendViaChat(note))}
          className="group flex items-center text-muted-foreground"
        >
          <span className="rounded-full p-2 transition-colors group-hover:bg-primary-tint group-hover:text-primary">
            <Share className={icon} />
          </span>
        </MenuButton>
      </div>
    </div>
  )
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

/** ··· : Not interested, Follow/Unfollow, Mute, Block, View post activity (author), Copy link, Report. */
function NoteMenu({ note }: { note: Note }) {
  const actions = useEchoActions()
  const [opened, setOpened] = useState(false)
  const own = isAuthor(note, actions.viewerId)
  const rel = useRelationship(note.authorId, opened && !own && !!actions.viewerId)
  if (!actions.viewerId) return null
  const handle = note.author?.username ? `@${note.author.username}` : "this account"
  const items: MenuItem[] = own
    ? [
        { key: "edit", label: canEditText(note, actions.viewerId) ? "Edit" : "Change who can reply", icon: <Pencil className="h-5 w-5" />, onSelect: () => actions.edit(note) },
        { key: "delete", label: "Delete", icon: <Trash2 className="h-5 w-5" />, danger: true, onSelect: () => actions.remove(note) },
        { key: "activity", label: "View post activity", icon: <BarChart2 className="h-5 w-5" />, onSelect: () => actions.activity(note) },
        { key: "copy", label: "Copy link", icon: <Link2 className="h-5 w-5" />, onSelect: () => actions.copyLink(note) },
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
        { key: "copy", label: "Copy link", icon: <Link2 className="h-5 w-5" />, onSelect: () => actions.copyLink(note) },
        { key: "report", label: "Report post", icon: <Flag className="h-5 w-5" />, onSelect: () => actions.report(note) },
      ]
  return (
    <div className="ml-auto shrink-0">
      <MenuButton label="More" items={items} onOpen={() => setOpened(true)} className="-m-2 rounded-full p-2 text-muted-foreground hover:bg-primary-tint hover:text-primary">
        <Ellipsis className="h-[18px] w-[18px]" />
      </MenuButton>
    </div>
  )
}

/** One post in a list: avatar, author line, words, media or poll, the quoted post, the action bar. */
export function NoteCard({ note, threadLine = false }: { note: Note; threadLine?: boolean }) {
  const router = useRouter()
  const ref = useRef<HTMLElement>(null)
  useTrackView(ref, note.id)
  const a = note.author
  const name = a?.displayName || a?.username || "Someone"
  return (
    <article
      ref={ref}
      data-note-id={note.id}
      onClick={() => router.push(statusPath(note))}
      className="flex cursor-pointer gap-3 px-4 pt-3 transition-colors hover:bg-brand-secondary/40"
    >
      <div className="flex shrink-0 flex-col items-center">
        <Link href={profilePath(a, note.authorId)} onClick={(e) => e.stopPropagation()} aria-label={name}>
          <Avatar src={a?.avatarUrl} name={name} className="h-10 w-10" />
        </Link>
        {threadLine && <span className="mt-1 w-0.5 flex-1 bg-border" aria-hidden />}
      </div>
      <div className="min-w-0 flex-1 pb-2">
        <div className="flex items-start gap-2">
          <AuthorLine note={note} />
          <NoteMenu note={note} />
        </div>
        <NoteText text={note.text} className="mt-0.5" />
        <NoteMediaGrid note={note} />
        <PollView note={note} />
        <QuotedNote note={note.quoted} quoteOfId={note.quoteOfId} />
        <ActionBar note={note} />
      </div>
    </article>
  )
}

/** The post page's big post: author block, large text, full date and views, counts, the action bar. */
export function BigNote({ note }: { note: Note }) {
  const ref = useRef<HTMLElement>(null)
  useTrackView(ref, note.id)
  const a = note.author
  const name = a?.displayName || a?.username || "Someone"
  return (
    <article ref={ref} data-note-id={note.id} data-big-note className="px-4 pt-3">
      <div className="flex items-center gap-3">
        <Link href={profilePath(a, note.authorId)} aria-label={name}>
          <Avatar src={a?.avatarUrl} name={name} className="h-10 w-10" />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-1">
            <Link href={profilePath(a, note.authorId)} className="truncate font-bold text-brand-text hover:underline">
              {name}
            </Link>
            <VerifiedMark mark={a?.mark ?? "none"} />
          </div>
          {a?.username && <p className="truncate text-base text-muted-foreground">@{a.username}</p>}
        </div>
        <NoteMenu note={note} />
      </div>
      <NoteText text={note.text} className="mt-3 text-lg leading-relaxed" />
      <NoteMediaGrid note={note} />
      <PollView note={note} />
      <QuotedNote note={note.quoted} quoteOfId={note.quoteOfId} />
      <p className="py-4 text-base text-muted-foreground" data-echo-full-date>
        <time dateTime={note.createdAt}>{fullDate(note.createdAt)}</time>
        {note.editedAt && <span> · Edited</span>}
        <span> · </span>
        <span className="font-bold text-brand-text">{fullCount(note.viewCount)}</span> {note.viewCount === 1 ? "View" : "Views"}
      </p>
      {(note.repostCount > 0 || note.quoteCount > 0 || note.likeCount > 0 || note.bookmarkCount > 0) && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border py-3 text-base text-muted-foreground">
          {note.repostCount > 0 && (
            <span>
              <b className="text-brand-text">{fullCount(note.repostCount)}</b> {note.repostCount === 1 ? "Repost" : "Reposts"}
            </span>
          )}
          {note.quoteCount > 0 && (
            <Link href={quotesPath(note)} className="hover:underline">
              <b className="text-brand-text">{fullCount(note.quoteCount)}</b> {note.quoteCount === 1 ? "Quote" : "Quotes"}
            </Link>
          )}
          {note.likeCount > 0 && (
            <span>
              <b className="text-brand-text">{fullCount(note.likeCount)}</b> {note.likeCount === 1 ? "Like" : "Likes"}
            </span>
          )}
          {note.bookmarkCount > 0 && (
            <span>
              <b className="text-brand-text">{fullCount(note.bookmarkCount)}</b> {note.bookmarkCount === 1 ? "Bookmark" : "Bookmarks"}
            </span>
          )}
        </div>
      )}
      <ActionBar note={note} big />
    </article>
  )
}

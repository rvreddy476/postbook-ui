"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowUp, CalendarDays, CalendarClock, Settings } from "lucide-react"

import { ActivityList } from "@/app/notifications/ActivityList"
import Avatar from "@/components/ui/Avatar"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import SegmentedControl from "@/components/ui/SegmentedControl"
import { useGlobalToast } from "@/contexts/ToastContext"
import { useAggregatedProfile, profileErrorStatus } from "@/hooks/useAggregatedProfile"
import { useFollowUser, useUnfollowUser } from "@/hooks/useEditProfile"
import { useMarkNotificationRead } from "@/hooks/useNotificationInbox"
import api from "@/lib/api"
import { INBOX_TAB_CATEGORY, flattenInboxLoads, loadInboxWindows } from "@/lib/activityInbox"
import { useAuthUser } from "@/store/auth"

import { PROFILE_NOTES_TABS, TIMELINES, deleteScheduled, reschedule, type ProfileNotesTab, type ResultsTab, type Timeline } from "./api"
import {
  echoListKeys,
  flattenPages,
  newNotesCount,
  updateNoteEverywhere,
  useBookmarks,
  useConversation,
  useThread,
  useEligibility,
  useHashtagNotes,
  useNote,
  usePeek,
  useQuotes,
  useReplies,
  useScheduled,
  useSearchNotes,
  useTrends,
  useTimeline,
  useUserNotes,
} from "./hooks"
import { ECHO_WORDS, echoErrorMessage, fullCount, hashtagPath, readFailure, replyPolicyLabel, statusPath, type Note } from "./model"
import { conversationRows, isLongNote, replyBoxPlaceholder, threadPartsAfter } from "./look"
import { notificationsFilterFromParam, notificationsTabHref, scheduleLabel, withMentionsFilter } from "./v2"
import { Composer, ComposerGateView, PremiumGateCard, ScheduleDialog } from "./components/Composer"
import { EchoActionsProvider, useEchoActions } from "./components/EchoActions"
import { PageHeader, SearchBox, Tabs, TrendRows, WriteNoteButton, useEchoShell } from "./components/EchoShell"
import { BigNote, NoteCard, ReplyThread, VerifiedMark } from "./components/NoteCard"
import { NoteText } from "./components/NoteText"
import { ListMessage, NoteList, Spinner } from "./components/NoteList"

/*
  The Echo screens (echo-v2-contract.md §5). Each renders inside the Echo
  shell (app/echo/layout.tsx): no VChat chrome. Every route a screen calls
  may be missing (404) or switched off (503) while the server lanes land;
  lists say "Not available yet" then, and the page still draws.
*/

// ── Home ────────────────────────────────────────────────────────────────

/** "Echo" in the serif, then For you / Following as two pill tabs. */
function HomeHeader({ timeline, onTimeline }: { timeline: Timeline; onTimeline: (t: Timeline) => void }) {
  const user = useAuthUser()
  const shell = useEchoShell()
  return (
    <div className="sticky top-0 z-20 bg-canvas/90 backdrop-blur-md" data-echo-page-header>
      <div className="flex h-[53px] items-center gap-3 px-4">
        {user && (
          <button type="button" aria-label="Open menu" onClick={shell.openDrawer} className="sm:hidden">
            <Avatar src={user.avatar || null} name={user.name || user.username || "?"} className="h-8 w-8" />
          </button>
        )}
        <h1 className="font-echo-serif text-2xl font-semibold text-brand-text">Echo</h1>
      </div>
      <Tabs label="Timeline" tabs={TIMELINES.map((t) => ({ key: t.value, label: t.label }))} active={timeline} onSelect={onTimeline} />
    </div>
  )
}

/**
 * The centred Write a note pill at the top of the column (look v3 §1), in
 * place of X's inline composer: it opens the compose modal. A free member
 * sees the Premium card instead, as before.
 */
function HomeComposer() {
  const user = useAuthUser()
  const eligibility = useEligibility(!!user)
  // A failed eligibility read still offers the pill; the server refuses at submit if it must.
  return (
    <ComposerGateView eligibility={eligibility.data} loading={eligibility.isLoading}>
      <div className="flex justify-center px-3 pt-3" data-echo-write-note>
        <WriteNoteButton />
      </div>
    </ComposerGateView>
  )
}

const TIMELINE_STORE = "echo.timeline"

/** /echo: For you / Following, the composer (or the Premium card), the "Show N posts" pill, the timeline. */
export function EchoHomeScreen() {
  const qc = useQueryClient()
  // Following is the default on first open (design §2); the last choice is remembered on this device.
  const [timeline, setTimeline] = useState<Timeline>("following")
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TIMELINE_STORE)
      if (saved === "for-you" || saved === "following") setTimeline(saved)
    } catch {}
  }, [])
  const choose = (t: Timeline) => {
    setTimeline(t)
    try {
      localStorage.setItem(TIMELINE_STORE, t)
    } catch {}
  }
  const query = useTimeline(timeline)
  const peek = usePeek(timeline, query.isSuccess)
  const shown = useMemo(() => query.data?.pages[0]?.items ?? [], [query.data])
  const fresh = newNotesCount(peek.data?.items ?? [], shown)

  const showNew = async () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
    await qc.resetQueries({ queryKey: ["echo", "timeline", timeline] })
  }

  return (
    <>
      <HomeHeader timeline={timeline} onTimeline={choose} />
      <HomeComposer />
      {fresh > 0 && (
        <div className="sticky top-[110px] z-10 flex justify-center">
          <button type="button" onClick={showNew} data-echo-show-new className="mt-2 flex items-center gap-1.5 rounded-full bg-echo-accent px-4 py-2 text-sm font-semibold text-echo-on-accent shadow-md hover:bg-echo-accent-hover">
            <ArrowUp className="h-4 w-4" aria-hidden /> Show {fresh} {fresh === 1 ? "post" : "posts"}
          </button>
        </div>
      )}
      <NoteList
        query={query}
        empty={timeline === "following" ? "Welcome to Echo!" : "Nothing to see yet"}
        emptyDetail={timeline === "following" ? "Posts from people you follow show up here. Find some people to follow in Explore." : "Check back soon."}
      />
    </>
  )
}

// ── Compose ─────────────────────────────────────────────────────────────

/** The compose modal (/echo/compose): the same composer, or the Premium card for a free member. */
export function ComposeModal({ onClose }: { onClose: () => void }) {
  const eligibility = useEligibility()
  const actions = useEchoActions()
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", key)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", key)
      document.body.style.overflow = ""
    }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-brand-text/40 sm:pt-[5vh]" role="dialog" aria-modal="true" aria-label="Compose post" data-echo-compose-modal>
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative h-full w-full overflow-y-auto bg-canvas p-3 sm:h-auto sm:max-h-[90vh] sm:max-w-[600px] sm:rounded-echo-card sm:border sm:border-border">
        <ComposerGateView eligibility={eligibility.data} loading={eligibility.isLoading}>
          <Composer
            purpose={{ kind: "note" }}
            autoFocus
            onPosted={onClose}
            onCancel={onClose}
            onPremiumRequired={actions.showPremiumRequired}
            headerExtra={
              <Link href="/echo/scheduled" onClick={onClose} className="rounded-full px-3 py-1.5 text-xs font-semibold text-echo-accent hover:bg-echo-accent-tint">
                Drafts &amp; scheduled
              </Link>
            }
          />
        </ComposerGateView>
        {eligibility.data && !eligibility.data.canPost && (
          <div className="flex justify-center pt-3">
            <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-sm font-semibold text-brand-text hover:bg-brand-secondary">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** A direct visit to /echo/compose: Home behind, the modal on top. Closing goes Home. */
export function ComposePageScreen() {
  const router = useRouter()
  return (
    <>
      <EchoHomeScreen />
      <ComposeModal onClose={() => router.replace("/echo")} />
    </>
  )
}

// ── Post page ───────────────────────────────────────────────────────────

type ReplySort = "relevant" | "recent" | "likes"

const REPLY_ORDER: Record<ReplySort, ((a: Note, b: Note) => number) | undefined> = {
  relevant: undefined,
  recent: (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  likes: (a, b) => b.likeCount - a.likeCount,
}

function ReplyBox({ note }: { note: Note }) {
  const user = useAuthUser()
  const eligibility = useEligibility(!!user)
  const actions = useEchoActions()
  const line = "mx-3 my-3 rounded-echo-card border border-border bg-brand-card px-4 py-3 text-sm text-muted-foreground"
  if (!user) {
    return (
      <p className={line}>
        <Link href={`/login?redirect=${encodeURIComponent(statusPath(note))}`} className="font-semibold text-echo-accent hover:underline">
          Sign in
        </Link>{" "}
        to reply.
      </p>
    )
  }
  if (!note.viewerCanReply) {
    return (
      <p className={line} data-reply-closed>
        {ECHO_WORDS.replyNotAllowed}
      </p>
    )
  }
  if (eligibility.data && !eligibility.data.canReply) {
    const words = eligibility.data.reason === "account_too_new" ? ECHO_WORDS.accountTooNewDetail : ECHO_WORDS.suspendedDetail
    return <p className={line}>{words}</p>
  }
  // The rounded reply box, held at the bottom of the screen while the conversation scrolls.
  return (
    <div className="sticky bottom-14 z-10 bg-canvas/95 backdrop-blur-md sm:bottom-0" data-echo-reply-box>
      <Composer purpose={{ kind: "reply", to: note }} inline placeholder={replyBoxPlaceholder(note)} onPremiumRequired={actions.showPremiumRequired} />
    </div>
  )
}

/** /echo/:handle/status/:id — the conversation above, the big post, sort and View quotes, the reply box, the replies. */
export function StatusScreen({ handle, id }: { handle: string; id: string }) {
  const user = useAuthUser()
  const note = useNote(id)
  const conversation = useConversation(id, note.isSuccess && !!note.data?.replyToId)
  const thread = useThread(id, note.isSuccess)
  const replies = useReplies(id, note.isSuccess)
  const [sort, setSort] = useState<ReplySort>("relevant")

  // /echo/i/status/<id> (the old /echo/note/<id> links) settles on the author's handle.
  const realHandle = note.data?.author?.username
  useEffect(() => {
    if (realHandle && realHandle !== handle) {
      try {
        window.history.replaceState(window.history.state, "", statusPath(note.data!))
      } catch {}
    }
  }, [realHandle, handle, note.data])

  let body: React.ReactNode
  if (note.isLoading) body = <Spinner />
  else if (note.isError || !note.data) {
    const f = readFailure(note.error)
    body = (
      <div data-note-missing>
        <ListMessage title={f.status === 404 || !note.error ? "Hmm…this page doesn't exist." : echoErrorMessage(note.error)} detail="Try searching for something else." />
        <p className="px-8">
          <Link href={user ? "/echo" : "/"} className="text-base font-bold text-primary-ink hover:underline">
            {user ? "Back to Echo" : "Go to Home"}
          </Link>
        </p>
      </div>
    )
  } else {
    const n = note.data
    const above = (conversation.data ?? []).filter((c) => c.id !== n.id)
    // The author's own thread carrying on under the note: serif cards joined by an ember line, above the conversation.
    // Every later part comes from the thread call; until it answers, the parts that reply to this note directly.
    const directPart = (r: Note) => r.authorId === n.authorId && r.replyToId === n.id
    const parts = thread.data
      ? threadPartsAfter(n.id, thread.data)
      : flattenPages(replies.data)
          .filter(directPart)
          .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    const partIds = new Set(parts.map((p) => p.id))
    const isPart = (r: Note) => (thread.data ? partIds.has(r.id) : directPart(r))
    const rows = new Map<string, { depth: number; replyingTo: string | null }>()
    const arrange = (ns: Note[]) => {
      const out = conversationRows(n.id, ns)
      rows.clear()
      for (const r of out) rows.set(r.note.id, { depth: r.depth, replyingTo: r.replyingTo })
      return out.map((r) => r.note)
    }
    body = (
      <div className="px-3 py-3">
        {above.length > 0 && (
          <ol aria-label="Earlier in the conversation">
            {above.map((c, i) => (
              <li key={c.id}>
                <NoteCard note={c} threadLine bubbles={false} threadPart={i > 0 && c.authorId === above[i - 1].authorId} replyToHandle={i > 0 ? above[i - 1].author?.username ?? null : undefined} />
              </li>
            ))}
          </ol>
        )}
        <BigNote note={n} />
        {parts.length > 0 && (
          <ol aria-label="The rest of the thread" data-echo-thread-parts>
            {parts.map((p) => (
              <li key={p.id}>
                <span className="mx-auto block h-3 w-0.5 bg-echo-accent" aria-hidden />
                <NoteCard note={p} bubbles={false} threadPart />
              </li>
            ))}
          </ol>
        )}
        {n.replyPolicy !== "everyone" && <p className="px-1 pt-3 text-xs text-muted-foreground">Who can reply: {replyPolicyLabel(n.replyPolicy)}</p>}
        <div className="mt-4 flex items-center gap-2 px-1" data-echo-conversation-label>
          <h2 className="text-sm font-bold text-brand-text">Conversation · {fullCount(n.replyCount)}</h2>
          <label className="ml-auto flex items-center text-xs font-semibold text-muted-foreground">
            <span className="sr-only">Sort replies</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as ReplySort)} className="rounded-full border border-border bg-brand-card px-2 py-1 text-xs font-semibold text-brand-text" data-echo-reply-sort>
              <option value="relevant">Relevant</option>
              <option value="recent">Recent</option>
              <option value="likes">Likes</option>
            </select>
          </label>
          <Link href={`${statusPath(n)}/quotes`} className="rounded-full border border-border bg-brand-card px-3 py-1 text-xs font-semibold text-echo-accent hover:bg-echo-accent-tint" data-echo-view-quotes>
            View quotes
          </Link>
        </div>
        <div className="-mx-3">
          <NoteList
            query={replies}
            empty="No replies yet"
            emptyDetail="Be the first to reply."
            order={REPLY_ORDER[sort]}
            filter={(r) => !isPart(r)}
            arrange={arrange}
            render={(r) => <ReplyThread note={r} depth={rows.get(r.id)?.depth ?? 0} replyingTo={rows.get(r.id)?.replyingTo ?? null} />}
          />
        </div>
        <div className="-mx-3">
          <ReplyBox note={n} />
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Post" back />
      {body}
    </>
  )
}

/** /echo/:handle/status/:id/quotes */
export function QuotesScreen({ id }: { id: string }) {
  const quotes = useQuotes(id)
  return (
    <>
      <PageHeader title="Quotes" back />
      <NoteList query={quotes} empty="No quotes yet" emptyDetail="When someone quotes this post, it'll show up here." />
    </>
  )
}

// ── Profile ─────────────────────────────────────────────────────────────

type ProfileTab = ProfileNotesTab | "media"

const PROFILE_TABS: readonly { key: ProfileTab; label: string }[] = [
  { key: "notes", label: "Posts" },
  { key: "replies", label: "Replies" },
  { key: "reposts", label: "Reposts" },
  { key: "media", label: "Media" },
]

function joinedLabel(createdAt: string | undefined): string {
  const t = createdAt ? Date.parse(createdAt) : NaN
  if (!Number.isFinite(t)) return ""
  return `Joined ${new Date(t).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`
}

function ProfileFollowButton({ userId, following }: { userId: string; following: boolean }) {
  const follow = useFollowUser()
  const unfollow = useUnfollowUser()
  const busy = follow.isPending || unfollow.isPending
  const [hover, setHover] = useState(false)
  return following ? (
    <button
      type="button"
      disabled={busy}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => unfollow.mutate(userId)}
      className="rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-brand-text hover:border-danger hover:bg-danger/10 hover:text-danger disabled:opacity-60"
    >
      {hover ? "Unfollow" : "Following"}
    </button>
  ) : (
    <button type="button" disabled={busy} onClick={() => follow.mutate(userId)} className="rounded-full bg-echo-accent px-4 py-1.5 text-sm font-semibold text-echo-on-accent hover:bg-echo-accent-hover disabled:opacity-60">
      Follow
    </button>
  )
}

/** /echo/:handle — cover, avatar, name, badge, handle, bio, joined, Following/Followers, then Posts/Replies/Reposts/Media. */
export function ProfileScreen({ handle }: { handle: string }) {
  const user = useAuthUser()
  const searchParams = useSearchParams()
  const tabParam = searchParams?.get("tab")
  const tab: ProfileTab = PROFILE_TABS.some((t) => t.key === tabParam) ? (tabParam as ProfileTab) : "notes"
  const profile = useAggregatedProfile(handle)
  const p = profile.data?.profile
  const userId = p?.id ?? ""
  const notes = useUserNotes(userId, tab === "media" ? "notes" : tab, !!userId)

  if (profile.isLoading) {
    return (
      <>
        <PageHeader title="Profile" back />
        <Spinner />
      </>
    )
  }
  if (profile.isError || !p) {
    const status = profileErrorStatus(profile.error)
    return (
      <>
        <PageHeader title="Profile" back />
        <ListMessage title={status === 404 ? "This account doesn't exist" : "Something went wrong"} detail={status === 404 ? "Try searching for another." : "Try reloading."} />
      </>
    )
  }

  const own = !!user && user.id === p.id
  const name = p.display_name || p.username
  const avatar = p.avatar_media_id ? `/v1/media/${p.avatar_media_id}/serve/avatar` : null
  const cover = p.cover_media_id ? `/v1/media/${p.cover_media_id}/serve` : null
  const stats = profile.data?.stats
  const following = !!profile.data?.relationship?.following
  const mark = p.is_verified ? (p.verification_level === "organisation" ? "official" : p.verification_level === "government" ? "government" : "person") : "none"
  const base = `/echo/${encodeURIComponent(p.username || handle)}`

  return (
    <>
      <PageHeader title={name} back />
      <div data-echo-profile={p.username}>
        {/* The profile is a card like the notes under it: the cover sits inside it as its own rounded strip, never under the avatar. */}
        <section className="mx-3 mt-3 rounded-echo-card border border-border bg-brand-card p-4" data-echo-profile-card>
          {cover && (
            <div className="mb-4 aspect-[4/1] w-full overflow-hidden rounded-echo-inner bg-brand-secondary">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt="" className="h-full w-full object-cover" />
            </div>
          )}
          <div className="flex items-center gap-3">
            <Avatar src={avatar} name={name || "?"} className="h-16 w-16 shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="flex min-w-0 items-center gap-1 text-xl font-bold text-brand-text">
                <span className="truncate">{name}</span>
                <VerifiedMark mark={mark} />
              </h2>
              <p className="truncate text-sm text-muted-foreground">@{p.username}</p>
            </div>
            <div className="shrink-0">
              {own ? (
                <Link href="/settings/profile" className="rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-brand-text hover:bg-brand-secondary">
                  Edit profile
                </Link>
              ) : user ? (
                <ProfileFollowButton userId={p.id} following={following} />
              ) : null}
            </div>
          </div>
          {p.bio && <NoteText text={p.bio} className="mt-3" />}
          {joinedLabel(p.created_at) && (
            <p className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" aria-hidden /> {joinedLabel(p.created_at)}
            </p>
          )}
          <p className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
            <Link href={`/u/${encodeURIComponent(p.username)}?tab=connections`} className="rounded-full border border-border px-3 py-1 hover:bg-brand-secondary">
              <b className="text-brand-text">{fullCount(stats?.following_count ?? 0)}</b> Following
            </Link>
            <Link href={`/u/${encodeURIComponent(p.username)}?tab=connections`} className="rounded-full border border-border px-3 py-1 hover:bg-brand-secondary">
              <b className="text-brand-text">{fullCount(stats?.follower_count ?? 0)}</b> {stats?.follower_count === 1 ? "Follower" : "Followers"}
            </Link>
          </p>
        </section>
        <div className="mt-1">
          <Tabs label="Profile" tabs={PROFILE_TABS.map((t) => ({ key: t.key, label: t.label, href: t.key === "notes" ? base : `${base}?tab=${t.key}` }))} active={tab} />
        </div>
        <NoteList
          key={tab}
          query={notes}
          filter={tab === "media" ? (n) => n.media.length > 0 : undefined}
          empty={tab === "media" ? `@${p.username} hasn't posted media` : tab === "replies" ? `@${p.username} hasn't replied yet` : tab === "reposts" ? `@${p.username} hasn't reposted yet` : `@${p.username} hasn't posted`}
          emptyDetail={tab === "media" ? "Once they do, those posts will show up here." : undefined}
        />
      </div>
    </>
  )
}

// ── Explore, search and hashtags ────────────────────────────────────────

const RESULT_TABS: readonly { key: ResultsTab; label: string }[] = [
  { key: "top", label: "Top" },
  { key: "latest", label: "Latest" },
]

/**
 * Explore → Latest with no search term. post-service answers an empty q
 * with an empty page (notes_v2.go SearchNotes), so nothing is asked for:
 * the tab offers the latest posts of each trend instead
 * (/echo/hashtag/<tag>?f=live) and a prompt to search.
 */
function LatestEverywhere() {
  const trends = useTrends(10)
  const tags = trends.data ?? []
  return (
    <div data-echo-latest>
      <ListMessage title="Search for something" detail="Type a word or a #hashtag above to see the latest posts, or pick a trend." />
      {tags.length > 0 && (
        <ul className="mx-3 overflow-hidden rounded-echo-card border border-border bg-brand-card">
          {tags.map((t) => (
            <li key={t.tag}>
              <Link href={`${hashtagPath(t.tag)}?f=live`} className="block px-4 py-3 text-sm font-semibold text-brand-text hover:bg-brand-secondary">
                Latest in #{t.tag}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** /echo/explore — search, Trending and Latest; with ?q= the search results (Top / Latest). */
export function ExploreScreen() {
  const searchParams = useSearchParams()
  const q = (searchParams?.get("q") ?? "").trim()
  const f = searchParams?.get("f")
  const router = useRouter()

  const header = (
    <div className="flex items-center gap-2 px-4 py-1.5">
      {q && (
        <button type="button" aria-label="Back" onClick={() => router.push("/echo/explore")} className="-ml-2 rounded-full border border-border bg-brand-card p-2 text-brand-text hover:bg-brand-secondary">
          <ArrowUp className="h-5 w-5 -rotate-90" aria-hidden />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <SearchBox initial={q} />
      </div>
      <Link href="/settings" aria-label="Settings" className="rounded-full p-2 text-brand-text hover:bg-brand-secondary">
        <Settings className="h-5 w-5" aria-hidden />
      </Link>
    </div>
  )

  if (q) {
    const tab: ResultsTab = f === "live" ? "latest" : "top"
    const href = (t: ResultsTab) => `/echo/explore?q=${encodeURIComponent(q)}${t === "latest" ? "&f=live" : ""}`
    return (
      <>
        <PageHeader>
          {header}
          <Tabs label="Search results" tabs={RESULT_TABS.map((t) => ({ ...t, href: href(t.key) }))} active={tab} />
        </PageHeader>
        <SearchResults q={q} tab={tab} />
      </>
    )
  }

  const tab = f === "live" ? "latest" : "trending"
  return (
    <>
      <PageHeader>
        {header}
        <Tabs
          label="Explore"
          tabs={[
            { key: "trending", label: "Trending", href: "/echo/explore" },
            { key: "latest", label: "Latest", href: "/echo/explore?f=live" },
          ]}
          active={tab}
        />
      </PageHeader>
      {tab === "trending" ? (
        <section aria-label="Talked about now" className="mx-3 mt-3 overflow-hidden rounded-echo-card border border-border bg-brand-card">
          <h2 className="px-4 pb-1 pt-3.5 text-lg font-bold text-brand-text">Talked about now</h2>
          <TrendRows limit={30} />
        </section>
      ) : (
        <LatestEverywhere />
      )}
    </>
  )
}

function SearchResults({ q, tab }: { q: string; tab: ResultsTab }) {
  const results = useSearchNotes(q, tab)
  return <NoteList key={`${q}:${tab}`} query={results} empty={`No results for "${q}"`} emptyDetail="Try searching for something else." />
}

/** /echo/hashtag/:tag — Top / Latest. */
export function HashtagScreen({ tag }: { tag: string }) {
  const searchParams = useSearchParams()
  const tab: ResultsTab = searchParams?.get("f") === "live" ? "latest" : "top"
  const notes = useHashtagNotes(tag, tab)
  const base = `/echo/hashtag/${encodeURIComponent(tag)}`
  return (
    <>
      <PageHeader title={`#${tag}`} back>
        <Tabs label="Hashtag" tabs={RESULT_TABS.map((t) => ({ ...t, href: t.key === "latest" ? `${base}?f=live` : base }))} active={tab} />
      </PageHeader>
      <NoteList key={tab} query={notes} empty={`No posts for #${tag} yet`} emptyDetail="Posts with this hashtag will show up here." />
    </>
  )
}

// ── Notifications ───────────────────────────────────────────────────────

/** /echo/notifications — All, and Mentions via ?filter=mentions. */
export function NotificationsScreen() {
  const user = useAuthUser()
  const searchParams = useSearchParams()
  const filter = notificationsFilterFromParam(searchParams?.get("filter"))
  const markRead = useMarkNotificationRead()
  const inbox = useInfiniteQuery({
    queryKey: ["notification-inbox", user?.id, "echo", filter],
    enabled: !!user?.id,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      loadInboxWindows(async (path) => (await api.get<unknown>(withMentionsFilter(path, filter))).data, filter === "mentions" ? (INBOX_TAB_CATEGORY.mentions ?? "") : "", pageParam),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    refetchInterval: (query) => ((query.state.data?.pages.length ?? 0) <= 1 ? 30_000 : false),
  })
  const rows = useMemo(() => flattenInboxLoads(inbox.data?.pages ?? []), [inbox.data])

  return (
    <>
      <PageHeader title="Notifications">
        <Tabs
          label="Notifications"
          tabs={[
            { key: "all", label: "All", href: notificationsTabHref("all") },
            { key: "mentions", label: "Mentions", href: notificationsTabHref("mentions") },
          ]}
          active={filter}
        />
      </PageHeader>
      <div className="mx-3 my-3 rounded-echo-card border border-border bg-brand-card px-3 py-2" data-echo-notifications={filter}>
        {inbox.isLoading ? (
          <Spinner />
        ) : inbox.isError ? (
          <ListMessage title="Notifications couldn't be loaded" detail="Try again in a moment." />
        ) : rows.length === 0 && !inbox.hasNextPage ? (
          filter === "mentions" ? (
            <ListMessage title="Nothing to see here — yet" detail="When someone mentions you, you'll find it here." />
          ) : (
            <ListMessage title="Nothing to see here — yet" detail="Likes, mentions, reposts and a whole lot more — when it comes from a post, you'll find it here." />
          )
        ) : (
          <>
            <ActivityList notifications={rows} onOpen={(n) => !n.is_read && markRead.mutate([n])} />
            {inbox.hasNextPage && (
              <div className="flex justify-center py-4">
                <button type="button" onClick={() => void inbox.fetchNextPage()} disabled={inbox.isFetchingNextPage} className="rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-echo-accent hover:bg-echo-accent-tint disabled:opacity-50">
                  {inbox.isFetchingNextPage ? "Loading…" : "Show more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

// ── Bookmarks and Scheduled ─────────────────────────────────────────────

export function BookmarksScreen() {
  const user = useAuthUser()
  const bookmarks = useBookmarks(!!user)
  return (
    <>
      <PageHeader title="Saved" subtitle={user?.username ? `@${user.username}` : undefined} back />
      <NoteList query={bookmarks} empty="Save notes for later" emptyDetail="Tap More, then Save, on any note to find it here again." />
    </>
  )
}

function ScheduledRow({ note }: { note: Note }) {
  const qc = useQueryClient()
  const toast = useGlobalToast()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const at = note.scheduledAt ? new Date(note.scheduledAt) : null

  const save = async (d: Date) => {
    setBusy(true)
    try {
      const updated = await reschedule(note.id, d)
      updateNoteEverywhere(qc, (n) => (n.id === updated.id ? updated : n))
      void qc.invalidateQueries({ queryKey: echoListKeys.scheduled })
      setEditing(false)
      toast({ type: "success", title: scheduleLabel(d) })
    } catch (err) {
      toast({ type: "error", title: echoErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    setBusy(true)
    try {
      await deleteScheduled(note.id)
      updateNoteEverywhere(qc, (n) => (n.id === note.id ? null : n))
      setDeleting(false)
      toast({ type: "success", title: "Scheduled post deleted" })
    } catch (err) {
      toast({ type: "error", title: echoErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-echo-card border border-border bg-brand-card p-3.5" data-echo-scheduled-row={note.id}>
      <p className="flex items-center gap-2 text-xs font-semibold text-echo-accent">
        <CalendarClock className="h-4 w-4" aria-hidden /> {note.status === "failed" ? "Not sent" : at ? scheduleLabel(at) : "Scheduled"}
      </p>
      {(note.status === "failed" || note.publishError) && (
        <p role="alert" className="mt-1 text-sm text-danger" data-echo-publish-error>
          {note.status === "failed" ? "This post couldn't be sent and won't be retried." : "This post couldn't be sent yet; it will be tried again."}
          {note.publishError ? ` ${note.publishError}` : ""}
        </p>
      )}
      <NoteText text={note.text} size={isLongNote(note.text) ? "long" : "timeline"} className="mt-1.5" />
      {note.poll && <p className="mt-1 text-sm text-muted-foreground">Poll · {note.poll.options.map((o) => o.label).join(" / ")}</p>}
      {note.media.length > 0 && <p className="mt-1 text-sm text-muted-foreground">{note.media.length === 1 ? "1 photo" : `${note.media.length} photos`}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setEditing(true)} disabled={busy} className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-brand-text hover:bg-brand-secondary">
          Edit time
        </button>
        <button type="button" onClick={() => setDeleting(true)} disabled={busy} className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-danger hover:bg-danger/10">
          Delete
        </button>
      </div>
      {editing && <ScheduleDialog open value={at} onClose={() => setEditing(false)} onClear={() => setEditing(false)} onConfirm={(d) => void save(d)} />}
      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} onConfirm={remove} title="Delete scheduled post?" description="It won't be sent." confirmLabel="Delete" destructive loading={busy} />
    </div>
  )
}

export function ScheduledScreen() {
  const user = useAuthUser()
  const scheduled = useScheduled(!!user)
  return (
    <>
      <PageHeader title="Scheduled" back />
      <NoteList query={scheduled} empty="You haven't scheduled any posts" emptyDetail="When you schedule a post, it'll show up here until it's sent." render={(n) => <ScheduledRow note={n} />} />
    </>
  )
}

// ── The Echo tab on a VChat profile ─────────────────────────────────────

/** The Echo tab on a VChat profile: Posts, Replies, Reposts (GET /v1/notes/users/:userId?tab=). */
export function ProfileEchoTab({ userId }: { userId: string }) {
  const [tab, setTab] = useState<ProfileNotesTab>("notes")
  const query = useUserNotes(userId, tab)
  const notes = flattenPages(query.data)
  const handle = notes[0]?.author?.username
  return (
    <EchoActionsProvider>
      <div className="overflow-hidden rounded-echo-card border border-border bg-canvas" data-profile-echo>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="flex-1">
            <SegmentedControl
              aria-label="Echo"
              layoutId="profile-echo-tab"
              fullWidth
              size="sm"
              value={tab}
              onChange={(id) => setTab(id as ProfileNotesTab)}
              segments={PROFILE_NOTES_TABS.map((t) => ({ id: t.value, label: t.label }))}
            />
          </div>
          {handle && (
            <Link href={`/echo/${encodeURIComponent(handle)}`} className="text-sm font-semibold text-echo-accent hover:underline">
              Open in Echo
            </Link>
          )}
        </div>
        <NoteList query={query} empty={tab === "notes" ? "No posts yet" : tab === "replies" ? "No replies yet" : "No reposts yet"} />
      </div>
    </EchoActionsProvider>
  )
}

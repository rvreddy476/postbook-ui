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
import { notificationsFilterFromParam, notificationsTabHref, scheduleLabel, withMentionsFilter } from "./v2"
import { Composer, ComposerGateView, PremiumGateCard, ScheduleDialog } from "./components/Composer"
import { EchoActionsProvider, useEchoActions } from "./components/EchoActions"
import { PageHeader, SearchBox, Tabs, TrendRows, useEchoShell } from "./components/EchoShell"
import { BigNote, NoteCard } from "./components/NoteCard"
import { NoteText } from "./components/NoteText"
import { ListMessage, NoteList, Spinner } from "./components/NoteList"

/*
  The Echo screens (echo-v2-contract.md §5). Each renders inside the Echo
  shell (app/echo/layout.tsx): no VChat chrome. Every route a screen calls
  may be missing (404) or switched off (503) while the server lanes land;
  lists say "Not available yet" then, and the page still draws.
*/

// ── Home ────────────────────────────────────────────────────────────────

function HomeHeader({ timeline, onTimeline }: { timeline: Timeline; onTimeline: (t: Timeline) => void }) {
  const user = useAuthUser()
  const shell = useEchoShell()
  return (
    <div className="sticky top-0 z-20 border-b border-border bg-brand-bg/85 backdrop-blur-md" data-echo-page-header>
      <div className="flex h-[53px] items-center px-4 sm:hidden">
        {user && (
          <button type="button" aria-label="Open menu" onClick={shell.openDrawer}>
            <Avatar src={user.avatar || null} name={user.name || user.username || "?"} className="h-8 w-8" />
          </button>
        )}
        <span className="mx-auto pr-8 text-lg font-extrabold">Echo</span>
      </div>
      <Tabs label="Timeline" tabs={TIMELINES.map((t) => ({ key: t.value, label: t.label }))} active={timeline} onSelect={onTimeline} />
    </div>
  )
}

function HomeComposer() {
  const user = useAuthUser()
  const eligibility = useEligibility(!!user)
  const actions = useEchoActions()
  // A failed eligibility read still shows the composer; the server refuses at submit if it must.
  return (
    <ComposerGateView eligibility={eligibility.data} loading={eligibility.isLoading}>
      <Composer purpose={{ kind: "note" }} inline onPremiumRequired={actions.showPremiumRequired} />
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
        <div className="sticky top-[110px] z-10 flex justify-center sm:top-[60px]">
          <button type="button" onClick={showNew} data-echo-show-new className="mt-2 flex items-center gap-1.5 rounded-full bg-primary-ink px-4 py-2 text-sm font-bold text-primary-foreground shadow-md hover:bg-primary-hover">
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
      <div className="relative h-full w-full overflow-y-auto bg-brand-bg sm:h-auto sm:max-h-[90vh] sm:max-w-[600px] sm:rounded-2xl">
        <div className="flex h-[53px] items-center px-2">
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-base font-semibold text-brand-text hover:bg-brand-secondary">
            Cancel
          </button>
          <Link href="/echo/scheduled" onClick={onClose} className="ml-auto rounded-full px-3 py-1.5 text-sm font-bold text-primary-ink hover:bg-primary-tint">
            Drafts &amp; scheduled
          </Link>
        </div>
        <div className="px-2 pb-2">
          <ComposerGateView eligibility={eligibility.data} loading={eligibility.isLoading}>
            <Composer purpose={{ kind: "note" }} autoFocus onPosted={onClose} onPremiumRequired={actions.showPremiumRequired} />
          </ComposerGateView>
        </div>
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
  if (!user) {
    return (
      <p className="border-b border-border px-4 py-3 text-base text-muted-foreground">
        <Link href={`/login?redirect=${encodeURIComponent(statusPath(note))}`} className="font-bold text-primary-ink hover:underline">
          Sign in
        </Link>{" "}
        to reply.
      </p>
    )
  }
  if (!note.viewerCanReply) {
    return (
      <p className="border-b border-border px-4 py-3 text-base text-muted-foreground" data-reply-closed>
        {ECHO_WORDS.replyNotAllowed}
      </p>
    )
  }
  if (eligibility.data && !eligibility.data.canReply) {
    const words = eligibility.data.reason === "account_too_new" ? ECHO_WORDS.accountTooNewDetail : ECHO_WORDS.suspendedDetail
    return <p className="border-b border-border px-4 py-3 text-base text-muted-foreground">{words}</p>
  }
  return <Composer purpose={{ kind: "reply", to: note }} inline onPremiumRequired={actions.showPremiumRequired} />
}

/** /echo/:handle/status/:id — the conversation above, the big post, sort and View quotes, the reply box, the replies. */
export function StatusScreen({ handle, id }: { handle: string; id: string }) {
  const user = useAuthUser()
  const note = useNote(id)
  const conversation = useConversation(id, note.isSuccess && !!note.data?.replyToId)
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
    body = (
      <>
        {above.length > 0 && (
          <ol aria-label="Earlier in the conversation">
            {above.map((c) => (
              <li key={c.id}>
                <NoteCard note={c} threadLine />
              </li>
            ))}
          </ol>
        )}
        <BigNote note={n} />
        {n.replyPolicy !== "everyone" && <p className="px-4 pt-2 text-sm text-muted-foreground">Who can reply: {replyPolicyLabel(n.replyPolicy)}</p>}
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <label className="flex items-center gap-2 text-base font-bold text-brand-text">
            <span className="sr-only">Sort replies</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as ReplySort)} className="rounded-full bg-transparent py-1 font-bold text-brand-text" data-echo-reply-sort>
              <option value="relevant">Relevant</option>
              <option value="recent">Recent</option>
              <option value="likes">Likes</option>
            </select>
          </label>
          <Link href={`${statusPath(n)}/quotes`} className="rounded-full px-3 py-1 text-base font-bold text-primary-ink hover:bg-primary-tint" data-echo-view-quotes>
            View quotes
          </Link>
        </div>
        <ReplyBox note={n} />
        <NoteList query={replies} empty="No replies yet" emptyDetail="Be the first to reply." order={REPLY_ORDER[sort]} />
      </>
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
      className="rounded-full border border-border px-4 py-1.5 text-base font-bold text-brand-text hover:border-danger hover:bg-danger/10 hover:text-danger disabled:opacity-60"
    >
      {hover ? "Unfollow" : "Following"}
    </button>
  ) : (
    <button type="button" disabled={busy} onClick={() => follow.mutate(userId)} className="rounded-full bg-brand-text px-4 py-1.5 text-base font-bold text-brand-bg hover:opacity-90 disabled:opacity-60">
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
        <div className="h-48 bg-brand-secondary" />
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
        <div className="aspect-[3/1] w-full bg-brand-secondary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="px-4">
          <div className="flex items-start justify-between">
            <div className="-mt-[12%] rounded-full border-4 border-brand-bg">
              <Avatar src={avatar} name={name || "?"} className="h-[clamp(4.5rem,24vw,8.5rem)] w-[clamp(4.5rem,24vw,8.5rem)]" />
            </div>
            <div className="pt-3">
              {own ? (
                <Link href="/settings/profile" className="rounded-full border border-border px-4 py-1.5 text-base font-bold text-brand-text hover:bg-brand-secondary">
                  Edit profile
                </Link>
              ) : user ? (
                <ProfileFollowButton userId={p.id} following={following} />
              ) : null}
            </div>
          </div>
          <div className="mt-2">
            <h2 className="flex items-center gap-1 text-xl font-extrabold text-brand-text">
              {name}
              {mark !== "none" && <span className="text-primary" aria-label="Verified">✓</span>}
            </h2>
            <p className="text-base text-muted-foreground">@{p.username}</p>
          </div>
          {p.bio && <NoteText text={p.bio} className="mt-3" />}
          {joinedLabel(p.created_at) && (
            <p className="mt-3 flex items-center gap-1 text-base text-muted-foreground">
              <CalendarDays className="h-[18px] w-[18px]" aria-hidden /> {joinedLabel(p.created_at)}
            </p>
          )}
          <p className="mt-3 flex gap-5 text-base text-muted-foreground">
            <Link href={`/u/${encodeURIComponent(p.username)}?tab=connections`} className="hover:underline">
              <b className="text-brand-text">{fullCount(stats?.following_count ?? 0)}</b> Following
            </Link>
            <Link href={`/u/${encodeURIComponent(p.username)}?tab=connections`} className="hover:underline">
              <b className="text-brand-text">{fullCount(stats?.follower_count ?? 0)}</b> {stats?.follower_count === 1 ? "Follower" : "Followers"}
            </Link>
          </p>
        </div>
        <div className="mt-3 border-b border-border">
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
        <ul className="border-t border-border">
          {tags.map((t) => (
            <li key={t.tag}>
              <Link href={`${hashtagPath(t.tag)}?f=live`} className="block px-4 py-3 text-base font-bold text-brand-text hover:bg-brand-secondary/60">
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
        <button type="button" aria-label="Back" onClick={() => router.push("/echo/explore")} className="-ml-2 rounded-full p-2 text-brand-text hover:bg-brand-secondary">
          <ArrowUp className="h-5 w-5 -rotate-90" aria-hidden />
        </button>
      )}
      <div className="flex-1">
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
      {tab === "trending" ? <TrendRows limit={30} /> : <LatestEverywhere />}
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
      <div className="px-4 py-3" data-echo-notifications={filter}>
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
                <button type="button" onClick={() => void inbox.fetchNextPage()} disabled={inbox.isFetchingNextPage} className="rounded-full px-4 py-1.5 text-base font-bold text-primary-ink hover:bg-primary-tint disabled:opacity-50">
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
      <PageHeader title="Bookmarks" subtitle={user?.username ? `@${user.username}` : undefined} back />
      <NoteList query={bookmarks} empty="Save posts for later" emptyDetail="Bookmark posts to easily find them again in the future." />
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
    <div className="px-4 py-3" data-echo-scheduled-row={note.id}>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarClock className="h-4 w-4" aria-hidden /> {note.status === "failed" ? "Not sent" : at ? scheduleLabel(at) : "Scheduled"}
      </p>
      {(note.status === "failed" || note.publishError) && (
        <p role="alert" className="mt-1 text-sm text-danger" data-echo-publish-error>
          {note.status === "failed" ? "This post couldn't be sent and won't be retried." : "This post couldn't be sent yet; it will be tried again."}
          {note.publishError ? ` ${note.publishError}` : ""}
        </p>
      )}
      <NoteText text={note.text} className="mt-1" />
      {note.poll && <p className="mt-1 text-sm text-muted-foreground">Poll · {note.poll.options.map((o) => o.label).join(" / ")}</p>}
      {note.media.length > 0 && <p className="mt-1 text-sm text-muted-foreground">{note.media.length === 1 ? "1 photo" : `${note.media.length} photos`}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => setEditing(true)} disabled={busy} className="rounded-full border border-border px-3 py-1 text-sm font-bold text-brand-text hover:bg-brand-secondary">
          Edit time
        </button>
        <button type="button" onClick={() => setDeleting(true)} disabled={busy} className="rounded-full border border-border px-3 py-1 text-sm font-bold text-danger hover:bg-danger/10">
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
      <div className="overflow-hidden rounded-2xl border border-border bg-brand-card" data-profile-echo>
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
            <Link href={`/echo/${encodeURIComponent(handle)}`} className="text-sm font-bold text-primary-ink hover:underline">
              Open in Echo
            </Link>
          )}
        </div>
        <NoteList query={query} empty={tab === "notes" ? "No posts yet" : tab === "replies" ? "No replies yet" : "No reposts yet"} />
      </div>
    </EchoActionsProvider>
  )
}

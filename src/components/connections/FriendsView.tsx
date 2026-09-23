'use client'

/**
 * FriendsView — the Connections surface, built to the shared screen.
 *
 * Layout: title on the left with a segmented control on the right, a
 * filter/sort bar under a divider, then a grid of COMPACT HORIZONTAL
 * cards — avatar, name, status line, mutual count, and the actions on the
 * right. Three across on a wide screen.
 *
 * One relationship concept: a Connection. "Circle" and "Trusted Circle"
 * were removed on 21 Sep; close-friends and the circle tables are gone
 * from graph-service too.
 *
 * What the shared screen shows that is NOT here, and why:
 *   · Job titles ("Product Designer") — no profile field carries one for a
 *     connection, so it would be invented text on every card.
 *   · "Active 18m ago" — presence is a live boolean from the WS gateway,
 *     not a last-seen timestamp. Online reads "Active now"; offline shows
 *     the handle rather than a made-up duration.
 *   · A Favorites filter — the favorites table was dropped in graph-service
 *     migration 012. A chip that filters nothing is worse than no chip.
 *
 *   connections / requests → graph-service
 *   mutual counts          → graph-service /connections/mutual-counts
 *   presence               → /v1/users/online/batch + WS presence_update
 *   "Matched for you"      → suggestion-service
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    UserPlus, Search, ChevronRight, MessageCircle, X, QrCode, AtSign,
    MapPin, Contact, ShieldOff, Users, Inbox, Send, LayoutGrid, List,
    ArrowUpDown, MoreHorizontal, UserMinus, ExternalLink,
} from 'lucide-react'
import { useAuthUser } from '@/store/auth'
import {
    useFriends, usePendingFriendRequests, useAcceptFriendRequest,
    useRejectFriendRequest, useFriendSuggestions, useSentFriendRequests,
    useCancelFriendRequest, useFilteredFriendRequests, useUnfilterFriendRequest,
    useMutualConnectionCounts, usePresence, useRemoveFriend,
    type ConnectionUser, type SuggestionUser,
} from '@/hooks/useConnections'
import { useNotifications } from '@/contexts/NotificationContext'
import { FriendRequestButton } from '@/components/connections/FriendRequestButton'

/* ----------------------------- shared helpers ---------------------------- */

function avatarUrl(userId: string, avatarMediaId?: string): string {
    return avatarMediaId
        ? `/v1/media/${avatarMediaId}/serve`
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
}

const REASON_LABELS: Record<string, string> = {
    MUTUAL_FRIENDS: 'You have mutual friends',
    SAME_CITY: 'Lives near you',
    SAME_LOCATION: 'Lives near you',
    SAME_SCHOOL: 'Went to the same school',
    SAME_COMPANY: 'Works at the same place',
    SAME_PROFESSION: 'Does similar work',
    MUTUAL_FOLLOW: 'In your follow network',
    FRIENDS_FOLLOW: 'In your follow network',
    COMMON_GROUPS: 'In groups you are in',
    TRIADIC_CLOSURE: 'Connected to your circle',
    CONTACT_MATCH: 'From your contacts',
    NEW_CREATOR: 'New creator to discover',
    POPULAR: 'Popular right now',
    TRENDING_REGION: 'Popular right now',
}

function reasonText(codes?: string[], explain?: string): string {
    if (explain && explain.trim()) return explain.trim()
    if (codes && codes.length) return REASON_LABELS[codes[0]] ?? 'Suggested for you'
    return 'Suggested for you'
}

/**
 * A suggestion "% match". The suggestion-service score is a 0..1 (or already
 * 0..100) signal; clamp it to 0–100. When absent, fall back to a mutual-friend
 * heuristic so the badge is never empty.
 */
function matchPercent(s: SuggestionUser): number {
    if (typeof s.score === 'number' && s.score > 0) {
        const pct = s.score <= 1 ? s.score * 100 : s.score
        return Math.max(1, Math.min(100, Math.round(pct)))
    }
    const mutuals = s.mutual_friend_count ?? 0
    return Math.max(12, Math.min(96, 40 + mutuals * 7))
}

/**
 * "N mutual connections", or nothing at all while the count is still in
 * flight. An absent entry means unresolved — never "zero" — so the line is
 * left blank rather than asserting something the server has not said.
 */
function mutualsLine(count: number | undefined): string {
    if (count === undefined) return ''
    if (count === 0) return 'No mutual connections'
    return `${count} mutual connection${count === 1 ? '' : 's'}`
}

type Lane = 'connections' | 'received' | 'sent'
type Person = { user_id: string; display_name: string; username?: string; avatar_media_id?: string }

/* ================================ SURFACE 1 ============================== */
/* Connections home                                                          */

export default function FriendsView() {
    const router = useRouter()
    const authUser = useAuthUser()
    const { getUnreadCountForUser } = useNotifications()

    const [lane, setLane] = useState<Lane>('connections')
    const [search, setSearch] = useState('')
    const [onlineOnly, setOnlineOnly] = useState(false)
    const [sortAlpha, setSortAlpha] = useState(false)
    const [listView, setListView] = useState(false)
    const [addOpen, setAddOpen] = useState(false)
    const [filteredOpen, setFilteredOpen] = useState(false)
    /** Locally settled requests, so a card leaves the grid immediately. */
    const [handled, setHandled] = useState<Set<string>>(new Set())

    const friendsQ = useFriends(authUser?.id, 50)
    const receivedQ = usePendingFriendRequests()
    const sentQ = useSentFriendRequests()
    const filteredQ = useFilteredFriendRequests()

    const acceptReq = useAcceptFriendRequest()
    const rejectReq = useRejectFriendRequest()
    const cancelReq = useCancelFriendRequest()
    const unfilterReq = useUnfilterFriendRequest()
    const removeFriend = useRemoveFriend()

    const friends = useMemo(() => friendsQ.data?.items ?? [], [friendsQ.data])
    const received = useMemo(
        () => (receivedQ.data?.items ?? []).filter((r) => !handled.has(r.user_id)),
        [receivedQ.data, handled],
    )
    const sent = useMemo(
        () => (sentQ.data?.items ?? []).filter((r) => !handled.has(r.user_id)),
        [sentQ.data, handled],
    )
    const filtered = useMemo(
        () => (filteredQ.data?.items ?? []).filter((r) => !handled.has(r.user_id)),
        [filteredQ.data, handled],
    )

    // Presence for everyone on screen — one batch call, then the WS gateway
    // patches the cache the instant anybody connects or disconnects.
    const allIds = useMemo(
        () => [...friends, ...received, ...sent].map((p) => p.user_id),
        [friends, received, sent],
    )
    const presence = usePresence(allIds).data ?? {}

    const markHandled = (id: string) => setHandled((p) => new Set(p).add(id))
    const unmarkHandled = (id: string) =>
        setHandled((p) => {
            const n = new Set(p)
            n.delete(id)
            return n
        })
    /** Optimistic: hide the card, put it back if the server refuses. */
    const settle = (id: string, run: (id: string, opts: { onError: () => void }) => void) => {
        markHandled(id)
        run(id, { onError: () => unmarkHandled(id) })
    }

    // One list drives the grid, whichever lane is open.
    const people = useMemo(() => {
        let base: Person[] = lane === 'connections' ? friends : lane === 'received' ? received : sent

        const q = search.trim().toLowerCase()
        if (q) {
            base = base.filter(
                (p) =>
                    p.display_name.toLowerCase().includes(q) ||
                    (p.username ?? '').toLowerCase().includes(q),
            )
        }
        if (lane === 'connections' && onlineOnly) {
            base = base.filter((p) => presence[p.user_id])
        }
        return [...base].sort((a, b) =>
            sortAlpha
                ? a.display_name.localeCompare(b.display_name)
                : Number(!!presence[b.user_id]) - Number(!!presence[a.user_id]),
        )
    }, [lane, friends, received, sent, search, onlineOnly, sortAlpha, presence])

    const mutualIds = useMemo(() => people.map((p) => p.user_id), [people])
    const mutualsQ = useMutualConnectionCounts(authUser?.id, mutualIds)
    const mutuals = mutualsQ.data

    const openProfile = (u: Person) => router.push(`/u/${u.username || u.user_id}`)
    const openChat = (u: Person) =>
        router.push(`/messenger?user=${encodeURIComponent(u.user_id)}`)

    const emptyText = search.trim()
        ? 'Nobody here matches that search.'
        : lane === 'connections'
            ? onlineOnly
                ? 'None of your connections are online right now.'
                : 'No connections yet — add a few people to get started.'
            : lane === 'received'
                ? 'No one is waiting on you.'
                : 'You have no requests outstanding.'

    const loading =
        lane === 'connections' ? friendsQ.isLoading
            : lane === 'received' ? receivedQ.isLoading
                : sentQ.isLoading

    const gridClass = listView
        ? 'grid grid-cols-1 gap-2.5'
        : 'grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3'

    const actionsFor = (p: Person): React.ReactNode => {
        if (lane === 'connections') {
            return (
                <>
                    <IconAction
                        onClick={() => openChat(p)}
                        label={`Message ${p.display_name}`}
                        badge={getUnreadCountForUser(p.user_id)}
                    >
                        <MessageCircle className="h-4 w-4" />
                    </IconAction>
                    <OverflowMenu
                        label={`More options for ${p.display_name}`}
                        items={[
                            { label: 'View profile', icon: <ExternalLink className="h-3.5 w-3.5" />, onSelect: () => openProfile(p) },
                            {
                                label: 'Remove connection',
                                icon: <UserMinus className="h-3.5 w-3.5" />,
                                danger: true,
                                onSelect: () => settle(p.user_id, (id, o) => removeFriend.mutate(id, o)),
                            },
                        ]}
                    />
                </>
            )
        }
        if (lane === 'received') {
            return (
                <>
                    <PillAction onClick={() => settle(p.user_id, (id, o) => acceptReq.mutate(id, o))} label="Accept" primary />
                    <PillAction onClick={() => settle(p.user_id, (id, o) => rejectReq.mutate(id, o))} label="Decline" />
                </>
            )
        }
        return <PillAction onClick={() => settle(p.user_id, (id, o) => cancelReq.mutate(id, o))} label="Cancel" />
    }

    return (
        <div className="space-y-5">
            {/* ---- Title + segmented control ---- */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <h1 className="text-[32px] font-black leading-none tracking-tight text-brand-text">
                        Connections
                    </h1>
                    <p className="mt-2 text-[13px] font-medium text-brand-text/55">
                        {friends.length} {friends.length === 1 ? 'connection' : 'connections'}
                        <span className="px-1.5 text-brand-text/25">·</span>
                        {received.length} received
                        <span className="px-1.5 text-brand-text/25">·</span>
                        {sent.length} sent
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <div
                        role="tablist"
                        aria-label="Connection lanes"
                        className="flex gap-1 rounded-2xl border border-brand-divider bg-brand-secondary/60 p-1"
                    >
                        <LaneTab id="connections" active={lane} onSelect={setLane} label="Connections" count={friends.length} icon={<Users className="h-4 w-4" />} />
                        <LaneTab id="received" active={lane} onSelect={setLane} label="Received" count={received.length} icon={<Inbox className="h-4 w-4" />} />
                        <LaneTab id="sent" active={lane} onSelect={setLane} label="Sent" count={sent.length} icon={<Send className="h-4 w-4" />} />
                    </div>
                    <button
                        onClick={() => setAddOpen(true)}
                        className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary-ink px-4 text-[13px] font-bold text-white transition hover:bg-primary-hover"
                    >
                        <UserPlus className="h-4 w-4" />
                        <span className="hidden sm:inline">Find people</span>
                    </button>
                </div>
            </div>

            {/* ---- Filter / sort bar ---- */}
            <div className="flex flex-wrap items-center gap-2 border-b border-brand-divider pb-4">
                {lane === 'connections' && (
                    <>
                        <span className="mr-1 text-sm font-bold text-brand-text">All Connections</span>
                        <Chip active={!onlineOnly} onClick={() => setOnlineOnly(false)} label="Everyone" />
                        <Chip active={onlineOnly} onClick={() => setOnlineOnly(true)} label="Online Only" />
                    </>
                )}

                <div className="ml-auto flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-full border border-brand-divider bg-brand-card px-3 py-1.5">
                        <Search className="h-3.5 w-3.5 shrink-0 text-brand-text/35" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search"
                            aria-label="Search connections"
                            className="w-28 bg-transparent text-[13px] text-brand-text placeholder-brand-text/35 outline-hidden focus:w-40 sm:w-36 sm:focus:w-52"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} aria-label="Clear search">
                                <X className="h-3.5 w-3.5 text-brand-text/35 transition hover:text-brand-text" />
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => setSortAlpha((v) => !v)}
                        className="flex items-center gap-1.5 rounded-full border border-brand-divider bg-brand-card px-3 py-1.5 text-[13px] font-semibold text-brand-text/70 transition hover:text-brand-text"
                    >
                        <ArrowUpDown className="h-3.5 w-3.5" />
                        Sort: {sortAlpha ? 'Name' : 'Active'}
                    </button>

                    <div className="flex items-center gap-0.5 rounded-full border border-brand-divider bg-brand-card p-0.5">
                        <ViewToggle on={!listView} onClick={() => setListView(false)} label="Grid view">
                            <LayoutGrid className="h-4 w-4" />
                        </ViewToggle>
                        <ViewToggle on={listView} onClick={() => setListView(true)} label="List view">
                            <List className="h-4 w-4" />
                        </ViewToggle>
                    </div>
                </div>
            </div>

            {/* ---- Cards ---- */}
            {loading ? (
                <Hint text="Loading…" />
            ) : people.length === 0 ? (
                <Hint text={emptyText} />
            ) : (
                <div className={gridClass}>
                    {people.map((p) => (
                        <PersonCard
                            key={p.user_id}
                            person={p}
                            online={!!presence[p.user_id]}
                            mutuals={mutuals?.get(p.user_id)}
                            onOpen={() => openProfile(p)}
                            actions={actionsFor(p)}
                        />
                    ))}
                </div>
            )}

            {/* ---- Held back by trust-safety (received lane only) ---- */}
            {lane === 'received' && filtered.length > 0 && (
                <section>
                    <button
                        onClick={() => setFilteredOpen((v) => !v)}
                        aria-expanded={filteredOpen}
                        className="flex w-full items-center gap-3 rounded-2xl border border-brand-divider bg-brand-secondary/40 p-3 text-left transition hover:border-brand-text/30"
                    >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brand-divider bg-brand-card text-brand-text/70">
                            <ShieldOff className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-bold text-brand-text">
                                Hidden by trust-safety
                            </span>
                            <span className="block truncate text-[11px] text-brand-text/55">
                                {filtered.length} {filtered.length === 1 ? 'request' : 'requests'} · new accounts, no shared signals
                            </span>
                        </span>
                        <ChevronRight
                            className={`h-4 w-4 shrink-0 text-brand-text/30 transition-transform ${filteredOpen ? 'rotate-90' : ''}`}
                        />
                    </button>

                    {filteredOpen && (
                        <div className={`mt-2.5 ${gridClass}`}>
                            {filtered.map((r) => (
                                <PersonCard
                                    key={r.user_id}
                                    person={r}
                                    online={!!presence[r.user_id]}
                                    mutuals={mutuals?.get(r.user_id)}
                                    onOpen={() => openProfile(r)}
                                    actions={
                                        <PillAction
                                            onClick={() => settle(r.user_id, (id, o) => unfilterReq.mutate(id, o))}
                                            label="Unfilter"
                                        />
                                    }
                                />
                            ))}
                        </div>
                    )}
                </section>
            )}

            {addOpen && <AddFriendsModal onClose={() => setAddOpen(false)} />}
        </div>
    )
}

/* ------------------------------ chrome bits ------------------------------ */

function LaneTab({
    id, active, onSelect, label, count, icon,
}: {
    id: Lane
    active: Lane
    onSelect: (l: Lane) => void
    label: string
    count: number
    icon: React.ReactNode
}) {
    const on = active === id
    return (
        <button
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(id)}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-bold transition ${
                on ? 'bg-brand-card text-brand-text shadow-xs' : 'text-brand-text/55 hover:text-brand-text'
            }`}
        >
            <span className="shrink-0">{icon}</span>
            <span className="hidden truncate sm:inline">{label}</span>
            {count > 0 && (
                <span
                    className={`grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold ${
                        on ? 'bg-primary-ink text-white' : 'bg-brand-text/10 text-brand-text/60'
                    }`}
                >
                    {count > 99 ? '99+' : count}
                </span>
            )}
        </button>
    )
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button
            onClick={onClick}
            aria-pressed={active}
            className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
                active
                    ? 'bg-brand-card text-brand-text shadow-xs ring-1 ring-brand-divider'
                    : 'text-brand-text/55 hover:text-brand-text'
            }`}
        >
            {label}
        </button>
    )
}

function ViewToggle({
    on, onClick, label, children,
}: {
    on: boolean
    onClick: () => void
    label: string
    children: React.ReactNode
}) {
    return (
        <button
            onClick={onClick}
            aria-label={label}
            aria-pressed={on}
            className={`grid h-8 w-8 place-items-center rounded-full transition ${
                on ? 'bg-primary-ink text-white' : 'text-brand-text/45 hover:text-brand-text'
            }`}
        >
            {children}
        </button>
    )
}

/* ------------------------------ person card ------------------------------ */

/**
 * The compact row from the shared screen: avatar with a live presence dot,
 * name, status line, mutual count, actions on the right. Three across on a
 * wide screen, one per row in list view.
 */
function PersonCard({
    person, online, mutuals, onOpen, actions,
}: {
    person: Person
    online: boolean
    mutuals: number | undefined
    onOpen: () => void
    actions: React.ReactNode
}) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-brand-divider bg-brand-card p-3 transition hover:border-brand-text/25">
            <button onClick={onOpen} aria-label={person.display_name} className="shrink-0">
                <Avatar user={person} size={44} online={online} />
            </button>

            <button onClick={onOpen} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[14px] font-bold leading-tight text-brand-text">
                    {person.display_name}
                </span>
                <span
                    className={`mt-0.5 block truncate text-[11px] leading-tight ${
                        online ? 'font-semibold text-emerald-600' : 'text-brand-text/50'
                    }`}
                >
                    {online ? 'Active now' : person.username ? `@${person.username}` : ''}
                </span>
                {/* Fixed height so rows line up whether or not the count has
                    arrived — an absent count is "not resolved", not zero. */}
                <span className="mt-1 flex h-4 items-center gap-1 text-[11px] text-brand-text/45">
                    {mutuals !== undefined && mutuals > 0 && <Users className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{mutualsLine(mutuals)}</span>
                </span>
            </button>

            <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
        </div>
    )
}

function IconAction({
    onClick, label, badge = 0, children,
}: {
    onClick: () => void
    label: string
    badge?: number
    children: React.ReactNode
}) {
    return (
        <button
            onClick={onClick}
            aria-label={badge > 0 ? `${label} — ${badge} unread` : label}
            className="relative grid h-9 w-9 place-items-center rounded-full border border-brand-divider text-brand-text/60 transition hover:border-brand-text/35 hover:text-brand-text"
        >
            {children}
            {badge > 0 && (
                <span className="absolute -right-1 -top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-primary-ink px-1 text-[10px] font-bold text-white ring-2 ring-brand-card">
                    {badge > 99 ? '99+' : badge}
                </span>
            )}
        </button>
    )
}

function PillAction({
    onClick, label, primary,
}: {
    onClick: () => void
    label: string
    primary?: boolean
}) {
    return (
        <button
            onClick={onClick}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                primary
                    ? 'bg-primary-ink text-white hover:bg-primary-hover'
                    : 'border border-brand-divider text-brand-text/70 hover:border-brand-text/35 hover:text-brand-text'
            }`}
        >
            {label}
        </button>
    )
}

/** The "…" menu on a connection card. Closes on outside click and Escape. */
function OverflowMenu({
    label, items,
}: {
    label: string
    items: { label: string; icon: React.ReactNode; onSelect: () => void; danger?: boolean }[]
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false)
        }
        window.addEventListener('mousedown', onDown)
        window.addEventListener('keydown', onKey)
        return () => {
            window.removeEventListener('mousedown', onDown)
            window.removeEventListener('keydown', onKey)
        }
    }, [open])

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                aria-label={label}
                aria-expanded={open}
                className="grid h-9 w-9 place-items-center rounded-full border border-brand-divider text-brand-text/50 transition hover:border-brand-text/35 hover:text-brand-text"
            >
                <MoreHorizontal className="h-4 w-4" />
            </button>
            {open && (
                <div
                    role="menu"
                    className="absolute right-0 top-10 z-50 w-48 overflow-hidden rounded-xl border border-brand-divider bg-brand-card py-1 shadow-lg"
                >
                    {items.map((it) => (
                        <button
                            key={it.label}
                            role="menuitem"
                            onClick={() => {
                                setOpen(false)
                                it.onSelect()
                            }}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-semibold transition hover:bg-brand-secondary/60 ${
                                it.danger ? 'text-rose-600' : 'text-brand-text/80'
                            }`}
                        >
                            {it.icon}
                            {it.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

/* ----------------------------- shared atoms ------------------------------ */


function Avatar({
    user,
    size,
    online,
    ring,
}: {
    user: { user_id: string; display_name: string; avatar_media_id?: string }
    size: number
    online?: boolean
    ring?: boolean
}) {
    const dot = Math.max(8, Math.round(size * 0.26))
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={avatarUrl(user.user_id, user.avatar_media_id)}
                alt={user.display_name}
                className={`h-full w-full rounded-full object-cover ${
                    ring ? 'ring-2 ring-brand-text ring-offset-2 ring-offset-brand-card' : ''
                }`}
            />
            {online && (
                <span
                    className="absolute bottom-0 right-0 rounded-full bg-emerald-500 ring-2 ring-brand-card"
                    style={{ width: dot, height: dot }}
                />
            )}
        </div>
    )
}

function Eyebrow({ text }: { text: string }) {
    return (
        <div className="text-[11px] font-bold tracking-[0.14em] text-brand-text/45">
            {text}
        </div>
    )
}

function Hint({ text }: { text: string }) {
    return (
        <div className="rounded-2xl border border-brand-divider bg-brand-card px-4 py-6 text-center text-sm text-brand-text/50">
            {text}
        </div>
    )
}

function ModalShell({
    children,
    onClose,
}: {
    children: React.ReactNode
    onClose: () => void
}) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    return (
        <div
            className="fixed inset-0 z-120 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
            onClick={onClose}
        >
            <div
                className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-brand-divider bg-brand-card sm:max-h-[85vh] sm:rounded-3xl"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                {children}
            </div>
        </div>
    )
}

function ModalHeader({
    icon,
    title,
    subtitle,
    onClose,
}: {
    icon: React.ReactNode
    title: string
    subtitle: string
    onClose: () => void
}) {
    return (
        <div className="flex items-start gap-3 border-b border-brand-divider p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-ink text-white">
                {icon}
            </span>
            <div className="min-w-0 flex-1">
                <h3 className="text-lg font-black tracking-tight text-brand-text">{title}</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-brand-text/55">{subtitle}</p>
            </div>
            <button
                onClick={onClose}
                aria-label="Close"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-brand-divider text-brand-text/60 transition hover:text-brand-text"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    )
}

function ModalFooter({ text }: { text: string }) {
    return (
        <div className="border-t border-brand-divider bg-brand-secondary/40 px-5 py-3">
            <p className="text-[11px] leading-relaxed text-brand-text/50">{text}</p>
        </div>
    )
}

/** Central "you" avatar with close-friend avatars scattered in orbit. */
/* ================================ SURFACE 3 ============================== */
/* Add Friends modal                                                         */

function AddFriendsModal({ onClose }: { onClose: () => void }) {
    const router = useRouter()
    const authUser = useAuthUser()
    const suggestionsQ = useFriendSuggestions(authUser?.id, 20)

    const [showAll, setShowAll] = useState(false)

    const suggestions = suggestionsQ.data ?? []
    const visible = showAll ? suggestions : suggestions.slice(0, 5)
    const focusSearch = () => {
        onClose()
        router.push('/search')
    }

    const methods: {
        icon: React.ReactNode
        label: string
        sub: string
        soon?: boolean
        onClick?: () => void
    }[] = [
        { icon: <QrCode className="h-4 w-4" />, label: 'Scan QR', sub: 'Point at their code', soon: true },
        { icon: <Contact className="h-4 w-4" />, label: 'Contacts', sub: 'Some are on VChat', soon: true },
        { icon: <AtSign className="h-4 w-4" />, label: 'Username', sub: 'Search by @handle', onClick: focusSearch },
        { icon: <MapPin className="h-4 w-4" />, label: 'Nearby', sub: 'Bluetooth + wi-fi', soon: true },
    ]

    return (
        <ModalShell onClose={onClose}>
            <ModalHeader
                icon={<UserPlus className="h-5 w-5" />}
                title="Add connections"
                subtitle="Find people to connect with."
                onClose={onClose}
            />

            <div className="flex-1 overflow-y-auto p-5">
                {/* Primary QR card */}
                <button
                    disabled
                    className="flex w-full items-center gap-4 rounded-2xl border border-primary-ink bg-primary-ink p-4 text-left text-white"
                >
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-brand-bg text-brand-text">
                        <QrCode className="h-7 w-7" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black">Show my QR</span>
                        <span className="block text-xs text-brand-bg/70">
                            Hold up — they scan — you're connected
                        </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-brand-bg/60" />
                </button>

                {/* 2×2 method grid */}
                <div className="mt-3 grid grid-cols-2 gap-3">
                    {methods.map((m) => (
                        <button
                            key={m.label}
                            onClick={m.onClick}
                            disabled={m.soon}
                            className={`flex flex-col gap-2 rounded-2xl border border-brand-divider bg-brand-card p-3.5 text-left transition ${
                                m.soon ? 'cursor-default' : 'hover:border-brand-text/30'
                            }`}
                        >
                            <span className="flex items-center justify-between">
                                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-secondary text-brand-text">
                                    {m.icon}
                                </span>
                                {m.soon && (
                                    <span className="rounded-full border border-brand-divider px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-brand-text/45">
                                        Soon
                                    </span>
                                )}
                            </span>
                            <span className="text-sm font-bold text-brand-text">{m.label}</span>
                            <span className="text-[11px] text-brand-text/50">{m.sub}</span>
                        </button>
                    ))}
                </div>

                {/* Matched for you */}
                <div className="mt-6 flex items-center justify-between">
                    <Eyebrow text={`Matched for you · ${suggestions.length}`} />
                    {suggestions.length > 5 && (
                        <button
                            onClick={() => setShowAll((v) => !v)}
                            className="text-xs font-semibold text-brand-text/55 transition hover:text-brand-text"
                        >
                            {showAll ? 'Show less' : 'See all'}
                        </button>
                    )}
                </div>

                <div className="mt-2 space-y-2">
                    {suggestionsQ.isLoading ? (
                        <Hint text="Finding people you may know…" />
                    ) : suggestions.length === 0 ? (
                        <Hint text="No matches right now — try a username search." />
                    ) : (
                        visible.map((s) => (
                            <div
                                key={s.user_id}
                                className="flex items-center gap-3 rounded-2xl border border-brand-divider bg-brand-card px-3 py-2.5"
                            >
                                <button
                                    onClick={() => router.push(`/u/${s.username || s.user_id}`)}
                                    className="shrink-0"
                                    aria-label={s.display_name}
                                >
                                    <Avatar user={s} size={42} />
                                </button>
                                <button
                                    onClick={() => router.push(`/u/${s.username || s.user_id}`)}
                                    className="min-w-0 flex-1 text-left"
                                >
                                    <span className="flex items-center gap-1.5">
                                        <span className="truncate text-sm font-bold text-brand-text">
                                            {s.display_name}
                                        </span>
                                        <span className="shrink-0 rounded-full bg-primary-ink px-1.5 py-0.5 text-[9px] font-bold text-white">
                                            {matchPercent(s)}% MATCH
                                        </span>
                                    </span>
                                    <span className="block truncate text-xs text-brand-text/55">
                                        {reasonText(s.reason_codes, s.explain_text)}
                                    </span>
                                </button>
                                <FriendRequestButton
                allowSend={false}
                                    targetUserId={s.user_id}
                                    targetUsername={s.username}
                                    addLabel="+ Add"
                                    showIcon={false}
                                    showIncomingActions={false}
                                    allowCancel={false}
                                    className="shrink-0 rounded-full bg-primary-ink px-3.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-primary-hover disabled:opacity-60"
                                    sentClassName="border border-brand-divider bg-transparent text-brand-text/45 hover:opacity-100"
                                />
                            </div>
                        ))
                    )}
                </div>
            </div>

            <ModalFooter text="Matches blend shared groups, hashtag overlap, and mutuals. You stay hidden from people you haven't added." />
        </ModalShell>
    )
}

'use client'

/**
 * FriendsView — the Connections surface.
 *
 * One relationship concept: a Connection. "Circle" and "Trusted Circle"
 * were removed on 21 Sep; close-friends and the circle tables are gone
 * from graph-service too.
 *
 * Three lanes, one screen: your connections, requests you received, and
 * requests you sent. Each is a grid of cards carrying only what identifies
 * a person — picture, name, and how many connections you share.
 *
 * "Online now" was removed on 22 Sep at the founder's request, and with it
 * the presence query and the per-card activity line: a card that claims
 * someone is active is a claim that has to keep being true.
 *
 *   connections / requests → graph-service
 *   mutual counts          → graph-service /connections/mutual-counts
 *   "Matched for you"      → suggestion-service
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    UserPlus, Search, ChevronRight, MessageCircle, X, QrCode, AtSign,
    MapPin, Contact, ShieldOff, Users,
} from 'lucide-react'
import { useAuthUser } from '@/store/auth'
import {
    useFriends, usePendingFriendRequests, useAcceptFriendRequest,
    useRejectFriendRequest, useFriendSuggestions, useSentFriendRequests,
    useCancelFriendRequest, useFilteredFriendRequests, useUnfilterFriendRequest,
    useMutualConnectionCounts,
    type ConnectionUser, type SuggestionUser,
} from '@/hooks/useConnections'
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

/* ================================ SURFACE 1 ============================== */
/* Connections home                                                          */

export default function FriendsView() {
    const router = useRouter()
    const authUser = useAuthUser()

    const [lane, setLane] = useState<Lane>('connections')
    const [search, setSearch] = useState('')
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

    // One list drives the grid, whichever lane is open. Every entry is
    // {user_id, display_name, username?, avatar_media_id?}, which is all a
    // card renders.
    const people = useMemo(() => {
        const base: { user_id: string; display_name: string; username?: string; avatar_media_id?: string }[] =
            lane === 'connections' ? friends : lane === 'received' ? received : sent
        const q = search.trim().toLowerCase()
        if (!q) return base
        return base.filter(
            (p) =>
                p.display_name.toLowerCase().includes(q) ||
                (p.username ?? '').toLowerCase().includes(q),
        )
    }, [lane, friends, received, sent, search])

    const mutualIds = useMemo(() => people.map((p) => p.user_id), [people])
    const mutualsQ = useMutualConnectionCounts(authUser?.id, mutualIds)
    const mutuals = mutualsQ.data

    const openProfile = (u: { username?: string; user_id: string }) =>
        router.push(`/u/${u.username || u.user_id}`)
    const openChat = (u: ConnectionUser) =>
        router.push(`/messenger?user=${encodeURIComponent(u.user_id)}`)

    const emptyText =
        search.trim()
            ? 'Nobody here matches that search.'
            : lane === 'connections'
                ? 'No connections yet — add a few people to get started.'
                : lane === 'received'
                    ? 'No one is waiting on you.'
                    : 'You have no requests outstanding.'

    const loading =
        lane === 'connections' ? friendsQ.isLoading
            : lane === 'received' ? receivedQ.isLoading
                : sentQ.isLoading

    return (
        <div className="space-y-6">
            {/* ---- Header ---- */}
            <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                    <h1 className="text-[34px] font-black leading-none tracking-tight text-brand-text">
                        Connections
                    </h1>
                    <p className="mt-2 text-sm font-medium text-brand-text/55">
                        {friends.length} {friends.length === 1 ? 'connection' : 'connections'}
                        <span className="px-1.5 text-brand-text/25">·</span>
                        {received.length} received
                        <span className="px-1.5 text-brand-text/25">·</span>
                        {sent.length} sent
                    </p>
                </div>
                <button
                    onClick={() => setAddOpen(true)}
                    className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary-ink px-4 text-[13px] font-bold text-white transition hover:bg-primary-hover"
                >
                    <UserPlus className="h-4 w-4" />
                    Find people
                </button>
            </div>

            {/* ---- Segmented control ---- */}
            <div
                role="tablist"
                aria-label="Connection lanes"
                className="flex gap-1 rounded-full border border-brand-divider bg-brand-secondary/50 p-1"
            >
                <LaneTab id="connections" active={lane} onSelect={setLane} label="Connections" count={friends.length} />
                <LaneTab id="received" active={lane} onSelect={setLane} label="Received" count={received.length} />
                <LaneTab id="sent" active={lane} onSelect={setLane} label="Sent" count={sent.length} />
            </div>

            {/* ---- Search ---- */}
            <div className="flex items-center gap-2.5 rounded-2xl border border-brand-divider bg-brand-card px-4 py-2.5">
                <Search className="h-4 w-4 shrink-0 text-brand-text/35" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or @handle"
                    aria-label="Search connections"
                    className="flex-1 bg-transparent text-sm text-brand-text placeholder-brand-text/35 outline-hidden"
                />
                {search && (
                    <button onClick={() => setSearch('')} aria-label="Clear search">
                        <X className="h-4 w-4 text-brand-text/35 transition hover:text-brand-text" />
                    </button>
                )}
            </div>

            {/* ---- Grid ---- */}
            {loading ? (
                <Hint text="Loading…" />
            ) : people.length === 0 ? (
                <Hint text={emptyText} />
            ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {people.map((p) => (
                        <PersonCard
                            key={p.user_id}
                            person={p}
                            mutuals={mutuals?.get(p.user_id)}
                            onOpen={() => openProfile(p)}
                        >
                            {lane === 'connections' && (
                                <CardButton
                                    onClick={() => openChat(p as ConnectionUser)}
                                    label="Message"
                                    icon={<MessageCircle className="h-3.5 w-3.5" />}
                                />
                            )}
                            {lane === 'received' && (
                                <div className="flex w-full gap-1.5">
                                    <CardButton
                                        onClick={() => settle(p.user_id, (id, o) => acceptReq.mutate(id, o))}
                                        label="Accept"
                                        primary
                                    />
                                    <CardButton
                                        onClick={() => settle(p.user_id, (id, o) => rejectReq.mutate(id, o))}
                                        label="Decline"
                                    />
                                </div>
                            )}
                            {lane === 'sent' && (
                                <CardButton
                                    onClick={() => settle(p.user_id, (id, o) => cancelReq.mutate(id, o))}
                                    label="Cancel request"
                                />
                            )}
                        </PersonCard>
                    ))}
                </div>
            )}

            {/* ---- Held back by trust-safety (received lane only) ---- */}
            {lane === 'received' && filtered.length > 0 && (
                <section>
                    <button
                        onClick={() => setFilteredOpen((v) => !v)}
                        aria-expanded={filteredOpen}
                        className="flex w-full items-center gap-3 rounded-2xl border border-brand-divider bg-brand-secondary/40 p-3.5 text-left transition hover:border-brand-text/30"
                    >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-brand-divider bg-brand-card text-brand-text/70">
                            <ShieldOff className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-brand-text">
                                Hidden by trust-safety
                            </span>
                            <span className="block truncate text-xs text-brand-text/55">
                                {filtered.length} {filtered.length === 1 ? 'request' : 'requests'} · new accounts, no shared signals
                            </span>
                        </span>
                        <ChevronRight
                            className={`h-5 w-5 shrink-0 text-brand-text/30 transition-transform ${filteredOpen ? 'rotate-90' : ''}`}
                        />
                    </button>

                    {filteredOpen && (
                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                            {filtered.map((r) => (
                                <PersonCard
                                    key={r.user_id}
                                    person={r}
                                    mutuals={mutuals?.get(r.user_id)}
                                    onOpen={() => openProfile(r)}
                                >
                                    <CardButton
                                        onClick={() => settle(r.user_id, (id, o) => unfilterReq.mutate(id, o))}
                                        label="Unfilter"
                                    />
                                </PersonCard>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {addOpen && <AddFriendsModal onClose={() => setAddOpen(false)} />}
        </div>
    )
}

/* ------------------------------- lane tab -------------------------------- */

function LaneTab({
    id,
    active,
    onSelect,
    label,
    count,
}: {
    id: Lane
    active: Lane
    onSelect: (l: Lane) => void
    label: string
    count: number
}) {
    const on = active === id
    return (
        <button
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold transition ${
                on
                    ? 'bg-brand-card text-brand-text shadow-xs'
                    : 'text-brand-text/55 hover:text-brand-text'
            }`}
        >
            <span className="truncate">{label}</span>
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

/* ------------------------------ person card ------------------------------ */

/**
 * The card carries three things and no more: the picture, the name, and the
 * mutual-connection count. Job titles, "active 2h ago" and match percentages
 * were all removed on 22 Sep — none of them was backed by a field the server
 * actually sends for a connection.
 */
function PersonCard({
    person,
    mutuals,
    onOpen,
    children,
}: {
    person: { user_id: string; display_name: string; username?: string; avatar_media_id?: string }
    mutuals: number | undefined
    onOpen: () => void
    children?: React.ReactNode
}) {
    return (
        <div className="flex flex-col items-center rounded-2xl border border-brand-divider bg-brand-card p-4 text-center transition hover:border-brand-text/25">
            <button onClick={onOpen} aria-label={person.display_name} className="shrink-0">
                <Avatar user={person} size={72} />
            </button>
            <button onClick={onOpen} className="mt-3 w-full min-w-0">
                <span className="block truncate text-sm font-bold text-brand-text">
                    {person.display_name}
                </span>
            </button>
            {/* Fixed height so every card in a row lines up, whether or not
                the count has arrived. */}
            <span className="mt-1 flex h-4 items-center gap-1 text-[11px] text-brand-text/50">
                {mutuals !== undefined && mutuals > 0 && <Users className="h-3 w-3" />}
                <span className="truncate">{mutualsLine(mutuals)}</span>
            </span>
            {children && <div className="mt-3 flex w-full">{children}</div>}
        </div>
    )
}

function CardButton({
    onClick,
    label,
    icon,
    primary,
}: {
    onClick: () => void
    label: string
    icon?: React.ReactNode
    primary?: boolean
}) {
    return (
        <button
            onClick={onClick}
            className={`flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-bold transition ${
                primary
                    ? 'bg-primary-ink text-white hover:bg-primary-hover'
                    : 'border border-brand-divider text-brand-text/75 hover:border-brand-text/35 hover:text-brand-text'
            }`}
        >
            {icon}
            {label}
        </button>
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

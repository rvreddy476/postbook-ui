'use client'

/**
 * FriendsView — the AtPost "Friends" module: one home surface + three
 * modals/sheets (Trusted Circle, Add Friends, Requests).
 *
 * LAYOUT redesign only — every section is wired to the existing data hooks
 * in useConnections.ts / useUserSettings.ts; no new hooks, no backend change.
 * Rendered strictly on AtPost's light "Paper/Asphalt" brand palette
 * (brand-bg / brand-text / brand-card / brand-secondary / brand-divider) —
 * no non-brand colours are introduced.
 *
 *   friends / requests  → graph-service
 *   "Pulse · live now"   → placeholder activity over the first real friends
 *   "Trusted Circle"     → graph-service close-friends + tc_* user settings
 *   "Matched for you"    → suggestion-service
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    UserPlus, Search, LayoutGrid, Shield, ShieldOff, ChevronRight,
    MessageCircle, ArrowUpDown, X, QrCode, AtSign, MapPin, Contact,
    Loader2, MoreHorizontal, Plus,
} from 'lucide-react'
import ChatWindow from '@/components/ChatWindow'
import type { User } from '@/types'
import { useAuthUser } from '@/store/auth'
import {
    useFriends, usePendingFriendRequests, useAcceptFriendRequest,
    useRejectFriendRequest, useFriendSuggestions, useSendFriendRequest,
    useCloseFriends, useAddCloseFriend, useRemoveCloseFriend, usePresence,
    useFilteredFriendRequests, useUnfilterFriendRequest,
    type ConnectionUser, type SuggestionUser, type FriendRequestEntry,
} from '@/hooks/useConnections'
import {
    useUserSettings, useUpdateUserSettings,
    type UserSettings, type TrustedCircleSettingKey,
} from '@/hooks/useUserSettings'
import { useNotifications } from '@/contexts/NotificationContext'

/* ----------------------------- shared helpers ---------------------------- */

function avatarUrl(userId: string, avatarMediaId?: string): string {
    return avatarMediaId
        ? `/v1/media/${avatarMediaId}/serve`
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
}

function firstName(name: string): string {
    return name.trim().split(/\s+/)[0] || name
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
    const mutual = s.mutual_friend_count ?? 0
    if (mutual > 0) return Math.min(95, 45 + mutual * 8)
    return 40
}

/* ================================ SURFACE 1 ============================== */
/* Friends Home                                                              */

export default function FriendsView() {
    const router = useRouter()
    const authUser = useAuthUser()
    // Shared, real-time unread-message counts — same source the Messenger
    // screen uses (NotificationContext, now mounted app-wide).
    const { getUnreadCountForUser } = useNotifications()

    const [activeModal, setActiveModal] =
        useState<'trusted' | 'add' | 'requests' | null>(null)
    const [sortAlpha, setSortAlpha] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)
    const [search, setSearch] = useState('')
    const searchRef = useRef<HTMLInputElement>(null)

    const friendsQ = useFriends(authUser?.id, 50)
    const requestsQ = usePendingFriendRequests()
    const suggestionsQ = useFriendSuggestions(authUser?.id, 20)
    const closeQ = useCloseFriends()

    const friends = useMemo(() => friendsQ.data?.items ?? [], [friendsQ.data])
    const friendIds = useMemo(() => friends.map((f) => f.user_id), [friends])
    const presenceQ = usePresence(friendIds)
    const presence = presenceQ.data ?? {}

    const requests = requestsQ.data?.items ?? []
    const closeFriends = closeQ.data ?? []
    const closeIds = useMemo(
        () => new Set(closeFriends.map((c) => c.user_id)),
        [closeFriends],
    )

    useEffect(() => {
        if (searchOpen) searchRef.current?.focus()
    }, [searchOpen])

    const listed = useMemo(() => {
        const q = search.trim().toLowerCase()
        let list = friends
        if (q) {
            list = list.filter(
                (f) =>
                    f.display_name.toLowerCase().includes(q) ||
                    (f.username && f.username.toLowerCase().includes(q)),
            )
        }
        if (sortAlpha) {
            list = [...list].sort((a, b) =>
                a.display_name.localeCompare(b.display_name),
            )
        } else {
            // online-first
            list = [...list].sort(
                (a, b) =>
                    Number(!!presence[b.user_id]) - Number(!!presence[a.user_id]),
            )
        }
        return list
    }, [friends, search, sortAlpha, presence])

    // Friends who are actually online right now (live presence) — surfaced
    // as a compact strip at the top.
    const onlineFriends = useMemo(
        () => friends.filter((f) => presence[f.user_id]),
        [friends, presence],
    )
    const openProfile = (u: { username?: string; user_id: string }) =>
        router.push(`/u/${u.username || u.user_id}`)

    // Facebook-style chat dock — tapping a friend's message icon opens an
    // in-place ChatWindow rather than navigating away from the Friends page.
    // ChatWindow runs standalone here: useNotifications() falls back to its
    // no-op value when no NotificationProvider is mounted.
    const [chats, setChats] = useState<User[]>([])
    const openChat = (f: ConnectionUser, online: boolean) => {
        setChats((prev) => {
            if (prev.some((c) => c.id === f.user_id)) return prev
            const contact: User = {
                id: f.user_id,
                name: f.display_name,
                username: f.username,
                avatar: avatarUrl(f.user_id, f.avatar_media_id),
                isOnline: online,
            }
            const next = [contact, ...prev]
            return next.length > 3 ? next.slice(0, 3) : next
        })
    }
    const closeChat = (id: string) =>
        setChats((prev) => prev.filter((c) => c.id !== id))

    return (
        <div className="space-y-7">
            {/* ---- Header ---- */}
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                    <h1 className="text-[34px] font-black leading-none tracking-tight text-brand-text">
                        Friends
                    </h1>
                    <p className="mt-1.5 text-sm font-medium text-brand-text/60">
                        {friends.length} in orbit
                        <span className="px-1.5 text-brand-text/30">·</span>
                        {requests.length} pending
                    </p>
                </div>
                <button
                    onClick={() => setSearchOpen((v) => !v)}
                    aria-label="Search friends"
                    aria-pressed={searchOpen}
                    className={`grid h-10 w-10 place-items-center rounded-full border transition ${
                        searchOpen
                            ? 'border-brand-text bg-brand-text text-brand-bg'
                            : 'border-brand-divider bg-brand-card text-brand-text/70 hover:text-brand-text'
                    }`}
                >
                    <Search className="h-[18px] w-[18px]" />
                </button>
                <button
                    onClick={() => setActiveModal('add')}
                    aria-label="Add friends"
                    className="grid h-10 w-10 place-items-center rounded-full border border-brand-divider bg-brand-card text-brand-text/70 transition hover:text-brand-text"
                >
                    <LayoutGrid className="h-[18px] w-[18px]" />
                </button>
            </div>

            {/* ---- Search field (revealed) ---- */}
            {searchOpen && (
                <div className="flex items-center gap-3 rounded-2xl border border-brand-divider bg-brand-card px-4 py-3">
                    <Search className="h-4 w-4 shrink-0 text-brand-text/40" />
                    <input
                        ref={searchRef}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search your friends…"
                        className="flex-1 bg-transparent text-sm text-brand-text placeholder-brand-text/40 outline-none"
                    />
                    <button
                        onClick={() => {
                            setSearch('')
                            setSearchOpen(false)
                        }}
                        aria-label="Close search"
                    >
                        <X className="h-4 w-4 text-brand-text/40" />
                    </button>
                </div>
            )}

            {/* ---- Online now ---- */}
            {onlineFriends.length > 0 && (
                <section>
                    <Eyebrow text={`Online now · ${onlineFriends.length}`} />
                    <div className="mt-3 flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
                        {onlineFriends.map((f) => (
                            <button
                                key={f.user_id}
                                onClick={() => openProfile(f)}
                                className="flex w-[58px] shrink-0 flex-col items-center gap-1.5"
                            >
                                <Avatar user={f} size={48} online />
                                <span className="w-full truncate text-center text-[11px] font-semibold text-brand-text">
                                    {firstName(f.display_name)}
                                </span>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {/* ---- Trusted Circle row ---- */}
            <RowCard onClick={() => setActiveModal('trusted')}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-text text-brand-bg">
                    <Shield className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-brand-text">
                        Trusted Circle
                    </span>
                    <span className="block truncate text-xs text-brand-text/55">
                        {closeFriends.length} {closeFriends.length === 1 ? 'person sees' : 'people see'} your inner posts
                    </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-brand-text/30" />
            </RowCard>

            {/* ---- New requests row ---- */}
            {requests.length > 0 && (
                <RowCard onClick={() => setActiveModal('requests')}>
                    <AvatarStack users={requests} />
                    <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-brand-text">
                            {requests.length} new {requests.length === 1 ? 'request' : 'requests'}
                        </span>
                        <span className="block truncate text-xs text-brand-text/55">
                            {requests.slice(0, 3).map((r) => firstName(r.display_name)).join(', ')}
                            {requests.length > 3 ? ' and more' : ''}
                        </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-brand-text/30" />
                </RowCard>
            )}

            {/* ---- All friends ---- */}
            <section>
                <div className="mb-3 flex items-end justify-between">
                    <Eyebrow text={`All friends · ${friends.length}`} />
                    <button
                        onClick={() => setSortAlpha((v) => !v)}
                        className="flex items-center gap-1 text-xs font-semibold text-brand-text/55 transition hover:text-brand-text"
                    >
                        <ArrowUpDown className="h-3.5 w-3.5" />
                        {sortAlpha ? 'A–Z' : 'Active'}
                    </button>
                </div>

                {friendsQ.isLoading ? (
                    <Hint text="Loading your friends…" />
                ) : friends.length === 0 ? (
                    <Hint text="No friends yet — add a few people to build your orbit." />
                ) : listed.length === 0 ? (
                    <Hint text="No friends match your search." />
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-card">
                        {listed.map((f, i) => (
                            <FriendRow
                                key={f.user_id}
                                friend={f}
                                online={!!presence[f.user_id]}
                                trusted={closeIds.has(f.user_id)}
                                unread={getUnreadCountForUser(f.user_id)}
                                first={i === 0}
                                onOpen={() => openProfile(f)}
                                onMessage={() => openChat(f, !!presence[f.user_id])}
                            />
                        ))}
                    </div>
                )}
            </section>

            {/* ---- Modals / sheets ---- */}
            {activeModal === 'trusted' && (
                <TrustedCircleModal
                    friends={friends}
                    closeFriends={closeFriends}
                    closeIds={closeIds}
                    onClose={() => setActiveModal(null)}
                />
            )}
            {activeModal === 'add' && (
                <AddFriendsModal onClose={() => setActiveModal(null)} />
            )}
            {activeModal === 'requests' && (
                <RequestsModal onClose={() => setActiveModal(null)} />
            )}

            {/* ---- Chat dock — in-place ChatWindows, no navigation ---- */}
            <div className="pointer-events-none fixed bottom-0 right-3 z-[1000] flex flex-row-reverse items-end gap-3 sm:right-6 md:gap-4">
                <AnimatePresence>
                    {chats.map((c) => (
                        <motion.div
                            key={c.id}
                            initial={{ opacity: 0, y: 50, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 50, scale: 0.9 }}
                            className="pointer-events-auto"
                        >
                            <ChatWindow contact={c} onClose={() => closeChat(c.id)} />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
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
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-text/45">
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

/** A tappable card-shaped row used for Trusted Circle / new-requests entries. */
function RowCard({
    children,
    onClick,
}: {
    children: React.ReactNode
    onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            className="flex w-full items-center gap-3.5 rounded-2xl border border-brand-divider bg-brand-card p-3.5 text-left transition hover:border-brand-text/30"
        >
            {children}
        </button>
    )
}

/** Three overlapping avatars (used by the new-requests row). */
function AvatarStack({ users }: { users: { user_id: string; display_name: string; avatar_media_id?: string }[] }) {
    const shown = users.slice(0, 3)
    return (
        <span className="flex shrink-0 -space-x-3">
            {shown.map((u) => (
                <img
                    key={u.user_id}
                    /* eslint-disable-next-line @next/next/no-img-element */
                    src={avatarUrl(u.user_id, u.avatar_media_id)}
                    alt={u.display_name}
                    className="h-10 w-10 rounded-full object-cover ring-2 ring-brand-card"
                />
            ))}
        </span>
    )
}

function FriendRow({
    friend,
    online,
    trusted,
    unread,
    first,
    onOpen,
    onMessage,
}: {
    friend: ConnectionUser
    online: boolean
    trusted: boolean
    unread: number
    first: boolean
    onOpen: () => void
    onMessage: () => void
}) {
    return (
        <div
            className={`flex items-center gap-3 px-3.5 py-3 ${
                first ? '' : 'border-t border-brand-divider'
            }`}
        >
            <button onClick={onOpen} className="shrink-0" aria-label={friend.display_name}>
                <Avatar user={friend} size={44} online={online} />
            </button>
            <button onClick={onOpen} className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-brand-text">
                        {friend.display_name}
                    </span>
                    {trusted && <Shield className="h-3.5 w-3.5 shrink-0 text-brand-text/50" />}
                </div>
                <div
                    className={`truncate text-xs ${
                        online ? 'font-semibold text-emerald-600' : 'text-brand-text/55'
                    }`}
                >
                    {online
                        ? 'Active now'
                        : friend.username
                            ? `@${friend.username}`
                            : 'Offline'}
                </div>
            </button>
            <button
                onClick={onMessage}
                aria-label={
                    unread > 0
                        ? `Message ${friend.display_name} — ${unread} unread`
                        : `Message ${friend.display_name}`
                }
                className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brand-divider bg-brand-card text-brand-text/60 transition hover:border-brand-text/30 hover:text-brand-text"
            >
                <MessageCircle className="h-4 w-4" />
                {unread > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand-text px-1 text-[10px] font-bold text-brand-bg ring-2 ring-brand-card">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>
        </div>
    )
}

/* ------------------------------ modal shell ------------------------------ */

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
            className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
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
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-text text-brand-bg">
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

/* ================================ SURFACE 2 ============================== */
/* Trusted Circle modal                                                      */

const TC_TOGGLE_DEFS: { key: TrustedCircleSettingKey; label: string }[] = [
    { key: 'tc_close_friends_posts', label: 'Close-friends Flicks & stories' },
    { key: 'tc_location_pings', label: 'Live location pings' },
    { key: 'tc_after_hours_posts', label: 'After-hours posts' },
    { key: 'tc_audio_room_invite', label: 'Audio Room auto-invite' },
]

type TcTogglesState = Record<TrustedCircleSettingKey, boolean>

function TrustedCircleModal({
    friends,
    closeFriends,
    closeIds,
    onClose,
}: {
    friends: ConnectionUser[]
    closeFriends: ConnectionUser[]
    closeIds: Set<string>
    onClose: () => void
}) {
    const authUser = useAuthUser()
    const addClose = useAddCloseFriend()
    const removeClose = useRemoveCloseFriend()
    const settingsQ = useUserSettings()
    const updateSettings = useUpdateUserSettings()

    const [ids, setIds] = useState<Set<string>>(new Set(closeIds))
    const [busy, setBusy] = useState<Set<string>>(new Set())
    const [picking, setPicking] = useState(false)
    const [pickSearch, setPickSearch] = useState('')
    const [menuFor, setMenuFor] = useState<string | null>(null)

    // Optimistic copy of the four tc_* toggles, seeded once settings load.
    const [tc, setTc] = useState<TcTogglesState | null>(null)
    useEffect(() => {
        if (settingsQ.data && tc === null) {
            setTc({
                tc_close_friends_posts: !!settingsQ.data.tc_close_friends_posts,
                tc_location_pings: !!settingsQ.data.tc_location_pings,
                tc_after_hours_posts: !!settingsQ.data.tc_after_hours_posts,
                tc_audio_room_invite: !!settingsQ.data.tc_audio_room_invite,
            })
        }
    }, [settingsQ.data, tc])

    const [togglingKey, setTogglingKey] = useState<TrustedCircleSettingKey | null>(null)
    const toggleSetting = (key: TrustedCircleSettingKey) => {
        if (!tc || togglingKey) return
        const next = !tc[key]
        setTc({ ...tc, [key]: next })
        setTogglingKey(key)
        updateSettings.mutate({ [key]: next } as Partial<UserSettings>, {
            onError: () => setTc((p) => (p ? { ...p, [key]: !next } : p)),
            onSettled: () => setTogglingKey(null),
        })
    }

    const setMembership = (f: ConnectionUser, addToCircle: boolean) => {
        if (busy.has(f.user_id)) return
        setBusy((p) => new Set(p).add(f.user_id))
        setIds((p) => {
            const n = new Set(p)
            if (addToCircle) n.add(f.user_id)
            else n.delete(f.user_id)
            return n
        })
        const mutation = addToCircle ? addClose : removeClose
        mutation.mutate(f.user_id, {
            onError: () =>
                setIds((p) => {
                    const n = new Set(p)
                    if (addToCircle) n.delete(f.user_id)
                    else n.add(f.user_id)
                    return n
                }),
            onSettled: () =>
                setBusy((p) => {
                    const n = new Set(p)
                    n.delete(f.user_id)
                    return n
                }),
        })
    }

    // Current members reflect optimistic `ids` on top of the loaded list.
    const memberMap = useMemo(() => {
        const m = new Map<string, ConnectionUser>()
        for (const c of closeFriends) m.set(c.user_id, c)
        for (const f of friends) if (ids.has(f.user_id) && !m.has(f.user_id)) m.set(f.user_id, f)
        return m
    }, [closeFriends, friends, ids])
    const members = useMemo(
        () => [...memberMap.values()].filter((m) => ids.has(m.user_id)),
        [memberMap, ids],
    )

    const addable = useMemo(() => {
        const q = pickSearch.trim().toLowerCase()
        return friends
            .filter((f) => !ids.has(f.user_id))
            .filter(
                (f) =>
                    !q ||
                    f.display_name.toLowerCase().includes(q) ||
                    (f.username && f.username.toLowerCase().includes(q)),
            )
    }, [friends, ids, pickSearch])

    const atCap = ids.size >= 10

    return (
        <ModalShell onClose={onClose}>
            <ModalHeader
                icon={<Shield className="h-5 w-5" />}
                title="Trusted Circle"
                subtitle={`Your inner ${ids.size} — they see what others can't.`}
                onClose={onClose}
            />

            <div className="flex-1 overflow-y-auto">
                {/* Orbit visual */}
                <div className="flex justify-center px-5 pt-5">
                    <OrbitVisual you={authUser?.id ?? 'you'} members={members} />
                </div>

                {/* Members */}
                <div className="px-3 pt-4">
                    <div className="flex items-center justify-between px-2">
                        <Eyebrow text={`Members · ${ids.size} of 10`} />
                        <button
                            onClick={() => setPicking((v) => !v)}
                            disabled={atCap && !picking}
                            className="flex items-center gap-1 rounded-full border border-brand-divider px-2.5 py-1 text-[11px] font-bold text-brand-text transition hover:border-brand-text/40 disabled:opacity-40"
                        >
                            <Plus className="h-3 w-3" /> Add
                        </button>
                    </div>

                    {/* Friend picker */}
                    {picking && (
                        <div className="mt-2 overflow-hidden rounded-2xl border border-brand-divider bg-brand-secondary/40">
                            <div className="flex items-center gap-2 border-b border-brand-divider px-3 py-2">
                                <Search className="h-3.5 w-3.5 text-brand-text/40" />
                                <input
                                    value={pickSearch}
                                    onChange={(e) => setPickSearch(e.target.value)}
                                    placeholder="Add a friend to your circle…"
                                    className="flex-1 bg-transparent text-sm text-brand-text placeholder-brand-text/40 outline-none"
                                />
                            </div>
                            <div className="max-h-48 overflow-y-auto p-1">
                                {atCap ? (
                                    <p className="px-3 py-4 text-center text-xs text-brand-text/50">
                                        Your circle is full (10 of 10). Remove someone first.
                                    </p>
                                ) : addable.length === 0 ? (
                                    <p className="px-3 py-4 text-center text-xs text-brand-text/50">
                                        {friends.length === 0
                                            ? 'Add friends first, then build your circle.'
                                            : 'Everyone is already in your circle.'}
                                    </p>
                                ) : (
                                    addable.map((f) => (
                                        <button
                                            key={f.user_id}
                                            onClick={() => setMembership(f, true)}
                                            disabled={busy.has(f.user_id)}
                                            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-brand-card disabled:opacity-50"
                                        >
                                            <Avatar user={f} size={36} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold text-brand-text">
                                                    {f.display_name}
                                                </span>
                                                {f.username && (
                                                    <span className="block truncate text-xs text-brand-text/50">
                                                        @{f.username}
                                                    </span>
                                                )}
                                            </span>
                                            {busy.has(f.user_id) ? (
                                                <Loader2 className="h-4 w-4 animate-spin text-brand-text/40" />
                                            ) : (
                                                <Plus className="h-4 w-4 text-brand-text/50" />
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Member rows */}
                    <div className="mt-2">
                        {members.length === 0 ? (
                            <p className="px-2 py-6 text-center text-sm text-brand-text/50">
                                No one in your circle yet. Tap “Add” to bring people in.
                            </p>
                        ) : (
                            members.map((m) => (
                                <div
                                    key={m.user_id}
                                    className="flex items-center gap-3 rounded-xl px-2 py-2"
                                >
                                    <Avatar user={m} size={40} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-bold text-brand-text">
                                            {m.display_name}
                                        </span>
                                        <span className="block truncate text-xs text-brand-text/50">
                                            {m.username ? `@${m.username}` : 'In your circle'}
                                        </span>
                                    </span>
                                    <div className="relative">
                                        <button
                                            onClick={() =>
                                                setMenuFor((p) => (p === m.user_id ? null : m.user_id))
                                            }
                                            disabled={busy.has(m.user_id)}
                                            aria-label="Member options"
                                            className="grid h-8 w-8 place-items-center rounded-full text-brand-text/50 transition hover:bg-brand-secondary hover:text-brand-text disabled:opacity-50"
                                        >
                                            {busy.has(m.user_id) ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <MoreHorizontal className="h-4 w-4" />
                                            )}
                                        </button>
                                        {menuFor === m.user_id && (
                                            <div className="absolute right-0 top-9 z-10 w-44 overflow-hidden rounded-xl border border-brand-divider bg-brand-card shadow-lg">
                                                <button
                                                    onClick={() => {
                                                        setMenuFor(null)
                                                        setMembership(m, false)
                                                    }}
                                                    className="block w-full px-3 py-2.5 text-left text-sm font-medium text-brand-text transition hover:bg-brand-secondary"
                                                >
                                                    Remove from circle
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Toggles */}
                <div className="mt-2 px-3 pb-2">
                    <div className="px-2">
                        <Eyebrow text="What they alone see" />
                    </div>
                    <div className="mt-1.5 rounded-2xl border border-brand-divider">
                        {settingsQ.isLoading || tc === null ? (
                            <div className="flex items-center gap-2 px-4 py-5 text-xs text-brand-text/40">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Loading settings…
                            </div>
                        ) : (
                            TC_TOGGLE_DEFS.map(({ key, label }, i) => (
                                <ToggleRow
                                    key={key}
                                    label={label}
                                    checked={tc[key]}
                                    busy={togglingKey === key}
                                    first={i === 0}
                                    onToggle={() => toggleSetting(key)}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>

            <ModalFooter text="Adds are silent. They never get notified they're in your circle." />
        </ModalShell>
    )
}

/** Central "you" avatar with close-friend avatars scattered in orbit. */
function OrbitVisual({
    you,
    members,
}: {
    you: string
    members: ConnectionUser[]
}) {
    const size = 188
    const center = size / 2
    const shown = members.slice(0, 9)
    // Two staggered orbits so even small circles look intentional.
    const placements = shown.map((m, i) => {
        const ringInner = i % 2 === 0
        const r = ringInner ? size * 0.3 : size * 0.43
        const av = ringInner ? 34 : 30
        const per = shown.length <= 1 ? 1 : shown.length
        const angle = (i / per) * Math.PI * 2 - Math.PI / 2 + (ringInner ? 0 : 0.5)
        return {
            m,
            av,
            x: Math.cos(angle) * r + center - av / 2,
            y: Math.sin(angle) * r + center - av / 2,
        }
    })
    return (
        <div className="relative" style={{ width: size, height: size }}>
            {/* orbit rings */}
            <div
                className="absolute rounded-full border border-dashed border-brand-text/15"
                style={{ inset: size * 0.07 }}
            />
            <div
                className="absolute rounded-full border border-dashed border-brand-text/10"
                style={{ inset: size * 0.2 }}
            />
            {/* you */}
            <div
                className="absolute grid place-items-center rounded-full bg-brand-text text-brand-bg shadow-lg"
                style={{ width: 54, height: 54, left: center - 27, top: center - 27 }}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={avatarUrl(you)}
                    alt="You"
                    className="h-[46px] w-[46px] rounded-full object-cover"
                />
            </div>
            {placements.map(({ m, av, x, y }) => (
                <div key={m.user_id} className="absolute" style={{ left: x, top: y }}>
                    <Avatar user={m} size={av} ring />
                </div>
            ))}
            {shown.length === 0 && (
                <span className="absolute inset-x-0 bottom-1 text-center text-[10px] font-medium text-brand-text/40">
                    Add people to fill your orbit
                </span>
            )}
        </div>
    )
}

function ToggleRow({
    label,
    checked,
    busy,
    first,
    onToggle,
}: {
    label: string
    checked: boolean
    busy: boolean
    first: boolean
    onToggle: () => void
}) {
    return (
        <div
            className={`flex items-center gap-3 px-4 py-3 ${
                first ? '' : 'border-t border-brand-divider'
            }`}
        >
            <span className="min-w-0 flex-1 text-sm font-medium text-brand-text">
                {label}
            </span>
            {busy && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-text/40" />}
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                onClick={onToggle}
                disabled={busy}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                    checked ? 'bg-brand-text' : 'bg-brand-text/20'
                }`}
            >
                <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-brand-card shadow transition-transform ${
                        checked ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                />
            </button>
        </div>
    )
}

/* ================================ SURFACE 3 ============================== */
/* Add Friends modal                                                         */

function AddFriendsModal({ onClose }: { onClose: () => void }) {
    const router = useRouter()
    const authUser = useAuthUser()
    const suggestionsQ = useFriendSuggestions(authUser?.id, 20)
    const sendReq = useSendFriendRequest()

    const [sentIds, setSentIds] = useState<Set<string>>(new Set())
    const [showAll, setShowAll] = useState(false)

    const suggestions = suggestionsQ.data ?? []
    const visible = showAll ? suggestions : suggestions.slice(0, 5)

    const handleAdd = (s: SuggestionUser) => {
        setSentIds((p) => new Set(p).add(s.user_id))
        sendReq.mutate(s.username || s.user_id, {
            onError: () =>
                setSentIds((p) => {
                    const n = new Set(p)
                    n.delete(s.user_id)
                    return n
                }),
        })
    }
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
                title="Add friends"
                subtitle="Bring people into your orbit."
                onClose={onClose}
            />

            <div className="flex-1 overflow-y-auto p-5">
                {/* Primary QR card */}
                <button
                    disabled
                    className="flex w-full items-center gap-4 rounded-2xl border border-brand-text bg-brand-text p-4 text-left text-brand-bg"
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
                                    <span className="rounded-full border border-brand-divider px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-text/45">
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
                                        <span className="shrink-0 rounded-full bg-brand-text px-1.5 py-0.5 text-[9px] font-bold text-brand-bg">
                                            {matchPercent(s)}% MATCH
                                        </span>
                                    </span>
                                    <span className="block truncate text-xs text-brand-text/55">
                                        {reasonText(s.reason_codes, s.explain_text)}
                                    </span>
                                </button>
                                <button
                                    onClick={() => handleAdd(s)}
                                    disabled={sentIds.has(s.user_id)}
                                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-bold transition ${
                                        sentIds.has(s.user_id)
                                            ? 'border border-brand-divider text-brand-text/45'
                                            : 'bg-brand-text text-brand-bg hover:opacity-90'
                                    }`}
                                >
                                    {sentIds.has(s.user_id) ? 'Requested' : '+ Add'}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <ModalFooter text="Matches blend shared groups, hashtag overlap, and mutuals. You stay hidden from people you haven't added." />
        </ModalShell>
    )
}

/* ================================ SURFACE 4 ============================== */
/* Requests modal                                                            */

/**
 * Derive an "origin" chip for a request. graph-service request rows carry a
 * `source` field, but the FriendRequestEntry data hook does not surface it
 * (and we must not change the hook). We fall back to a neutral, deterministic
 * label so the chip is always present and stable per sender.
 */
const ORIGIN_CHIPS = ['Mutual friends', 'Suggested', 'Search', 'Profile visit'] as const
function originChip(req: FriendRequestEntry): string {
    const src = (req as { source?: string }).source
    if (src && src.trim()) {
        return src
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase())
            .trim()
    }
    let h = 0
    for (let i = 0; i < req.user_id.length; i++) h = (h * 31 + req.user_id.charCodeAt(i)) >>> 0
    return ORIGIN_CHIPS[h % ORIGIN_CHIPS.length]
}

function RequestsModal({ onClose }: { onClose: () => void }) {
    const router = useRouter()
    const requestsQ = usePendingFriendRequests()
    const filteredQ = useFilteredFriendRequests()
    const acceptReq = useAcceptFriendRequest()
    const rejectReq = useRejectFriendRequest()
    const unfilterReq = useUnfilterFriendRequest()

    const [handled, setHandled] = useState<Set<string>>(new Set())
    const [filteredOpen, setFilteredOpen] = useState(false)

    const requests = (requestsQ.data?.items ?? []).filter((r) => !handled.has(r.user_id))
    const filtered = (filteredQ.data?.items ?? []).filter((r) => !handled.has(r.user_id))

    const markHandled = (id: string) => setHandled((p) => new Set(p).add(id))
    const unmarkHandled = (id: string) =>
        setHandled((p) => {
            const n = new Set(p)
            n.delete(id)
            return n
        })

    const handleAccept = (id: string) => {
        markHandled(id)
        acceptReq.mutate(id, { onError: () => unmarkHandled(id) })
    }
    const handleDecline = (id: string) => {
        markHandled(id)
        rejectReq.mutate(id, { onError: () => unmarkHandled(id) })
    }
    const handleUnfilter = (id: string) => {
        markHandled(id)
        unfilterReq.mutate(id, { onError: () => unmarkHandled(id) })
    }
    const openProfile = (u: { username?: string; user_id: string }) => {
        onClose()
        router.push(`/u/${u.username || u.user_id}`)
    }

    return (
        <ModalShell onClose={onClose}>
            <ModalHeader
                icon={<UserPlus className="h-5 w-5" />}
                title="Friend requests"
                subtitle={`${requests.length} ${requests.length === 1 ? 'person wants' : 'people want'} in. Tap a name for the full profile.`}
                onClose={onClose}
            />

            <div className="flex-1 overflow-y-auto p-5">
                <Eyebrow text={`Incoming · ${requests.length}`} />

                <div className="mt-2 space-y-2">
                    {requestsQ.isLoading ? (
                        <Hint text="Loading requests…" />
                    ) : requests.length === 0 ? (
                        <Hint text="No incoming requests right now." />
                    ) : (
                        requests.map((r) => (
                            <RequestRow
                                key={r.user_id}
                                req={r}
                                onOpen={() => openProfile(r)}
                                onAccept={() => handleAccept(r.user_id)}
                                onDecline={() => handleDecline(r.user_id)}
                            />
                        ))
                    )}
                </div>

                {/* Hidden by trust-safety */}
                {filtered.length > 0 && (
                    <div className="mt-4">
                        <button
                            onClick={() => setFilteredOpen((v) => !v)}
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
                                className={`h-5 w-5 shrink-0 text-brand-text/30 transition-transform ${
                                    filteredOpen ? 'rotate-90' : ''
                                }`}
                            />
                        </button>

                        {filteredOpen && (
                            <div className="mt-2 space-y-2">
                                {filtered.map((r) => (
                                    <div
                                        key={r.user_id}
                                        className="flex items-center gap-3 rounded-2xl border border-brand-divider bg-brand-card px-3 py-2.5"
                                    >
                                        <button
                                            onClick={() => openProfile(r)}
                                            className="shrink-0"
                                            aria-label={r.display_name}
                                        >
                                            <Avatar user={r} size={40} />
                                        </button>
                                        <button
                                            onClick={() => openProfile(r)}
                                            className="min-w-0 flex-1 text-left"
                                        >
                                            <span className="block truncate text-sm font-bold text-brand-text">
                                                {r.display_name}
                                            </span>
                                            <span className="block truncate text-xs text-brand-text/55">
                                                {r.username ? `@${r.username}` : 'Held back by trust-safety'}
                                            </span>
                                        </button>
                                        <button
                                            onClick={() => handleUnfilter(r.user_id)}
                                            className="shrink-0 rounded-full border border-brand-divider px-3 py-1.5 text-[11px] font-bold text-brand-text transition hover:border-brand-text/40"
                                        >
                                            Unfilter
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <ModalFooter text="Decline is silent. Senders never see they were declined." />
        </ModalShell>
    )
}

function RequestRow({
    req,
    onOpen,
    onAccept,
    onDecline,
}: {
    req: FriendRequestEntry
    onOpen: () => void
    onAccept: () => void
    onDecline: () => void
}) {
    const [busy, setBusy] = useState(false)
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-brand-divider bg-brand-card px-3 py-3">
            <button onClick={onOpen} className="shrink-0" aria-label={req.display_name}>
                <Avatar user={req} size={44} />
            </button>
            <button onClick={onOpen} className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-bold text-brand-text">
                    {req.display_name}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="truncate text-xs text-brand-text/55">
                        {req.username ? `@${req.username}` : 'Wants to connect'}
                    </span>
                    <span className="shrink-0 rounded-full border border-brand-divider px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-text/50">
                        {originChip(req)}
                    </span>
                </div>
            </button>
            <button
                onClick={() => {
                    setBusy(true)
                    onDecline()
                }}
                disabled={busy}
                className="shrink-0 rounded-full border border-brand-divider px-3 py-1.5 text-[11px] font-bold text-brand-text/70 transition hover:border-brand-text/40 disabled:opacity-50"
            >
                Decline
            </button>
            <button
                onClick={() => {
                    setBusy(true)
                    onAccept()
                }}
                disabled={busy}
                className="shrink-0 rounded-full bg-brand-text px-3.5 py-1.5 text-[11px] font-bold text-brand-bg transition hover:opacity-90 disabled:opacity-50"
            >
                Accept
            </button>
        </div>
    )
}

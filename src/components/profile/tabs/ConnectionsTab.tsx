"use client"

import { useCallback, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useQueries, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
    batchRelationshipsKey,
    fetchRelationshipsBatch,
    useInfiniteFollowers,
    useInfiniteFollowing,
    useFriends,
    usePendingFriendRequests,
    useAcceptFriendRequest,
    useRejectFriendRequest,
} from "@/hooks/useConnections"
import type { ConnectionUser } from "@/hooks/useConnections"
import { useFollowUser, useUnfollowUser } from "@/hooks/useEditProfile"
import { useBlockedUsers } from "@/hooks/useBlocking"
import { useAuthUser } from "@/store/auth"
import { useGlobalToast } from "@/contexts/ToastContext"
import type { GraphCounts, AppPlatform, Relationship } from "@/types/profile"
import { Check, X, ShieldOff, ChevronDown, Loader2 } from "lucide-react"
import {
    ROW_PILL_LABELS,
    bumpFollowingCount,
    connectionRowPill,
    type ConnectionListType,
    type CountedProfile,
    type RowOverride,
    type RowPill,
} from "./connectionRows"

interface ConnectionsTabProps {
    userId: string
    graphCounts: GraphCounts
    platform: AppPlatform
    isOwn: boolean
}

type ConnectionType = ConnectionListType | "blocked"

/** Rows asked for per page, and the step "Load more" adds to the friends list. */
const PAGE_SIZE = 20

function getInitials(displayName: string): string {
    const parts = displayName.trim().split(/\s+/)
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return displayName.substring(0, 2).toUpperCase()
}

function ConnectionUserAvatar({ user, size = "md" }: { user: Pick<ConnectionUser, "display_name" | "avatar_media_id">; size?: "sm" | "md" }) {
    const sizeClasses = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm"

    if (user.avatar_media_id) {
        return (
            <img
                src={`/v1/media/${user.avatar_media_id}/serve`}
                alt={user.display_name}
                className={`${sizeClasses} rounded-full object-cover`}
            />
        )
    }

    return (
        <div className={`${sizeClasses} rounded-full bg-brand-text/10 flex items-center justify-center font-bold text-brand-text`}>
            {getInitials(user.display_name)}
        </div>
    )
}

const PILL_BASE =
    "inline-flex h-8 min-w-[92px] shrink-0 items-center justify-center gap-1 rounded-lg px-3 text-xs font-semibold transition-colors disabled:opacity-60"
const PILL_CLASS: Record<Exclude<RowPill, "none">, string> = {
    follow: `${PILL_BASE} bg-primary-ink text-primary-foreground hover:bg-primary-hover`,
    follow_back: `${PILL_BASE} bg-primary-ink text-primary-foreground hover:bg-primary-hover`,
    following: `${PILL_BASE} border border-brand-divider bg-brand-card text-brand-text hover:bg-brand-secondary`,
    requested: `${PILL_BASE} border border-brand-divider bg-brand-card text-brand-text/60`,
}

function ConnectionUserCard({
    user,
    pill,
    busy,
    onPill,
}: {
    user: ConnectionUser
    pill: RowPill
    busy: boolean
    onPill: (user: ConnectionUser, pill: RowPill) => void
}) {
    // A row without a handle still opens the profile by id.
    const href = `/u/${encodeURIComponent(user.username || user.user_id)}`
    return (
        <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-text/5 transition-colors border border-transparent hover:border-brand-text/10">
            <Link href={href} className="flex flex-1 min-w-0 items-center gap-3">
                <ConnectionUserAvatar user={user} />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-brand-text truncate">
                        {user.display_name}
                    </p>
                    {user.username ? (
                        <p className="text-xs text-brand-text/60 truncate">
                            @{user.username}
                        </p>
                    ) : null}
                </div>
            </Link>
            {pill !== "none" ? (
                <button
                    type="button"
                    onClick={() => onPill(user, pill)}
                    disabled={busy || pill === "requested"}
                    aria-pressed={pill === "following"}
                    title={pill === "requested" ? "Follow request sent" : undefined}
                    className={PILL_CLASS[pill]}
                >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                    {ROW_PILL_LABELS[pill]}
                </button>
            ) : null}
        </div>
    )
}

/** De-duplicated rows, first sighting wins (cursor pages can overlap at a boundary). */
function uniqueRows(rows: ConnectionUser[]): ConnectionUser[] {
    const seen = new Set<string>()
    return rows.filter((row) => {
        if (seen.has(row.user_id)) return false
        seen.add(row.user_id)
        return true
    })
}

function chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
    return out
}

export function ConnectionsTab({ userId, graphCounts, platform, isOwn }: ConnectionsTabProps) {
    const showFriends = platform === "postboek"
    const [activeType, setActiveType] = useState<ConnectionType>(showFriends ? "friends" : "followers")
    const [friendsLimit, setFriendsLimit] = useState(PAGE_SIZE)
    const viewerId = useAuthUser()?.id ?? ""
    const qc = useQueryClient()
    const toast = useGlobalToast()

    const followers = useInfiniteFollowers(activeType === "followers" ? userId : undefined, PAGE_SIZE)
    const following = useInfiniteFollowing(activeType === "following" ? userId : undefined, PAGE_SIZE)
    const friends = useFriends(activeType === "friends" ? userId : undefined, friendsLimit)
    const { data: blockedData } = useBlockedUsers(isOwn && activeType === "blocked")

    // The rows on screen, and the id groups the relationship batch is asked
    // for: one group per loaded page, so loading a page never refetches the
    // pages before it.
    const { users, idGroups, isLoading, hasMore, loadingMore } = useMemo(() => {
        if (activeType === "followers" || activeType === "following") {
            const q = activeType === "followers" ? followers : following
            const pages = q.data?.pages ?? []
            return {
                users: uniqueRows(pages.flatMap((p) => p.items)),
                idGroups: pages.map((p) => p.items.map((u) => u.user_id)),
                isLoading: q.isLoading,
                hasMore: !!q.hasNextPage,
                loadingMore: q.isFetchingNextPage,
            }
        }
        if (activeType === "friends") {
            const items = friends.data?.items ?? []
            return {
                users: uniqueRows(items),
                idGroups: chunk(items.map((u) => u.user_id), PAGE_SIZE),
                isLoading: friends.isLoading,
                hasMore: !!friends.data?.meta.has_next,
                loadingMore: friends.isPlaceholderData,
            }
        }
        return { users: [], idGroups: [], isLoading: false, hasMore: false, loadingMore: false }
    }, [activeType, followers, following, friends])

    const loadMore = () => {
        if (activeType === "followers") void followers.fetchNextPage()
        else if (activeType === "following") void following.fetchNextPage()
        else if (activeType === "friends") setFriendsLimit((n) => n + PAGE_SIZE)
    }

    // The viewer's relationship to each row, from the graph batch route.
    const relationshipQueries = useQueries({
        queries: idGroups.map((group) => {
            const ids = group.filter((id) => id !== viewerId)
            return {
                queryKey: batchRelationshipsKey(viewerId, ids),
                queryFn: () => fetchRelationshipsBatch(viewerId, ids),
                staleTime: 30_000,
                enabled: !!viewerId && ids.length > 0,
            }
        }),
    })
    const relationships = useMemo(() => {
        const map = new Map<string, Relationship>()
        for (const q of relationshipQueries) q.data?.forEach((rel, id) => map.set(id, rel))
        return map
    }, [relationshipQueries])

    // What the viewer did on this screen; it wins until the batch refetch agrees.
    const [overrides, setOverrides] = useState<Map<string, RowOverride>>(new Map())
    const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
    const [confirmUnfollow, setConfirmUnfollow] = useState<ConnectionUser | null>(null)

    // Unfollowing from your own Following list keeps the row (now "Follow").
    const followMutation = useFollowUser({ keepListsInPlace: true })
    const unfollowMutation = useUnfollowUser({ keepListsInPlace: true })

    const setOverride = useCallback((id: string, value: RowOverride | undefined) => {
        setOverrides((prev) => {
            const next = new Map(prev)
            if (value) next.set(id, value)
            else next.delete(id)
            return next
        })
    }, [])
    const setBusy = useCallback((id: string, on: boolean) => {
        setBusyIds((prev) => {
            const next = new Set(prev)
            if (on) next.add(id)
            else next.delete(id)
            return next
        })
    }, [])
    const bumpCount = useCallback(
        (delta: number) => {
            if (!viewerId) return
            qc.setQueriesData<CountedProfile | undefined>({ queryKey: ["aggregated-profile"] }, (data) =>
                bumpFollowingCount(data, viewerId, delta),
            )
        },
        [qc, viewerId],
    )

    const follow = useCallback(
        async (user: ConnectionUser) => {
            const before = overrides.get(user.user_id)
            setBusy(user.user_id, true)
            setOverride(user.user_id, "following")
            bumpCount(1)
            try {
                const result = await followMutation.mutateAsync(user.user_id)
                // A private account turns the follow into a request: no new follow yet.
                if (result?.status === "requested") {
                    setOverride(user.user_id, "requested")
                    bumpCount(-1)
                }
            } catch {
                setOverride(user.user_id, before)
                bumpCount(-1)
                toast({ type: "error", title: `Couldn't follow @${user.username || "this account"}. Try again.` })
            } finally {
                setBusy(user.user_id, false)
            }
        },
        [overrides, setBusy, setOverride, bumpCount, followMutation, toast],
    )

    const unfollow = useCallback(
        async (user: ConnectionUser) => {
            const before = overrides.get(user.user_id)
            setBusy(user.user_id, true)
            setOverride(user.user_id, "not_following")
            bumpCount(-1)
            try {
                await unfollowMutation.mutateAsync(user.user_id)
            } catch {
                setOverride(user.user_id, before)
                bumpCount(1)
                toast({ type: "error", title: `Couldn't unfollow @${user.username || "this account"}. Try again.` })
            } finally {
                setBusy(user.user_id, false)
            }
        },
        [overrides, setBusy, setOverride, bumpCount, unfollowMutation, toast],
    )

    const onPill = useCallback(
        (user: ConnectionUser, pill: RowPill) => {
            if (pill === "following") setConfirmUnfollow(user)
            else if (pill === "follow" || pill === "follow_back") void follow(user)
        },
        [follow],
    )

    const tabs: { key: ConnectionType; label: string; count: number }[] = []
    if (showFriends) {
        tabs.push({ key: "friends", label: "Connections", count: graphCounts.friend_count })
    }
    tabs.push(
        { key: "followers", label: "Followers", count: graphCounts.follower_count },
        { key: "following", label: "Following", count: graphCounts.following_count },
    )
    if (isOwn) {
        tabs.push({ key: "blocked", label: "Blocked", count: blockedData?.items?.length ?? 0 })
    }

    const confirmName = confirmUnfollow ? confirmUnfollow.username || confirmUnfollow.display_name : ""

    return (
        <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveType(tab.key)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            activeType === tab.key
                                ? "bg-brand-text text-white shadow-xs"
                                : "bg-brand-text/5 text-brand-text hover:bg-brand-text/10"
                        }`}
                    >
                        {tab.label} ({tab.count})
                    </button>
                ))}
            </div>

            {/* Pending friend requests (own profile, friends tab) */}
            {isOwn && activeType === "friends" && showFriends && (
                <PendingRequestsList />
            )}

            {/* Blocked users tab */}
            {activeType === "blocked" && isOwn && (
                <BlockedUsersList />
            )}

            {/* Connection user lists */}
            {activeType !== "blocked" && (
                <>
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-14 bg-brand-text/50 rounded-xl animate-pulse" />
                            ))}
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-12 text-brand-text/60">
                            No {activeType} yet
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {users.map((user) => (
                                <ConnectionUserCard
                                    key={user.user_id}
                                    user={user}
                                    pill={connectionRowPill({
                                        rowUserId: user.user_id,
                                        viewerId,
                                        list: activeType,
                                        isOwn,
                                        relationship: relationships.get(user.user_id),
                                        override: overrides.get(user.user_id),
                                    })}
                                    busy={busyIds.has(user.user_id)}
                                    onPill={onPill}
                                />
                            ))}

                            {hasMore && (
                                <div className="pt-4 flex justify-center">
                                    <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                                        {loadingMore ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <ChevronDown className="mr-2 h-4 w-4" />
                                        )}
                                        {loadingMore ? "Loading…" : "Load more"}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* On document.body: the tab sits inside an animated (transformed)
                panel, which would trap a fixed overlay inside it. */}
            {confirmUnfollow && typeof document !== "undefined"
                ? createPortal(
                      <ConfirmDialog
                          open
                          onClose={() => setConfirmUnfollow(null)}
                          onConfirm={() => {
                              const user = confirmUnfollow
                              setConfirmUnfollow(null)
                              void unfollow(user)
                          }}
                          title={`Unfollow @${confirmName}?`}
                          description="Their posts will stop showing up for you. You can follow them again at any time."
                          confirmLabel="Unfollow"
                          cancelLabel="Cancel"
                          destructive
                      />,
                      document.body,
                  )
                : null}
        </div>
    )
}

function PendingRequestsList() {
    const { data: requestsData, isLoading } = usePendingFriendRequests()
    const acceptMutation = useAcceptFriendRequest()
    const rejectMutation = useRejectFriendRequest()

    const requests = requestsData?.items ?? []

    if (isLoading || requests.length === 0) return null

    return (
        <div className="space-y-2">
            <h3 className="text-sm font-semibold text-brand-text/60">
                Pending Requests ({requests.length})
            </h3>
            {requests.map((req) => (
                <div
                    key={req.user_id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-brand-text/50 border border-brand-text/10"
                >
                    <ConnectionUserAvatar user={req} size="md" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-brand-text truncate">
                            {req.display_name}
                        </p>
                        {req.username && (
                            <p className="text-xs text-brand-text/60 truncate">
                                @{req.username}
                            </p>
                        )}
                    </div>
                    <div className="flex gap-1">
                        <Button
                            size="sm"
                            variant="default"
                            onClick={() => acceptMutation.mutate(req.user_id)}
                            disabled={acceptMutation.isPending}
                        >
                            <Check className="h-4 w-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => rejectMutation.mutate(req.user_id)}
                            disabled={rejectMutation.isPending}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    )
}

function BlockedUsersList() {
    const { data: blockedData, isLoading } = useBlockedUsers(true)

    const blockedUsers = blockedData?.items ?? []

    if (isLoading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 bg-brand-text/50 rounded-xl animate-pulse" />
                ))}
            </div>
        )
    }

    if (blockedUsers.length === 0) {
        return (
            <div className="text-center py-12 text-brand-text/60">
                <ShieldOff className="h-10 w-10 mx-auto mb-3 text-brand-text/30" />
                <p>You have not blocked anyone</p>
            </div>
        )
    }

    // useBlockedUsers answers the whole list in one read (graph-service
    // blocked-and-muted, capped at 100), so there is no next page to load.
    return (
        <div className="space-y-1">
            {blockedUsers.map((block) => (
                <div
                    key={block.blocked_id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-red-50/50 transition-colors border border-transparent hover:border-red-100"
                >
                    <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-sm font-bold text-red-600">
                        {block.blocked_id.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-brand-text truncate">
                            {block.blocked_id}
                        </p>
                        {block.created_at ? (
                            <p className="text-xs text-brand-text/40">
                                Blocked {new Date(block.created_at).toLocaleDateString()}
                            </p>
                        ) : null}
                    </div>
                </div>
            ))}
        </div>
    )
}

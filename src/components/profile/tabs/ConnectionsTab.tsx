"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    useFollowers,
    useFollowing,
    useFriends,
    usePendingFriendRequests,
    useAcceptFriendRequest,
    useRejectFriendRequest,
} from "@/hooks/useConnections"
import type { ConnectionUser } from "@/hooks/useConnections"
import { useBlockedUsers } from "@/hooks/useBlocking"
import type { GraphCounts, AppPlatform } from "@/types/profile"
import { Check, X, ShieldOff, ChevronDown } from "lucide-react"

interface ConnectionsTabProps {
    userId: string
    graphCounts: GraphCounts
    platform: AppPlatform
    isOwn: boolean
}

type ConnectionType = "friends" | "followers" | "following" | "blocked"

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
        <div className={`${sizeClasses} rounded-full bg-violet-100 flex items-center justify-center font-bold text-violet-600`}>
            {getInitials(user.display_name)}
        </div>
    )
}

function ConnectionUserCard({ user }: { user: ConnectionUser }) {
    return (
        <a
            href={`/u/${user.username}`}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-violet-50/50 transition-colors border border-transparent hover:border-violet-100"
        >
            <ConnectionUserAvatar user={user} />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                    {user.display_name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                    @{user.username}
                </p>
            </div>
        </a>
    )
}

export function ConnectionsTab({ userId, graphCounts, platform, isOwn }: ConnectionsTabProps) {
    const showFriends = platform === "postboek"
    const [activeType, setActiveType] = useState<ConnectionType>(showFriends ? "friends" : "followers")

    const { data: followersData, isLoading: followersLoading } = useFollowers(
        activeType === "followers" ? userId : undefined
    )
    const { data: followingData, isLoading: followingLoading } = useFollowing(
        activeType === "following" ? userId : undefined
    )
    const { data: friendsData, isLoading: friendsLoading } = useFriends(
        activeType === "friends" ? userId : undefined
    )
    const { data: blockedData, isLoading: blockedLoading } = useBlockedUsers(
        isOwn && activeType === "blocked"
    )

    const isLoading =
        (activeType === "followers" && followersLoading) ||
        (activeType === "following" && followingLoading) ||
        (activeType === "friends" && friendsLoading) ||
        (activeType === "blocked" && blockedLoading)

    const currentData =
        activeType === "followers" ? followersData :
        activeType === "following" ? followingData :
        activeType === "friends" ? friendsData :
        null

    const users: ConnectionUser[] = currentData?.items ?? []
    const meta = currentData?.meta ?? null

    const tabs: { key: ConnectionType; label: string; count: number }[] = []
    if (showFriends) {
        tabs.push({ key: "friends", label: "Circle", count: graphCounts.friend_count })
    }
    tabs.push(
        { key: "followers", label: "Followers", count: graphCounts.follower_count },
        { key: "following", label: "Following", count: graphCounts.following_count },
    )
    if (isOwn) {
        tabs.push({ key: "blocked", label: "Blocked", count: blockedData?.items?.length ?? 0 })
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveType(tab.key)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            activeType === tab.key
                                ? "bg-violet-600 text-white shadow-sm"
                                : "bg-violet-50 text-violet-700 hover:bg-violet-100"
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
                                <div key={i} className="h-14 bg-violet-50/50 rounded-xl animate-pulse" />
                            ))}
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            No {activeType} yet
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {users.map((user) => (
                                <ConnectionUserCard key={user.user_id} user={user} />
                            ))}

                            {meta?.has_next && (
                                <div className="pt-4 flex justify-center">
                                    <Button variant="outline" size="sm">
                                        <ChevronDown className="mr-2 h-4 w-4" />
                                        Load More
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
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
            <h3 className="text-sm font-semibold text-gray-500">
                Pending Requests ({requests.length})
            </h3>
            {requests.map((req) => (
                <div
                    key={req.user_id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-violet-50/50 border border-violet-100"
                >
                    <ConnectionUserAvatar user={req} size="md" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                            {req.display_name}
                        </p>
                        {req.username && (
                            <p className="text-xs text-gray-500 truncate">
                                @{req.username}
                            </p>
                        )}
                    </div>
                    <div className="flex gap-1">
                        <Button
                            size="sm"
                            variant="default"
                            onClick={() => acceptMutation.mutate(req.friendship_id)}
                            disabled={acceptMutation.isPending}
                        >
                            <Check className="h-4 w-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => rejectMutation.mutate(req.friendship_id)}
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
                    <div key={i} className="h-14 bg-violet-50/50 rounded-xl animate-pulse" />
                ))}
            </div>
        )
    }

    if (blockedUsers.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                <ShieldOff className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <p>You have not blocked anyone</p>
            </div>
        )
    }

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
                        <p className="text-sm font-medium text-gray-900 truncate">
                            {block.blocked_id}
                        </p>
                        <p className="text-xs text-gray-400">
                            Blocked {new Date(block.created_at).toLocaleDateString()}
                        </p>
                    </div>
                </div>
            ))}

            {blockedData?.meta?.has_next && (
                <div className="pt-4 flex justify-center">
                    <Button variant="outline" size="sm">
                        <ChevronDown className="mr-2 h-4 w-4" />
                        Load More
                    </Button>
                </div>
            )}
        </div>
    )
}

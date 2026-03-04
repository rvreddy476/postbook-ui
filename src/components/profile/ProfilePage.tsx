"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthUser } from "@/store/auth"
import { useAggregatedProfile } from "@/hooks/useAggregatedProfile"
import { ProfileHeader } from "./ProfileHeader"
import { ProfileStats } from "./ProfileStats"
import { ProfileTabs } from "./ProfileTabs"
import { CreationsTab } from "./tabs/CreationsTab"
import { AboutTab } from "./tabs/AboutTab"
import { ConnectionsTab } from "./tabs/ConnectionsTab"
import { PagesTab } from "./tabs/PagesTab"
import { ActivityTab } from "./tabs/ActivityTab"
import { useFollowUser, useUnfollowUser } from "@/hooks/useEditProfile"
import { useSendFriendRequest, useAcceptFriendRequest, useRejectFriendRequest, useCancelFriendRequest, useRemoveFriend } from "@/hooks/useConnections"
import { useBlockUser, useUnblockUser } from "@/hooks/useBlocking"
import { useMuteUser, useUnmuteUser } from "@/hooks/useMuting"
import { useToast } from "@/components/ui/toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import type { UserProfile, ProfileTab, AppPlatform } from "@/types/profile"

interface ProfilePageProps {
    username: string
    platform?: AppPlatform
}

export function ProfilePage({ username, platform = "postboek" }: ProfilePageProps) {
    const localUser = useAuthUser()
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<ProfileTab>("creations")
    const [blockDialogOpen, setBlockDialogOpen] = useState(false)
    const [unblockDialogOpen, setUnblockDialogOpen] = useState(false)
    const [removeCircleDialogOpen, setRemoveCircleDialogOpen] = useState(false)
    const [isMuted, setIsMuted] = useState(false)

    const { toast, ToastContainer } = useToast()

    const { data, isLoading } = useAggregatedProfile(username)

    // Build a fallback profile from local session when backend is unreachable
    const fallbackProfile = useMemo<UserProfile | null>(() => {
        if (!localUser) return null
        if (localUser.id !== username) return null
        return {
            id: localUser.id,
            username: localUser.loginId ?? "",
            display_name: localUser.name,
            first_name: localUser.firstName,
            last_name: localUser.lastName,
            bio: localUser.bio ?? "",
            avatar_media_id: undefined,
            cover_media_id: undefined,
            category: "personal",
            profession: localUser.work,
            website: undefined,
            location: localUser.location,
            badge_flags: 0,
            is_verified: false,
            follower_count: 0,
            following_count: 0,
            friend_count: 0,
            post_count: 0,
            created_at: localUser.joinDate ?? new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }
    }, [localUser, username])

    const profile = data?.profile ?? fallbackProfile
    const links = data?.links ?? []
    const relationship = data?.relationship ?? null
    const avatarUrl = !data?.profile && fallbackProfile ? localUser?.avatar : undefined

    const graphCounts = data?.stats
        ? { follower_count: data.stats.follower_count, following_count: data.stats.following_count, friend_count: data.stats.friend_count }
        : { follower_count: 0, following_count: 0, friend_count: 0 }

    const contentCounts = data?.stats
        ? { post: data.stats.post, short: data.stats.short, video: data.stats.video, photo: data.stats.photo, total: data.stats.total }
        : { post: 0, short: 0, video: 0, photo: 0, total: 0 }

    const isOwn = !!localUser && !!profile && localUser.id === profile.id

    // Follow mutations
    const followMutation = useFollowUser()
    const unfollowMutation = useUnfollowUser()

    // Circle mutations
    const sendCircleRequest = useSendFriendRequest()
    const acceptCircleRequest = useAcceptFriendRequest()
    const declineCircleRequest = useRejectFriendRequest()
    const cancelCircleRequest = useCancelFriendRequest()
    const removeFromCircle = useRemoveFriend()

    // Block mutations
    const blockMutation = useBlockUser()
    const unblockMutation = useUnblockUser()

    // Mute mutations
    const muteMutation = useMuteUser()
    const unmuteMutation = useUnmuteUser()

    // Hydrate isMuted from sessionStorage once the profile id is known
    useEffect(() => {
        if (!profile?.id) return
        const stored = sessionStorage.getItem(`muted_${profile.id}`)
        setIsMuted(stored === "true")
    }, [profile?.id])

    // Follow handlers
    const handleFollow = useCallback(() => {
        if (!profile) return
        followMutation.mutate(profile.username || profile.id)
    }, [profile, followMutation])

    const handleUnfollow = useCallback(() => {
        if (!profile) return
        unfollowMutation.mutate(profile.username || profile.id)
    }, [profile, unfollowMutation])

    // Circle handlers
    const handleSendCircleRequest = useCallback(() => {
        if (!profile) return
        sendCircleRequest.mutate(profile.username || profile.id)
    }, [profile, sendCircleRequest])

    const handleAcceptCircleRequest = useCallback(() => {
        if (!relationship?.circle_request_id) return
        acceptCircleRequest.mutate(relationship.circle_request_id)
    }, [relationship, acceptCircleRequest])

    const handleDeclineCircleRequest = useCallback(() => {
        if (!relationship?.circle_request_id) return
        declineCircleRequest.mutate(relationship.circle_request_id)
    }, [relationship, declineCircleRequest])

    const handleCancelCircleRequest = useCallback(() => {
        if (!relationship?.circle_request_id) return
        cancelCircleRequest.mutate(relationship.circle_request_id)
    }, [relationship, cancelCircleRequest])

    const handleRemoveFromCircle = useCallback(() => {
        setRemoveCircleDialogOpen(true)
    }, [])

    const handleConfirmRemoveFromCircle = useCallback(() => {
        if (!profile) return
        removeFromCircle.mutate(profile.username || profile.id, {
            onSuccess: () => {
                setRemoveCircleDialogOpen(false)
            },
        })
    }, [profile, removeFromCircle])

    // Block handlers
    const handleBlock = useCallback(() => {
        setBlockDialogOpen(true)
    }, [])

    const handleConfirmBlock = useCallback(() => {
        if (!profile) return
        blockMutation.mutate(profile.username, {
            onSuccess: () => {
                setBlockDialogOpen(false)
            },
        })
    }, [profile, blockMutation])

    const handleUnblock = useCallback(() => {
        setUnblockDialogOpen(true)
    }, [])

    const handleConfirmUnblock = useCallback(() => {
        if (!profile) return
        unblockMutation.mutate(profile.username, {
            onSuccess: () => {
                setUnblockDialogOpen(false)
            },
        })
    }, [profile, unblockMutation])

    // Mute handlers
    const handleMute = useCallback(() => {
        if (!profile) return
        muteMutation.mutate({ muted_id: profile.id }, {
            onSuccess: () => {
                setIsMuted(true)
                sessionStorage.setItem(`muted_${profile.id}`, "true")
                toast({ type: "success", title: `@${profile.username} muted` })
            },
        })
    }, [profile, muteMutation, toast])

    const handleUnmute = useCallback(() => {
        if (!profile) return
        unmuteMutation.mutate({ muted_id: profile.id }, {
            onSuccess: () => {
                setIsMuted(false)
                sessionStorage.removeItem(`muted_${profile.id}`)
                toast({ type: "info", title: `@${profile.username} unmuted` })
            },
        })
    }, [profile, unmuteMutation, toast])

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto py-8 space-y-6">
                <div className="h-64 bg-muted/30 rounded-2xl animate-pulse" />
                <div className="h-16 bg-muted/30 rounded-lg animate-pulse" />
                <div className="h-10 bg-muted/30 rounded-lg animate-pulse" />
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="max-w-4xl mx-auto py-16 text-center">
                <h2 className="text-xl font-semibold">User not found</h2>
                <p className="text-muted-foreground mt-2">
                    The user @{username} doesn&apos;t exist.
                </p>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto pb-12 space-y-6">
            <ProfileHeader
                profile={profile}
                links={links}
                relationship={relationship}
                isOwn={isOwn}
                avatarUrl={avatarUrl}
                isMuted={isMuted}
                onFollow={handleFollow}
                onUnfollow={handleUnfollow}
                onSendCircleRequest={handleSendCircleRequest}
                onAcceptCircleRequest={handleAcceptCircleRequest}
                onDeclineCircleRequest={handleDeclineCircleRequest}
                onCancelCircleRequest={handleCancelCircleRequest}
                onRemoveFromCircle={handleRemoveFromCircle}
                onEditProfile={() => router.push("/settings/profile")}
                onBlock={handleBlock}
                onUnblock={handleUnblock}
                onMute={handleMute}
                onUnmute={handleUnmute}
            />

            <div className="px-4 space-y-6">
                <ProfileStats
                    graphCounts={graphCounts}
                    contentCounts={contentCounts}
                    platform={platform}
                />

                <ProfileTabs
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    platform={platform}
                />

                {activeTab === "creations" && (
                    <CreationsTab userId={profile.id} platform={platform} />
                )}
                {activeTab === "about" && (
                    <AboutTab profile={profile} />
                )}
                {activeTab === "connections" && (
                    <ConnectionsTab
                        userId={profile.id}
                        graphCounts={graphCounts}
                        platform={platform}
                        isOwn={isOwn}
                    />
                )}
                {activeTab === "pages" && <PagesTab />}
                {activeTab === "activity" && <ActivityTab />}
            </div>

            {/* Block Confirmation Dialog */}
            <ConfirmDialog
                open={blockDialogOpen}
                onClose={() => setBlockDialogOpen(false)}
                onConfirm={handleConfirmBlock}
                title={`Block @${profile.username}?`}
                description={`Are you sure you want to block @${profile.username}? They will not be able to see your profile, posts, or interact with you. You can unblock them later.`}
                confirmLabel="Block"
                destructive
                loading={blockMutation.isPending}
            />

            {/* Unblock Confirmation Dialog */}
            <ConfirmDialog
                open={unblockDialogOpen}
                onClose={() => setUnblockDialogOpen(false)}
                onConfirm={handleConfirmUnblock}
                title={`Unblock @${profile.username}?`}
                description={`Are you sure you want to unblock @${profile.username}? They will be able to see your profile and interact with you again.`}
                confirmLabel="Unblock"
                loading={unblockMutation.isPending}
            />

            {/* Remove from Circle Confirmation Dialog */}
            <ConfirmDialog
                open={removeCircleDialogOpen}
                onClose={() => setRemoveCircleDialogOpen(false)}
                onConfirm={handleConfirmRemoveFromCircle}
                title="Remove from Circle?"
                description={`Are you sure you want to remove @${profile.username} from your Circle? They won't be able to see your circle-only posts or message you. You can send a new request later.`}
                confirmLabel="Remove from Circle"
                destructive
                loading={removeFromCircle.isPending}
            />

            <ToastContainer />
        </div>
    )
}

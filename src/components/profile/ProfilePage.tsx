"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthUser } from "@/store/auth"
import { useAggregatedProfile } from "@/hooks/useAggregatedProfile"
import { ProfileHeader } from "./ProfileHeader"
import { ProfileTabs } from "./ProfileTabs"
import { CreationsTab } from "./tabs/CreationsTab"
import { AboutTab } from "./tabs/AboutTab"
import { ConnectionsTab } from "./tabs/ConnectionsTab"
import { VideosTab } from "./tabs/VideosTab"
import { FlicksTab } from "./tabs/FlicksTab"
import { StashedTab } from "./tabs/StashedTab"
import MutualFriendsCard from "./sidebar/MutualFriendsCard"
import LinksCard from "./sidebar/LinksCard"
import ProfileCompletionCard from "./sidebar/ProfileCompletionCard"
import { ProfileSkeleton } from "./states/ProfileSkeleton"
import { BlockedProfileView } from "./states/BlockedProfileView"
import { UnavailableProfileView } from "./states/UnavailableProfileView"
import { useFollowUser, useUnfollowUser } from "@/hooks/useEditProfile"
import {
    useSendFriendRequest,
    useAcceptFriendRequest,
    useRejectFriendRequest,
    useCancelFriendRequest,
    useRemoveFriend,
} from "@/hooks/useConnections"
import { useContentCounts } from "@/hooks/useProfilePosts"
import { useBlockUser, useUnblockUser } from "@/hooks/useBlocking"
import { useMuteUser, useUnmuteUser } from "@/hooks/useMuting"
import { useUserChannels } from "@/hooks/useChannels"
import { useToast } from "@/components/ui/toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Film, Clapperboard, Sparkles, ExternalLink } from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"
import type { UserProfile, ProfileTab } from "@/types/profile"

interface ProfilePageProps {
    username: string
}

export function ProfilePage({ username }: ProfilePageProps) {
    const localUser = useAuthUser()
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<ProfileTab>("posts")
    const [blockDialogOpen, setBlockDialogOpen] = useState(false)
    const [unblockDialogOpen, setUnblockDialogOpen] = useState(false)
    const [removeCircleDialogOpen, setRemoveCircleDialogOpen] = useState(false)
    const [isMuted, setIsMuted] = useState(false)
    const [isTabsSticky, setIsTabsSticky] = useState(false)
    const tabsSentinelRef = useRef<HTMLDivElement>(null)

    const { toast, ToastContainer } = useToast()
    const { data, isLoading } = useAggregatedProfile(username)
    const profile_ = data?.profile ?? null
    const { data: userChannels } = useUserChannels(profile_?.id)
    const primaryChannel = userChannels?.[0] ?? null
    const { data: directCounts } = useContentCounts(profile_?.id)

    // Sticky tabs with IntersectionObserver
    useEffect(() => {
        const sentinel = tabsSentinelRef.current
        if (!sentinel) return
        const observer = new IntersectionObserver(
            ([entry]) => setIsTabsSticky(!entry.isIntersecting),
            { threshold: 0, rootMargin: "-1px 0px 0px 0px" }
        )
        observer.observe(sentinel)
        return () => observer.disconnect()
    }, [])

    // Fallback profile from local session
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
    const avatarUrl = profile?.avatar_media_id
        ? undefined
        : localUser?.avatar || undefined
    const coverUrl = profile?.cover_media_id
        ? undefined
        : localUser?.coverImage || undefined

    const graphCounts = data?.stats
        ? {
              follower_count: data.stats.follower_count,
              following_count: data.stats.following_count,
              friend_count: data.stats.friend_count,
          }
        : { follower_count: 0, following_count: 0, friend_count: 0 }

    const contentCounts = directCounts
        ? directCounts
        : data?.stats
            ? {
                  post: data.stats.post,
                  reel: data.stats.reel,
                  video: data.stats.video,
                  total: data.stats.total,
              }
            : { post: 0, reel: 0, video: 0, total: 0 }

    const isOwn = !!localUser && !!profile && localUser.id === profile.id
    const hasVideos = contentCounts.video > 0
    const hasFlicks = contentCounts.reel > 0
    const hasCreatorContent = hasVideos || hasFlicks

    // Mutations
    const followMutation = useFollowUser()
    const unfollowMutation = useUnfollowUser()
    const sendCircleRequest = useSendFriendRequest()
    const acceptCircleRequest = useAcceptFriendRequest()
    const declineCircleRequest = useRejectFriendRequest()
    const cancelCircleRequest = useCancelFriendRequest()
    const removeFromCircle = useRemoveFriend()
    const blockMutation = useBlockUser()
    const unblockMutation = useUnblockUser()
    const muteMutation = useMuteUser()
    const unmuteMutation = useUnmuteUser()

    // Muted state from sessionStorage
    useEffect(() => {
        if (!profile?.id) return
        const stored = sessionStorage.getItem(`muted_${profile.id}`)
        setIsMuted(stored === "true")
    }, [profile?.id])

    // Handlers
    const handleFollow = useCallback(() => {
        if (!profile) return
        followMutation.mutate(profile.username || profile.id)
    }, [profile, followMutation])

    const handleUnfollow = useCallback(() => {
        if (!profile) return
        unfollowMutation.mutate(profile.username || profile.id)
    }, [profile, unfollowMutation])

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

    const handleRemoveFromCircle = useCallback(() => setRemoveCircleDialogOpen(true), [])

    const handleConfirmRemoveFromCircle = useCallback(() => {
        if (!profile) return
        removeFromCircle.mutate(profile.username || profile.id, {
            onSuccess: () => setRemoveCircleDialogOpen(false),
        })
    }, [profile, removeFromCircle])

    const handleBlock = useCallback(() => setBlockDialogOpen(true), [])

    const handleConfirmBlock = useCallback(() => {
        if (!profile) return
        blockMutation.mutate(profile.username, {
            onSuccess: () => setBlockDialogOpen(false),
        })
    }, [profile, blockMutation])

    const handleUnblock = useCallback(() => setUnblockDialogOpen(true), [])

    const handleConfirmUnblock = useCallback(() => {
        if (!profile) return
        unblockMutation.mutate(profile.username, {
            onSuccess: () => setUnblockDialogOpen(false),
        })
    }, [profile, unblockMutation])

    const handleMute = useCallback(() => {
        if (!profile) return
        muteMutation.mutate(
            { muted_id: profile.id },
            {
                onSuccess: () => {
                    setIsMuted(true)
                    sessionStorage.setItem(`muted_${profile.id}`, "true")
                    toast({ type: "success", title: `@${profile.username} muted` })
                },
            }
        )
    }, [profile, muteMutation, toast])

    const handleUnmute = useCallback(() => {
        if (!profile) return
        unmuteMutation.mutate(
            { muted_id: profile.id },
            {
                onSuccess: () => {
                    setIsMuted(false)
                    sessionStorage.removeItem(`muted_${profile.id}`)
                    toast({ type: "info", title: `@${profile.username} unmuted` })
                },
            }
        )
    }, [profile, unmuteMutation, toast])

    // --- Render states ---

    if (isLoading) return <ProfileSkeleton />

    if (relationship?.blocked_by) {
        return (
            <BlockedProfileView
                variant="blocked_by_them"
                onGoHome={() => router.push("/")}
            />
        )
    }

    if (!profile) {
        return <UnavailableProfileView />
    }

    if (relationship?.blocked) {
        return (
            <BlockedProfileView
                variant="blocked_by_viewer"
                username={profile.username}
                onUnblock={handleUnblock}
                onGoHome={() => router.push("/")}
            />
        )
    }

    return (
        <div className="w-full pb-12">
            {/* Header: Cover + 3-col grid + Bio */}
            <ProfileHeader
                profile={profile}
                links={links}
                relationship={relationship}
                isOwn={isOwn}
                avatarUrl={avatarUrl}
                coverUrl={coverUrl}
                isMuted={isMuted}
                graphCounts={graphCounts}
                contentCounts={contentCounts}
                channel={primaryChannel}
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
                onUploadError={(msg) => toast({ type: "error", title: msg })}
            />

            {/* Sentinel for sticky tabs */}
            <div ref={tabsSentinelRef} className="h-0" />

            {/* Sticky tab bar */}
            <div
                className={`${
                    isTabsSticky
                        ? "sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-slate-100 shadow-sm"
                        : ""
                } transition-all duration-200`}
            >
                <div className="max-w-[1200px] mx-auto px-6 sm:px-8">
                    <ProfileTabs
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        isOwn={isOwn}
                        hasVideos={hasVideos}
                        hasFlicks={hasFlicks}
                        hasMedia={false}
                        isSticky={isTabsSticky}
                    />
                </div>
            </div>

            {/* Main content: 70/30 split (or 100% if no creator content) */}
            <div className="max-w-[1200px] mx-auto px-6 sm:px-8 mt-6">
                <div className={`flex gap-6 ${hasCreatorContent ? "" : ""}`}>
                    {/* Main content — 70% or 100% */}
                    <div className={`min-w-0 ${hasCreatorContent ? "flex-[7]" : "flex-1"}`}>
                        {activeTab === "posts" && (
                            <CreationsTab userId={profile.id} platform="postboek" />
                        )}
                        {activeTab === "about" && <AboutTab profile={profile} links={links} />}
                        {activeTab === "connections" && (
                            <ConnectionsTab
                                userId={profile.id}
                                graphCounts={graphCounts}
                                platform="postboek"
                                isOwn={isOwn}
                            />
                        )}
                        {activeTab === "videos" && (
                            <VideosTab userId={profile.id} isOwn={isOwn} />
                        )}
                        {activeTab === "flicks" && (
                            <FlicksTab userId={profile.id} isOwn={isOwn} />
                        )}
                        {activeTab === "stashed" && <StashedTab userId={profile.id} />}
                    </div>

                    {/* Right sidebar — Studio Stats (30%) — only if creator content exists */}
                    {hasCreatorContent && (
                        <aside className="hidden lg:block flex-[3] shrink-0 space-y-4">
                            {/* Studio Stats Card */}
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25 }}
                                className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
                            >
                                <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 px-5 py-3.5">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/90">
                                        Studio Stats
                                    </h3>
                                </div>

                                <div className="p-5 space-y-4">
                                    {contentCounts.video > 0 && (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-xl bg-[#D8103F]/10">
                                                    <Film className="h-4 w-4 text-[#D8103F]" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">Posttube Videos</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">Long-form content</p>
                                                </div>
                                            </div>
                                            <span className="text-lg font-black text-slate-900">
                                                {contentCounts.video.toLocaleString()}
                                            </span>
                                        </div>
                                    )}

                                    {contentCounts.reel > 0 && (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-xl bg-rose-50">
                                                    <Clapperboard className="h-4 w-4 text-rose-500" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">Flicks</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">Short-form clips</p>
                                                </div>
                                            </div>
                                            <span className="text-lg font-black text-slate-900">
                                                {contentCounts.reel.toLocaleString()}
                                            </span>
                                        </div>
                                    )}

                                    {contentCounts.total > 0 && (
                                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-xl bg-amber-50">
                                                    <Sparkles className="h-4 w-4 text-amber-500" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">Total Sparks</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">All-time engagement</p>
                                                </div>
                                            </div>
                                            <span className="text-lg font-black text-slate-900">
                                                {contentCounts.total.toLocaleString()}
                                            </span>
                                        </div>
                                    )}

                                    <Link
                                        href={`/posttube/channel/${profile.username}`}
                                        className="flex items-center justify-center gap-2 mt-2 w-full py-3 rounded-xl bg-[#D8103F] text-white text-xs font-black uppercase tracking-[0.2em] hover:bg-[#b80d35] transition-all shadow-lg shadow-[#D8103F]/20"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        View Channel
                                    </Link>
                                </div>
                            </motion.div>

                            {/* Additional sidebar cards */}
                            {!isOwn && localUser && (
                                <MutualFriendsCard
                                    viewerId={localUser.id}
                                    profileId={profile.id}
                                    isOwn={isOwn}
                                />
                            )}

                            {links.length > 0 && <LinksCard links={links} />}

                            {isOwn && (
                                <ProfileCompletionCard
                                    profile={profile}
                                    onEditProfile={() => router.push("/settings/profile")}
                                />
                            )}
                        </aside>
                    )}
                </div>

                {/* Mobile: sidebar cards below main content */}
                <div className="lg:hidden mt-6 space-y-4">
                    {hasCreatorContent && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
                        >
                            <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 px-5 py-3">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/90">Studio Stats</h3>
                            </div>
                            <div className="p-4 flex items-center justify-between gap-4">
                                {contentCounts.video > 0 && (
                                    <div className="flex items-center gap-2">
                                        <Film className="h-4 w-4 text-[#D8103F]" />
                                        <span className="text-sm font-bold">{contentCounts.video} Videos</span>
                                    </div>
                                )}
                                {contentCounts.reel > 0 && (
                                    <div className="flex items-center gap-2">
                                        <Clapperboard className="h-4 w-4 text-rose-500" />
                                        <span className="text-sm font-bold">{contentCounts.reel} Flicks</span>
                                    </div>
                                )}
                                <Link
                                    href={`/posttube/channel/${profile.username}`}
                                    className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#D8103F] text-white text-xs font-bold"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    Channel
                                </Link>
                            </div>
                        </motion.div>
                    )}
                    {!isOwn && localUser && (
                        <MutualFriendsCard
                            viewerId={localUser.id}
                            profileId={profile.id}
                            isOwn={isOwn}
                        />
                    )}
                    {isOwn && (
                        <ProfileCompletionCard
                            profile={profile}
                            onEditProfile={() => router.push("/settings/profile")}
                        />
                    )}
                </div>
            </div>

            {/* Confirmation Dialogs */}
            <ConfirmDialog
                open={blockDialogOpen}
                onClose={() => setBlockDialogOpen(false)}
                onConfirm={handleConfirmBlock}
                title={`Block @${profile.username}?`}
                description={`Are you sure you want to block @${profile.username}? They will not be able to see your profile, posts, or interact with you.`}
                confirmLabel="Block"
                destructive
                loading={blockMutation.isPending}
            />
            <ConfirmDialog
                open={unblockDialogOpen}
                onClose={() => setUnblockDialogOpen(false)}
                onConfirm={handleConfirmUnblock}
                title={`Unblock @${profile.username}?`}
                description={`Are you sure you want to unblock @${profile.username}? They will be able to see your profile and interact with you again.`}
                confirmLabel="Unblock"
                loading={unblockMutation.isPending}
            />
            <ConfirmDialog
                open={removeCircleDialogOpen}
                onClose={() => setRemoveCircleDialogOpen(false)}
                onConfirm={handleConfirmRemoveFromCircle}
                title="Remove from Circle?"
                description={`Remove @${profile.username} from your Circle? They won't see your circle-only posts or message you.`}
                confirmLabel="Remove"
                destructive
                loading={removeFromCircle.isPending}
            />

            <ToastContainer />
        </div>
    )
}

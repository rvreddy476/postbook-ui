"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useAuthUser } from "@/store/auth"
import { useAggregatedProfile } from "@/hooks/useAggregatedProfile"
import { ProfileHeader } from "./ProfileHeader"
import { ProfileTabs } from "./ProfileTabs"
import ProfileQASection from "./ProfileQASection"
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
    useRemoveFriend,
} from "@/hooks/useConnections"
import { useContentCounts } from "@/hooks/useProfilePosts"
import { useBlockUser, useUnblockUser } from "@/hooks/useBlocking"
import { useMuteUser, useUnmuteUser } from "@/hooks/useMuting"
import { useUserChannels } from "@/hooks/useChannels"
import { useToast } from "@/components/ui/toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
    Film,
    Clapperboard,
    Sparkles,
    ExternalLink,
    Pin,
    QrCode,
    X,
    Plus,
    Loader2,
    ShoppingBag,
    CalendarCheck,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { UserProfile, ProfileTab, ProfilePin, PortfolioItem, ProfileQRCode } from "@/types/profile"

interface ProfilePageProps {
    username: string
}

// ── QR Code modal ─────────────────────────────────────────────────────────────
function QRCodeModal({ onClose }: { onClose: () => void }) {
    const { data: qr, isLoading } = useQuery<ProfileQRCode>({
        queryKey: ["qr-code"],
        queryFn: () =>
            api.get("/v1/users/me/qr").then((r) => r.data?.data ?? r.data),
    })
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        const urlToCopy = qr?.profile_url ?? qr?.qr_url ?? ""
        navigator.clipboard.writeText(urlToCopy).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-brand-card rounded-2xl shadow-2xl w-full max-w-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-brand-divider">
                    <h2 className="text-base font-bold text-brand-text">Your Profile QR Code</h2>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-brand-secondary transition-colors">
                        <X className="w-4 h-4 text-brand-highlight" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-brand-text/30" />
                        </div>
                    ) : (
                        <>
                            {/* QR placeholder styled box */}
                            <div className="border-4 border-slate-900 rounded-2xl p-4 mx-auto w-48 h-48 flex flex-col items-center justify-center bg-brand-card">
                                <div className="grid grid-cols-5 gap-0.5">
                                    {Array.from({ length: 25 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className={`w-7 h-7 rounded-sm ${
                                                [0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24,7,12,17].includes(i)
                                                    ? "bg-slate-900"
                                                    : "bg-brand-card"
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="text-center space-y-1">
                                <p className="text-xs font-semibold text-brand-highlight">Share Profile</p>
                                {qr?.profile_url && (
                                    <p className="text-[11px] text-brand-text/60 break-all font-mono bg-brand-secondary rounded-lg px-3 py-1.5">
                                        {qr.profile_url}
                                    </p>
                                )}
                                {typeof qr?.scan_count === "number" && (
                                    <p className="text-[11px] text-brand-text/60">
                                        Scanned{" "}
                                        <span className="font-bold text-brand-highlight">{qr.scan_count}</span>{" "}
                                        {qr.scan_count === 1 ? "time" : "times"}
                                    </p>
                                )}
                            </div>

                            <button
                                onClick={handleCopy}
                                className="w-full py-2.5 rounded-xl bg-brand-text text-white text-xs font-bold hover:bg-brand-text transition-colors"
                            >
                                {copied ? "Copied!" : "Copy Link"}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

// ── Pinned Posts section ───────────────────────────────────────────────────────
function PinnedSection({ userId, isOwn }: { userId: string; isOwn: boolean }) {
    const qc = useQueryClient()
    const { data: pins = [] } = useQuery<ProfilePin[]>({
        queryKey: ["pins", userId],
        queryFn: () =>
            api.get(`/v1/users/${userId}/pins`).then((r) => r.data?.data?.items ?? []),
    })

    const unpinMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/v1/users/me/pins/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["pins", userId] }),
    })

    if (pins.length === 0) return null

    const CONTENT_TYPE_COLORS: Record<string, string> = {
        post: "bg-blue-50 text-blue-600 border-blue-100",
        video: "bg-brand-text/10 text-brand-text border-brand-text/20",
        reel: "bg-rose-50 text-rose-500 border-rose-100",
    }

    return (
        <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
                <Pin className="w-3.5 h-3.5 text-brand-text" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-highlight">Pinned</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {pins.map((pin) => (
                    <div
                        key={pin.id}
                        className="flex items-center gap-2 bg-brand-card border border-brand-divider rounded-xl px-3 py-2 shadow-sm"
                    >
                        <Pin className="w-3 h-3 text-brand-text shrink-0" />
                        <span className="text-xs font-medium text-brand-text max-w-[120px] truncate">
                            {pin.content_id}
                        </span>
                        <span
                            className={`text-[9px] font-bold uppercase tracking-wider border px-1.5 py-0.5 rounded-md ${
                                CONTENT_TYPE_COLORS[pin.content_type] ?? "bg-brand-secondary text-brand-text/60 border-brand-divider"
                            }`}
                        >
                            {pin.content_type}
                        </span>
                        {isOwn && (
                            <button
                                onClick={() => unpinMutation.mutate(pin.id)}
                                disabled={unpinMutation.isPending}
                                className="ml-1 text-brand-text/30 hover:text-brand-text transition-colors disabled:opacity-40"
                                title="Unpin"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Profile tab content: Portfolio ────────────────────────────────────────────
function PortfolioTabContent({ userId, isOwn }: { userId: string; isOwn: boolean }) {
    const qc = useQueryClient()
    const [showAdd, setShowAdd] = useState(false)
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [url, setUrl] = useState("")
    const [itemType, setItemType] = useState("project")

    const { data: items = [], isLoading } = useQuery<PortfolioItem[]>({
        queryKey: ["portfolio", userId],
        queryFn: () =>
            api.get(`/v1/users/${userId}/portfolio`).then((r) => r.data?.data?.items ?? []),
    })

    const addMutation = useMutation({
        mutationFn: () =>
            api.post("/v1/users/me/portfolio", {
                title,
                description,
                url,
                item_type: itemType,
                display_order: 0,
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["portfolio", userId] })
            setShowAdd(false)
            setTitle("")
            setDescription("")
            setUrl("")
            setItemType("project")
        },
    })

    const ITEM_TYPE_COLORS: Record<string, string> = {
        project: "bg-blue-50 text-blue-600 border-blue-100",
        article: "bg-emerald-50 text-emerald-600 border-emerald-100",
        video: "bg-brand-text/10 text-brand-text border-brand-text/20",
        design: "bg-violet-50 text-violet-600 border-violet-100",
        other: "bg-brand-secondary text-brand-highlight border-brand-divider",
    }

    return (
        <div className="space-y-4">
            {isOwn && (
                <div className="flex justify-end">
                    <button
                        onClick={() => setShowAdd((v) => !v)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-text text-white text-xs font-bold hover:bg-brand-text transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Item
                    </button>
                </div>
            )}

            {isOwn && showAdd && (
                <div className="border border-brand-text/20 rounded-xl p-4 bg-brand-text/5 space-y-3">
                    <p className="text-xs font-bold text-brand-text uppercase tracking-wider">New Portfolio Item</p>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Title *"
                        className="w-full text-sm border border-brand-divider rounded-xl px-3 py-2 outline-none focus:border-brand-text/50"
                    />
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Description"
                        rows={2}
                        className="w-full text-sm border border-brand-divider rounded-xl px-3 py-2 outline-none focus:border-brand-text/50 resize-none"
                    />
                    <input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="URL (optional)"
                        type="url"
                        className="w-full text-sm border border-brand-divider rounded-xl px-3 py-2 outline-none focus:border-brand-text/50"
                    />
                    <select
                        value={itemType}
                        onChange={(e) => setItemType(e.target.value)}
                        className="w-full text-sm border border-brand-divider rounded-xl px-3 py-2 outline-none focus:border-brand-text/50 bg-brand-card"
                    >
                        <option value="project">Project</option>
                        <option value="article">Article</option>
                        <option value="video">Video</option>
                        <option value="design">Design</option>
                        <option value="other">Other</option>
                    </select>
                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={() => addMutation.mutate()}
                            disabled={!title.trim() || addMutation.isPending}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-text text-white text-xs font-bold disabled:opacity-40 hover:bg-brand-text transition-colors"
                        >
                            {addMutation.isPending ? (
                                <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>
                            ) : "Save"}
                        </button>
                        <button
                            onClick={() => setShowAdd(false)}
                            className="px-4 py-2 rounded-xl bg-brand-secondary text-brand-highlight text-xs font-bold hover:bg-brand-secondary transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-brand-text/30" />
                </div>
            ) : items.length === 0 ? (
                <div className="py-16 text-center text-sm text-brand-text/60">No portfolio items yet</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((item) => (
                        <div
                            key={item.id}
                            className="border border-brand-divider rounded-xl p-4 bg-brand-card shadow-sm hover:shadow-md transition-shadow space-y-2"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-bold text-brand-text line-clamp-1">{item.title}</p>
                                <span
                                    className={`shrink-0 text-[9px] font-bold uppercase tracking-wider border px-1.5 py-0.5 rounded-md ${
                                        ITEM_TYPE_COLORS[item.item_type] ?? ITEM_TYPE_COLORS.other
                                    }`}
                                >
                                    {item.item_type}
                                </span>
                            </div>
                            {item.description && (
                                <p className="text-xs text-brand-highlight line-clamp-2">{item.description}</p>
                            )}
                            {item.url && (
                                <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-text hover:underline"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    View
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function ComingSoonTab({
    icon,
    title,
    description,
    accent,
}: {
    icon: ReactNode
    title: string
    description: string
    accent: string
}) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`relative overflow-hidden rounded-3xl border border-brand-divider bg-gradient-to-br ${accent} px-6 py-16 text-center`}
        >
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-card shadow-sm">
                {icon}
            </div>
            <h3 className="mt-6 text-xl font-bold text-brand-text">{title}</h3>
            <p className="mt-2 text-sm text-brand-highlight max-w-md mx-auto">
                {description}
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-brand-card/80 backdrop-blur px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-text shadow-sm">
                <Sparkles className="w-3 h-3" />
                Coming soon
            </span>
        </motion.div>
    )
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
    const [qrModalOpen, setQrModalOpen] = useState(false)
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

    // Helpers
    const authErrMsg = (e: unknown) =>
        (e as { response?: { status?: number } })?.response?.status === 401
            ? "Authentication error — please try again or log in again if it persists"
            : "Something went wrong. Please try again."

    // Handlers
    const handleFollow = useCallback(() => {
        if (!profile) return
        followMutation.mutate(profile.username || profile.id, {
            onError: (e) => toast({ type: "error", title: authErrMsg(e) }),
        })
    }, [profile, followMutation, toast])

    const handleUnfollow = useCallback(() => {
        if (!profile) return
        unfollowMutation.mutate(profile.username || profile.id, {
            onError: (e) => toast({ type: "error", title: authErrMsg(e) }),
        })
    }, [profile, unfollowMutation, toast])

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
        <div className="w-full pb-28 md:pb-12">
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
                onRemoveFromCircle={handleRemoveFromCircle}
                onEditProfile={() => router.push("/settings/profile")}
                onBlock={handleBlock}
                onUnblock={handleUnblock}
                onMute={handleMute}
                onUnmute={handleUnmute}
                onUploadError={(msg) => toast({ type: "error", title: msg })}
            />

            {/* QR Code button (own profile only) */}
            {isOwn && (
                <div className="max-w-[1200px] mx-auto px-4 sm:px-8 pt-3 flex justify-end">
                    <button
                        onClick={() => setQrModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-brand-divider text-brand-highlight text-xs font-semibold hover:bg-brand-secondary hover:border-brand-text/30 transition-all"
                    >
                        <QrCode className="w-3.5 h-3.5" />
                        QR Code
                    </button>
                </div>
            )}

            {/* Sentinel for sticky tabs */}
            <div ref={tabsSentinelRef} className="h-0" />

            {/* Sticky tab bar */}
            <div
                className={`${
                    isTabsSticky
                        ? "sticky top-0 z-30 bg-brand-card/95 backdrop-blur-xl border-b border-brand-divider shadow-sm"
                        : ""
                } transition-all duration-200`}
            >
                <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
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
            <div className="max-w-[1200px] mx-auto px-4 sm:px-8 mt-6">
                {/* Pinned posts (shown above tabs content for all tab states) */}
                {activeTab === "posts" && (
                    <PinnedSection userId={profile.id} isOwn={isOwn} />
                )}

                <div className={`flex gap-6 ${hasCreatorContent ? "" : ""}`}>
                    {/* Main content — 70% or 100% */}
                    <div className={`min-w-0 ${hasCreatorContent ? "flex-[7]" : "flex-1"}`}>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.22, ease: "easeOut" }}
                            >
                                {activeTab === "posts" && (
                                    <CreationsTab userId={profile.id} platform="postboek" />
                                )}
                                {activeTab === "about" && (
                                    <AboutTab profile={profile} links={links} />
                                )}
                                {activeTab === "connections" && (
                                    <ConnectionsTab
                                        userId={profile.id}
                                        graphCounts={graphCounts}
                                        platform="postboek"
                                        isOwn={isOwn}
                                    />
                                )}
                                {activeTab === "qa" && (
                                    <ProfileQASection userId={profile.id} />
                                )}
                                {activeTab === "videos" && (
                                    <VideosTab userId={profile.id} isOwn={isOwn} />
                                )}
                                {activeTab === "flicks" && (
                                    <FlicksTab userId={profile.id} isOwn={isOwn} />
                                )}
                                {activeTab === "orders" && (
                                    <ComingSoonTab
                                        icon={<ShoppingBag className="w-10 h-10 text-emerald-500" />}
                                        title="Orders"
                                        description="Your purchase history, deliveries, and order tracking will live here."
                                        accent="from-emerald-50 to-emerald-100/40"
                                    />
                                )}
                                {activeTab === "bookings" && (
                                    <ComingSoonTab
                                        icon={<CalendarCheck className="w-10 h-10 text-blue-500" />}
                                        title="Bookings"
                                        description="Appointments, reservations, and scheduled sessions will appear here."
                                        accent="from-blue-50 to-blue-100/40"
                                    />
                                )}
                                {activeTab === "stashed" && <StashedTab userId={profile.id} />}
                                {activeTab === "portfolio" && (
                                    <PortfolioTabContent userId={profile.id} isOwn={isOwn} />
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Right sidebar — additional cards (mutual friends, links, completion) */}
                    {hasCreatorContent && (
                        <aside className="hidden lg:block flex-[3] shrink-0 space-y-4">
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

            {/* QR Code modal */}
            {qrModalOpen && <QRCodeModal onClose={() => setQrModalOpen(false)} />}

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

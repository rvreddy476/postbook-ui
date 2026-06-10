"use client"

import { useRef, useCallback, useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { UserProfile, UserLink, Relationship, ContentCounts, GraphCounts, Channel } from "@/types/profile"
import { getBadges } from "@/types/profile"
import {
    BadgeCheck,
    Briefcase,
    Sparkles,
    MapPin,
    Globe,
    Calendar,
    Camera,
    Loader2,
    ImageIcon,
    FileText,
    Users,
    Settings,
    MessageSquare,
    CheckCircle2,
    ExternalLink,
    Eye,
    Lock,
    Film,
    Clapperboard,
    Play,
    Crown,
    Coffee,
    Sun,
    Moon,
} from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"
import api from "@/lib/api"
import { uploadMedia } from "@/lib/mediaUpload"
import TierPicker from "@/components/monetization/TierPicker"
import TipComposer from "@/components/monetization/TipComposer"

interface ProfileHeaderProps {
    profile: UserProfile
    links: UserLink[]
    relationship: Relationship | null
    isOwn: boolean
    avatarUrl?: string
    coverUrl?: string
    isMuted?: boolean
    graphCounts: GraphCounts
    contentCounts: ContentCounts
    channel: Channel | null
    onFollow: () => void
    onUnfollow: () => void
    onSendCircleRequest: () => void
    onAcceptCircleRequest: () => void
    onDeclineCircleRequest: () => void
    onCancelCircleRequest: () => void
    onRemoveFromCircle: () => void
    onEditProfile: () => void
    onMessage?: () => void
    onBlock?: () => void
    onUnblock?: () => void
    onMute?: () => void
    onUnmute?: () => void
    onUploadError?: (message: string) => void
}

const badgeConfig: Record<string, { icon: typeof BadgeCheck; color: string; bg: string }> = {
    verified: { icon: BadgeCheck, color: "text-teal-600", bg: "bg-teal-50 border-teal-100" },
    creator: { icon: Sparkles, color: "text-brand-text", bg: "bg-brand-text/10 border-brand-text/20" },
    business: { icon: Briefcase, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
}

function formatJoinDate(dateStr: string): string {
    const d = new Date(dateStr)
    return `Joined ${d.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`
}

function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toString()
}

export function ProfileHeader({
    profile,
    links,
    relationship,
    isOwn,
    avatarUrl,
    coverUrl,
    isMuted,
    graphCounts,
    contentCounts,
    channel,
    // onFollow / onUnfollow stay in the props contract so callers don't
    // break; user profile no longer renders Follow per spec §4.1, so the
    // handlers are intentionally not destructured here.
    onSendCircleRequest,
    onAcceptCircleRequest,
    onDeclineCircleRequest,
    onCancelCircleRequest,
    onRemoveFromCircle,
    onEditProfile,
    onMessage,
    onBlock,
    onUnblock,
    onMute,
    onUnmute,
    onUploadError,
}: ProfileHeaderProps) {
    const qc = useQueryClient()
    const avatarInputRef = useRef<HTMLInputElement>(null)
    const coverInputRef = useRef<HTMLInputElement>(null)

    const badges = getBadges(profile.badge_flags)
    const [avatarFails, setAvatarFails] = useState(0)
    const [coverFails, setCoverFails] = useState(0)
    const [theme, setTheme] = useState<string>("light")

    useEffect(() => {
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem("postbook_theme") || "light"
            setTheme(stored)
        }
    }, [])

    const toggleTheme = () => {
        const next = theme === "dark" ? "light" : "dark"
        setTheme(next)
        if (typeof window !== "undefined") {
            localStorage.setItem("postbook_theme", next)
            if (next === "dark") {
                document.documentElement.classList.add("dark")
                document.documentElement.classList.remove("light")
                document.documentElement.style.colorScheme = "dark"
            } else {
                document.documentElement.classList.add("light")
                document.documentElement.classList.remove("dark")
                document.documentElement.style.colorScheme = "light"
            }
        }
    }

    useEffect(() => { setAvatarFails(0) }, [profile.avatar_media_id])
    useEffect(() => { setCoverFails(0) }, [profile.cover_media_id])

    const avatarSources = [
        profile.avatar_media_id ? `/v1/media/${profile.avatar_media_id}/serve` : null,
        avatarUrl ?? null,
    ].filter(Boolean)
    const coverSources = [
        profile.cover_media_id ? `/v1/media/${profile.cover_media_id}/serve` : null,
        coverUrl ?? null,
    ].filter(Boolean)

    const resolvedAvatar = avatarSources[avatarFails] ?? null
    const resolvedCover = coverSources[coverFails] ?? null
    const followsYou = relationship?.followed_by ?? false
    // isFollowing removed alongside the Follow button — user profiles don't
    // expose follower state per relationship-separation spec §4.1.
    const inCircle = relationship?.in_circle ?? false
    const canDM = relationship?.can_dm ?? false
    // Tier 3 monetization modals
    const [showTierPicker, setShowTierPicker] = useState(false)
    const [showTipComposer, setShowTipComposer] = useState(false)

    const uploadMutation = useMutation({
        mutationFn: async ({ file, field }: { file: File; field: "avatar_media_id" | "cover_media_id" }) => {
            const mediaId = await uploadMedia(file, "image", field === "avatar_media_id" ? "avatar" : "cover")
            const endpoint = field === "avatar_media_id" ? "/v1/profiles/me/avatar" : "/v1/profiles/me/cover"
            await api.put(endpoint, { media_id: mediaId })
            return { field, mediaId }
        },
        onSuccess: (_data, variables) => {
            if (variables.field === "avatar_media_id") setAvatarFails(0)
            if (variables.field === "cover_media_id") setCoverFails(0)
            qc.invalidateQueries({ queryKey: ["profile"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
            qc.invalidateQueries({ queryKey: ["my-profile"] })
        },
        onError: (error: Error) => {
            const msg = error.message?.includes("401")
                ? "Session expired. Please log in again."
                : `Upload failed: ${error.message}`
            onUploadError?.(msg)
        },
    })

    const handleFileSelect = useCallback(
        (field: "avatar_media_id" | "cover_media_id") => (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0]
            if (file) uploadMutation.mutate({ file, field })
        },
        [uploadMutation]
    )

    return (
        <div className="w-full bg-brand-card border-b border-black/5">
            {/* Hidden file inputs */}
            <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleFileSelect("avatar_media_id")} />
            <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={handleFileSelect("cover_media_id")} />

            {/* 1. Cover Photo — half-height hero */}
            <div className="relative h-[200px] sm:h-[280px] lg:h-[320px] w-full overflow-hidden">
                {resolvedCover ? (
                    <img
                        src={resolvedCover}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={() => setCoverFails((n) => n + 1)}
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-brand-secondary via-brand-text/10 to-brand-secondary" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/10" />

                {/* Cover actions */}
                <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                    {isOwn && (
                        <>
                            <button
                                onClick={() => coverInputRef.current?.click()}
                                className="flex items-center gap-2 px-3.5 py-2 bg-black/30 backdrop-blur-md text-white text-xs font-semibold rounded-xl hover:bg-black/50 transition-all border border-white/10"
                            >
                                {uploadMutation.isPending && uploadMutation.variables?.field === "cover_media_id" ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <ImageIcon className="w-3.5 h-3.5" />
                                )}
                                Edit cover
                            </button>
                            <button className="flex items-center gap-2 px-3.5 py-2 bg-black/30 backdrop-blur-md text-white text-xs font-semibold rounded-xl hover:bg-black/50 transition-all border border-white/10">
                                <Eye className="w-3.5 h-3.5" />
                                Public
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* 2. Identity row: Profile Pic | Intro | Stats — sits cleanly below the cover */}
            <div className="max-w-[1200px] mx-auto px-6 sm:px-8">
                <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-6 lg:gap-10 -mt-14 sm:-mt-16 pb-8 items-start">

                    {/* Left: Profile Picture */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className="relative group justify-self-center md:justify-self-start z-10"
                    >
                        <div className="h-28 w-28 sm:h-36 sm:w-36 md:h-40 md:w-40 rounded-[1.5rem] sm:rounded-3xl overflow-hidden border-[4px] sm:border-[6px] border-brand-card shadow-xl bg-brand-secondary relative">
                            {resolvedAvatar ? (
                                <img
                                    src={resolvedAvatar}
                                    alt={profile.display_name}
                                    className="w-full h-full object-cover"
                                    onError={() => setAvatarFails((n) => n + 1)}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-5xl font-black text-brand-card bg-gradient-to-br from-brand-text/70 to-brand-text uppercase">
                                    {(profile.display_name || "?").charAt(0)}
                                </div>
                            )}

                            {uploadMutation.isPending && uploadMutation.variables?.field === "avatar_media_id" && (
                                <div className="absolute inset-0 bg-brand-card/70 backdrop-blur-sm flex items-center justify-center">
                                    <Loader2 className="w-7 h-7 animate-spin text-brand-text" />
                                </div>
                            )}
                        </div>

                        {/* Verified badge */}
                        {profile.is_verified && (
                            <div className="absolute -bottom-1.5 -right-1.5 bg-black text-white p-2 rounded-xl shadow-lg z-10">
                                <CheckCircle2 size={18} fill="white" className="text-black" />
                            </div>
                        )}

                        {/* Camera overlay for own profile */}
                        {isOwn && (
                            <button
                                onClick={() => avatarInputRef.current?.click()}
                                className="absolute bottom-1 right-1 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 rounded-xl cursor-pointer hover:bg-black/80 transition-all shadow-lg border border-white/10"
                            >
                                <Camera className="w-4 h-4 text-white" />
                            </button>
                        )}
                    </motion.div>

                    {/* Middle: Intro */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.05 }}
                        className="space-y-2.5 text-center md:text-left md:pt-[4.5rem]"
                    >
                        {/* Name + badges */}
                        <div className="flex items-center gap-2.5 justify-center md:justify-start flex-wrap">
                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-brand-text">
                                {profile.display_name}
                            </h1>
                            {badges.map((badge) => {
                                const cfg = badgeConfig[badge]
                                if (!cfg) return null
                                const Icon = cfg.icon
                                return (
                                    <span
                                        key={badge}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border ${cfg.bg} ${cfg.color}`}
                                    >
                                        <Icon className="h-3 w-3" />
                                        {badge}
                                    </span>
                                )
                            })}
                            {!isOwn && followsYou && (
                                <span className="text-[9px] font-bold text-brand-text/60 bg-brand-secondary px-2 py-0.5 rounded-md uppercase tracking-wider">
                                    Follows you
                                </span>
                            )}
                        </div>

                        {/* Handle */}
                        <p className="text-brand-text/50 font-medium tracking-wide text-sm">@{profile.username}</p>

                        {/* Meta chips */}
                        <div className="flex items-center gap-x-4 gap-y-1.5 pt-1 text-xs font-medium text-brand-text/60 justify-center md:justify-start flex-wrap">
                            {profile.profession && (
                                <span className="flex items-center gap-1.5">
                                    <Briefcase size={13} className="text-violet-500" />
                                    {profile.profession}
                                </span>
                            )}
                            {profile.location && (
                                <span className="flex items-center gap-1.5">
                                    <MapPin size={13} className="text-rose-500" />
                                    {profile.location}
                                </span>
                            )}
                            {profile.website && (
                                <a
                                    href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-sky-500 hover:text-sky-600 hover:underline transition-colors"
                                >
                                    <Globe size={13} />
                                    {profile.website.replace(/^https?:\/\//, "")}
                                </a>
                            )}
                            {profile.created_at && (
                                <span className="flex items-center gap-1.5">
                                    <Calendar size={13} className="text-amber-500" />
                                    {formatJoinDate(profile.created_at)}
                                </span>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-2.5 justify-center md:justify-start flex-wrap">
                            {isOwn ? (
                                <>
                                    <button
                                        onClick={onEditProfile}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-text text-brand-card text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all shadow-sm"
                                    >
                                        <Settings className="w-3.5 h-3.5" />
                                        Edit Profile
                                    </button>
                                    <button
                                        onClick={toggleTheme}
                                        type="button"
                                        className="flex items-center justify-center p-2.5 rounded-xl border border-brand-divider bg-brand-card text-brand-text hover:bg-brand-secondary transition-all shadow-sm"
                                        title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                                    >
                                        {theme === "dark" ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-amber-600" />}
                                    </button>
                                </>
                            ) : (
                                <>
                                    {/* Relationship-separation spec §3.2 / §4.1: user profiles
                                        must never render a Follow button — friendship actions
                                        (Add Friend / Friends / Accept / etc.) come through
                                        ProfileActions. Follow lives on hub profile pages only. */}
                                    <button
                                        onClick={canDM ? onMessage : undefined}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border-2 transition-all ${
                                            canDM
                                                ? "border-brand-divider text-brand-text hover:border-brand-text/30 hover:bg-brand-secondary shadow-sm"
                                                : "border-brand-divider text-brand-text/30 cursor-not-allowed"
                                        }`}
                                        title={canDM ? "Send message" : "Add to Circle to message"}
                                    >
                                        {!canDM && <Lock className="w-3 h-3" />}
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        Message
                                    </button>
                                    {/* Tier 3c — Become a member */}
                                    <button
                                        onClick={() => setShowTierPicker(true)}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border-2 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950 transition-all shadow-sm"
                                        title="Become a member"
                                    >
                                        <Crown className="w-3.5 h-3.5" />
                                        Member
                                    </button>
                                    {/* Tier 3d — Tip */}
                                    <button
                                        onClick={() => setShowTipComposer(true)}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border-2 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950 transition-all shadow-sm"
                                        title="Send a tip"
                                    >
                                        <Coffee className="w-3.5 h-3.5" />
                                        Tip
                                    </button>
                                </>
                            )}
                        </div>
                    </motion.div>

                    {/* Right: Stats cards — unified card system */}
                    <div className="hidden md:flex flex-col gap-4 w-[330px] lg:w-[360px] md:pt-[4.5rem]">
                        {/* Feed Stats */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.1 }}
                            className="rounded-2xl border border-brand-divider bg-brand-card shadow-sm p-5"
                        >
                            {/* Relationship-separation spec §4.1: user profile stats are
                                Posts + Friends. Followers / Following live only on hub
                                profile pages. */}
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { icon: FileText, label: "Posts", value: contentCounts.total, key: "posts", color: "text-sky-500" },
                                    { icon: Users, label: "Friends", value: graphCounts.friend_count, key: "friends", color: "text-emerald-500" },
                                ].map((stat) => (
                                    <div key={stat.key} className="flex flex-col items-center text-center gap-1">
                                        <stat.icon size={16} className={stat.color} />
                                        <p className="text-lg font-black text-brand-text tracking-tight leading-none">
                                            {formatCount(stat.value)}
                                        </p>
                                        <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-brand-text/50">
                                            {stat.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* PostTube Channel Stats — same card system, subtle accent */}
                        {channel && (
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: 0.15 }}
                                className="rounded-2xl border border-brand-divider bg-brand-card shadow-sm p-5 border-l-[3px] border-l-violet-500"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-text/50">
                                        PostTube Channel
                                    </span>
                                    <Link
                                        href={`/posttube/channel/${channel.handle}`}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-text text-brand-card text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition-all"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        View
                                    </Link>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { icon: Play, label: "Subscribers", value: channel.subscriber_count, key: "subs", color: "text-violet-500" },
                                        { icon: Film, label: "Videos", value: contentCounts.video, key: "videos", color: "text-sky-500" },
                                        { icon: Clapperboard, label: "Reels", value: contentCounts.reel, key: "flicks", color: "text-rose-500" },
                                    ].map((stat) => (
                                        <div key={stat.key} className="flex flex-col items-center text-center gap-1">
                                            <stat.icon size={16} className={stat.color} />
                                            <p className="text-lg font-black text-brand-text tracking-tight leading-none">
                                                {formatCount(stat.value)}
                                            </p>
                                            <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-brand-text/50">
                                                {stat.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Mobile: Social Graph (stacked below on small screens) */}
                <div className="md:hidden space-y-3 mb-6">
                    <div className="rounded-2xl border border-brand-divider bg-brand-card shadow-sm p-4">
                        {/* Spec §4.1 — Posts + Friends only on user profile. */}
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { icon: FileText, label: "Posts", value: contentCounts.total, color: "text-sky-500" },
                                { icon: Users, label: "Friends", value: graphCounts.friend_count, color: "text-emerald-500" },
                            ].map((stat) => (
                                <div key={stat.label} className="flex flex-col items-center text-center gap-1">
                                    <stat.icon size={15} className={stat.color} />
                                    <p className="text-base font-black text-brand-text leading-none">{formatCount(stat.value)}</p>
                                    <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-brand-text/50">{stat.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Mobile: PostTube Channel Stats */}
                    {channel && (
                        <div className="rounded-2xl border border-brand-divider bg-brand-card shadow-sm p-4 border-l-[3px] border-l-violet-500">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-text/50">PostTube Channel</span>
                                <Link
                                    href={`/posttube/channel/${channel.handle}`}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-text text-brand-card text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition-all"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    View
                                </Link>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { icon: Play, label: "Subscribers", value: channel.subscriber_count, color: "text-violet-500" },
                                    { icon: Film, label: "Videos", value: contentCounts.video, color: "text-sky-500" },
                                    { icon: Clapperboard, label: "Reels", value: contentCounts.reel, color: "text-rose-500" },
                                ].map((stat) => (
                                    <div key={stat.label} className="flex flex-col items-center text-center gap-1">
                                        <stat.icon size={15} className={stat.color} />
                                        <p className="text-base font-black text-brand-text leading-none">{formatCount(stat.value)}</p>
                                        <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-brand-text/50">{stat.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. Bio Row */}
                {profile.bio && (
                    <div className="pb-6">
                        <div className="rounded-2xl border border-brand-divider bg-brand-card shadow-sm p-5 sm:p-6">
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-text/50 mb-2.5">Biography</h3>
                            <p className="text-[15px] not-italic font-normal leading-relaxed text-brand-text/80">
                                {profile.bio}
                            </p>

                            {/* Social links */}
                            {links.length > 0 && (
                                <div className="flex gap-2 flex-wrap mt-4 pt-4 border-t border-brand-divider">
                                    {links.map((link) => (
                                        <a
                                            key={link.platform}
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-secondary border border-brand-divider text-xs font-semibold text-brand-text/70 hover:text-brand-text hover:shadow-sm transition-all"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            {link.display_label || link.platform}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Social links row — shown standalone when there is no bio */}
                {!profile.bio && links.length > 0 && (
                    <div className="pb-6">
                        <div className="flex gap-2 flex-wrap">
                            {links.map((link) => (
                                <a
                                    key={link.platform}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-secondary border border-brand-divider text-xs font-semibold text-brand-text/70 hover:text-brand-text hover:shadow-sm transition-all"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    {link.display_label || link.platform}
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Tier 3c — Member tier picker modal */}
            <TierPicker
                creatorId={profile.id}
                creatorName={profile.display_name || profile.username}
                open={showTierPicker}
                onClose={() => setShowTierPicker(false)}
            />
            {/* Tier 3d — Tip composer modal */}
            <TipComposer
                creatorId={profile.id}
                creatorName={profile.display_name || profile.username}
                open={showTipComposer}
                onClose={() => setShowTipComposer(false)}
            />
        </div>
    )
}

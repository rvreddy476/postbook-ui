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
    UserPlus,
    Heart,
    Settings,
    MessageSquare,
    CheckCircle2,
    ExternalLink,
    Eye,
    Lock,
    Film,
    Clapperboard,
    Play,
} from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"
import api from "@/lib/api"
import { uploadMedia } from "@/lib/mediaUpload"

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
    creator: { icon: Sparkles, color: "text-[#D8103F]", bg: "bg-[#D8103F]/10 border-[#D8103F]/20" },
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
    onFollow,
    onUnfollow,
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
    const isFollowing = relationship?.following ?? false
    const inCircle = relationship?.in_circle ?? false
    const canDM = relationship?.can_dm ?? false

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
            <div className="relative h-[320px] w-full overflow-hidden">
                {resolvedCover ? (
                    <img
                        src={resolvedCover}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={() => setCoverFails((n) => n + 1)}
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-100 via-[#D8103F]/5 to-teal-50" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/10" />

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
                                <span className="hidden sm:inline">Edit cover</span>
                            </button>
                            <button className="flex items-center gap-2 px-3.5 py-2 bg-black/30 backdrop-blur-md text-white text-xs font-semibold rounded-xl hover:bg-black/50 transition-all border border-white/10">
                                <Eye className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Public</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* 2. Three-column grid: Profile Pic | Intro | Social Graph */}
            <div className="max-w-[1200px] mx-auto px-6 sm:px-8">
                <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-6 lg:gap-10 -mt-16 pb-8 items-end">

                    {/* Left: Profile Picture */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className="relative group justify-self-center md:justify-self-start"
                    >
                        <div className="h-44 w-44 rounded-3xl overflow-hidden border-[6px] border-white shadow-2xl bg-zinc-100 relative">
                            {resolvedAvatar ? (
                                <img
                                    src={resolvedAvatar}
                                    alt={profile.display_name}
                                    className="w-full h-full object-cover"
                                    onError={() => setAvatarFails((n) => n + 1)}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-5xl font-black text-slate-300 bg-gradient-to-br from-slate-50 to-slate-100 uppercase">
                                    {(profile.display_name || "?").charAt(0)}
                                </div>
                            )}

                            {uploadMutation.isPending && uploadMutation.variables?.field === "avatar_media_id" && (
                                <div className="absolute inset-0 bg-brand-card/70 backdrop-blur-sm flex items-center justify-center">
                                    <Loader2 className="w-7 h-7 animate-spin text-[#D8103F]" />
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
                                className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-all rounded-3xl cursor-pointer"
                            >
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity p-3 bg-brand-card/80 backdrop-blur-md rounded-2xl shadow-xl">
                                    <Camera className="w-5 h-5 text-slate-800" />
                                </div>
                            </button>
                        )}
                    </motion.div>

                    {/* Middle: Intro */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.05 }}
                        className="space-y-2 text-center md:text-left pt-2"
                    >
                        {/* Name + badges */}
                        <div className="flex items-center gap-2.5 justify-center md:justify-start flex-wrap">
                            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-brand-text">
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
                                <span className="text-[9px] font-bold text-brand-text/60 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                    Follows you
                                </span>
                            )}
                        </div>

                        {/* Handle */}
                        <p className="text-zinc-400 font-medium tracking-wide text-sm">@{profile.username}</p>

                        {/* Meta chips */}
                        <div className="flex items-center gap-4 pt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 justify-center md:justify-start flex-wrap">
                            {profile.profession && (
                                <span className="flex items-center gap-1.5">
                                    <Briefcase size={12} />
                                    {profile.profession}
                                </span>
                            )}
                            {profile.location && (
                                <span className="flex items-center gap-1.5">
                                    <MapPin size={12} />
                                    {profile.location}
                                </span>
                            )}
                            {profile.website && (
                                <a
                                    href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-teal-500 hover:text-teal-600 transition-colors"
                                >
                                    <Globe size={12} />
                                    {profile.website.replace(/^https?:\/\//, "")}
                                </a>
                            )}
                            {profile.created_at && (
                                <span className="flex items-center gap-1.5">
                                    <Calendar size={12} />
                                    {formatJoinDate(profile.created_at)}
                                </span>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-2 justify-center md:justify-start flex-wrap">
                            {isOwn ? (
                                <>
                                    <button
                                        onClick={onEditProfile}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-wider hover:bg-black transition-colors shadow-lg"
                                    >
                                        <Settings className="w-3.5 h-3.5" />
                                        Edit Profile
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={isFollowing ? onUnfollow : onFollow}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg ${
                                            isFollowing
                                                ? "bg-brand-card border-2 border-[#D8103F]/30 text-[#D8103F] hover:bg-[#D8103F]/5"
                                                : "bg-[#D8103F] text-white hover:bg-[#b80d35]"
                                        }`}
                                    >
                                        {isFollowing ? (
                                            <><Heart className="w-3.5 h-3.5" fill="currentColor" /> Following</>
                                        ) : (
                                            <><UserPlus className="w-3.5 h-3.5" /> Follow</>
                                        )}
                                    </button>
                                    <button
                                        onClick={canDM ? onMessage : undefined}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border-2 transition-all ${
                                            canDM
                                                ? "border-brand-divider text-slate-700 hover:border-slate-300 hover:bg-brand-secondary shadow-sm"
                                                : "border-brand-divider text-slate-300 cursor-not-allowed"
                                        }`}
                                        title={canDM ? "Send message" : "Add to Circle to message"}
                                    >
                                        {!canDM && <Lock className="w-3 h-3" />}
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        Message
                                    </button>
                                </>
                            )}
                        </div>
                    </motion.div>

                    {/* Right: Stats cards */}
                    <div className="hidden md:flex flex-col gap-3 self-end mb-1">
                        {/* Postbook Stats */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.1 }}
                            className="flex justify-between items-center bg-zinc-50/80 backdrop-blur-sm p-5 rounded-2xl border border-black/5 gap-1"
                        >
                            {[
                                { icon: FileText, label: "Posts", value: contentCounts.total, key: "posts" },
                                { icon: Heart, label: "Followers", value: graphCounts.follower_count, key: "followers" },
                                { icon: UserPlus, label: "Following", value: graphCounts.following_count, key: "following" },
                                { icon: Users, label: "Friends", value: graphCounts.friend_count, key: "friends" },
                            ].map((stat, i) => (
                                <div key={stat.key} className="flex items-center">
                                    {i > 0 && <div className="h-8 w-px bg-black/5 mx-3" />}
                                    <div className="text-center px-2">
                                        <div className="flex items-center justify-center gap-1.5 text-zinc-400 mb-1">
                                            <stat.icon size={13} />
                                            <span className="text-[8px] font-bold uppercase tracking-[0.2em]">{stat.label}</span>
                                        </div>
                                        <p className="text-lg font-black text-brand-text tracking-tight">
                                            {formatCount(stat.value)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </motion.div>

                        {/* PostTube Channel Stats */}
                        {channel && (
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: 0.15 }}
                                className="flex items-center bg-zinc-900 p-4 rounded-2xl border border-zinc-800 gap-1"
                            >
                                <div className="flex items-center gap-4 flex-1">
                                    {[
                                        { icon: Play, label: "Subscribers", value: channel.subscriber_count, key: "subs" },
                                        { icon: Film, label: "Videos", value: contentCounts.video, key: "videos" },
                                        { icon: Clapperboard, label: "Flicks", value: contentCounts.reel, key: "flicks" },
                                    ].map((stat, i) => (
                                        <div key={stat.key} className="flex items-center">
                                            {i > 0 && <div className="h-7 w-px bg-zinc-700 mx-2" />}
                                            <div className="text-center px-2">
                                                <div className="flex items-center justify-center gap-1.5 text-zinc-500 mb-1">
                                                    <stat.icon size={12} />
                                                    <span className="text-[7px] font-bold uppercase tracking-[0.2em]">{stat.label}</span>
                                                </div>
                                                <p className="text-base font-black text-white tracking-tight">
                                                    {formatCount(stat.value)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <Link
                                    href={`/posttube/channel/${channel.handle}`}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#D8103F] text-white text-[9px] font-black uppercase tracking-[0.15em] hover:bg-[#b80d35] transition-all shadow-lg shadow-[#D8103F]/30 shrink-0 ml-2"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    View Channel
                                </Link>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Mobile: Social Graph (stacked below on small screens) */}
                <div className="md:hidden space-y-3 mb-6 -mt-2">
                    <div className="flex justify-between items-center bg-zinc-50/80 p-4 rounded-2xl border border-black/5">
                        {[
                            { icon: FileText, label: "Posts", value: contentCounts.total },
                            { icon: Heart, label: "Followers", value: graphCounts.follower_count },
                            { icon: UserPlus, label: "Following", value: graphCounts.following_count },
                            { icon: Users, label: "Friends", value: graphCounts.friend_count },
                        ].map((stat, i) => (
                            <div key={stat.label} className="flex items-center">
                                {i > 0 && <div className="h-6 w-px bg-black/5 mx-1" />}
                                <div className="text-center px-1.5">
                                    <div className="flex items-center justify-center gap-1 text-zinc-400 mb-0.5">
                                        <stat.icon size={11} />
                                        <span className="text-[7px] font-bold uppercase tracking-widest">{stat.label}</span>
                                    </div>
                                    <p className="text-base font-black text-brand-text">{formatCount(stat.value)}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Mobile: PostTube Channel Stats */}
                    {channel && (
                        <div className="flex items-center justify-between bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
                            <div className="flex items-center gap-3">
                                {[
                                    { icon: Play, label: "Subs", value: channel.subscriber_count },
                                    { icon: Film, label: "Videos", value: contentCounts.video },
                                    { icon: Clapperboard, label: "Flicks", value: contentCounts.reel },
                                ].map((stat, i) => (
                                    <div key={stat.label} className="flex items-center">
                                        {i > 0 && <div className="h-5 w-px bg-zinc-700 mx-1" />}
                                        <div className="text-center px-1">
                                            <div className="flex items-center justify-center gap-1 text-zinc-500 mb-0.5">
                                                <stat.icon size={10} />
                                                <span className="text-[7px] font-bold uppercase tracking-widest">{stat.label}</span>
                                            </div>
                                            <p className="text-sm font-black text-white">{formatCount(stat.value)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <Link
                                href={`/posttube/channel/${channel.handle}`}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#D8103F] text-white text-[8px] font-black uppercase tracking-wider"
                            >
                                <ExternalLink className="w-3 h-3" />
                                Channel
                            </Link>
                        </div>
                    )}
                </div>

                {/* 3. Bio Row */}
                {profile.bio && (
                    <div className="py-6 border-t border-black/5">
                        <div className="max-w-2xl">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-3">Biography</h3>
                            <p className="text-xl sm:text-2xl font-serif-display italic leading-relaxed text-zinc-700">
                                {profile.bio}
                            </p>
                        </div>
                    </div>
                )}

                {/* Social links row */}
                {links.length > 0 && (
                    <div className="flex gap-2 pb-4 flex-wrap">
                        {links.map((link) => (
                            <a
                                key={link.platform}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-50 border border-zinc-100 text-xs font-semibold text-zinc-500 hover:text-zinc-700 hover:border-zinc-200 hover:shadow-sm transition-all"
                            >
                                <ExternalLink className="w-3 h-3" />
                                {link.display_label || link.platform}
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

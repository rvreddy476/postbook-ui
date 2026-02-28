"use client"

import { useRef, useCallback } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { UserProfile, UserLink, Relationship } from "@/types/profile"
import { getBadges } from "@/types/profile"
import { ProfileActions } from "./ProfileActions"
import { BadgeCheck, Briefcase, Sparkles, MapPin, ExternalLink, Camera, Loader2, Image } from "lucide-react"
import { motion } from "framer-motion"
import api from "@/lib/api"
import { uploadMedia } from "@/lib/mediaUpload"

interface ProfileHeaderProps {
    profile: UserProfile
    links: UserLink[]
    relationship: Relationship | null
    isOwn: boolean
    avatarUrl?: string
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
}

const badgeIcons: Record<string, typeof BadgeCheck> = {
    verified: BadgeCheck,
    creator: Sparkles,
    business: Briefcase,
}

export function ProfileHeader({ profile, links, relationship, isOwn, avatarUrl, onFollow, onUnfollow, onSendCircleRequest, onAcceptCircleRequest, onDeclineCircleRequest, onCancelCircleRequest, onRemoveFromCircle, onEditProfile, onMessage, onBlock, onUnblock }: ProfileHeaderProps) {
    const qc = useQueryClient()
    const avatarInputRef = useRef<HTMLInputElement>(null)
    const coverInputRef = useRef<HTMLInputElement>(null)

    const badges = getBadges(profile.badge_flags)
    const resolvedAvatar = avatarUrl ?? (profile.avatar_media_id ? `/v1/media/${profile.avatar_media_id}/serve` : null)

    const uploadMutation = useMutation({
        mutationFn: async ({ file, field }: { file: File; field: "avatar_media_id" | "cover_media_id" }) => {
            const mediaId = await uploadMedia(file, "image", field === "avatar_media_id" ? "avatar" : "cover")

            const endpoint = field === "avatar_media_id"
                ? "/v1/profiles/me/avatar"
                : "/v1/profiles/me/cover"
            await api.put(endpoint, { media_id: mediaId })
            return { field, mediaId }
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["profile"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
        }
    })

    const handleFileSelect = useCallback((field: "avatar_media_id" | "cover_media_id") => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            uploadMutation.mutate({ file, field })
        }
    }, [uploadMutation])

    return (
        <section className="relative w-full">
            <input
                type="file"
                ref={avatarInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileSelect("avatar_media_id")}
            />
            <input
                type="file"
                ref={coverInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileSelect("cover_media_id")}
            />

            {/* Prismatic Cover Section */}
            <div className="h-64 md:h-80 relative overflow-hidden rounded-b-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] group/cover">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-fuchsia-500/10 to-blue-600/20 animate-pulse" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />

                {profile.cover_media_id ? (
                    <img
                        src={`/v1/media/${profile.cover_media_id}/serve`}
                        alt=""
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full orchid-gradient opacity-80" />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent" />

                {/* Stylish Cover Edit Trigger */}
                {isOwn && (
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => coverInputRef.current?.click()}
                        className="absolute bottom-6 right-8 z-30 p-3 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-full text-white shadow-2xl transition-all duration-300 hover:bg-white/20"
                    >
                        {uploadMutation.isPending && uploadMutation.variables?.field === "cover_media_id" ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Image className="w-5 h-5" />
                        )}
                    </motion.button>
                )}
            </div>

            {/* Content Layer */}
            <div className="max-w-5xl mx-auto px-6 -mt-24 relative z-20">
                <div className="flex flex-col md:flex-row items-center md:items-end gap-8">
                    {/* Squircle Avatar with Elite Framing */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="relative group/avatar"
                    >
                        <div className="absolute -inset-1 bg-gradient-to-tr from-violet-500 via-fuchsia-500 to-blue-500 rounded-[3rem] blur opacity-20 group-hover/avatar:opacity-40 transition duration-1000 group-hover/avatar:duration-200" />
                        <div className="relative h-44 w-44 rounded-[3.2rem] bg-white p-2 shadow-2xl overflow-hidden ring-1 ring-white/50">
                            <div className="w-full h-full rounded-[2.5rem] overflow-hidden bg-slate-100 relative">
                                {resolvedAvatar ? (
                                    <img
                                        src={resolvedAvatar}
                                        alt={profile.display_name}
                                        className="w-full h-full object-cover group-hover/avatar:scale-110 transition-transform duration-700"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-4xl font-black text-slate-300">
                                        {profile.display_name.charAt(0).toUpperCase()}
                                    </div>
                                )}

                                {uploadMutation.isPending && uploadMutation.variables?.field === "avatar_media_id" && (
                                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Prismatic Avatar Edit Trigger */}
                        {isOwn && (
                            <motion.button
                                whileHover={{ scale: 1.1, rotate: 5 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => avatarInputRef.current?.click()}
                                className="absolute -bottom-2 -right-2 z-30 p-2.5 bg-white border border-slate-100 rounded-2xl shadow-xl text-slate-600 hover:text-violet-600 transition-colors group/edit-btn overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-tr from-violet-500/10 via-fuchsia-500/10 to-blue-500/10 opacity-0 group-hover/edit-btn:opacity-100 transition-opacity" />
                                <Camera className="w-5 h-5 relative z-10" />
                            </motion.button>
                        )}

                        {!isOwn && profile.is_verified && (
                            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full border-4 border-white shadow-lg animate-pulse" />
                        )}
                    </motion.div>

                    {/* Elite Identity Info */}
                    <div className="flex-1 flex flex-col md:flex-row items-center md:items-end justify-between gap-6 pb-4 w-full px-2">
                        <div className="text-center md:text-left space-y-2">
                            <div className="flex items-center gap-3 justify-center md:justify-start">
                                <h1 className="text-4xl font-black text-slate-950 tracking-tighter uppercase italic drop-shadow-sm">
                                    {profile.display_name}
                                </h1>
                                <div className="flex gap-1.5">
                                    {badges.map((badge) => {
                                        const Icon = badgeIcons[badge]
                                        return Icon ? (
                                            <div key={badge} className="p-1 px-2.5 rounded-full bg-violet-50 border border-violet-100/50 shadow-sm flex items-center gap-1.5">
                                                <Icon className="h-3.5 w-3.5 text-violet-600" />
                                                <span className="text-[8px] font-black text-violet-600 uppercase tracking-widest">{badge}</span>
                                            </div>
                                        ) : null
                                    })}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-2">
                                {profile.username && (
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] bg-slate-100 px-3 py-1 rounded-lg">
                                        @{profile.username}
                                    </span>
                                )}
                                {profile.pronouns && (
                                    <span className="text-[10px] font-bold text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-100">
                                        {profile.pronouns}
                                    </span>
                                )}
                                {profile.profession && (
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <Briefcase className="w-3.5 h-3.5" />
                                        <span className="text-xs font-bold italic">{profile.profession}</span>
                                    </div>
                                )}
                                {profile.location && (
                                    <div className="flex items-center gap-1.5 text-slate-400">
                                        <MapPin className="w-3.5 h-3.5" />
                                        <span className="text-xs font-bold">{profile.location}</span>
                                    </div>
                                )}
                            </div>

                            {/* Status */}
                            {profile.status_text && (
                                <div className="flex items-center gap-2 mt-1">
                                    {profile.status_emoji && <span className="text-sm">{profile.status_emoji}</span>}
                                    <span className="text-xs font-medium text-slate-500 italic">{profile.status_text}</span>
                                </div>
                            )}

                            {profile.bio && (
                                <p className="text-slate-600 font-medium italic max-w-lg mt-4 leading-relaxed bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-white shadow-sm">
                                    &ldquo;{profile.bio}&rdquo;
                                </p>
                            )}

                            {/* CTA Button */}
                            {profile.cta_label && profile.cta_url && (
                                <a
                                    href={profile.cta_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 mt-3 px-5 py-2 rounded-xl bg-violet-600 text-white text-xs font-black uppercase tracking-widest shadow-lg hover:bg-violet-700 transition-colors"
                                >
                                    {profile.cta_label}
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                            )}

                            {links.length > 0 && (
                                <div className="flex gap-4 mt-4 justify-center md:justify-start flex-wrap">
                                    {links.map((link) => (
                                        <a
                                            key={link.platform}
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-violet-200 transition-all"
                                        >
                                            <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-violet-500 transition-colors" />
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-900 transition-colors">
                                                {link.display_label || link.platform}
                                            </span>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="shrink-0 flex items-center">
                            <ProfileActions
                                isOwn={isOwn}
                                relationship={relationship}
                                username={profile.username}
                                displayName={profile.display_name}
                                onFollow={onFollow}
                                onUnfollow={onUnfollow}
                                onSendCircleRequest={onSendCircleRequest}
                                onAcceptCircleRequest={onAcceptCircleRequest}
                                onDeclineCircleRequest={onDeclineCircleRequest}
                                onCancelCircleRequest={onCancelCircleRequest}
                                onRemoveFromCircle={onRemoveFromCircle}
                                onEditProfile={onEditProfile}
                                onMessage={onMessage}
                                onBlock={onBlock}
                                onUnblock={onUnblock}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

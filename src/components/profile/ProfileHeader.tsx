"use client"

import { useRef, useCallback, useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { UserProfile, UserLink, Relationship, GraphCounts } from "@/types/profile"
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
    Settings,
    MessageSquare,
    CheckCircle2,
    ExternalLink,
    Eye,
    Lock,
    Crown,
    Sun,
    Moon,
} from "lucide-react"
import { motion } from "framer-motion"
import api from "@/lib/api"
import { uploadMedia } from "@/lib/mediaUpload"
import { ProfileJoinButton } from "@/features/memberships/components/JoinButton"
import { ActionPill } from "@/features/action-button/components/ActionPill"
import { useProfileAction } from "@/features/action-button/hooks"
import MessageButton from "@/components/connections/MessageButton"
import { ImageAdjustEditor } from "@/components/media/ImageAdjustEditor"
import { ImageAdjustDialog } from "@/components/media/ImageAdjustDialog"
import { ProfileActions } from "./ProfileActions"
import { ProfileCounts } from "./ProfileCounts"
import { followButtonState } from "./profileParity"

interface ProfileHeaderProps {
    profile: UserProfile
    links: UserLink[]
    relationship: Relationship | null
    isOwn: boolean
    avatarUrl?: string
    coverUrl?: string
    isMuted?: boolean
    graphCounts: GraphCounts
    onFollow: () => void
    onUnfollow: () => void
    onEditProfile: () => void
    onMessage?: () => void
    onBlock?: () => void
    onUnblock?: () => void
    onMute?: () => void
    onUnmute?: () => void
    onUploadError?: (message: string) => void
    /** A signed-in viewer (owner or visitor). Signed-out visitors get Share and Copy link only. */
    signedIn?: boolean
    followBusy?: boolean
    onShare?: () => void
    onCopyLink?: () => void
    onReport?: () => void
    /** Open the follower/following lists; omitted when they are not viewable (private, not followed). */
    onOpenConnections?: () => void
    signInHref?: string
}

const badgeConfig: Record<string, { icon: typeof BadgeCheck; color: string; bg: string }> = {
    verified: { icon: BadgeCheck, color: "text-teal-600", bg: "bg-teal-50 border-teal-100" },
    creator: { icon: Sparkles, color: "text-brand-text", bg: "bg-brand-text/10 border-brand-text/20" },
    business: { icon: Briefcase, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
}

type ProfileImageField = "avatar_media_id" | "cover_media_id"

type PendingProfileImage = {
    field: ProfileImageField
    file: File
    previewUrl: string
}

function formatJoinDate(dateStr: string): string {
    const d = new Date(dateStr)
    return `Joined ${d.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`
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
    onFollow,
    onUnfollow,
    onEditProfile,
    onMessage,
    onBlock,
    onUnblock,
    onMute,
    onUnmute,
    onUploadError,
    signedIn = false,
    followBusy = false,
    onShare,
    onCopyLink,
    onReport,
    onOpenConnections,
    signInHref,
}: ProfileHeaderProps) {
    const qc = useQueryClient()
    // The profile's Action button, beside Follow and Message (edited on Branding).
    const profileAction = useProfileAction(profile)
    const avatarInputRef = useRef<HTMLInputElement>(null)
    const coverInputRef = useRef<HTMLInputElement>(null)

    const badges = getBadges(profile.badge_flags)
    const [avatarFails, setAvatarFails] = useState(0)
    const [coverFails, setCoverFails] = useState(0)
    const [theme, setTheme] = useState<string>("light")
    const [pendingImage, setPendingImage] = useState<PendingProfileImage | null>(null)

    useEffect(() => {
        return () => {
            if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl)
        }
    }, [pendingImage?.previewUrl])

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
    const followState = followButtonState(profile, relationship)

    const uploadMutation = useMutation({
        mutationFn: async ({ file, field }: { file: File; field: ProfileImageField }) => {
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
        (field: ProfileImageField) => (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (file) {
                setPendingImage((current) => {
                    if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
                    return { file, field, previewUrl: URL.createObjectURL(file) }
                })
            }
        },
        []
    )

    const handleAdjustedImage = useCallback(
        (file: File) => {
            if (!pendingImage) return
            uploadMutation.mutate(
                { file, field: pendingImage.field },
                {
                    onSettled: () => {
                        setPendingImage((current) => {
                            if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
                            return null
                        })
                    },
                },
            )
        },
        [pendingImage, uploadMutation],
    )

    const pendingImageConfig = pendingImage?.field === "cover_media_id"
        ? {
              title: "Adjust cover photo",
              outputWidth: 1800,
              outputHeight: 480,
          }
        : {
              title: "Adjust profile photo",
              outputWidth: 1024,
              outputHeight: 1024,
          }

    return (
        <div className="w-full bg-brand-card border-b border-black/5">
            {pendingImage?.field === "avatar_media_id" && (
                <ImageAdjustDialog
                    file={pendingImage.file}
                    previewUrl={pendingImage.previewUrl}
                    title={pendingImageConfig.title}
                    outputWidth={pendingImageConfig.outputWidth}
                    outputHeight={pendingImageConfig.outputHeight}
                    isApplying={uploadMutation.isPending}
                    onCancel={() => {
                        if (!uploadMutation.isPending) setPendingImage(null)
                    }}
                    onApply={handleAdjustedImage}
                />
            )}

            {/* Hidden file inputs */}
            <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleFileSelect("avatar_media_id")} />
            <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={handleFileSelect("cover_media_id")} />

            {/* 1. Cover Photo — half-height hero */}
            <div className="relative aspect-[3/1] min-h-[160px] max-h-[320px] w-full overflow-hidden">
                {pendingImage?.field === "cover_media_id" ? (
                    <ImageAdjustEditor
                        file={pendingImage.file}
                        previewUrl={pendingImage.previewUrl}
                        title={pendingImageConfig.title}
                        outputWidth={pendingImageConfig.outputWidth}
                        outputHeight={pendingImageConfig.outputHeight}
                        className="relative z-10"
                        isApplying={uploadMutation.isPending}
                        onCancel={() => {
                            if (!uploadMutation.isPending) setPendingImage(null)
                        }}
                        onApply={handleAdjustedImage}
                    />
                ) : resolvedCover ? (
                    <img
                        src={resolvedCover}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={() => setCoverFails((n) => n + 1)}
                    />
                ) : (
                    <div className="w-full h-full bg-linear-to-br from-brand-secondary via-brand-text/10 to-brand-secondary" />
                )}
                {pendingImage?.field !== "cover_media_id" && (
                    <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/20 via-transparent to-black/10" />
                )}

                {/* Cover actions */}
                <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                    {isOwn && pendingImage?.field !== "cover_media_id" && (
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

            {/*
              2. Identity row: Profile Pic | Intro — sits below the cover.
              Both tracks may shrink (`minmax(0,1fr)`, `min-w-0`), so a long
              name never widens the row past the page. No PostTube channel
              card here: the channel lives in PostTube.
            */}
            <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
                <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] gap-6 lg:gap-10 -mt-14 sm:-mt-16 pb-8 items-start">

                    {/* Left: Profile Picture */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className="relative group justify-self-center md:justify-self-start z-10"
                    >
                        <div className="h-28 w-28 sm:h-36 sm:w-36 md:h-40 md:w-40 rounded-3xl sm:rounded-3xl overflow-hidden border-4 sm:border-[6px] border-brand-card shadow-xl bg-brand-secondary relative">
                            {resolvedAvatar ? (
                                <img
                                    src={resolvedAvatar}
                                    alt={profile.display_name}
                                    className="w-full h-full object-cover"
                                    onError={() => setAvatarFails((n) => n + 1)}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-5xl font-black text-brand-card bg-linear-to-br from-brand-text/70 to-brand-text">
                                    {(profile.display_name || "?").charAt(0)}
                                </div>
                            )}

                            {uploadMutation.isPending && uploadMutation.variables?.field === "avatar_media_id" && (
                                <div className="absolute inset-0 bg-brand-card/70 backdrop-blur-xs flex items-center justify-center">
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
                                className="absolute bottom-1 right-1 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 rounded-xl cursor-pointer hover:bg-black/80 transition-all shadow-lg border border-white/10"
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
                        className="@container w-full min-w-0 md:pt-18 space-y-3"
                    >
                        {/*
                          Name and actions side by side only when the intro
                          column is wide enough for both (container query,
                          not the viewport: the column's width depends on the
                          shell and sidebar). Otherwise the actions take
                          their own row below the name. The name truncates
                          with an ellipsis rather than running under them.
                        */}
                        <div
                            data-testid="profile-identity-row"
                            className="flex flex-col @3xl:flex-row @3xl:items-start @3xl:justify-between gap-4 w-full min-w-0"
                        >
                            {/* Left: Name, then handle & badges */}
                            <div className="flex flex-col items-center md:items-start gap-1.5 min-w-0 max-w-full @3xl:flex-1">
                                <h1
                                    title={profile.display_name}
                                    className="max-w-full truncate text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-brand-text"
                                >
                                    {profile.display_name}
                                </h1>
                                <div className="flex items-center gap-x-3 gap-y-1.5 justify-center md:justify-start flex-wrap min-w-0 max-w-full">
                                {profile.username && (
                                    <span className="min-w-0 max-w-full truncate text-muted-foreground font-semibold tracking-wide text-sm sm:text-base">
                                        @{profile.username}
                                    </span>
                                )}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {badges.map((badge) => {
                                        const cfg = badgeConfig[badge]
                                        if (!cfg) return null
                                        const Icon = cfg.icon
                                        return (
                                            <span
                                                key={badge}
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold tracking-wider border ${cfg.bg} ${cfg.color} whitespace-nowrap`}
                                            >
                                                <Icon className="h-3 w-3" />
                                                {badge}
                                            </span>
                                        )
                                    })}
                                    {!isOwn && followsYou && (
                                        <span className="text-xs font-semibold text-muted-foreground bg-brand-secondary px-2 py-0.5 rounded-md tracking-wider whitespace-nowrap">
                                            Follows you
                                        </span>
                                    )}
                                </div>
                                </div>
                            </div>

                            {/*
                              Actions (parity 3-W1): owner Edit ·
                              Share · Settings; visitor Follow · Message ·
                              Share · ⋮ (Copy link, Mute, Block/Unblock,
                              Report). Follow is offered on every account,
                              not only creators; the circle control stays
                              alongside for its incoming requests.

                              Message follows the server's decision (DM
                              consent §4): Message, Send request,
                              Requested, or disabled with the reason; a
                              tap opens the thread.
                            */}
                            <div className="flex flex-wrap items-center justify-center md:justify-start @3xl:justify-end @3xl:shrink-0 gap-2 min-w-0">
                                <ProfileActions
                                    isOwn={isOwn}
                                    signedIn={signedIn}
                                    username={profile.username || profile.id}
                                    followState={followState}
                                    followBusy={followBusy}
                                    blocked={!!relationship?.blocked}
                                    isMuted={isMuted}
                                    onFollow={onFollow}
                                    onUnfollow={onUnfollow}
                                    onEditProfile={onEditProfile}
                                    onShare={() => onShare?.()}
                                    onCopyLink={() => onCopyLink?.()}
                                    onBlock={onBlock}
                                    onUnblock={onUnblock}
                                    onMute={onMute}
                                    onUnmute={onUnmute}
                                    onReport={onReport}
                                    signInHref={signInHref}
                                    messageSlot={
                                        <MessageButton
                                            targetUserId={profile.id}
                                            targetUsername={profile.username}
                                            targetName={profile.display_name}
                                            variant="full"
                                        />
                                    }
                                />
                                {/* The profile's Action button: it opens /l/<id> (the leaving page). The owner also sees one that is blocked or under review. */}
                                <ActionPill action={profileAction} isAuthor={isOwn} variant="profile" />
                                {/* Join: only a creator with an active membership level, never your own page. */}
                                {!isOwn && (
                                    <ProfileJoinButton
                                        creatorId={profile.id}
                                        creatorName={profile.display_name || profile.username}
                                        className="flex h-10 items-center justify-center gap-2 rounded-xl bg-primary-ink px-4 text-xs font-bold tracking-wider text-brand-bg shadow-xs transition-all hover:opacity-90"
                                    />
                                )}
                                {isOwn && (
                                    <button
                                        onClick={toggleTheme}
                                        type="button"
                                        className="flex items-center justify-center h-10 w-10 rounded-xl border border-brand-divider bg-brand-card text-brand-text hover:bg-brand-secondary transition-all shadow-xs"
                                        title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                                        aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                                    >
                                        {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/*
                          Counts (T-20): graph-service /v1/graph/counts via
                          the profile BFF, so they move after a follow or
                          unfollow. No likes total: the only likes
                          aggregate is analytics creator/me (owner only).
                        */}
                        <ProfileCounts
                            followerCount={graphCounts.follower_count}
                            followingCount={graphCounts.following_count}
                            onOpen={onOpenConnections}
                        />

                        {/* Meta chips */}
                        <div className="flex items-center gap-x-4 gap-y-1.5 pt-1 text-xs font-medium text-brand-text/60 justify-center md:justify-start flex-wrap">
                            {profile.profession && (
                                <span className="flex items-center gap-1.5">
                                    <Briefcase size={13} className="text-brand-text/50" />
                                    {profile.profession}
                                </span>
                            )}
                            {profile.location && (
                                <span className="flex items-center gap-1.5">
                                    <MapPin size={13} className="text-brand-text/50" />
                                    {profile.location}
                                </span>
                            )}
                            {profile.website && (
                                <a
                                    href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex min-w-0 max-w-full items-center gap-1.5 text-brand-text/75 hover:underline transition-colors"
                                >
                                    <Globe size={13} className="shrink-0" />
                                    <span className="truncate">{profile.website.replace(/^https?:\/\//, "")}</span>
                                </a>
                            )}
                            {profile.created_at && (
                                <span className="flex items-center gap-1.5">
                                    <Calendar size={13} className="text-brand-text/50" />
                                    {formatJoinDate(profile.created_at)}
                                </span>
                            )}
                        </div>
                    </motion.div>
                </div>

                {/* 3. Bio Row */}
                {profile.bio && (
                    <div className="pb-6">
                        <div className="rounded-2xl border border-brand-divider bg-brand-card shadow-xs p-5 sm:p-6">
                            <h3 className="text-xs font-bold tracking-[0.25em] text-muted-foreground mb-2.5">Biography</h3>
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
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-secondary border border-brand-divider text-xs font-semibold text-brand-text/70 hover:text-brand-text hover:shadow-xs transition-all"
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
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-secondary border border-brand-divider text-xs font-semibold text-brand-text/70 hover:text-brand-text hover:shadow-xs transition-all"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    {link.display_label || link.platform}
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Video, Film, Play, Eye, Heart, Users, Loader2 } from "lucide-react"
import { Avatar } from "@/components/LetterAvatar"
import { useAggregatedProfile } from "@/hooks/useAggregatedProfile"
import { useProfilePosts } from "@/hooks/useProfilePosts"
import { useUserChannels } from "@/hooks/useChannels"
import { AppShell } from "@/features/reels/components/AppShell"
import type { PostDetail } from "@/types/profile"

type Tab = "videos" | "flicks"

function fmtCount(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(n)
}

function mediaUrl(mediaId: string) {
    return `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/v1/media/${mediaId}/serve`
}

function VideoCard({ post }: { post: PostDetail }) {
    const isFlick = post.content_type === "reel" || post.content_type === "flick" || post.content_type === "short"
    const href = isFlick ? `/reels?reelId=${post.id}` : `/posttube/watch/${post.id}`

    const thumbMedia = post.media?.find((m) => m.kind === "thumbnail" || m.kind === "cover")
    const coverUrl = post.cover_media_id ? mediaUrl(post.cover_media_id) : null
    const thumbUrl = thumbMedia ? mediaUrl(thumbMedia.media_id) : coverUrl

    return (
        <div className="group relative">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-brand-secondary">
                <Link href={href} className="block h-full">
                    {thumbUrl ? (
                        <img src={thumbUrl} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                        <div className="flex h-full items-center justify-center">
                            <Play className="h-8 w-8 text-brand-text/30" />
                        </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                        <Play className="h-10 w-10 text-white opacity-0 transition-opacity group-hover:opacity-100" fill="white" />
                    </div>
                </Link>
            </div>
            <div className="mt-2 px-0.5">
                <Link href={href}>
                    <p className="truncate text-[13px] font-semibold text-brand-text hover:text-brand-text transition-colors">
                        {post.text || "Untitled"}
                    </p>
                </Link>
                <div className="mt-0.5 flex items-center gap-3 text-[11px] text-brand-text/60">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{fmtCount(post.counts?.likes ?? 0)}</span>
                    <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{fmtCount(post.counts?.comments ?? 0)}</span>
                </div>
            </div>
        </div>
    )
}

const FLICK_TYPES = new Set(["reel", "flick", "short"])

export default function PublicChannelPage() {
    const params = useParams()
    const handle = params.handle as string
    const [tab, setTab] = useState<Tab>("videos")

    const { data: profileData, isLoading: profileLoading } = useAggregatedProfile(handle)
    const profile = profileData?.profile ?? null
    const { data: userChannels } = useUserChannels(profile?.id)
    const channel = userChannels?.[0] ?? null

    const allQuery = useProfilePosts(profile?.id, "all")
    const allPosts = allQuery.data?.pages.flatMap((p) => p.data) ?? []

    const flicks = allPosts.filter((p) => FLICK_TYPES.has(p.content_type))
    const videos = allPosts.filter((p) => !FLICK_TYPES.has(p.content_type) && p.content_type !== "post")
    const items = tab === "videos" ? videos : flicks

    const avatarUrl = profile?.avatar_media_id ? mediaUrl(profile.avatar_media_id) : undefined
    const bannerUrl = profile?.cover_media_id ? mediaUrl(profile.cover_media_id) : undefined

    if (profileLoading) {
        return (
            <AppShell sectionLabel="PostTube">
                <div className="flex items-center justify-center min-h-[60vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-text" />
                </div>
            </AppShell>
        )
    }

    if (!profile) {
        return (
            <AppShell sectionLabel="PostTube">
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                    <h2 className="text-xl font-bold text-brand-text">Channel not found</h2>
                    <p className="text-sm text-brand-highlight mt-2">
                        The channel you are looking for does not exist or has been removed.
                    </p>
                </div>
            </AppShell>
        )
    }

    const displayName = channel?.name || profile.display_name || handle
    const channelHandle = channel?.handle || profile.username || handle
    const subscriberCount = channel?.subscriber_count ?? 0

    return (
        <AppShell sectionLabel="PostTube">
            <div className="min-h-screen bg-brand-card">
                {/* Banner */}
                <div className="relative h-40 bg-gradient-to-br from-brand-text via-brand-text/50 to-slate-300">
                    {bannerUrl && (
                        <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                </div>

                {/* Channel info */}
                <div className="mx-auto max-w-[960px] px-6">
                    <div className="relative -mt-12 flex items-end gap-5">
                        <Avatar
                            src={avatarUrl}
                            name={displayName}
                            seed={profile.id}
                            size="xl"
                            className="h-24 w-24 rounded-full border-4 border-white shadow-lg"
                        />
                        <div className="flex-1 min-w-0 pb-2">
                            <h1 className="text-[22px] font-bold text-brand-text">{displayName}</h1>
                            <p className="text-[13px] text-brand-text/60">@{channelHandle}</p>
                            <div className="mt-1 flex items-center gap-4 text-[12px] text-brand-highlight">
                                <span className="flex items-center gap-1">
                                    <Users className="h-3.5 w-3.5" />
                                    <strong className="text-brand-text">{fmtCount(subscriberCount)}</strong> subscribers
                                </span>
                                <span><strong className="text-brand-text">{videos.length}</strong> videos</span>
                                <span><strong className="text-brand-text">{flicks.length}</strong> flicks</span>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="mt-6 flex items-center gap-1 border-b border-brand-divider">
                        {([
                            { id: "videos" as Tab, label: "Videos", icon: Video, count: videos.length },
                            { id: "flicks" as Tab, label: "Reels", icon: Film, count: flicks.length },
                        ]).map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTab(t.id)}
                                className={`relative flex items-center gap-1.5 px-4 py-3 text-[13px] font-semibold transition-colors ${
                                    tab === t.id ? "text-brand-text" : "text-brand-text/60 hover:text-brand-highlight"
                                }`}
                            >
                                <t.icon className="h-4 w-4" />
                                {t.label}
                                {t.count > 0 && (
                                    <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                        tab === t.id ? "bg-brand-text/10 text-brand-text" : "bg-brand-secondary text-brand-text/60"
                                    }`}>
                                        {t.count}
                                    </span>
                                )}
                                {tab === t.id && (
                                    <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-brand-text" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Grid */}
                    <div className="py-6">
                        {items.length === 0 && !allQuery.isLoading ? (
                            <div className="flex flex-col items-center py-16 text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-secondary">
                                    {tab === "videos" ? <Video className="h-7 w-7 text-brand-text/30" /> : <Film className="h-7 w-7 text-brand-text/30" />}
                                </div>
                                <p className="mt-4 text-[14px] font-semibold text-brand-highlight">No {tab} yet</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
                                {items.map((item) => (
                                    <VideoCard key={item.id} post={item} />
                                ))}
                            </div>
                        )}

                        {allQuery.hasNextPage && (
                            <div className="mt-6 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => allQuery.fetchNextPage()}
                                    disabled={allQuery.isFetchingNextPage}
                                    className="rounded-xl border border-brand-divider px-5 py-2 text-[12px] font-semibold text-brand-highlight hover:bg-brand-secondary disabled:opacity-40 transition-colors"
                                >
                                    {allQuery.isFetchingNextPage ? "Loading..." : "Load more"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    )
}

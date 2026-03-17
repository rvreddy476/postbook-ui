"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import {
    Video,
    Film,
    FileText,
    Trash2,
    Loader2,
    Eye,
    Heart,
    MessageCircle,
    ArrowLeft,
    Play,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import {
    useMyVideos,
    useMyFlicks,
    useMyPosts,
    useUploadCounts,
    useDeleteUpload,
} from "@/hooks/useMyUploads"
import type { UploadDetail } from "@/types/profile"

const TABS = [
    { id: "videos" as const, label: "Videos", icon: Video },
    { id: "flicks" as const, label: "Flicks", icon: Film },
    { id: "posts" as const, label: "Posts", icon: FileText },
]

type TabId = (typeof TABS)[number]["id"]

function fmtDuration(sec: number) {
    if (sec <= 0) return ""
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = Math.round(sec % 60)
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    return `${m}:${String(s).padStart(2, "0")}`
}

function fmtCount(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(n)
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString()
}

function UploadCard({
    item,
    onDelete,
    isDeleting,
    variant,
}: {
    item: UploadDetail
    onDelete: () => void
    isDeleting: boolean
    variant: TabId
}) {
    const thumbnailUrl = item.video_metadata?.thumbnail_url || item.cover_media_id
    const isVideo = variant === "videos" || variant === "flicks"

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="group rounded-xl border border-brand-divider bg-brand-card overflow-hidden hover:shadow-md transition-shadow"
        >
            {/* Thumbnail */}
            {isVideo && (
                <Link href={`/posttube/watch/${item.id}`} className="block relative aspect-video bg-slate-100">
                    {thumbnailUrl ? (
                        <img
                            src={thumbnailUrl}
                            alt={item.title || item.text}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#D8103F]/10 to-purple-100">
                            <Play className="h-8 w-8 text-[#D8103F]/30" />
                        </div>
                    )}
                    {item.video_metadata?.duration_seconds && (
                        <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
                            {fmtDuration(item.video_metadata.duration_seconds)}
                        </span>
                    )}
                    {item.video_metadata?.upload_status && item.video_metadata.upload_status !== "ready" && (
                        <span className="absolute top-2 left-2 rounded bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                            {item.video_metadata.upload_status}
                        </span>
                    )}
                </Link>
            )}

            {/* Content */}
            <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <Link
                            href={isVideo ? `/posttube/watch/${item.id}` : `/post/${item.id}`}
                            className="text-sm font-semibold text-brand-text line-clamp-2 hover:text-[#D8103F] transition-colors"
                        >
                            {item.title || item.text || "Untitled"}
                        </Link>
                        <p className="text-xs text-brand-text/60 mt-1">{timeAgo(item.created_at)}</p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDelete}
                        disabled={isDeleting}
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        {isDeleting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        )}
                    </Button>
                </div>

                {/* Stats */}
                <div className="mt-3 flex items-center gap-4 text-xs text-brand-highlight">
                    {item.counts && (
                        <>
                            <span className="flex items-center gap-1">
                                <Heart className="h-3 w-3" /> {fmtCount(item.counts.likes)}
                            </span>
                            <span className="flex items-center gap-1">
                                <MessageCircle className="h-3 w-3" /> {fmtCount(item.counts.comments)}
                            </span>
                        </>
                    )}
                    {isVideo && item.video_metadata?.final_category && (
                        <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-highlight">
                            {item.video_metadata.final_category}
                        </span>
                    )}
                </div>
            </div>
        </motion.div>
    )
}

function VideosTab() {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useMyVideos()
    const deleteMutation = useDeleteUpload()
    const { toast, ToastContainer } = useToast()
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const items = data?.pages.flatMap((p) => p.data) ?? []

    const handleDelete = (postId: string) => {
        setDeletingId(postId)
        deleteMutation.mutate(
            { postId },
            {
                onSuccess: () => {
                    toast({ type: "success", title: "Deleted", description: "Video removed." })
                    setDeletingId(null)
                },
                onError: () => {
                    toast({ type: "error", title: "Error", description: "Could not delete video." })
                    setDeletingId(null)
                },
            },
        )
    }

    if (isLoading) return <LoadingSkeleton />
    if (!items.length) return <EmptyState label="No videos yet" />

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                    {items.map((item) => (
                        <UploadCard
                            key={item.id}
                            item={item}
                            variant="videos"
                            onDelete={() => handleDelete(item.id)}
                            isDeleting={deletingId === item.id}
                        />
                    ))}
                </AnimatePresence>
            </div>
            {hasNextPage && (
                <div className="flex justify-center mt-6">
                    <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                        {isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Load more
                    </Button>
                </div>
            )}
            <ToastContainer />
        </>
    )
}

function FlicksTab() {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useMyFlicks()
    const deleteMutation = useDeleteUpload()
    const { toast, ToastContainer } = useToast()
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const items = data?.pages.flatMap((p) => p.data) ?? []

    const handleDelete = (postId: string) => {
        setDeletingId(postId)
        deleteMutation.mutate(
            { postId },
            {
                onSuccess: () => {
                    toast({ type: "success", title: "Deleted", description: "Flick removed." })
                    setDeletingId(null)
                },
                onError: () => {
                    toast({ type: "error", title: "Error", description: "Could not delete flick." })
                    setDeletingId(null)
                },
            },
        )
    }

    if (isLoading) return <LoadingSkeleton />
    if (!items.length) return <EmptyState label="No flicks yet" />

    return (
        <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <AnimatePresence>
                    {items.map((item) => (
                        <UploadCard
                            key={item.id}
                            item={item}
                            variant="flicks"
                            onDelete={() => handleDelete(item.id)}
                            isDeleting={deletingId === item.id}
                        />
                    ))}
                </AnimatePresence>
            </div>
            {hasNextPage && (
                <div className="flex justify-center mt-6">
                    <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                        {isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Load more
                    </Button>
                </div>
            )}
            <ToastContainer />
        </>
    )
}

function PostsTab() {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useMyPosts()
    const deleteMutation = useDeleteUpload()
    const { toast, ToastContainer } = useToast()
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const items = data?.pages.flatMap((p) => p.data) ?? []

    const handleDelete = (postId: string) => {
        setDeletingId(postId)
        deleteMutation.mutate(
            { postId },
            {
                onSuccess: () => {
                    toast({ type: "success", title: "Deleted", description: "Post removed." })
                    setDeletingId(null)
                },
                onError: () => {
                    toast({ type: "error", title: "Error", description: "Could not delete post." })
                    setDeletingId(null)
                },
            },
        )
    }

    if (isLoading) return <LoadingSkeleton />
    if (!items.length) return <EmptyState label="No posts yet" />

    return (
        <>
            <div className="space-y-3">
                <AnimatePresence>
                    {items.map((item) => (
                        <UploadCard
                            key={item.id}
                            item={item}
                            variant="posts"
                            onDelete={() => handleDelete(item.id)}
                            isDeleting={deletingId === item.id}
                        />
                    ))}
                </AnimatePresence>
            </div>
            {hasNextPage && (
                <div className="flex justify-center mt-6">
                    <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                        {isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Load more
                    </Button>
                </div>
            )}
            <ToastContainer />
        </>
    )
}

function LoadingSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-brand-divider bg-brand-card overflow-hidden animate-pulse">
                    <div className="aspect-video bg-slate-100" />
                    <div className="p-4 space-y-2">
                        <div className="h-4 bg-slate-100 rounded w-3/4" />
                        <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    )
}

function EmptyState({ label }: { label: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-brand-text/60">
            <Video className="h-10 w-10 mb-3" />
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs mt-1">Your uploaded content will appear here.</p>
        </div>
    )
}

export default function MyUploadsPage() {
    const [activeTab, setActiveTab] = useState<TabId>("videos")
    const { data: counts } = useUploadCounts()

    const countMap: Record<TabId, number> = {
        videos: counts?.videos ?? 0,
        flicks: counts?.flicks ?? 0,
        posts: counts?.posts ?? 0,
    }

    return (
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-6">
                <Link href="/posttube" className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D8103F]/10 hover:bg-[#D8103F]/20 transition-colors">
                    <ArrowLeft className="h-4 w-4 text-[#D8103F]" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-brand-text">My Uploads</h1>
                    <p className="text-sm text-brand-highlight">Manage your videos, flicks, and posts.</p>
                </div>
            </motion.div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 mb-6 w-fit">
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                                isActive
                                    ? "bg-brand-card text-[#b80d35] shadow-sm"
                                    : "text-brand-highlight hover:text-slate-700"
                            }`}
                        >
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                            {countMap[tab.id] > 0 && (
                                <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                                    isActive ? "bg-[#D8103F]/10 text-[#D8103F]" : "bg-slate-200 text-brand-highlight"
                                }`}>
                                    {fmtCount(countMap[tab.id])}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                >
                    {activeTab === "videos" && <VideosTab />}
                    {activeTab === "flicks" && <FlicksTab />}
                    {activeTab === "posts" && <PostsTab />}
                </motion.div>
            </AnimatePresence>
        </div>
    )
}

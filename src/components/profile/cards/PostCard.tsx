"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Gem,
    MessageCircle,
    Repeat2,
    Bookmark,
    Pin,
} from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { PostDetail } from "@/types/profile"
import api from "@/lib/api"
import { VideoEmbedCard } from "./VideoEmbedCard"
import { FlickEmbedCard } from "./FlickEmbedCard"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateString: string): string {
    const now = Date.now()
    const then = new Date(dateString).getTime()
    const diffMs = now - then
    if (diffMs < 0) return "just now"

    const seconds = Math.floor(diffMs / 1000)
    if (seconds < 60) return "just now"

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`

    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`

    const weeks = Math.floor(days / 7)
    if (weeks < 5) return `${weeks}w ago`

    const months = Math.floor(days / 30)
    if (months < 12) return `${months}mo ago`

    const years = Math.floor(days / 365)
    return `${years}y ago`
}

function formatCount(n: number): string {
    if (n < 1_000) return String(n)
    if (n < 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`
    if (n < 1_000_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
}

function mediaUrl(mediaId: string): string {
    return `/v1/media/${mediaId}/serve`
}

// ---------------------------------------------------------------------------
// Media Grid
// ---------------------------------------------------------------------------

function MediaGrid({ items }: { items: { media_id: string; kind: string }[] }) {
    const count = items.length
    if (count === 0) return null

    if (count === 1) {
        return (
            <div className="mt-3 overflow-hidden rounded-xl">
                <img
                    src={mediaUrl(items[0].media_id)}
                    alt=""
                    loading="lazy"
                    className="w-full max-h-[480px] object-cover"
                />
            </div>
        )
    }

    if (count === 2) {
        return (
            <div className="mt-3 grid grid-cols-2 gap-1 overflow-hidden rounded-xl">
                {items.slice(0, 2).map((m) => (
                    <img
                        key={m.media_id}
                        src={mediaUrl(m.media_id)}
                        alt=""
                        loading="lazy"
                        className="w-full h-64 object-cover"
                    />
                ))}
            </div>
        )
    }

    if (count === 3) {
        return (
            <div className="mt-3 grid grid-cols-2 gap-1 overflow-hidden rounded-xl" style={{ gridTemplateRows: "1fr 1fr" }}>
                <img
                    src={mediaUrl(items[0].media_id)}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover row-span-2"
                    style={{ gridRow: "1 / 3" }}
                />
                <img
                    src={mediaUrl(items[1].media_id)}
                    alt=""
                    loading="lazy"
                    className="w-full h-32 object-cover"
                />
                <img
                    src={mediaUrl(items[2].media_id)}
                    alt=""
                    loading="lazy"
                    className="w-full h-32 object-cover"
                />
            </div>
        )
    }

    // 4+
    const visible = items.slice(0, 4)
    const remaining = count - 4
    return (
        <div className="mt-3 grid grid-cols-2 gap-1 overflow-hidden rounded-xl">
            {visible.map((m, i) => (
                <div key={m.media_id} className="relative">
                    <img
                        src={mediaUrl(m.media_id)}
                        alt=""
                        loading="lazy"
                        className="w-full h-48 object-cover"
                    />
                    {i === 3 && remaining > 0 && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="text-white text-2xl font-bold">+{remaining}</span>
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Action Button
// ---------------------------------------------------------------------------

interface ActionButtonProps {
    icon: React.ReactNode
    label: string
    count?: number
    active?: boolean
    activeColor?: string
    onClick?: () => void
}

function ActionButton({ icon, label, count, active, activeColor = "text-[#D8103F]", onClick }: ActionButtonProps) {
    return (
        <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={onClick}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                active ? activeColor : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
        >
            {icon}
            {count !== undefined && count > 0 && (
                <span className="text-xs">{formatCount(count)}</span>
            )}
            <span className="hidden sm:inline text-xs">{label}</span>
        </motion.button>
    )
}

// ---------------------------------------------------------------------------
// PostCard
// ---------------------------------------------------------------------------

interface PostCardProps {
    post: PostDetail
}

export function PostCard({ post }: PostCardProps) {
    const queryClient = useQueryClient()
    const [expanded, setExpanded] = useState(false)

    // Optimistic local state for spark + stash
    const [sparked, setSparked] = useState(!!post.viewer_reaction)
    const [sparkCount, setSparkCount] = useState(post.counts?.likes ?? 0)
    const [stashed, setStashed] = useState(!!post.is_bookmarked)

    const sparkMutation = useMutation({
        mutationFn: () =>
            api.post(`/v1/posts/${post.id}/react`, { reaction_type: "like" }),
        onMutate: () => {
            const wasSparked = sparked
            setSparked(!wasSparked)
            setSparkCount((c) => (wasSparked ? c - 1 : c + 1))
            return { wasSparked }
        },
        onError: (_err, _vars, context) => {
            if (context) {
                setSparked(context.wasSparked)
                setSparkCount((c) => (context.wasSparked ? c + 1 : c - 1))
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["posts"] })
        },
    })

    const stashMutation = useMutation({
        mutationFn: () => api.post(`/v1/posts/${post.id}/bookmark`),
        onMutate: () => {
            const wasStashed = stashed
            setStashed(!wasStashed)
            return { wasStashed }
        },
        onError: (_err, _vars, context) => {
            if (context) {
                setStashed(context.wasStashed)
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["posts"] })
        },
    })

    const handleSpark = useCallback(() => sparkMutation.mutate(), [sparkMutation])
    const handleStash = useCallback(() => stashMutation.mutate(), [stashMutation])

    const commentCount = post.counts?.comments ?? 0
    const echoCount = post.counts?.shares ?? 0
    const hasMedia = post.media && post.media.length > 0
    const isVideoEmbed = post.content_type === "video_embed"
    const isFlickEmbed = post.content_type === "flick_embed"

    return (
        <motion.article
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow duration-300"
        >
            {/* Pinned badge */}
            {post.is_pinned && (
                <div className="flex items-center gap-1.5 mb-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-50 text-teal-600 text-xs font-semibold">
                        <Pin className="w-3 h-3" />
                        Pinned
                    </span>
                </div>
            )}

            {/* Post text */}
            {post.text && (
                <div className="mb-3">
                    <p
                        className={`text-slate-950 text-[15px] leading-relaxed whitespace-pre-wrap break-words ${
                            !expanded ? "line-clamp-4" : ""
                        }`}
                    >
                        {post.text}
                    </p>
                    {/* Show more toggle — only show if text likely exceeds 4 lines */}
                    {post.text.length > 280 && (
                        <button
                            onClick={() => setExpanded((v) => !v)}
                            className="mt-1 text-sm font-medium text-[#D8103F] hover:text-[#b80d35] transition-colors"
                        >
                            {expanded ? "Show less" : "Show more"}
                        </button>
                    )}
                </div>
            )}

            {/* Media grid (only for non-embed types) */}
            {!isVideoEmbed && !isFlickEmbed && hasMedia && (
                <MediaGrid items={post.media!} />
            )}

            {/* Video embed card */}
            {isVideoEmbed && post.embed_ref && (
                <div className="mt-3">
                    <VideoEmbedCard embedRef={post.embed_ref} />
                </div>
            )}

            {/* Flick embed card */}
            {isFlickEmbed && post.embed_ref && (
                <div className="mt-3">
                    <FlickEmbedCard embedRef={post.embed_ref} />
                </div>
            )}

            {/* Hashtags */}
            {post.hashtags && post.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                    {post.hashtags.map((tag) => (
                        <span
                            key={tag}
                            className="text-teal-500 text-sm font-medium hover:text-teal-600 cursor-pointer transition-colors"
                        >
                            #{tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Counts summary */}
            {(sparkCount > 0 || commentCount > 0 || echoCount > 0) && (
                <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
                    {sparkCount > 0 && (
                        <span className="flex items-center gap-1">
                            <Gem className="w-3.5 h-3.5 text-[#D8103F]/50" />
                            {formatCount(sparkCount)} {sparkCount === 1 ? "Spark" : "Sparks"}
                        </span>
                    )}
                    {sparkCount > 0 && (commentCount > 0 || echoCount > 0) && (
                        <span className="text-slate-300">·</span>
                    )}
                    {commentCount > 0 && (
                        <span>{formatCount(commentCount)} {commentCount === 1 ? "Comment" : "Comments"}</span>
                    )}
                    {commentCount > 0 && echoCount > 0 && (
                        <span className="text-slate-300">·</span>
                    )}
                    {echoCount > 0 && (
                        <span>{formatCount(echoCount)} {echoCount === 1 ? "Echo" : "Echoes"}</span>
                    )}
                </div>
            )}

            {/* Divider */}
            <div className="border-t border-slate-100 mt-4 mb-1" />

            {/* Action bar */}
            <div className="flex items-center justify-between -mx-1">
                <ActionButton
                    icon={
                        <Gem
                            className={`w-[18px] h-[18px] transition-colors ${
                                sparked ? "fill-[#D8103F]/50 text-[#D8103F]" : ""
                            }`}
                        />
                    }
                    label="Spark"
                    count={sparkCount}
                    active={sparked}
                    activeColor="text-[#D8103F]"
                    onClick={handleSpark}
                />
                <ActionButton
                    icon={<MessageCircle className="w-[18px] h-[18px]" />}
                    label="Comment"
                    count={commentCount}
                />
                <ActionButton
                    icon={<Repeat2 className="w-[18px] h-[18px]" />}
                    label="Echo"
                    count={echoCount}
                />
                <ActionButton
                    icon={
                        <Bookmark
                            className={`w-[18px] h-[18px] transition-colors ${
                                stashed ? "fill-slate-700 text-slate-700" : ""
                            }`}
                        />
                    }
                    label="Stash"
                    active={stashed}
                    activeColor="text-slate-700"
                    onClick={handleStash}
                />
            </div>

            {/* Timestamp */}
            <div className="mt-2 text-[11px] text-slate-400 text-right">
                {formatRelativeTime(post.created_at)}
            </div>
        </motion.article>
    )
}

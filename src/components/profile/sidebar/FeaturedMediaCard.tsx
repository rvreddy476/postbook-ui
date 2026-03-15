"use client"

import { PostDetail } from "@/types/profile"
import api from "@/lib/api"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { Image, Play } from "lucide-react"

interface FeaturedMediaCardProps {
    userId: string
    onSeeAll: () => void
}

export default function FeaturedMediaCard({ userId, onSeeAll }: FeaturedMediaCardProps) {
    const { data: mediaItems, isLoading } = useQuery({
        queryKey: ["featuredMedia", userId],
        queryFn: async () => {
            const res = await api.get<{ data: PostDetail[] }>(
                `/v1/posts/by-author/${userId}?limit=18`
            )
            const posts = res.data.data ?? []
            return posts
                .filter((p) => p.media && p.media.length > 0)
                .slice(0, 6)
        },
        enabled: !!userId,
    })

    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-pulse">
                <div className="h-4 w-20 bg-slate-200 rounded mb-3" />
                <div className="grid grid-cols-3 gap-1.5">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="aspect-square bg-slate-200 rounded-xl" />
                    ))}
                </div>
            </div>
        )
    }

    if (!mediaItems || mediaItems.length === 0) return null

    const isVideoItem = (post: PostDetail) => {
        if (post.content_type === "reel" || post.content_type === "video") return true
        return post.media?.some((m) => m.kind === "video") ?? false
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100"
        >
            <div className="flex items-center gap-2 mb-3">
                <Image className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-900">Photos & Videos</h3>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
                {mediaItems.map((post) => {
                    const mediaId = post.media?.[0]?.media_id
                    const hasVideo = isVideoItem(post)

                    return (
                        <div
                            key={post.id}
                            className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 group cursor-pointer"
                        >
                            {mediaId && (
                                <img
                                    src={`/api/media/${mediaId}/thumbnail`}
                                    alt=""
                                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                                />
                            )}
                            {hasVideo && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
                                        <Play className="h-3 w-3 text-white fill-white ml-0.5" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            <button
                onClick={onSeeAll}
                className="mt-4 w-full text-center text-sm font-semibold text-[#D8103F] hover:text-[#b80d35] transition-colors"
            >
                See all
            </button>
        </motion.div>
    )
}

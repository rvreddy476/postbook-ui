"use client"

import { UserProfile } from "@/types/profile"
import api from "@/lib/api"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { Users } from "lucide-react"

interface MutualFriendsCardProps {
    viewerId: string
    profileId: string
    isOwn: boolean
}

interface MutualFriendsResponse {
    user_ids: string[]
    total: number
}

export default function MutualFriendsCard({ viewerId, profileId, isOwn }: MutualFriendsCardProps) {
    const {
        data: mutuals,
        isLoading,
    } = useQuery({
        queryKey: ["mutualFriends", viewerId, profileId],
        queryFn: async () => {
            const res = await api.get<{ data: MutualFriendsResponse }>(
                `/v1/graph/mutuals?user_id=${viewerId}&other_id=${profileId}&limit=6`
            )
            return res.data.data
        },
        enabled: !isOwn && !!viewerId && !!profileId,
    })

    const mutualIds = mutuals?.user_ids ?? []
    const total = mutuals?.total ?? 0

    const {
        data: profiles,
        isLoading: profilesLoading,
    } = useQuery({
        queryKey: ["mutualProfiles", mutualIds],
        queryFn: async () => {
            const res = await api.post<{ data: { profiles: UserProfile[] } }>(
                "/v1/profiles/batch",
                { user_ids: mutualIds }
            )
            return res.data.data.profiles
        },
        enabled: mutualIds.length > 0,
    })

    if (isOwn) return null
    if (!isLoading && total === 0) return null

    const loading = isLoading || profilesLoading

    if (loading) {
        return (
            <div className="bg-brand-card rounded-2xl p-5 shadow-sm border border-brand-divider animate-pulse">
                <div className="h-4 w-28 bg-slate-200 rounded mb-3" />
                <div className="flex -space-x-2 mb-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white" />
                    ))}
                </div>
                <div className="h-3 w-48 bg-slate-200 rounded" />
            </div>
        )
    }

    const displayProfiles = profiles ?? []
    const nameList = displayProfiles.slice(0, 2).map((p) => p.display_name || p.username)
    const othersCount = total - nameList.length

    let summaryText = ""
    if (nameList.length === 1 && othersCount > 0) {
        summaryText = `${total} mutual friends including ${nameList[0]} and ${othersCount} other${othersCount > 1 ? "s" : ""}`
    } else if (nameList.length === 2 && othersCount > 0) {
        summaryText = `${total} mutual friends including ${nameList[0]}, ${nameList[1]}, and ${othersCount} other${othersCount > 1 ? "s" : ""}`
    } else if (nameList.length >= 1 && othersCount === 0) {
        summaryText = `${total} mutual friend${total > 1 ? "s" : ""}`
    } else {
        summaryText = `${total} mutual friend${total > 1 ? "s" : ""}`
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 }}
            className="bg-brand-card rounded-2xl p-5 shadow-sm border border-brand-divider"
        >
            <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-brand-text/60" />
                <h3 className="text-sm font-bold text-brand-text">Mutual Friends</h3>
            </div>

            <div className="flex -space-x-2 mb-2.5">
                {displayProfiles.slice(0, 6).map((profile) => (
                    <div
                        key={profile.id}
                        className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 overflow-hidden shrink-0"
                    >
                        {profile.avatar_media_id ? (
                            <img
                                src={`/api/media/${profile.avatar_media_id}/thumbnail`}
                                alt={profile.display_name || profile.username}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-[#D8103F]/10 flex items-center justify-center text-xs font-semibold text-[#D8103F]">
                                {(profile.display_name || profile.username).charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <p className="text-xs text-brand-highlight leading-relaxed">{summaryText}</p>
        </motion.div>
    )
}

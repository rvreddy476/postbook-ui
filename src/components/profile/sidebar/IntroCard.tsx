"use client"

import { UserProfile } from "@/types/profile"
import { MapPin, Briefcase, Calendar, Globe } from "lucide-react"
import { motion } from "framer-motion"

interface IntroCardProps {
    profile: UserProfile
    onSeeAll: () => void
}

export default function IntroCard({ profile, onSeeAll }: IntroCardProps) {
    const joinedDate = new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
    })

    const hasAnyDetail = profile.bio || profile.location || profile.profession || profile.website

    if (!hasAnyDetail) return null

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100"
        >
            <h3 className="text-sm font-bold text-slate-900 mb-3">Intro</h3>

            <div className="space-y-3">
                {profile.bio && (
                    <p className="text-sm text-slate-700 line-clamp-2 leading-relaxed">
                        {profile.bio}
                    </p>
                )}

                {profile.profession && (
                    <div className="flex items-center gap-2.5 text-sm text-slate-600">
                        <Briefcase className="h-4 w-4 text-slate-400 shrink-0" />
                        <span>{profile.profession}</span>
                    </div>
                )}

                {profile.location && (
                    <div className="flex items-center gap-2.5 text-sm text-slate-600">
                        <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                        <span>{profile.location}</span>
                    </div>
                )}

                <div className="flex items-center gap-2.5 text-sm text-slate-600">
                    <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>Joined {joinedDate}</span>
                </div>

                {profile.website && (
                    <div className="flex items-center gap-2.5 text-sm text-slate-600">
                        <Globe className="h-4 w-4 text-slate-400 shrink-0" />
                        <a
                            href={profile.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#D8103F] hover:underline truncate"
                        >
                            {profile.website.replace(/^https?:\/\//, "")}
                        </a>
                    </div>
                )}
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

"use client"

import { UserLink } from "@/types/profile"
import api from "@/lib/api"
import { ExternalLink } from "lucide-react"
import { motion } from "framer-motion"

interface LinksCardProps {
    links: UserLink[]
}

function trackLinkClick(platform: string) {
    api.post(`/v1/links/${platform}/click`).catch(() => {
        // Fire and forget
    })
}

function formatPlatformName(platform: string): string {
    const names: Record<string, string> = {
        twitter: "Twitter / X",
        x: "Twitter / X",
        instagram: "Instagram",
        github: "GitHub",
        linkedin: "LinkedIn",
        youtube: "YouTube",
        tiktok: "TikTok",
        facebook: "Facebook",
        website: "Website",
        blog: "Blog",
        portfolio: "Portfolio",
        discord: "Discord",
        twitch: "Twitch",
        spotify: "Spotify",
        medium: "Medium",
        substack: "Substack",
    }
    return names[platform.toLowerCase()] ?? platform.charAt(0).toUpperCase() + platform.slice(1)
}

function formatUrl(url: string): string {
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "")
}

export default function LinksCard({ links }: LinksCardProps) {
    if (!links || links.length === 0) return null

    const sortedLinks = [...links].sort((a, b) => a.sort_order - b.sort_order)

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.2 }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100"
        >
            <h3 className="text-sm font-bold text-slate-900 mb-3">Links</h3>

            <div className="space-y-3">
                {sortedLinks.map((link, idx) => (
                    <a
                        key={`${link.platform}-${idx}`}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackLinkClick(link.platform)}
                        className="flex items-center gap-2.5 group"
                    >
                        <ExternalLink className="h-4 w-4 text-slate-400 shrink-0 group-hover:text-[#D8103F] transition-colors" />
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 group-hover:text-[#D8103F] transition-colors">
                                {link.display_label || formatPlatformName(link.platform)}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                                {formatUrl(link.url)}
                            </p>
                        </div>
                    </a>
                ))}
            </div>
        </motion.div>
    )
}

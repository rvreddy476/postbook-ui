"use client"

import React from "react"
import { useParams } from "next/navigation"
import { useChannel } from "@/hooks/useChannels"
import { useMediaSlots, getSlotUrlWithFallback } from "@/hooks/useMediaSlots"
import { BadgeCheck, Users, ExternalLink, Trophy, Loader2 } from "lucide-react"

export default function ChannelProfilePage() {
    const params = useParams()
    const handle = params.handle as string
    const { data: channel, isLoading, error } = useChannel(handle)
    const { data: slots } = useMediaSlots("channel", channel?.id)

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (error || !channel) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <h2 className="text-xl font-bold text-foreground">Channel not found</h2>
                <p className="text-sm text-muted-foreground mt-2">
                    The channel you are looking for does not exist or has been removed.
                </p>
            </div>
        )
    }

    const avatarUrl = getSlotUrlWithFallback(slots, "avatar", channel.avatar_media_id) ?? null
    const bannerUrl = getSlotUrlWithFallback(slots, "banner", channel.banner_media_id) ?? null

    return (
        <div className="min-h-screen bg-background">
            {/* Banner */}
            <div className="h-56 md:h-72 relative overflow-hidden">
                {bannerUrl ? (
                    <img
                        src={bannerUrl}
                        alt=""
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-linear-to-br from-primary-hover via-primary-ink to-primary" />
                )}
                <div className="absolute inset-0 bg-linear-to-t from-primary-hover/60 to-transparent" />
            </div>

            {/* Channel Info */}
            <div className="max-w-4xl mx-auto px-4 -mt-20 relative z-10">
                <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
                    {/* Avatar */}
                    <div className="h-32 w-32 rounded-2xl bg-brand-card p-1.5 shadow-xl border border-border">
                        <div className="w-full h-full rounded-xl overflow-hidden bg-secondary">
                            {avatarUrl ? (
                                <img
                                    src={avatarUrl}
                                    alt={channel.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-muted-foreground">
                                    {(channel.name || channel.handle || "C").charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Name + Meta */}
                    <div className="flex-1 text-center sm:text-left pb-2">
                        <div className="flex items-center gap-2 justify-center sm:justify-start">
                            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                                {channel.name || channel.handle}
                            </h1>
                            {channel.is_verified && (
                                <BadgeCheck className="w-5 h-5 text-primary-ink" />
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">@{channel.handle}</p>
                        {channel.category && (
                            <span className="inline-block mt-1.5 px-2.5 py-0.5 text-xs font-medium bg-secondary text-muted-foreground rounded-full">
                                {channel.category}
                            </span>
                        )}
                    </div>

                    {/* Subscriber Count */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-brand-card rounded-xl border border-border shadow-xs">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-bold text-foreground">
                            {channel.subscriber_count.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">subscribers</span>
                    </div>
                </div>

                {/* Description */}
                {channel.description && (
                    <div className="mt-6 p-4 bg-brand-card rounded-2xl border border-border shadow-xs">
                        <p className="text-sm text-foreground leading-relaxed">
                            {channel.description}
                        </p>
                    </div>
                )}

                {/* Links */}
                {channel.links && channel.links.length > 0 && (
                    <div className="mt-6">
                        <h2 className="text-sm font-bold text-foreground tracking-wide mb-3">
                            Links
                        </h2>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {channel.links.map((link) => (
                                <a
                                    key={link.id}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-3 bg-brand-card rounded-xl border border-border shadow-xs hover:border-primary-outline hover:shadow-md transition-all group"
                                >
                                    <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
                                        <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                    </div>
                                    <span className="text-sm font-medium text-foreground group-hover:text-muted-foreground transition-colors truncate">
                                        {link.title}
                                    </span>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* Milestones */}
                {channel.milestones && channel.milestones.length > 0 && (
                    <div className="mt-8 mb-12">
                        <h2 className="text-sm font-bold text-foreground tracking-wide mb-3">
                            Milestones
                        </h2>
                        <div className="relative">
                            {/* Timeline line */}
                            <div className="absolute left-4 top-0 bottom-0 w-px bg-secondary" />

                            <div className="space-y-4">
                                {channel.milestones.map((milestone) => (
                                    <div key={milestone.id} className="relative pl-10">
                                        {/* Dot */}
                                        <div className="absolute left-2.5 top-3 w-3 h-3 rounded-full bg-primary-tint border-2 border-white shadow-xs" />

                                        <div className="p-4 bg-brand-card rounded-xl border border-border shadow-xs">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Trophy className="w-4 h-4 text-primary-ink" />
                                                    <h3 className="text-sm font-bold text-foreground">
                                                        {milestone.title}
                                                    </h3>
                                                </div>
                                                {milestone.subscriber_count && (
                                                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full whitespace-nowrap">
                                                        {milestone.subscriber_count.toLocaleString()} subs
                                                    </span>
                                                )}
                                            </div>
                                            {milestone.description && (
                                                <p className="text-xs text-muted-foreground mt-1.5">
                                                    {milestone.description}
                                                </p>
                                            )}
                                            <p className="text-[10px] text-muted-foreground/60 mt-2">
                                                {new Date(milestone.reached_at).toLocaleDateString(undefined, {
                                                    year: "numeric",
                                                    month: "long",
                                                    day: "numeric",
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

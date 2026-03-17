"use client"

import { Shield, UserPlus, MessageSquare } from "lucide-react"
import { motion } from "framer-motion"

interface PrivateProfileProps {
    profile: {
        display_name: string
        username: string
        bio?: string
        avatar_media_id?: string
        cover_media_id?: string
    }
    onAddFriend: () => void
    onMessage?: () => void
}

export function PrivateProfileView({ profile, onAddFriend, onMessage }: PrivateProfileProps) {
    const avatarUrl = profile.avatar_media_id
        ? `/v1/media/${profile.avatar_media_id}/serve`
        : null

    const coverUrl = profile.cover_media_id
        ? `/v1/media/${profile.cover_media_id}/serve`
        : null

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="min-h-screen bg-brand-secondary"
        >
            {/* Cover area */}
            <div className="relative h-48 sm:h-64 rounded-b-3xl overflow-hidden">
                {coverUrl ? (
                    <img
                        src={coverUrl}
                        alt=""
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#D8103F]/50 via-[#D8103F] to-indigo-700" />
                )}
                <div className="absolute inset-0 bg-black/10" />
            </div>

            {/* Profile identity */}
            <div className="relative max-w-2xl mx-auto px-4 sm:px-6">
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="-mt-16 flex flex-col items-center"
                >
                    {/* Avatar */}
                    <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-slate-200">
                        {avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt={profile.display_name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#D8103F]/50 to-[#D8103F] flex items-center justify-center">
                                <span className="text-3xl font-bold text-white">
                                    {profile.display_name.charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Name and handle */}
                    <h1 className="mt-4 text-xl sm:text-2xl font-bold text-brand-text">
                        {profile.display_name}
                    </h1>
                    <p className="mt-1 text-sm text-brand-highlight">@{profile.username}</p>

                    {/* Bio (if visible) */}
                    {profile.bio && (
                        <p className="mt-3 text-sm text-brand-highlight text-center max-w-md leading-relaxed">
                            {profile.bio}
                        </p>
                    )}
                </motion.div>

                {/* Private notice card */}
                <motion.div
                    initial={{ y: 24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.45, delay: 0.25 }}
                    className="mt-8 mb-12"
                >
                    <div className="bg-brand-card rounded-2xl shadow-sm border border-brand-divider p-8 sm:p-10 text-center">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-secondary mb-5">
                            <Shield className="w-7 h-7 text-brand-text/60" />
                        </div>

                        <h2 className="text-lg font-semibold text-brand-text">
                            This profile is private
                        </h2>

                        <p className="mt-2 text-sm text-brand-highlight max-w-xs mx-auto leading-relaxed">
                            Add them as a friend to see their posts and connect with them.
                        </p>

                        {/* Action buttons */}
                        <div className="mt-6 flex items-center justify-center gap-3">
                            <button
                                onClick={onAddFriend}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D8103F] text-white text-sm font-medium hover:bg-[#b80d35] transition-colors focus:outline-none focus:ring-2 focus:ring-[#D8103F]/50 focus:ring-offset-2"
                            >
                                <UserPlus className="w-4 h-4" />
                                Add Friend
                            </button>

                            {onMessage && (
                                <button
                                    onClick={onMessage}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                                >
                                    <MessageSquare className="w-4 h-4" />
                                    Message
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    )
}

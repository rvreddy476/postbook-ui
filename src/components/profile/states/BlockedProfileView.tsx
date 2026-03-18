"use client"

import { ShieldOff, Home, UserX } from "lucide-react"
import { motion } from "framer-motion"

interface BlockedProfileProps {
    variant: "blocked_by_viewer" | "blocked_by_them"
    username?: string
    onUnblock?: () => void
    onGoHome: () => void
}

export function BlockedProfileView({ variant, username, onUnblock, onGoHome }: BlockedProfileProps) {
    if (variant === "blocked_by_them") {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="min-h-screen bg-brand-secondary flex items-center justify-center px-4"
            >
                <div className="bg-brand-card rounded-2xl shadow-sm border border-brand-divider p-10 sm:p-14 text-center max-w-md w-full">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-secondary mb-6">
                        <UserX className="w-8 h-8 text-brand-text/60" />
                    </div>

                    <h2 className="text-xl font-semibold text-brand-text">
                        This profile is unavailable
                    </h2>

                    <p className="mt-3 text-sm text-brand-highlight leading-relaxed">
                        You are unable to view this profile.
                    </p>

                    <div className="mt-8">
                        <button
                            onClick={onGoHome}
                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-text text-white text-sm font-medium hover:bg-brand-text transition-colors focus:outline-none focus:ring-2 focus:ring-brand-text/50 focus:ring-offset-2"
                        >
                            <Home className="w-4 h-4" />
                            Go Home
                        </button>
                    </div>
                </div>
            </motion.div>
        )
    }

    // blocked_by_viewer variant
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="min-h-screen bg-brand-secondary flex items-center justify-center px-4"
        >
            <div className="bg-brand-card rounded-2xl shadow-sm border border-brand-divider p-10 sm:p-14 text-center max-w-md w-full">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-6">
                    <ShieldOff className="w-8 h-8 text-red-400" />
                </div>

                <h2 className="text-xl font-semibold text-brand-text">
                    You have blocked {username ? `@${username}` : "this user"}
                </h2>

                <p className="mt-3 text-sm text-brand-highlight leading-relaxed max-w-xs mx-auto">
                    You won&apos;t see their content, and they won&apos;t be able to
                    contact you. You can unblock them at any time.
                </p>

                <div className="mt-8 flex items-center justify-center gap-3">
                    {onUnblock && (
                        <button
                            onClick={onUnblock}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-secondary text-brand-text text-sm font-medium hover:bg-brand-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-brand-text/40 focus:ring-offset-2"
                        >
                            <ShieldOff className="w-4 h-4" />
                            Unblock
                        </button>
                    )}

                    <button
                        onClick={onGoHome}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-text text-white text-sm font-medium hover:bg-brand-text transition-colors focus:outline-none focus:ring-2 focus:ring-brand-text/50 focus:ring-offset-2"
                    >
                        <Home className="w-4 h-4" />
                        Go Home
                    </button>
                </div>
            </div>
        </motion.div>
    )
}

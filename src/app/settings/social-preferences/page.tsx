"use client"

import { useState } from "react"
import AppShell from '@/components/AppShell'
import Link from "next/link"
import { motion } from "framer-motion"
import {
    ArrowLeft,
    Users,
    Eye,
    MessageSquare,
} from "lucide-react"
import api from "@/lib/api"

/* ------------------------------------------------------------------ */
/*  Toggle Switch                                                       */
/* ------------------------------------------------------------------ */

function ToggleSwitch({
    checked,
    onChange,
    disabled,
}: {
    checked: boolean
    onChange: (checked: boolean) => void
    disabled?: boolean
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={[
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
                "transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-text/50 focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
                checked ? "bg-brand-text" : "bg-brand-secondary",
            ].join(" ")}
        >
            <span
                className={[
                    "pointer-events-none inline-block h-5 w-5 rounded-full bg-brand-bg shadow-md",
                    "transform transition-transform duration-200 ease-in-out",
                    checked ? "translate-x-5" : "translate-x-0",
                ].join(" ")}
            />
        </button>
    )
}

/* ------------------------------------------------------------------ */
/*  Section Card                                                        */
/* ------------------------------------------------------------------ */

function SectionCard({
    icon,
    title,
    description,
    children,
    delay = 0,
}: {
    icon: React.ReactNode
    title: string
    description: string
    children: React.ReactNode
    delay?: number
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="rounded-2xl bg-brand-card border border-brand-divider shadow-sm"
        >
            <div className="p-6">
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-text/5">
                        {icon}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-bold text-brand-text">{title}</h2>
                        <p className="mt-1 text-sm text-brand-highlight">{description}</p>
                    </div>
                </div>
                <div className="mt-5">{children}</div>
            </div>
        </motion.div>
    )
}

/* ------------------------------------------------------------------ */
/*  Save Toast                                                          */
/* ------------------------------------------------------------------ */

function useSaveToast() {
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

    const show = (text: string, isError = false) => {
        setMessage({ text, isError })
        setTimeout(() => setMessage(null), 2000)
    }

    const Toast = message ? (
        <p
            className={[
                "mt-3 text-xs font-semibold",
                message.isError ? "text-red-500" : "text-emerald-600",
            ].join(" ")}
        >
            {message.text}
        </p>
    ) : null

    return { show, Toast }
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

export default function SocialPreferencesPage() {
    const [allowFriendRequests, setAllowFriendRequests] = useState(true)
    const [allowFollows, setAllowFollows] = useState(true)
    const [requireFollowApproval, setRequireFollowApproval] = useState(false)
    const [showFollowerCount, setShowFollowerCount] = useState(true)
    const [showFriendCount, setShowFriendCount] = useState(false)
    const [dmPolicy, setDmPolicy] = useState<"everyone" | "friends" | "nobody">("everyone")
    const { show, Toast } = useSaveToast()

    const handleSave = async () => {
        try {
            await api.put("/v1/users/me/social-preferences", {
                allow_friend_requests: allowFriendRequests,
                allow_follows: allowFollows,
                require_follow_approval: requireFollowApproval,
                show_follower_count: showFollowerCount,
                show_friend_count: showFriendCount,
                dm_policy: dmPolicy,
            })
            show("Saved!")
        } catch {
            show("Could not save", true)
        }
    }

    return (
        <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            {/* Back link */}
            <Link
                href="/settings"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-text transition-colors hover:text-brand-text/70"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Settings
            </Link>

            {/* Page header */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-text/10">
                    <Users className="h-5 w-5 text-brand-text" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-brand-text">Social Preferences</h1>
                    <p className="text-sm text-brand-highlight">
                        Control how others can connect and interact with you.
                    </p>
                </div>
            </div>

            {/* Section 1 — Connections */}
            <SectionCard
                icon={<Users className="h-6 w-6 text-brand-text/50" />}
                title="Connections"
                description="Manage who can connect with you."
                delay={0.05}
            >
                <div className="divide-y divide-brand-divider space-y-0">
                    <div className="flex items-center justify-between py-3">
                        <div>
                            <p className="text-sm font-semibold text-brand-text">Allow Friend Requests</p>
                            <p className="text-xs text-brand-highlight">Let others send you friend requests</p>
                        </div>
                        <ToggleSwitch checked={allowFriendRequests} onChange={setAllowFriendRequests} />
                    </div>
                    <div className="flex items-center justify-between py-3">
                        <div>
                            <p className="text-sm font-semibold text-brand-text">Allow Follows</p>
                            <p className="text-xs text-brand-highlight">Let others follow your profile</p>
                        </div>
                        <ToggleSwitch checked={allowFollows} onChange={setAllowFollows} />
                    </div>
                    <div className="flex items-center justify-between py-3">
                        <div>
                            <p className="text-sm font-semibold text-brand-text">Require Follow Approval</p>
                            <p className="text-xs text-brand-highlight">Manually approve each follow request</p>
                        </div>
                        <ToggleSwitch
                            checked={requireFollowApproval}
                            onChange={setRequireFollowApproval}
                            disabled={!allowFollows}
                        />
                    </div>
                </div>
            </SectionCard>

            {/* Section 2 — Visibility */}
            <SectionCard
                icon={<Eye className="h-6 w-6 text-brand-text/50" />}
                title="Visibility"
                description="Choose what counts to show on your profile."
                delay={0.1}
            >
                <div className="divide-y divide-brand-divider space-y-0">
                    <div className="flex items-center justify-between py-3">
                        <div>
                            <p className="text-sm font-semibold text-brand-text">Show Follower Count</p>
                            <p className="text-xs text-brand-highlight">Display how many people follow you</p>
                        </div>
                        <ToggleSwitch checked={showFollowerCount} onChange={setShowFollowerCount} />
                    </div>
                    <div className="flex items-center justify-between py-3">
                        <div>
                            <p className="text-sm font-semibold text-brand-text">Show Friend Count</p>
                            <p className="text-xs text-brand-highlight">Display your friend count on your profile</p>
                        </div>
                        <ToggleSwitch checked={showFriendCount} onChange={setShowFriendCount} />
                    </div>
                </div>
            </SectionCard>

            {/* Section 3 — Messaging */}
            <SectionCard
                icon={<MessageSquare className="h-6 w-6 text-brand-text/50" />}
                title="Messaging"
                description="Control who can message you."
                delay={0.15}
            >
                <div className="space-y-1.5">
                    <label htmlFor="dm-policy" className="block text-xs font-semibold text-brand-highlight">
                        Allow DMs from
                    </label>
                    <select
                        id="dm-policy"
                        value={dmPolicy}
                        onChange={(e) => setDmPolicy(e.target.value as "everyone" | "friends" | "nobody")}
                        className="w-48 rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2 text-sm font-medium text-brand-text focus:border-brand-text/50 focus:bg-brand-card focus:outline-none focus:ring-2 focus:ring-brand-text/20"
                    >
                        <option value="everyone">Everyone</option>
                        <option value="friends">Friends only</option>
                        <option value="nobody">Nobody</option>
                    </select>
                </div>
            </SectionCard>

            {/* Save */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                <button
                    onClick={handleSave}
                    className="rounded-xl bg-brand-text px-6 py-2.5 text-sm font-semibold text-brand-bg transition-opacity hover:opacity-90"
                >
                    Save Preferences
                </button>
                {Toast}
            </motion.div>
        </div>
        </AppShell>
    )
}

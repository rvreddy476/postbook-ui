"use client"

import { useState } from "react"
import AppShell from '@/components/AppShell'
import Link from "next/link"
import { motion } from "framer-motion"
import {
    ArrowLeft,
    Eye,
    Shield,
    Tag,
    ChevronRight,
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

type Audience = "everyone" | "friends" | "only_me"

export default function PrivacyPage() {
    const [profileVisibility, setProfileVisibility] = useState<Audience>("everyone")
    const [postVisibility, setPostVisibility] = useState<Audience>("everyone")
    const [appearInSearch, setAppearInSearch] = useState(true)
    const [appearInSuggestions, setAppearInSuggestions] = useState(true)
    const [allowTagging, setAllowTagging] = useState<"everyone" | "friends" | "nobody">("everyone")
    const [sensitiveFilter, setSensitiveFilter] = useState(true)
    const { show, Toast } = useSaveToast()

    const handleSave = async () => {
        try {
            await api.put("/v1/users/me/privacy", {
                profile_visibility: profileVisibility,
                post_visibility: postVisibility,
                appear_in_search: appearInSearch,
                appear_in_suggestions: appearInSuggestions,
                allow_tagging: allowTagging,
                sensitive_content_filter: sensitiveFilter,
            })
            show("Saved!")
        } catch {
            show("Could not save", true)
        }
    }

    const selectClasses =
        "w-48 rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2 text-sm font-medium text-brand-text focus:border-brand-text/50 focus:bg-brand-card focus:outline-none focus:ring-2 focus:ring-brand-text/20"

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
                    <Shield className="h-5 w-5 text-brand-text" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-brand-text">Privacy</h1>
                    <p className="text-sm text-brand-highlight">
                        Control who can see your profile and content.
                    </p>
                </div>
            </div>

            {/* Section 1 — Profile Visibility */}
            <SectionCard
                icon={<Eye className="h-6 w-6 text-brand-text/50" />}
                title="Profile Visibility"
                description="Decide who can view your profile and posts."
                delay={0.05}
            >
                <div className="space-y-5">
                    <div className="space-y-1.5">
                        <label htmlFor="profile-vis" className="block text-xs font-semibold text-brand-highlight">
                            Who can see my profile
                        </label>
                        <select
                            id="profile-vis"
                            value={profileVisibility}
                            onChange={(e) => setProfileVisibility(e.target.value as Audience)}
                            className={selectClasses}
                        >
                            <option value="everyone">Everyone</option>
                            <option value="friends">Friends</option>
                            <option value="only_me">Only me</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="post-vis" className="block text-xs font-semibold text-brand-highlight">
                            Who can see my posts
                        </label>
                        <select
                            id="post-vis"
                            value={postVisibility}
                            onChange={(e) => setPostVisibility(e.target.value as Audience)}
                            className={selectClasses}
                        >
                            <option value="everyone">Everyone</option>
                            <option value="friends">Friends</option>
                            <option value="only_me">Only me</option>
                        </select>
                    </div>
                    <div className="divide-y divide-brand-divider">
                        <div className="flex items-center justify-between py-3">
                            <div>
                                <p className="text-sm font-semibold text-brand-text">Appear in search results</p>
                                <p className="text-xs text-brand-highlight">Allow others to find you via search</p>
                            </div>
                            <ToggleSwitch checked={appearInSearch} onChange={setAppearInSearch} />
                        </div>
                        <div className="flex items-center justify-between py-3">
                            <div>
                                <p className="text-sm font-semibold text-brand-text">Appear in suggestions</p>
                                <p className="text-xs text-brand-highlight">Show up in &quot;People you may know&quot;</p>
                            </div>
                            <ToggleSwitch checked={appearInSuggestions} onChange={setAppearInSuggestions} />
                        </div>
                    </div>
                </div>
            </SectionCard>

            {/* Section 2 — Content */}
            <SectionCard
                icon={<Tag className="h-6 w-6 text-brand-text/50" />}
                title="Content"
                description="Manage tagging and content filters."
                delay={0.1}
            >
                <div className="space-y-5">
                    <div className="space-y-1.5">
                        <label htmlFor="tagging" className="block text-xs font-semibold text-brand-highlight">
                            Allow tagging in posts
                        </label>
                        <select
                            id="tagging"
                            value={allowTagging}
                            onChange={(e) => setAllowTagging(e.target.value as "everyone" | "friends" | "nobody")}
                            className={selectClasses}
                        >
                            <option value="everyone">Everyone</option>
                            <option value="friends">Friends</option>
                            <option value="nobody">Nobody</option>
                        </select>
                    </div>
                    <div className="flex items-center justify-between py-3">
                        <div>
                            <p className="text-sm font-semibold text-brand-text">Sensitive content filter</p>
                            <p className="text-xs text-brand-highlight">Hide potentially sensitive content in feeds</p>
                        </div>
                        <ToggleSwitch checked={sensitiveFilter} onChange={setSensitiveFilter} />
                    </div>
                </div>
            </SectionCard>

            {/* Section 3 — Blocked Accounts */}
            <SectionCard
                icon={<Shield className="h-6 w-6 text-brand-text/50" />}
                title="Blocked Accounts"
                description="Manage accounts you have blocked."
                delay={0.15}
            >
                <Link
                    href="/settings/security"
                    className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-brand-text/5 group"
                >
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-brand-text">View Blocked Accounts</p>
                        <p className="text-xs text-brand-highlight">Manage your block list in Security settings</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-brand-text/60 group-hover:text-brand-text/80 transition-colors shrink-0" />
                </Link>
            </SectionCard>

            {/* Save */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                <button
                    onClick={handleSave}
                    className="rounded-xl bg-brand-text px-6 py-2.5 text-sm font-semibold text-brand-bg transition-opacity hover:opacity-90"
                >
                    Save Privacy Settings
                </button>
                {Toast}
            </motion.div>
        </div>
        </AppShell>
    )
}

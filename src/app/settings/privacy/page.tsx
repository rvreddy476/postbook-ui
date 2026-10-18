"use client"

import { useEffect, useMemo, useState } from "react"
import AppShell from '@/components/AppShell'
import Link from "next/link"
import { motion } from "framer-motion"
import {
    ArrowLeft,
    Eye,
    Shield,
    Tag,
    CheckCheck,
    ChevronRight,
    MessageCircle,
} from "lucide-react"
import { useMySettings, useUpdateMySettings } from "@/hooks/useMySettings"
import {
    ACCOUNT_VISIBILITY_OPTIONS,
    COMMENT_AUDIENCE_OPTIONS,
    READ_RECEIPT_OPTIONS,
    isEmptyPatch,
    privacyFormFromSettings,
    privacyPatch,
    type AccountVisibility,
    type CommentAudience,
    type PrivacyForm,
    type VisibilityAudience,
} from "../_lib/privacySettings"
import { failedSave } from "../_lib/saveFeedback"
import { useSaveToast } from "../_components/useSaveToast"
import { SettingsLoadError, SettingsLoading } from "../_components/SettingsLoadState"

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
                "transition-colors duration-200 ease-in-out focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-text/50 focus-visible:ring-offset-2",
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
            className="rounded-2xl bg-brand-card border border-brand-divider shadow-xs"
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
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

/*
 * Every control on this page round-trips to a field of the settings document
 * on identity user-service (GET/PUT /v1/users/me/settings):
 *
 *   Who can see my profile     account_visibility          public | private
 *   Who can comment            allow_comments_from         everyone | friends
 *   Read receipts              who_can_see_read_receipts   everyone | connections_only | no_one
 *   Abusive content filter     auto_filter_abusive_content boolean
 *
 * The form is rendered only after that document has loaded, and Save sends
 * only the fields that differ from it.
 *
 * Removed, because no field exists for them in updateSettingsRequest and the
 * page used to report "Saved!" for values it never sent: who can see my
 * posts, appear in search results, appear in suggestions, allow tagging, and
 * the "Only me" profile option (a profile is public or private).
 */
export default function PrivacyPage() {
    const settingsQuery = useMySettings()
    const update = useUpdateMySettings()
    const { showResult, Toast } = useSaveToast()
    const [form, setForm] = useState<PrivacyForm | null>(null)

    useEffect(() => {
        if (settingsQuery.data && !form) setForm(privacyFormFromSettings(settingsQuery.data))
    }, [settingsQuery.data, form])

    const patch = useMemo(
        () => (settingsQuery.data && form ? privacyPatch(settingsQuery.data, form) : {}),
        [settingsQuery.data, form],
    )
    const dirty = !isEmptyPatch(patch)

    const handleSave = async () => {
        if (!dirty) return
        try {
            const stored = await update.mutateAsync(patch)
            setForm(privacyFormFromSettings(stored))
            showResult({ ok: true, data: stored })
        } catch (err) {
            showResult(failedSave(err))
        }
    }

    const set = <K extends keyof PrivacyForm>(key: K, value: PrivacyForm[K]) =>
        setForm((f) => (f ? { ...f, [key]: value } : f))

    const selectClasses =
        "w-full max-w-xs rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2 text-sm font-medium text-brand-text focus:border-brand-text/50 focus:bg-brand-card focus:outline-hidden focus:ring-2 focus:ring-brand-text/20"

    // Strict privacy mode and under-18 accounts have read receipts and the
    // abuse filter forced server-side (applyStrictMode); say so, rather than
    // letting a change appear to stick and then snap back.
    const enforced = settingsQuery.data?.strict_privacy_mode || settingsQuery.data?.under_18_mode

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

            {settingsQuery.isError ? (
                <SettingsLoadError onRetry={() => void settingsQuery.refetch()} />
            ) : !settingsQuery.data || !form ? (
                <SettingsLoading />
            ) : (
                <>
                    {/* Section 1 — Profile Visibility */}
                    <SectionCard
                        icon={<Eye className="h-6 w-6 text-brand-text/50" />}
                        title="Profile Visibility"
                        description="Decide who can view your profile and posts."
                        delay={0.05}
                    >
                        <div className="space-y-1.5">
                            <label htmlFor="profile-vis" className="block text-xs font-semibold text-brand-highlight">
                                Who can see my profile
                            </label>
                            <select
                                id="profile-vis"
                                value={form.accountVisibility}
                                onChange={(e) => set("accountVisibility", e.target.value as AccountVisibility)}
                                className={selectClasses}
                            >
                                {ACCOUNT_VISIBILITY_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                            <p className="pt-1 text-xs text-brand-highlight">
                                With approved followers only, people must request to follow you before they see your posts.
                            </p>
                        </div>
                    </SectionCard>

                    {/* Section 1b — Comments */}
                    <SectionCard
                        icon={<MessageCircle className="h-6 w-6 text-brand-text/50" />}
                        title="Comments"
                        description="Choose who can comment on your posts."
                        delay={0.07}
                    >
                        <div className="space-y-1.5">
                            <label htmlFor="comments-from" className="block text-xs font-semibold text-brand-highlight">
                                Who can comment on my posts
                            </label>
                            <select
                                id="comments-from"
                                value={form.allowCommentsFrom}
                                onChange={(e) => set("allowCommentsFrom", e.target.value as CommentAudience)}
                                className={selectClasses}
                            >
                                {COMMENT_AUDIENCE_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                    </SectionCard>

                    {/* Section 1c — Messaging.
                        Read receipts are mutual by design, as in every messenger
                        that has them: switching them off hides the ticks on your
                        messages AND stops you seeing anyone else's. The server
                        enforces both directions — chat-service consults the
                        READER's setting before disclosing their receipt — so this
                        is a real privacy control, not a local display toggle. */}
                    <SectionCard
                        icon={<CheckCheck className="h-6 w-6 text-brand-text/50" />}
                        title="Messaging"
                        description="Control what your chats reveal about you."
                        delay={0.09}
                    >
                        <div className="space-y-1.5">
                            <label htmlFor="read-receipts" className="block text-xs font-semibold text-brand-highlight">
                                Who can see when I&apos;ve read a message
                            </label>
                            <select
                                id="read-receipts"
                                value={form.readReceipts}
                                onChange={(e) => set("readReceipts", e.target.value as VisibilityAudience)}
                                className={selectClasses}
                            >
                                {READ_RECEIPT_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                            <p className="pt-1 text-xs text-brand-highlight">
                                Turning this off also hides other people&apos;s read receipts from you.
                            </p>
                        </div>
                        <Link
                            href="/settings/messaging"
                            className="mt-4 flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-brand-text/5 group"
                        >
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-brand-text">Inbox &amp; messaging settings</p>
                                <p className="text-xs text-brand-highlight">Who can message or call you, activity status, safe requests and more</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-brand-text/60 group-hover:text-brand-text/80 transition-colors shrink-0" />
                        </Link>
                    </SectionCard>

                    {/* Section 2 — Content */}
                    <SectionCard
                        icon={<Tag className="h-6 w-6 text-brand-text/50" />}
                        title="Content"
                        description="Manage content filters."
                        delay={0.1}
                    >
                        <div className="flex items-center justify-between py-3">
                            <div>
                                <p className="text-sm font-semibold text-brand-text">Abusive content filter</p>
                                <p className="text-xs text-brand-highlight">Filter abusive content automatically</p>
                            </div>
                            <ToggleSwitch
                                checked={form.filterAbusiveContent}
                                onChange={(v) => set("filterAbusiveContent", v)}
                            />
                        </div>
                        {enforced && (
                            <p className="text-xs text-brand-highlight">
                                Your account has strict privacy protections, so some of these settings are fixed.
                            </p>
                        )}
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
                        <Link
                            href="/settings/hidden-channels"
                            className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-brand-text/5 group"
                        >
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-brand-text">Hidden channels</p>
                                <p className="text-xs text-brand-highlight">Channels you asked not to be recommended, and how to show them again</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-brand-text/60 group-hover:text-brand-text/80 transition-colors shrink-0" />
                        </Link>
                    </SectionCard>

                    {/* Save */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                        <button
                            onClick={handleSave}
                            disabled={!dirty || update.isPending}
                            className="rounded-xl bg-primary-ink px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {update.isPending ? "Saving…" : "Save Privacy Settings"}
                        </button>
                        {Toast}
                    </motion.div>
                </>
            )}
        </div>
        </AppShell>
    )
}

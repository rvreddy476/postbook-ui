"use client"

import { useEffect, useMemo, useState } from "react"
import AppShell from '@/components/AppShell'
import Link from "next/link"
import { motion } from "framer-motion"
import {
    ArrowLeft,
    Users,
    MessageSquare,
    ChevronRight,
} from "lucide-react"
import { useMySettings, useUpdateMySettings } from "@/hooks/useMySettings"
import {
    isEmptyPatch,
    messageAudienceOptions,
    socialFormFromSettings,
    socialPatch,
    type MessageAudience,
    type SocialForm,
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
    label,
}: {
    checked: boolean
    onChange: (checked: boolean) => void
    disabled?: boolean
    label?: string
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
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
 * Every control here is a field of the settings document on identity
 * user-service (GET/PUT /v1/users/me/settings). The page reads that document
 * BEFORE rendering the form and saves only the fields the user changed, so a
 * save can never reset a value that was set elsewhere. In particular,
 * toggling friend requests leaves account_visibility exactly as stored.
 *
 * Removed: "Allow follows", "Show follower count" and "Show friend count".
 * None has a field in updateSettingsRequest, so none could ever be saved.
 */
export default function SocialPreferencesPage() {
    const settingsQuery = useMySettings()
    const update = useUpdateMySettings()
    const { showResult, Toast } = useSaveToast()
    const [form, setForm] = useState<SocialForm | null>(null)

    // Seed the form once the server's values are in.
    useEffect(() => {
        if (settingsQuery.data && !form) setForm(socialFormFromSettings(settingsQuery.data))
    }, [settingsQuery.data, form])

    const patch = useMemo(
        () => (settingsQuery.data && form ? socialPatch(settingsQuery.data, form) : {}),
        [settingsQuery.data, form],
    )
    const dirty = !isEmptyPatch(patch)

    const handleSave = async () => {
        if (!dirty) return
        try {
            const stored = await update.mutateAsync(patch)
            setForm(socialFormFromSettings(stored))
            showResult({ ok: true, data: stored })
        } catch (err) {
            showResult(failedSave(err))
        }
    }

    const set = <K extends keyof SocialForm>(key: K, value: SocialForm[K]) =>
        setForm((f) => (f ? { ...f, [key]: value } : f))

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

            {settingsQuery.isError ? (
                <SettingsLoadError onRetry={() => void settingsQuery.refetch()} />
            ) : !settingsQuery.data || !form ? (
                <SettingsLoading />
            ) : (
                <>
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
                                <ToggleSwitch
                                    label="Allow friend requests"
                                    checked={form.allowConnectionRequests}
                                    onChange={(v) => set("allowConnectionRequests", v)}
                                />
                            </div>
                            <div className="flex items-center justify-between py-3">
                                <div>
                                    <p className="text-sm font-semibold text-brand-text">Require Follow Approval</p>
                                    <p className="text-xs text-brand-highlight">
                                        Private account: approve each follower before they see your posts
                                    </p>
                                </div>
                                <ToggleSwitch
                                    label="Require follow approval"
                                    checked={form.requireFollowApproval}
                                    onChange={(v) => set("requireFollowApproval", v)}
                                />
                            </div>
                        </div>
                    </SectionCard>

                    {/* Section 2 — Messaging */}
                    <SectionCard
                        icon={<MessageSquare className="h-6 w-6 text-brand-text/50" />}
                        title="Messaging"
                        description="Control who can message you."
                        delay={0.1}
                    >
                        <div className="space-y-1.5">
                            <label htmlFor="dm-policy" className="block text-xs font-semibold text-brand-highlight">
                                Allow DMs from
                            </label>
                            <select
                                id="dm-policy"
                                value={form.whoCanMessage}
                                onChange={(e) => set("whoCanMessage", e.target.value as MessageAudience)}
                                className="w-full max-w-xs rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2 text-sm font-medium text-brand-text focus:border-brand-text/50 focus:bg-brand-card focus:outline-hidden focus:ring-2 focus:ring-brand-text/20"
                            >
                                {messageAudienceOptions(settingsQuery.data.who_can_message).map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        <Link
                            href="/settings/messaging"
                            className="mt-4 flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-brand-text/5 group"
                        >
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-brand-text">Inbox &amp; messaging settings</p>
                                <p className="text-xs text-brand-highlight">Groups, calls, activity status, safe requests and more</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-brand-text/60 group-hover:text-brand-text/80 transition-colors shrink-0" />
                        </Link>
                    </SectionCard>

                    {/* Save */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                        <button
                            onClick={handleSave}
                            disabled={!dirty || update.isPending}
                            className="rounded-xl bg-primary-ink px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {update.isPending ? "Saving…" : "Save Preferences"}
                        </button>
                        {Toast}
                    </motion.div>
                </>
            )}
        </div>
        </AppShell>
    )
}

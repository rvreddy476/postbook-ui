"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import {
    ArrowLeft,
    Bell,
    Mail,
    Smartphone,
    Moon,
    SlidersHorizontal,
    BookOpen,
} from "lucide-react"
import {
    useNotificationPreferences,
    useUpdateNotificationPreferences,
} from "@/hooks/useActivityNotifications"
import api from "@/lib/api"
import {
    NOTIFICATION_CATEGORIES,
    categoryTogglePatch,
    channelKey,
    globalTogglePatch,
    quietHoursPatch,
    type Channel,
    type NotificationCategory,
    type NotificationPatch,
    type NotificationSettings,
} from "../_lib/notificationPreferences"
import { failedSave } from "../_lib/saveFeedback"
import { useSaveToast } from "../_components/useSaveToast"
import { SettingsLoadError } from "../_components/SettingsLoadState"

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
                checked ? "bg-brand-text/50" : "bg-brand-secondary",
            ].join(" ")}
        >
            <span
                className={[
                    "pointer-events-none inline-block h-5 w-5 rounded-full bg-brand-card shadow-md",
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
            className="rounded-2xl bg-brand-card border border-brand-text/10 shadow-xs"
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
/*  Skeleton                                                            */
/* ------------------------------------------------------------------ */

function PageSkeleton() {
    return (
        <div className="space-y-6">
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className="rounded-2xl bg-brand-card border border-brand-text/10 shadow-xs p-6 space-y-4 animate-pulse"
                >
                    <div className="flex items-center gap-4">
                        <div className="h-11 w-11 rounded-xl bg-brand-secondary" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-36 rounded-sm bg-brand-secondary" />
                            <div className="h-3 w-52 rounded-sm bg-brand-secondary" />
                        </div>
                    </div>
                    <div className="space-y-3 pt-2">
                        <div className="h-12 rounded-xl bg-brand-secondary" />
                        <div className="h-12 rounded-xl bg-brand-secondary" />
                    </div>
                </div>
            ))}
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Notification Digests                                               */
/* ------------------------------------------------------------------ */

interface DigestItem {
    id: string
    period_type: "weekly" | "monthly"
    start_date: string
    end_date: string
    stats: Record<string, number>
}

function DigestsSection() {
    const { data: items = [], isLoading } = useQuery<DigestItem[]>({
        queryKey: ["notification-digests"],
        queryFn: () =>
            api
                .get("/v1/notifications/digests")
                .then((r) => r.data?.data?.items ?? []),
    })

    return (
        <SectionCard
            icon={<BookOpen className="h-6 w-6 text-brand-text/50" />}
            title="Notification Digests"
            description="Weekly and monthly summaries of your activity"
            delay={0.2}
        >
            {isLoading ? (
                <div className="space-y-3 animate-pulse">
                    {[0, 1].map((i) => (
                        <div key={i} className="h-16 rounded-xl bg-brand-secondary" />
                    ))}
                </div>
            ) : items.length === 0 ? (
                <p className="text-sm text-brand-highlight py-2">
                    No digests yet. Your first digest will appear after 7 days.
                </p>
            ) : (
                <div className="divide-y divide-brand-secondary">
                    {items.map((digest) => {
                        const periodLabel =
                            digest.period_type === "weekly" ? "Weekly" : "Monthly"
                        const start = new Date(digest.start_date).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                        })
                        const end = new Date(digest.end_date).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                        })
                        const statEntries = Object.entries(digest.stats ?? {})
                        return (
                            <div key={digest.id} className="py-3 space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="rounded-full bg-brand-text/10 px-2 py-0.5 text-xs font-semibold text-brand-text">
                                        {periodLabel}
                                    </span>
                                    <p className="text-xs text-brand-highlight">
                                        {start} – {end}
                                    </p>
                                </div>
                                {statEntries.length > 0 && (
                                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                                        {statEntries.map(([key, val]) => (
                                            <p key={key} className="text-xs text-brand-highlight">
                                                <span className="font-semibold text-brand-text">{val}</span>{" "}
                                                {key.replace(/_/g, " ")}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </SectionCard>
    )
}

/* ------------------------------------------------------------------ */
/*  Category rows                                                       */
/* ------------------------------------------------------------------ */

function CategoryRows({
    categories,
    prefs,
    pendingKey,
    onToggle,
}: {
    categories: NotificationCategory[]
    prefs: NotificationSettings
    pendingKey: string | null
    onToggle: (category: string, channel: Channel, on: boolean) => void
}) {
    return (
        <div className="divide-y divide-brand-secondary">
            {categories.map((c) => (
                <div key={c.key} className="flex items-center justify-between gap-4 py-3">
                    <p className="text-sm font-semibold text-brand-text">{c.label}</p>
                    <div className="flex items-center gap-6">
                        {(["inapp", "push"] as const).map((channel) => {
                            const key = channelKey(channel, c.key)
                            return (
                                <ToggleSwitch
                                    key={channel}
                                    label={`${c.label}: ${channel === "inapp" ? "in-app" : "push"}`}
                                    checked={prefs.channels[key] ?? true}
                                    disabled={pendingKey !== null}
                                    onChange={(on) => onToggle(c.key, channel, on)}
                                />
                            )
                        })}
                    </div>
                </div>
            ))}
        </div>
    )
}

function ChannelHeader() {
    return (
        <div className="flex justify-end gap-6 pb-1 text-xs font-semibold text-brand-highlight">
            <span className="w-11 text-center">In-app</span>
            <span className="w-11 text-center">Push</span>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

function browserTimeZone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone ?? ""
    } catch {
        return ""
    }
}

export default function NotificationPreferencesPage() {
    const prefsQuery = useNotificationPreferences()
    const updatePrefs = useUpdateNotificationPreferences()
    const { showResult, Toast } = useSaveToast()
    const [pendingKey, setPendingKey] = useState<string | null>(null)

    const prefs = prefsQuery.data

    // Quiet hours are edited locally and saved as one group.
    const [quiet, setQuiet] = useState<{ enabled: boolean; start: string; end: string } | null>(null)
    useEffect(() => {
        if (prefs && !quiet) {
            setQuiet({
                enabled: prefs.quiet_hours_enabled,
                start: prefs.quiet_hours_start || "22:00",
                end: prefs.quiet_hours_end || "07:00",
            })
        }
    }, [prefs, quiet])

    const save = async (patch: NotificationPatch, key: string) => {
        setPendingKey(key)
        try {
            const stored = await updatePrefs.mutateAsync(patch)
            showResult({ ok: true, data: stored })
            return stored
        } catch (err) {
            showResult(failedSave(err))
            return null
        } finally {
            setPendingKey(null)
        }
    }

    const handleCategoryToggle = (category: string, channel: Channel, on: boolean) => {
        void save(categoryTogglePatch(category, channel, on), channelKey(channel, category))
    }

    const handleGlobalToggle = (key: "push_enabled" | "email_enabled", on: boolean) => {
        void save(globalTogglePatch(key, on), key)
    }

    const handleSaveQuietHours = async () => {
        if (!quiet) return
        const built = quietHoursPatch({ ...quiet, timeZone: browserTimeZone() })
        if ("error" in built) {
            showResult({ ok: false, message: built.error })
            return
        }
        const stored = await save(built.patch, "quiet_hours")
        if (stored) {
            setQuiet({
                enabled: stored.quiet_hours_enabled,
                start: stored.quiet_hours_start || quiet.start,
                end: stored.quiet_hours_end || quiet.end,
            })
        }
    }

    const busy = pendingKey !== null
    const primaries = NOTIFICATION_CATEGORIES.filter((c) => c.primary)
    const secondaries = NOTIFICATION_CATEGORIES.filter((c) => !c.primary)

    return (
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            {/* Back link */}
            <Link
                href="/settings"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-text transition-colors hover:text-danger"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Settings
            </Link>

            {/* Page header */}
            <div>
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-brand-text">Notification Preferences</h1>
                    {busy && (
                        <span className="rounded-full bg-brand-text/10 px-2.5 py-0.5 text-xs font-semibold text-brand-text">
                            Saving...
                        </span>
                    )}
                </div>
                <p className="mt-1 text-sm text-brand-highlight">
                    Control how and when you are notified. Switches save as you change them.
                </p>
                {Toast}
            </div>

            {prefsQuery.isError ? (
                <SettingsLoadError onRetry={() => void prefsQuery.refetch()} />
            ) : !prefs || !quiet ? (
                <PageSkeleton />
            ) : (
                <>
                    {/* ------------------------------------------------- */}
                    {/*  Channels Section                                   */}
                    {/* ------------------------------------------------- */}
                    <SectionCard
                        icon={<Bell className="h-6 w-6 text-brand-text/50" />}
                        title="Notification Channels"
                        description="Choose which channels can reach you."
                        delay={0.05}
                    >
                        <div className="divide-y divide-brand-secondary">
                            {/* Push */}
                            <div className="flex items-center justify-between py-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-text/5">
                                        <Smartphone className="h-4 w-4 text-brand-text/50" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-brand-text">Push</p>
                                        <p className="text-xs text-brand-highlight">Push notifications on your devices</p>
                                    </div>
                                </div>
                                <ToggleSwitch
                                    label="Push notifications"
                                    checked={prefs.push_enabled}
                                    onChange={(val) => handleGlobalToggle("push_enabled", val)}
                                    disabled={busy}
                                />
                            </div>

                            {/* Email */}
                            <div className="flex items-center justify-between py-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-text/5">
                                        <Mail className="h-4 w-4 text-brand-text/50" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-brand-text">Email</p>
                                        <p className="text-xs text-brand-highlight">Notifications sent to your email address</p>
                                    </div>
                                </div>
                                <ToggleSwitch
                                    label="Email notifications"
                                    checked={prefs.email_enabled}
                                    onChange={(val) => handleGlobalToggle("email_enabled", val)}
                                    disabled={busy}
                                />
                            </div>
                        </div>
                    </SectionCard>

                    {/* ------------------------------------------------- */}
                    {/*  Categories Section                                 */}
                    {/* ------------------------------------------------- */}
                    <SectionCard
                        icon={<SlidersHorizontal className="h-6 w-6 text-brand-text/50" />}
                        title="What you're notified about"
                        description="In-app controls your notification inbox; Push controls alerts on your devices."
                        delay={0.1}
                    >
                        <ChannelHeader />
                        <CategoryRows
                            categories={primaries}
                            prefs={prefs}
                            pendingKey={pendingKey}
                            onToggle={handleCategoryToggle}
                        />
                        <details className="mt-3 group">
                            <summary className="cursor-pointer select-none text-sm font-semibold text-brand-text hover:opacity-80">
                                More categories
                            </summary>
                            <div className="mt-2">
                                <ChannelHeader />
                                <CategoryRows
                                    categories={secondaries}
                                    prefs={prefs}
                                    pendingKey={pendingKey}
                                    onToggle={handleCategoryToggle}
                                />
                            </div>
                        </details>
                    </SectionCard>

                    {/* ------------------------------------------------- */}
                    {/*  Quiet Hours Section                                */}
                    {/* ------------------------------------------------- */}
                    <SectionCard
                        icon={<Moon className="h-6 w-6 text-brand-text/50" />}
                        title="Quiet Hours"
                        description="During quiet hours, push notifications are held back."
                        delay={0.15}
                    >
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-brand-text">Use quiet hours</p>
                                <ToggleSwitch
                                    label="Use quiet hours"
                                    checked={quiet.enabled}
                                    onChange={(val) => setQuiet({ ...quiet, enabled: val })}
                                    disabled={busy}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {(["start", "end"] as const).map((field) => (
                                    <div key={field} className="space-y-1.5">
                                        <label
                                            htmlFor={`quiet-${field}`}
                                            className="block text-xs font-semibold text-brand-highlight"
                                        >
                                            {field === "start" ? "Start time" : "End time"}
                                        </label>
                                        <input
                                            id={`quiet-${field}`}
                                            type="time"
                                            value={quiet[field]}
                                            onChange={(e) => setQuiet({ ...quiet, [field]: e.target.value })}
                                            disabled={busy || !quiet.enabled}
                                            className={[
                                                "w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2.5",
                                                "text-sm font-medium text-brand-text",
                                                "transition-colors focus:border-brand-text/50 focus:bg-brand-card focus:outline-hidden focus:ring-2 focus:ring-brand-text/20",
                                                "disabled:cursor-not-allowed disabled:opacity-50",
                                            ].join(" ")}
                                        />
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={handleSaveQuietHours}
                                disabled={busy}
                                className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-primary-ink transition-colors disabled:opacity-50"
                            >
                                Save quiet hours
                            </button>
                        </div>
                    </SectionCard>

                    {/* ------------------------------------------------- */}
                    {/*  Digests Section                                    */}
                    {/* ------------------------------------------------- */}
                    <DigestsSection />
                </>
            )}
        </div>
    )
}

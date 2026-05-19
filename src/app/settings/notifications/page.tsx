"use client"

import { useCallback } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import {
    ArrowLeft,
    Bell,
    Mail,
    Smartphone,
    MessageSquare,
    Moon,
    VolumeX,
    BookOpen,
} from "lucide-react"
import {
    useNotificationPreferences,
    useUpdateNotificationPreferences,
} from "@/hooks/useActivityNotifications"
import api from "@/lib/api"

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface NotificationPreferences {
    email_enabled: boolean
    push_enabled: boolean
    sms_enabled: boolean
    quiet_hours_start?: string
    quiet_hours_end?: string
    muted_types: string[]
}

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const MUTED_TYPE_LABELS: { value: string; label: string; description: string }[] = [
    { value: "reaction", label: "Reactions", description: "When someone reacts to your post" },
    { value: "comment", label: "Comments", description: "When someone comments on your post" },
    { value: "follow", label: "Follows", description: "When someone follows you" },
    { value: "friend_request", label: "Friend Requests", description: "When someone sends you a friend request" },
    { value: "friend_accepted", label: "Friend Accepted", description: "When your friend request is accepted" },
    { value: "comment_reaction", label: "Comment Reactions", description: "When someone reacts to your comment" },
]

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
            className="rounded-2xl bg-brand-card border border-brand-text/10 shadow-sm"
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
                    className="rounded-2xl bg-brand-card border border-brand-text/10 shadow-sm p-6 space-y-4 animate-pulse"
                >
                    <div className="flex items-center gap-4">
                        <div className="h-11 w-11 rounded-xl bg-brand-secondary" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-36 rounded bg-brand-secondary" />
                            <div className="h-3 w-52 rounded bg-brand-secondary" />
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
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

export default function NotificationPreferencesPage() {
    const { data: rawPrefs, isLoading } = useNotificationPreferences()
    const updatePrefs = useUpdateNotificationPreferences()

    // Cast the opaque query data to our typed shape with safe defaults
    const prefs: NotificationPreferences = {
        email_enabled: false,
        push_enabled: false,
        sms_enabled: false,
        quiet_hours_start: "",
        quiet_hours_end: "",
        muted_types: [],
        ...(rawPrefs as Partial<NotificationPreferences> | undefined),
    }

    const patch = useCallback(
        (partial: Partial<NotificationPreferences>) => {
            updatePrefs.mutate({ ...prefs, ...partial })
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [prefs, updatePrefs]
    )

    const handleChannelToggle = useCallback(
        (field: "email_enabled" | "push_enabled" | "sms_enabled", value: boolean) => {
            patch({ [field]: value })
        },
        [patch]
    )

    const handleQuietHoursChange = useCallback(
        (field: "quiet_hours_start" | "quiet_hours_end", value: string) => {
            patch({ [field]: value || undefined })
        },
        [patch]
    )

    const handleMutedTypeToggle = useCallback(
        (type: string, muted: boolean) => {
            const current = prefs.muted_types ?? []
            const next = muted
                ? [...current, type]
                : current.filter((t) => t !== type)
            patch({ muted_types: next })
        },
        [prefs.muted_types, patch]
    )

    const isSaving = updatePrefs.isPending

    return (
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            {/* Back link */}
            <Link
                href="/settings"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-text transition-colors hover:text-[#8a0a28]"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Settings
            </Link>

            {/* Page header */}
            <div>
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-brand-text">Notification Preferences</h1>
                    {isSaving && (
                        <span className="rounded-full bg-brand-text/10 px-2.5 py-0.5 text-xs font-semibold text-brand-text">
                            Saving...
                        </span>
                    )}
                </div>
                <p className="mt-1 text-sm text-brand-highlight">
                    Control how and when VChat notifies you. Changes are saved automatically.
                </p>
            </div>

            {isLoading ? (
                <PageSkeleton />
            ) : (
                <>
                    {/* ------------------------------------------------- */}
                    {/*  Channels Section                                   */}
                    {/* ------------------------------------------------- */}
                    <SectionCard
                        icon={<Bell className="h-6 w-6 text-brand-text/50" />}
                        title="Notification Channels"
                        description="Choose which channels VChat can use to reach you."
                        delay={0.05}
                    >
                        <div className="divide-y divide-brand-secondary">
                            {/* Email */}
                            <div className="flex items-center justify-between py-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                                        <Mail className="h-4 w-4 text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-brand-text">Email</p>
                                        <p className="text-xs text-brand-highlight">Notifications sent to your email address</p>
                                    </div>
                                </div>
                                <ToggleSwitch
                                    checked={prefs.email_enabled}
                                    onChange={(val) => handleChannelToggle("email_enabled", val)}
                                    disabled={isSaving}
                                />
                            </div>

                            {/* Push */}
                            <div className="flex items-center justify-between py-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-text/5">
                                        <Smartphone className="h-4 w-4 text-brand-text/50" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-brand-text">Push</p>
                                        <p className="text-xs text-brand-highlight">Real-time push notifications on your devices</p>
                                    </div>
                                </div>
                                <ToggleSwitch
                                    checked={prefs.push_enabled}
                                    onChange={(val) => handleChannelToggle("push_enabled", val)}
                                    disabled={isSaving}
                                />
                            </div>

                            {/* SMS */}
                            <div className="flex items-center justify-between py-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
                                        <MessageSquare className="h-4 w-4 text-emerald-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-brand-text">SMS</p>
                                        <p className="text-xs text-brand-highlight">Text message alerts to your phone number</p>
                                    </div>
                                </div>
                                <ToggleSwitch
                                    checked={prefs.sms_enabled}
                                    onChange={(val) => handleChannelToggle("sms_enabled", val)}
                                    disabled={isSaving}
                                />
                            </div>
                        </div>
                    </SectionCard>

                    {/* ------------------------------------------------- */}
                    {/*  Quiet Hours Section                                */}
                    {/* ------------------------------------------------- */}
                    <SectionCard
                        icon={<Moon className="h-6 w-6 text-brand-text/50" />}
                        title="Quiet Hours"
                        description="During quiet hours, notifications will be held and delivered after the period ends."
                        delay={0.1}
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label
                                    htmlFor="quiet-start"
                                    className="block text-xs font-semibold text-brand-highlight"
                                >
                                    Start time
                                </label>
                                <input
                                    id="quiet-start"
                                    type="time"
                                    value={prefs.quiet_hours_start ?? ""}
                                    onChange={(e) => handleQuietHoursChange("quiet_hours_start", e.target.value)}
                                    disabled={isSaving}
                                    className={[
                                        "w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2.5",
                                        "text-sm font-medium text-brand-text placeholder-slate-400",
                                        "transition-colors focus:border-brand-text/50 focus:bg-brand-card focus:outline-none focus:ring-2 focus:ring-brand-text/20",
                                        "disabled:cursor-not-allowed disabled:opacity-50",
                                    ].join(" ")}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label
                                    htmlFor="quiet-end"
                                    className="block text-xs font-semibold text-brand-highlight"
                                >
                                    End time
                                </label>
                                <input
                                    id="quiet-end"
                                    type="time"
                                    value={prefs.quiet_hours_end ?? ""}
                                    onChange={(e) => handleQuietHoursChange("quiet_hours_end", e.target.value)}
                                    disabled={isSaving}
                                    className={[
                                        "w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2.5",
                                        "text-sm font-medium text-brand-text placeholder-slate-400",
                                        "transition-colors focus:border-brand-text/50 focus:bg-brand-card focus:outline-none focus:ring-2 focus:ring-brand-text/20",
                                        "disabled:cursor-not-allowed disabled:opacity-50",
                                    ].join(" ")}
                                />
                            </div>
                        </div>
                        {prefs.quiet_hours_start && prefs.quiet_hours_end && (
                            <p className="mt-3 text-xs text-brand-highlight">
                                Notifications will be silenced from{" "}
                                <span className="font-semibold text-brand-text">{prefs.quiet_hours_start}</span>
                                {" "}to{" "}
                                <span className="font-semibold text-brand-text">{prefs.quiet_hours_end}</span>.
                            </p>
                        )}
                    </SectionCard>

                    {/* ------------------------------------------------- */}
                    {/*  Muted Types Section                                */}
                    {/* ------------------------------------------------- */}
                    <SectionCard
                        icon={<VolumeX className="h-6 w-6 text-brand-text/50" />}
                        title="Muted Notification Types"
                        description="Select which types of activity you do not want to be notified about."
                        delay={0.15}
                    >
                        <div className="divide-y divide-brand-secondary">
                            {MUTED_TYPE_LABELS.map(({ value, label, description }) => {
                                const isMuted = (prefs.muted_types ?? []).includes(value)
                                const checkboxId = `muted-type-${value}`
                                return (
                                    <label
                                        key={value}
                                        htmlFor={checkboxId}
                                        className="flex cursor-pointer items-center justify-between gap-4 py-3 hover:opacity-80"
                                    >
                                        <div>
                                            <p className="text-sm font-semibold text-brand-text">{label}</p>
                                            <p className="text-xs text-brand-highlight">{description}</p>
                                        </div>
                                        <input
                                            id={checkboxId}
                                            type="checkbox"
                                            checked={isMuted}
                                            disabled={isSaving}
                                            onChange={(e) => handleMutedTypeToggle(value, e.target.checked)}
                                            className={[
                                                "h-4 w-4 shrink-0 cursor-pointer rounded border-brand-text/30",
                                                "text-brand-text/50 accent-brand-text/50",
                                                "focus:ring-2 focus:ring-brand-text/50 focus:ring-offset-1",
                                                "disabled:cursor-not-allowed disabled:opacity-50",
                                            ].join(" ")}
                                        />
                                    </label>
                                )
                            })}
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

"use client"

import { useCallback } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
    ArrowLeft,
    Bell,
    Mail,
    Smartphone,
    MessageSquare,
    Moon,
    VolumeX,
} from "lucide-react"
import {
    useNotificationPreferences,
    useUpdateNotificationPreferences,
} from "@/hooks/useActivityNotifications"

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
                "transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
                checked ? "bg-violet-500" : "bg-slate-200",
            ].join(" ")}
        >
            <span
                className={[
                    "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md",
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
            className="rounded-2xl bg-white border border-violet-100 shadow-sm"
        >
            <div className="p-6">
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50">
                        {icon}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                        <p className="mt-1 text-sm text-slate-500">{description}</p>
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
                    className="rounded-2xl bg-white border border-violet-100 shadow-sm p-6 space-y-4 animate-pulse"
                >
                    <div className="flex items-center gap-4">
                        <div className="h-11 w-11 rounded-xl bg-slate-200" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-36 rounded bg-slate-200" />
                            <div className="h-3 w-52 rounded bg-slate-200" />
                        </div>
                    </div>
                    <div className="space-y-3 pt-2">
                        <div className="h-12 rounded-xl bg-slate-100" />
                        <div className="h-12 rounded-xl bg-slate-100" />
                    </div>
                </div>
            ))}
        </div>
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
                className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 transition-colors hover:text-violet-800"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Settings
            </Link>

            {/* Page header */}
            <div>
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-slate-900">Notification Preferences</h1>
                    {isSaving && (
                        <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-600">
                            Saving...
                        </span>
                    )}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                    Control how and when PostBook notifies you. Changes are saved automatically.
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
                        icon={<Bell className="h-6 w-6 text-violet-500" />}
                        title="Notification Channels"
                        description="Choose which channels PostBook can use to reach you."
                        delay={0.05}
                    >
                        <div className="divide-y divide-slate-100">
                            {/* Email */}
                            <div className="flex items-center justify-between py-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                                        <Mail className="h-4 w-4 text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Email</p>
                                        <p className="text-xs text-slate-500">Notifications sent to your email address</p>
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
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50">
                                        <Smartphone className="h-4 w-4 text-violet-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Push</p>
                                        <p className="text-xs text-slate-500">Real-time push notifications on your devices</p>
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
                                        <p className="text-sm font-semibold text-slate-900">SMS</p>
                                        <p className="text-xs text-slate-500">Text message alerts to your phone number</p>
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
                        icon={<Moon className="h-6 w-6 text-violet-500" />}
                        title="Quiet Hours"
                        description="During quiet hours, notifications will be held and delivered after the period ends."
                        delay={0.1}
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label
                                    htmlFor="quiet-start"
                                    className="block text-xs font-semibold text-slate-600"
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
                                        "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5",
                                        "text-sm font-medium text-slate-900 placeholder-slate-400",
                                        "transition-colors focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200",
                                        "disabled:cursor-not-allowed disabled:opacity-50",
                                    ].join(" ")}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label
                                    htmlFor="quiet-end"
                                    className="block text-xs font-semibold text-slate-600"
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
                                        "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5",
                                        "text-sm font-medium text-slate-900 placeholder-slate-400",
                                        "transition-colors focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200",
                                        "disabled:cursor-not-allowed disabled:opacity-50",
                                    ].join(" ")}
                                />
                            </div>
                        </div>
                        {prefs.quiet_hours_start && prefs.quiet_hours_end && (
                            <p className="mt-3 text-xs text-slate-500">
                                Notifications will be silenced from{" "}
                                <span className="font-semibold text-slate-700">{prefs.quiet_hours_start}</span>
                                {" "}to{" "}
                                <span className="font-semibold text-slate-700">{prefs.quiet_hours_end}</span>.
                            </p>
                        )}
                    </SectionCard>

                    {/* ------------------------------------------------- */}
                    {/*  Muted Types Section                                */}
                    {/* ------------------------------------------------- */}
                    <SectionCard
                        icon={<VolumeX className="h-6 w-6 text-violet-500" />}
                        title="Muted Notification Types"
                        description="Select which types of activity you do not want to be notified about."
                        delay={0.15}
                    >
                        <div className="divide-y divide-slate-100">
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
                                            <p className="text-sm font-semibold text-slate-900">{label}</p>
                                            <p className="text-xs text-slate-500">{description}</p>
                                        </div>
                                        <input
                                            id={checkboxId}
                                            type="checkbox"
                                            checked={isMuted}
                                            disabled={isSaving}
                                            onChange={(e) => handleMutedTypeToggle(value, e.target.checked)}
                                            className={[
                                                "h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300",
                                                "text-violet-500 accent-violet-500",
                                                "focus:ring-2 focus:ring-violet-400 focus:ring-offset-1",
                                                "disabled:cursor-not-allowed disabled:opacity-50",
                                            ].join(" ")}
                                        />
                                    </label>
                                )
                            })}
                        </div>
                    </SectionCard>
                </>
            )}
        </div>
    )
}

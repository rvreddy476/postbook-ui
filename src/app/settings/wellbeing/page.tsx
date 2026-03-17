"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import {
    ArrowLeft,
    Clock,
    Moon,
    Coffee,
    Eye,
    Focus,
} from "lucide-react"
import api from "@/lib/api"

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface ScreenTimeDay {
    date: string
    minutes: number
}

interface ScreenTimeData {
    days: ScreenTimeDay[]
    total_minutes: number
}

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
                "transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D8103F]/50 focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
                checked ? "bg-[#D8103F]" : "bg-slate-200",
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
            className="bg-brand-card dark:bg-neutral-900 rounded-2xl p-6 shadow-sm border border-neutral-100 dark:border-neutral-800"
        >
            <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D8103F]/5">
                    {icon}
                </div>
                <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-brand-text">{title}</h2>
                    <p className="mt-1 text-sm text-brand-highlight">{description}</p>
                </div>
            </div>
            <div className="mt-5">{children}</div>
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
/*  Screen Time Bar Chart                                               */
/* ------------------------------------------------------------------ */

function ScreenTimeChart({ days }: { days: ScreenTimeDay[] }) {
    const max = Math.max(...days.map((d) => d.minutes), 1)
    const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

    return (
        <div className="flex items-end gap-2 h-24">
            {days.map((day, i) => {
                const heightPct = Math.round((day.minutes / max) * 100)
                const label = DAY_LABELS[new Date(day.date).getDay()] ?? DAY_LABELS[i % 7]
                return (
                    <div key={day.date} className="flex flex-col items-center flex-1 gap-1">
                        <span className="text-[10px] text-brand-text/60">{day.minutes}m</span>
                        <div className="w-full rounded-t-md bg-slate-100 relative" style={{ height: "60px" }}>
                            <div
                                className="absolute bottom-0 left-0 right-0 rounded-t-md bg-[#D8103F]/70 transition-all"
                                style={{ height: `${heightPct}%` }}
                            />
                        </div>
                        <span className="text-[10px] text-brand-highlight">{label}</span>
                    </div>
                )
            })}
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Screen Time Skeleton                                                */
/* ------------------------------------------------------------------ */

function ScreenTimeSkeleton() {
    return (
        <div className="space-y-3 animate-pulse">
            <div className="flex items-end gap-2 h-24">
                {[40, 70, 55, 90, 60, 80, 45].map((h, i) => (
                    <div key={i} className="flex flex-col items-center flex-1 gap-1">
                        <div className="w-full rounded-md bg-slate-100" style={{ height: "60px" }}>
                            <div className="bg-slate-200 rounded-t-md w-full" style={{ height: `${h}%` }} />
                        </div>
                        <div className="h-2 w-4 rounded bg-slate-200" />
                    </div>
                ))}
            </div>
            <div className="h-4 w-40 rounded bg-slate-200" />
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Daily Limit Card                                                    */
/* ------------------------------------------------------------------ */

function DailyLimitCard() {
    const [enabled, setEnabled] = useState(false)
    const [minutes, setMinutes] = useState(60)
    const { show, Toast } = useSaveToast()

    const handleSave = async () => {
        try {
            await api.put("/v1/users/me/wellbeing", {
                daily_limit_enabled: enabled,
                daily_limit_minutes: enabled ? minutes : 0,
            })
            show("Saved!")
        } catch {
            show("Could not save", true)
        }
    }

    return (
        <SectionCard
            icon={<Clock className="h-6 w-6 text-[#D8103F]/50" />}
            title="Daily Limit"
            description="Set a daily time limit to manage your usage."
            delay={0.1}
        >
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-brand-text">Enable daily limit</p>
                        <p className="text-xs text-brand-highlight">You will be reminded when you reach your limit</p>
                    </div>
                    <ToggleSwitch checked={enabled} onChange={setEnabled} />
                </div>
                {enabled && (
                    <div className="space-y-1.5">
                        <label htmlFor="daily-limit-minutes" className="block text-xs font-semibold text-brand-highlight">
                            Limit (minutes per day)
                        </label>
                        <input
                            id="daily-limit-minutes"
                            type="number"
                            min={1}
                            max={1440}
                            value={minutes}
                            onChange={(e) => setMinutes(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-32 rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2 text-sm font-medium text-brand-text focus:border-[#D8103F]/50 focus:bg-brand-card focus:outline-none focus:ring-2 focus:ring-[#D8103F]/20"
                        />
                        <p className="text-xs text-brand-text/60">Set 0 to disable the limit.</p>
                    </div>
                )}
                <button
                    onClick={handleSave}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors"
                    style={{ backgroundColor: "#D8103F" }}
                >
                    Save
                </button>
                {Toast}
            </div>
        </SectionCard>
    )
}

/* ------------------------------------------------------------------ */
/*  Focus Mode Card                                                     */
/* ------------------------------------------------------------------ */

function FocusModeCard() {
    const [enabled, setEnabled] = useState(false)
    const [start, setStart] = useState("09:00")
    const [end, setEnd] = useState("17:00")
    const { show, Toast } = useSaveToast()

    const handleSave = async () => {
        try {
            await api.put("/v1/users/me/wellbeing", {
                focus_mode_enabled: enabled,
                focus_mode_start: start,
                focus_mode_end: end,
            })
            show("Saved!")
        } catch {
            show("Could not save", true)
        }
    }

    return (
        <SectionCard
            icon={<Focus className="h-6 w-6 text-[#D8103F]/50" />}
            title="Focus Mode"
            description="Limit distractions during your focus hours."
            delay={0.15}
        >
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-brand-text">Enable focus mode</p>
                        <p className="text-xs text-brand-highlight">Notifications will be paused during this window</p>
                    </div>
                    <ToggleSwitch checked={enabled} onChange={setEnabled} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label htmlFor="focus-start" className="block text-xs font-semibold text-brand-highlight">
                            Start time
                        </label>
                        <input
                            id="focus-start"
                            type="text"
                            placeholder="09:00"
                            value={start}
                            onChange={(e) => setStart(e.target.value)}
                            className="w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2 text-sm font-medium text-brand-text focus:border-[#D8103F]/50 focus:bg-brand-card focus:outline-none focus:ring-2 focus:ring-[#D8103F]/20"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="focus-end" className="block text-xs font-semibold text-brand-highlight">
                            End time
                        </label>
                        <input
                            id="focus-end"
                            type="text"
                            placeholder="17:00"
                            value={end}
                            onChange={(e) => setEnd(e.target.value)}
                            className="w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2 text-sm font-medium text-brand-text focus:border-[#D8103F]/50 focus:bg-brand-card focus:outline-none focus:ring-2 focus:ring-[#D8103F]/20"
                        />
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors"
                    style={{ backgroundColor: "#D8103F" }}
                >
                    Save
                </button>
                {Toast}
            </div>
        </SectionCard>
    )
}

/* ------------------------------------------------------------------ */
/*  Bedtime Mode Card                                                   */
/* ------------------------------------------------------------------ */

function BedtimeModeCard() {
    const [enabled, setEnabled] = useState(false)
    const [start, setStart] = useState("22:00")
    const [end, setEnd] = useState("07:00")
    const { show, Toast } = useSaveToast()

    const handleSave = async () => {
        try {
            await api.put("/v1/users/me/wellbeing", {
                bedtime_mode_enabled: enabled,
                bedtime_mode_start: start,
                bedtime_mode_end: end,
            })
            show("Saved!")
        } catch {
            show("Could not save", true)
        }
    }

    return (
        <SectionCard
            icon={<Moon className="h-6 w-6 text-[#D8103F]/50" />}
            title="Bedtime Mode"
            description="Silence Postbook during your sleep hours."
            delay={0.2}
        >
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-brand-text">Enable bedtime mode</p>
                        <p className="text-xs text-brand-highlight">Notifications will be silenced during bedtime</p>
                    </div>
                    <ToggleSwitch checked={enabled} onChange={setEnabled} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label htmlFor="bed-start" className="block text-xs font-semibold text-brand-highlight">
                            Bedtime
                        </label>
                        <input
                            id="bed-start"
                            type="text"
                            placeholder="22:00"
                            value={start}
                            onChange={(e) => setStart(e.target.value)}
                            className="w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2 text-sm font-medium text-brand-text focus:border-[#D8103F]/50 focus:bg-brand-card focus:outline-none focus:ring-2 focus:ring-[#D8103F]/20"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="bed-end" className="block text-xs font-semibold text-brand-highlight">
                            Wake time
                        </label>
                        <input
                            id="bed-end"
                            type="text"
                            placeholder="07:00"
                            value={end}
                            onChange={(e) => setEnd(e.target.value)}
                            className="w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2 text-sm font-medium text-brand-text focus:border-[#D8103F]/50 focus:bg-brand-card focus:outline-none focus:ring-2 focus:ring-[#D8103F]/20"
                        />
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors"
                    style={{ backgroundColor: "#D8103F" }}
                >
                    Save
                </button>
                {Toast}
            </div>
        </SectionCard>
    )
}

/* ------------------------------------------------------------------ */
/*  Break Reminders Card                                                */
/* ------------------------------------------------------------------ */

function BreakRemindersCard() {
    const [enabled, setEnabled] = useState(false)
    const [interval, setInterval] = useState(60)
    const { show, Toast } = useSaveToast()

    const handleSave = async () => {
        try {
            await api.put("/v1/users/me/wellbeing", {
                break_reminders_enabled: enabled,
                break_interval_minutes: interval,
            })
            show("Saved!")
        } catch {
            show("Could not save", true)
        }
    }

    return (
        <SectionCard
            icon={<Coffee className="h-6 w-6 text-[#D8103F]/50" />}
            title="Break Reminders"
            description="Get reminded to take a break after extended sessions."
            delay={0.25}
        >
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-brand-text">Enable break reminders</p>
                        <p className="text-xs text-brand-highlight">You will be nudged to step away at the set interval</p>
                    </div>
                    <ToggleSwitch checked={enabled} onChange={setEnabled} />
                </div>
                <div className="space-y-1.5">
                    <label htmlFor="break-interval" className="block text-xs font-semibold text-brand-highlight">
                        Remind every
                    </label>
                    <select
                        id="break-interval"
                        value={interval}
                        onChange={(e) => setInterval(parseInt(e.target.value, 10))}
                        className="w-48 rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2 text-sm font-medium text-brand-text focus:border-[#D8103F]/50 focus:bg-brand-card focus:outline-none focus:ring-2 focus:ring-[#D8103F]/20"
                    >
                        <option value={30}>30 minutes</option>
                        <option value={60}>60 minutes</option>
                        <option value={90}>90 minutes</option>
                        <option value={120}>120 minutes</option>
                    </select>
                </div>
                <button
                    onClick={handleSave}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors"
                    style={{ backgroundColor: "#D8103F" }}
                >
                    Save
                </button>
                {Toast}
            </div>
        </SectionCard>
    )
}

/* ------------------------------------------------------------------ */
/*  Content Preferences Card                                            */
/* ------------------------------------------------------------------ */

function ContentPreferencesCard() {
    const [hideLikes, setHideLikes] = useState(false)
    const [hideViews, setHideViews] = useState(false)
    const { show, Toast } = useSaveToast()

    const handleSave = async () => {
        try {
            await api.put("/v1/users/me/wellbeing", {
                hide_like_counts: hideLikes,
                hide_view_counts: hideViews,
            })
            show("Saved!")
        } catch {
            show("Could not save", true)
        }
    }

    return (
        <SectionCard
            icon={<Eye className="h-6 w-6 text-[#D8103F]/50" />}
            title="Content Preferences"
            description="Reduce social pressure by hiding engagement metrics."
            delay={0.3}
        >
            <div className="space-y-4">
                <div className="divide-y divide-slate-100">
                    <div className="flex items-center justify-between py-3">
                        <div>
                            <p className="text-sm font-semibold text-brand-text">Hide like counts</p>
                            <p className="text-xs text-brand-highlight">Like numbers will not be shown on posts</p>
                        </div>
                        <ToggleSwitch checked={hideLikes} onChange={setHideLikes} />
                    </div>
                    <div className="flex items-center justify-between py-3">
                        <div>
                            <p className="text-sm font-semibold text-brand-text">Hide view counts</p>
                            <p className="text-xs text-brand-highlight">View numbers will not be shown on posts</p>
                        </div>
                        <ToggleSwitch checked={hideViews} onChange={setHideViews} />
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors"
                    style={{ backgroundColor: "#D8103F" }}
                >
                    Save
                </button>
                {Toast}
            </div>
        </SectionCard>
    )
}

/* ------------------------------------------------------------------ */
/*  Screen Time Card                                                    */
/* ------------------------------------------------------------------ */

function ScreenTimeCard() {
    const { data, isLoading, isError } = useQuery<ScreenTimeData>({
        queryKey: ["screen-time"],
        queryFn: () =>
            api.get("/v1/users/me/screen-time").then((r) => r.data?.data ?? r.data),
    })

    return (
        <SectionCard
            icon={<Clock className="h-6 w-6 text-[#D8103F]/50" />}
            title="Screen Time"
            description="Your Postbook usage over the last 7 days."
            delay={0.05}
        >
            {isLoading ? (
                <ScreenTimeSkeleton />
            ) : isError || !data ? (
                <p className="text-sm text-brand-highlight">Could not load settings.</p>
            ) : (
                <div className="space-y-3">
                    <ScreenTimeChart days={data.days ?? []} />
                    <p className="text-sm text-slate-700">
                        <span className="font-bold text-brand-text">{data.total_minutes ?? 0} min</span>{" "}
                        total this week
                    </p>
                </div>
            )}
        </SectionCard>
    )
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

export default function WellbeingPage() {
    return (
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            {/* Back link */}
            <Link
                href="/settings"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#D8103F] transition-colors hover:text-[#8a0a28]"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Settings
            </Link>

            {/* Page header */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D8103F]/10">
                    <Clock className="h-5 w-5 text-[#D8103F]" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-brand-text">Digital Wellbeing</h1>
                    <p className="text-sm text-brand-highlight">
                        Manage your time and mental health on Postbook
                    </p>
                </div>
            </div>

            <ScreenTimeCard />
            <DailyLimitCard />
            <FocusModeCard />
            <BedtimeModeCard />
            <BreakRemindersCard />
            <ContentPreferencesCard />
        </div>
    )
}

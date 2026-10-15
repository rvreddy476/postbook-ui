"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
    ArrowLeft,
    Clock,
    Moon,
    Coffee,
    Eye,
    Focus,
} from "lucide-react"
import { useScreenTime, useUpdateWellbeing, useWellbeing } from "@/hooks/useWellbeing"
import {
    DAILY_LIMIT_MAX,
    DAILY_LIMIT_MIN,
    buildWellbeingRequest,
    type ScreenTimeDay,
    type Wellbeing,
} from "../_lib/wellbeing"
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
            className="bg-brand-card rounded-2xl p-6 shadow-xs border border-brand-divider"
        >
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
        </motion.div>
    )
}

const inputClasses =
    "w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2 text-sm font-medium text-brand-text focus:border-brand-text/50 focus:bg-brand-card focus:outline-hidden focus:ring-2 focus:ring-brand-text/20 disabled:opacity-50"

function SaveButton({ onClick, pending }: { onClick: () => void; pending: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={pending}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-primary-ink transition-colors disabled:opacity-50"
        >
            {pending ? "Saving…" : "Save"}
        </button>
    )
}

/**
 * Each card edits its own slice but saves the WHOLE document: the PUT is a
 * full replace, so a card that sent only its fields would switch the others
 * off. The base is the last document the server confirmed.
 */
function useCardSave(stored: Wellbeing) {
    const update = useUpdateWellbeing()
    const { showResult, Toast } = useSaveToast()

    const save = async (slice: Partial<Wellbeing>) => {
        const built = buildWellbeingRequest({ ...stored, ...slice })
        if ("error" in built) {
            showResult({ ok: false, message: built.error })
            return
        }
        try {
            const result = await update.mutateAsync(built.body)
            showResult({ ok: true, data: result })
        } catch (err) {
            showResult(failedSave(err))
        }
    }

    return { save, pending: update.isPending, Toast }
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
                // Dates are UTC calendar days ("YYYY-MM-DD"); read them as such.
                const label = DAY_LABELS[new Date(`${day.date}T00:00:00Z`).getUTCDay()] ?? DAY_LABELS[i % 7]
                return (
                    <div key={day.date} className="flex flex-col items-center flex-1 gap-1">
                        <span className="text-[10px] text-brand-text/60">{day.minutes}m</span>
                        <div className="w-full rounded-t-md bg-brand-secondary relative" style={{ height: "60px" }}>
                            <div
                                className="absolute bottom-0 left-0 right-0 rounded-t-md bg-brand-text/70 transition-all"
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
                        <div className="w-full rounded-md bg-brand-secondary" style={{ height: "60px" }}>
                            <div className="bg-brand-secondary rounded-t-md w-full" style={{ height: `${h}%` }} />
                        </div>
                        <div className="h-2 w-4 rounded-sm bg-brand-secondary" />
                    </div>
                ))}
            </div>
            <div className="h-4 w-40 rounded-sm bg-brand-secondary" />
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Daily Limit Card                                                    */
/* ------------------------------------------------------------------ */

function DailyLimitCard({ stored }: { stored: Wellbeing }) {
    const [enabled, setEnabled] = useState(stored.daily_limit_mins !== null)
    const [minutes, setMinutes] = useState(String(stored.daily_limit_mins ?? 60))
    const { save, pending, Toast } = useCardSave(stored)

    const handleSave = () => {
        const parsed = Number.parseInt(minutes, 10)
        void save({ daily_limit_mins: enabled ? (Number.isFinite(parsed) ? parsed : NaN) : null })
    }

    return (
        <SectionCard
            icon={<Clock className="h-6 w-6 text-brand-text/50" />}
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
                    <ToggleSwitch label="Enable daily limit" checked={enabled} onChange={setEnabled} />
                </div>
                {enabled && (
                    <div className="space-y-1.5">
                        <label htmlFor="daily-limit-minutes" className="block text-xs font-semibold text-brand-highlight">
                            Limit (minutes per day)
                        </label>
                        <input
                            id="daily-limit-minutes"
                            type="number"
                            inputMode="numeric"
                            min={DAILY_LIMIT_MIN}
                            max={DAILY_LIMIT_MAX}
                            value={minutes}
                            onChange={(e) => setMinutes(e.target.value)}
                            className={`${inputClasses} max-w-32`}
                        />
                        <p className="text-xs text-brand-text/60">
                            Between {DAILY_LIMIT_MIN} and {DAILY_LIMIT_MAX} minutes.
                        </p>
                    </div>
                )}
                <SaveButton onClick={handleSave} pending={pending} />
                {Toast}
            </div>
        </SectionCard>
    )
}

/* ------------------------------------------------------------------ */
/*  Focus Mode Card                                                     */
/* ------------------------------------------------------------------ */

// The server stores focus mode as a switch (plus an optional end time), not a
// daily window; the old start/end inputs had no field to land in.
function FocusModeCard({ stored }: { stored: Wellbeing }) {
    const [enabled, setEnabled] = useState(stored.focus_mode_enabled)
    const { save, pending, Toast } = useCardSave(stored)

    return (
        <SectionCard
            icon={<Focus className="h-6 w-6 text-brand-text/50" />}
            title="Focus Mode"
            description="Limit distractions while you focus."
            delay={0.15}
        >
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-brand-text">Enable focus mode</p>
                    <ToggleSwitch label="Enable focus mode" checked={enabled} onChange={setEnabled} />
                </div>
                <SaveButton onClick={() => void save({ focus_mode_enabled: enabled })} pending={pending} />
                {Toast}
            </div>
        </SectionCard>
    )
}

/* ------------------------------------------------------------------ */
/*  Bedtime Card                                                        */
/* ------------------------------------------------------------------ */

function BedtimeModeCard({ stored }: { stored: Wellbeing }) {
    const [enabled, setEnabled] = useState(stored.bedtime_start !== null && stored.bedtime_end !== null)
    const [start, setStart] = useState(stored.bedtime_start ?? "22:00")
    const [end, setEnd] = useState(stored.bedtime_end ?? "07:00")
    const { save, pending, Toast } = useCardSave(stored)

    const handleSave = () =>
        void save(enabled ? { bedtime_start: start, bedtime_end: end } : { bedtime_start: null, bedtime_end: null })

    return (
        <SectionCard
            icon={<Moon className="h-6 w-6 text-brand-text/50" />}
            title="Sleep Hours"
            description="Set the hours you want to be away from the app."
            delay={0.2}
        >
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-brand-text">Enable sleep hours</p>
                    <ToggleSwitch label="Enable sleep hours" checked={enabled} onChange={setEnabled} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label htmlFor="bed-start" className="block text-xs font-semibold text-brand-highlight">
                            Bedtime
                        </label>
                        <input
                            id="bed-start"
                            type="time"
                            value={start}
                            disabled={!enabled}
                            onChange={(e) => setStart(e.target.value)}
                            className={inputClasses}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="bed-end" className="block text-xs font-semibold text-brand-highlight">
                            Wake time
                        </label>
                        <input
                            id="bed-end"
                            type="time"
                            value={end}
                            disabled={!enabled}
                            onChange={(e) => setEnd(e.target.value)}
                            className={inputClasses}
                        />
                    </div>
                </div>
                <SaveButton onClick={handleSave} pending={pending} />
                {Toast}
            </div>
        </SectionCard>
    )
}

/* ------------------------------------------------------------------ */
/*  Break Reminders Card                                                */
/* ------------------------------------------------------------------ */

// nudge_interval_mins is always set (5..240, default 30); there is no
// separate on/off field, so the old enable switch is gone.
const NUDGE_CHOICES = [15, 30, 60, 90, 120]

function BreakRemindersCard({ stored }: { stored: Wellbeing }) {
    const [interval, setIntervalMins] = useState(stored.nudge_interval_mins)
    const { save, pending, Toast } = useCardSave(stored)
    const choices = NUDGE_CHOICES.includes(interval) ? NUDGE_CHOICES : [...NUDGE_CHOICES, interval].sort((a, b) => a - b)

    return (
        <SectionCard
            icon={<Coffee className="h-6 w-6 text-brand-text/50" />}
            title="Break Reminders"
            description="Get reminded to take a break after extended sessions."
            delay={0.25}
        >
            <div className="space-y-4">
                <div className="space-y-1.5">
                    <label htmlFor="break-interval" className="block text-xs font-semibold text-brand-highlight">
                        Remind me every
                    </label>
                    <select
                        id="break-interval"
                        value={interval}
                        onChange={(e) => setIntervalMins(Number.parseInt(e.target.value, 10))}
                        className={`${inputClasses} max-w-48`}
                    >
                        {choices.map((m) => (
                            <option key={m} value={m}>{m} minutes</option>
                        ))}
                    </select>
                </div>
                <SaveButton onClick={() => void save({ nudge_interval_mins: interval })} pending={pending} />
                {Toast}
            </div>
        </SectionCard>
    )
}

/* ------------------------------------------------------------------ */
/*  Content Preferences Card                                            */
/* ------------------------------------------------------------------ */

// hide_view_counts has no field upstream, so only like counts remain.
function ContentPreferencesCard({ stored }: { stored: Wellbeing }) {
    const [hideLikes, setHideLikes] = useState(stored.hide_like_counts)
    const { save, pending, Toast } = useCardSave(stored)

    return (
        <SectionCard
            icon={<Eye className="h-6 w-6 text-brand-text/50" />}
            title="Content Preferences"
            description="Reduce social pressure by hiding engagement metrics."
            delay={0.3}
        >
            <div className="space-y-4">
                <div className="flex items-center justify-between py-3">
                    <div>
                        <p className="text-sm font-semibold text-brand-text">Hide like counts</p>
                        <p className="text-xs text-brand-highlight">Like numbers will not be shown on posts</p>
                    </div>
                    <ToggleSwitch label="Hide like counts" checked={hideLikes} onChange={setHideLikes} />
                </div>
                <SaveButton onClick={() => void save({ hide_like_counts: hideLikes })} pending={pending} />
                {Toast}
            </div>
        </SectionCard>
    )
}

/* ------------------------------------------------------------------ */
/*  Screen Time Card                                                    */
/* ------------------------------------------------------------------ */

function ScreenTimeCard() {
    const { data, isLoading, isError } = useScreenTime()

    return (
        <SectionCard
            icon={<Clock className="h-6 w-6 text-brand-text/50" />}
            title="Screen Time"
            description="Your usage over the last 7 days."
            delay={0.05}
        >
            {isLoading ? (
                <ScreenTimeSkeleton />
            ) : isError || !data ? (
                <p className="text-sm text-brand-highlight">Could not load screen time.</p>
            ) : (
                <div className="space-y-3">
                    <ScreenTimeChart days={data.days} />
                    <p className="text-sm text-brand-text">
                        <span className="font-bold text-brand-text">{data.total_minutes} min</span>{" "}
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
    const wellbeing = useWellbeing()

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
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-text/10">
                    <Clock className="h-5 w-5 text-brand-text" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-brand-text">Digital Wellbeing</h1>
                    <p className="text-sm text-brand-highlight">
                        Manage your time and wellbeing
                    </p>
                </div>
            </div>

            <ScreenTimeCard />

            {wellbeing.isError ? (
                <SettingsLoadError onRetry={() => void wellbeing.refetch()} />
            ) : !wellbeing.data ? (
                <SettingsLoading />
            ) : (
                <>
                    <DailyLimitCard stored={wellbeing.data} />
                    <FocusModeCard stored={wellbeing.data} />
                    <BedtimeModeCard stored={wellbeing.data} />
                    <BreakRemindersCard stored={wellbeing.data} />
                    <ContentPreferencesCard stored={wellbeing.data} />
                </>
            )}
        </div>
    )
}

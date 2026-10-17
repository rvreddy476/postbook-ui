"use client"

import { Loader2 } from "lucide-react"

/**
 * Shown while a settings page reads the server's current values. The form is
 * NOT rendered until then: a form seeded with defaults is a form whose Save
 * writes those defaults back.
 */
export function SettingsLoading({ label = "Loading your settings…" }: { label?: string }) {
    return (
        <div className="flex items-center gap-2 text-sm text-brand-highlight" role="status">
            <Loader2 className="h-4 w-4 animate-spin" />
            {label}
        </div>
    )
}

/** The read failed; nothing is editable, and nothing has been changed. */
export function SettingsLoadError({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="rounded-2xl border border-brand-divider bg-brand-card p-6 space-y-3" role="alert">
            <p className="text-sm font-semibold text-danger">Could not load your settings.</p>
            <p className="text-xs text-brand-highlight">
                Nothing has been changed. Try again to see and edit your current settings.
            </p>
            <button
                type="button"
                onClick={onRetry}
                className="rounded-xl border border-brand-divider px-4 py-2 text-sm font-semibold text-brand-text hover:bg-brand-secondary"
            >
                Try again
            </button>
        </div>
    )
}

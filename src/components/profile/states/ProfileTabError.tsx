"use client"

import { RefreshCw } from "lucide-react"

/** A profile tab whose list failed to load: say so and offer a retry. */
export function ProfileTabError({ subject, onRetry }: { subject: string; onRetry: () => void }) {
    return (
        <div role="alert" className="flex flex-col items-center justify-center py-16 text-center">
            <h3 className="text-base font-semibold text-brand-text">Couldn&apos;t load {subject}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">Check your connection and try again.</p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-brand-divider bg-brand-card px-4 py-2 text-xs font-bold text-brand-text hover:bg-brand-secondary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-outline"
            >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Retry
            </button>
        </div>
    )
}

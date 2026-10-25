"use client"

import { useRef, type KeyboardEvent } from "react"
import {
    PROFILE_POST_SORTS,
    PROFILE_POST_SORT_LABELS,
    type ProfilePostSort,
} from "@/lib/profilePostSort"

/*
  Latest · Popular · Oldest for the Videos and Reels grids (T-21).

  A radio group with a roving tab stop: Tab lands on the selected option,
  Left/Right (and Up/Down) move and select, Home/End jump to the ends.
*/

interface ProfileSortControlProps {
    value: ProfilePostSort
    onChange: (sort: ProfilePostSort) => void
    /** What is being sorted, for the group's accessible name ("videos", "reels"). */
    subject: string
}

export function ProfileSortControl({ value, onChange, subject }: ProfileSortControlProps) {
    const refs = useRef<(HTMLButtonElement | null)[]>([])

    const move = (to: number) => {
        const n = PROFILE_POST_SORTS.length
        const i = ((to % n) + n) % n
        onChange(PROFILE_POST_SORTS[i])
        refs.current[i]?.focus()
    }

    const onKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault()
            move(index + 1)
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault()
            move(index - 1)
        } else if (e.key === "Home") {
            e.preventDefault()
            move(0)
        } else if (e.key === "End") {
            e.preventDefault()
            move(PROFILE_POST_SORTS.length - 1)
        }
    }

    return (
        <div
            role="radiogroup"
            aria-label={`Sort ${subject}`}
            className="inline-flex items-center gap-1 rounded-xl border border-brand-divider bg-brand-card p-1"
        >
            {PROFILE_POST_SORTS.map((sort, index) => {
                const checked = sort === value
                return (
                    <button
                        key={sort}
                        ref={(el) => {
                            refs.current[index] = el
                        }}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        tabIndex={checked ? 0 : -1}
                        data-sort={sort}
                        onClick={() => onChange(sort)}
                        onKeyDown={(e) => onKey(e, index)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-outline ${
                            checked
                                ? "bg-primary-ink text-primary-foreground"
                                : "text-muted-foreground hover:bg-brand-secondary hover:text-brand-text"
                        }`}
                    >
                        {PROFILE_POST_SORT_LABELS[sort]}
                    </button>
                )
            })}
        </div>
    )
}

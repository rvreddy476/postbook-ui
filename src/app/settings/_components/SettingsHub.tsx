"use client"

import { useEffect, useId, useState } from "react"
import Link from "next/link"
import { ChevronRight, Monitor, Moon, Sun, type LucideIcon } from "lucide-react"

import { THEME_CHOICES, chooseTheme, readThemeChoice, type ThemeChoice } from "@/features/video-shell/themeChoice"
import {
    APPEARANCE_WORDS,
    SETTINGS_GROUPS,
    nextLogoutStep,
    type LogoutEvent,
    type LogoutStep,
    type SettingsRow,
} from "../_lib/settingsHub"

/*
  The /settings index: grouped cards on the page background, one icon and
  a chevron per row (SETTINGS_GROUPS). The appearance switch sits inside
  its own row's card and Log out is the red row at the foot that asks
  first. Styling is settings-hub.css (imported by the page), tokens only.

  `onLogout` is handed in by the page, so this file does not pull the
  auth service into its tests; the page runs exactly the flow the More
  panel used: logoutUser(), then /api/auth/logout.
*/

interface SettingsHubProps {
    onLogout: () => void
}

export function SettingsHub({ onLogout }: SettingsHubProps) {
    return (
        <div className="settings-hub__groups">
            {SETTINGS_GROUPS.map((group) => (
                <section key={group.key} className="settings-hub__group" aria-label={group.title ?? "Log out"}>
                    {group.title ? <h2 className="settings-hub__heading">{group.title}</h2> : null}
                    <ul className="settings-hub__card">
                        {group.rows.map((row) => (
                            <li key={row.key}>
                                {row.action === "theme" ? (
                                    <AppearanceRow row={row} />
                                ) : row.action === "logout" ? (
                                    <LogoutRow row={row} onLogout={onLogout} />
                                ) : (
                                    <Link href={row.href ?? "/settings"} className="settings-hub__row">
                                        <RowIcon icon={row.icon} />
                                        <span className="settings-hub__label">{row.label}</span>
                                        <ChevronRight className="settings-hub__chevron" size={16} strokeWidth={1.75} aria-hidden />
                                    </Link>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    )
}

function RowIcon({ icon: Icon }: { icon: LucideIcon }) {
    return (
        <span className="settings-hub__icon">
            <Icon size={18} strokeWidth={1.75} aria-hidden />
        </span>
    )
}

/* ---- Appearance ------------------------------------------------------ */

const DARK_QUERY = "(prefers-color-scheme: dark)"
const THEME_ICONS: Record<ThemeChoice, LucideIcon> = { auto: Monitor, dark: Moon, light: Sun }

/** Store the choice and apply it to the document at once. Client only. */
function applyThemeChoice(choice: ThemeChoice) {
    chooseTheme(choice, {
        storage: localStorage,
        root: document.documentElement,
        prefersDark: window.matchMedia(DARK_QUERY).matches,
    })
}

/*
  Moved here from the More panel (17 Oct) unchanged in behaviour: the
  current choice is read from storage once on the client; while it is
  "auto" the page follows the OS for as long as this page is open; the
  root layout's script decides on the next load.
*/
export function AppearanceRow({ row }: { row: SettingsRow }) {
    const labelId = useId()
    const [choice, setChoice] = useState<ThemeChoice>("auto")

    useEffect(() => {
        setChoice(readThemeChoice(localStorage))
    }, [])

    useEffect(() => {
        if (choice !== "auto") return
        const mq = window.matchMedia(DARK_QUERY)
        const onChange = () => applyThemeChoice("auto")
        mq.addEventListener("change", onChange)
        return () => mq.removeEventListener("change", onChange)
    }, [choice])

    const pick = (next: ThemeChoice) => {
        setChoice(next)
        applyThemeChoice(next)
    }

    return (
        <div className="settings-hub__block">
            <div className="settings-hub__row settings-hub__row--static">
                <RowIcon icon={row.icon} />
                <span id={labelId} className="settings-hub__label">{row.label}</span>
            </div>
            <div className="settings-hub__segmented" role="radiogroup" aria-labelledby={labelId}>
                {THEME_CHOICES.map((option) => {
                    const Icon = THEME_ICONS[option.value]
                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={choice === option.value}
                            className="settings-hub__segment"
                            onClick={() => pick(option.value)}
                        >
                            <Icon size={15} strokeWidth={1.75} aria-hidden />
                            <span>{APPEARANCE_WORDS[option.value]}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

/* ---- Log out --------------------------------------------------------- */

/**
 * The red Log out row. A press opens the confirm step in place; only its
 * own "Log out" button runs `onLogout`. `initialStep` exists for the tests
 * (static render of the confirm step).
 */
export function LogoutRow({
    row,
    onLogout,
    initialStep = "idle",
}: {
    row: SettingsRow
    onLogout: () => void
    initialStep?: LogoutStep
}) {
    const confirmId = useId()
    const [step, setStep] = useState<LogoutStep>(initialStep)

    const send = (event: LogoutEvent) => {
        const next = nextLogoutStep(step, event)
        setStep(next.step)
        if (next.logout) onLogout()
    }

    return (
        <div className="settings-hub__block">
            <button
                type="button"
                className="settings-hub__row settings-hub__row--danger"
                aria-expanded={step === "confirming"}
                aria-controls={confirmId}
                onClick={() => send("press")}
            >
                <RowIcon icon={row.icon} />
                <span className="settings-hub__label">{row.label}</span>
            </button>
            {step === "confirming" ? (
                <div id={confirmId} className="settings-hub__confirm" role="group" aria-label="Confirm log out">
                    <p className="settings-hub__confirm-text">Log out of your account on this browser?</p>
                    <div className="settings-hub__confirm-actions">
                        <button type="button" className="settings-hub__button" onClick={() => send("cancel")} autoFocus>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="settings-hub__button settings-hub__button--danger"
                            data-logout-confirm=""
                            onClick={() => send("confirm")}
                        >
                            Log out
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    )
}

"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Keyboard, KeyRound, Loader2, ShieldCheck } from "lucide-react"

import {
  hiddenErrorOf,
  settingsErrorMessage,
  type HiddenSettings,
} from "@/lib/chat/hiddenChats/requests"
import {
  CHAT_PASSWORD_MAX,
  SECRET_KEY_MAX,
  changeProblems,
  type FormProblems,
} from "@/lib/chat/hiddenChats/validation"
import {
  DEFAULT_SHORTCUT,
  effectiveShortcut,
  formatShortcut,
  shortcutFromEvent,
  shortcutLabel,
  shortcutProblem,
  type Shortcut,
} from "@/lib/chat/hiddenChats/shortcut"
import { STRICT_MODE_WARNING } from "@/lib/chat/hiddenChats/copy"
import { resetHiddenChats, saveHiddenSettings, stepUpWithCode } from "@/services/hiddenChatsApi"
import { SecretField, SecretsForm } from "@/components/messenger/hidden/SecretsForm"

/* The settings page's cards (app/settings/hidden-chats/page.tsx). */

export function Card({ icon, title, description, children, id }: {
    icon: React.ReactNode
    title: string
    description?: string
    children: React.ReactNode
    id?: string
}) {
    return (
        <section id={id} className="rounded-2xl border border-brand-divider bg-brand-card p-6 shadow-xs">
            <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-text/5">{icon}</div>
                <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-brand-text">{title}</h2>
                    {description && <p className="mt-1 text-sm text-brand-highlight">{description}</p>}
                </div>
            </div>
            <div className="mt-5">{children}</div>
        </section>
    )
}

const primaryButton =
    "flex items-center gap-1.5 rounded-xl bg-primary-ink px-4 py-2 text-sm font-semibold text-white transition-opacity hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
const quietButton =
    "rounded-xl px-4 py-2 text-sm font-semibold text-brand-text transition-colors hover:bg-brand-text/5 disabled:opacity-50"

const errorText = (err: unknown) => settingsErrorMessage(hiddenErrorOf(err))

/* ---- First-time setup ------------------------------------------------- */

export function SetupCard({ onSaved }: { onSaved: (s: HiddenSettings) => void }) {
    return (
        <Card icon={<KeyRound className="h-6 w-6 text-brand-text/50" />} title="Set up hidden chats" description="Choose a secret key and a chat password. You can hide chats from their menu in Messages afterwards.">
            <SecretsForm
                idPrefix="hidden-settings-setup"
                submitLabel="Turn on hidden chats"
                onSubmit={async (secretKey, chatPassword) => {
                    try {
                        onSaved((await saveHiddenSettings({ secretKey, chatPassword })) ?? { configured: true, strict: false, shortcut: null })
                    } catch (err) {
                        throw new Error(errorText(err))
                    }
                }}
            />
        </Card>
    )
}

/* ---- Change (needs the current chat password) ------------------------- */

export function ChangeCard({ onSaved }: { onSaved: () => void }) {
    const [currentPassword, setCurrentPassword] = useState("")
    const [newSecretKey, setNewSecretKey] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [problems, setProblems] = useState<FormProblems | null>(null)
    const [busy, setBusy] = useState(false)
    const [done, setDone] = useState(false)

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (busy) return
        setDone(false)
        const found = changeProblems({ currentPassword, newSecretKey, newPassword, confirmPassword })
        setProblems(found)
        if (found) return
        setBusy(true)
        try {
            await saveHiddenSettings({
                currentChatPassword: currentPassword,
                secretKey: newSecretKey || undefined,
                chatPassword: newPassword || undefined,
            })
            setCurrentPassword("")
            setNewSecretKey("")
            setNewPassword("")
            setConfirmPassword("")
            setDone(true)
            onSaved()
        } catch (err) {
            setProblems({ form: errorText(err) })
        } finally {
            setBusy(false)
        }
    }

    return (
        <Card icon={<KeyRound className="h-6 w-6 text-brand-text/50" />} title="Change secret key or chat password" description="Leave a field empty to keep what you have.">
            <form onSubmit={submit} className="space-y-3" noValidate>
                <SecretField id="hidden-change-current" label="Current chat password" value={currentPassword} onChange={setCurrentPassword} maxLength={CHAT_PASSWORD_MAX} />
                <SecretField id="hidden-change-key" label="New secret key" hint="4 to 12 letters or numbers." value={newSecretKey} onChange={setNewSecretKey} maxLength={SECRET_KEY_MAX} problem={problems?.secretKey} />
                <SecretField id="hidden-change-password" label="New chat password" hint="6 to 64 characters, different from your secret key." value={newPassword} onChange={setNewPassword} maxLength={CHAT_PASSWORD_MAX} problem={problems?.chatPassword} />
                {newPassword && (
                    <SecretField id="hidden-change-confirm" label="Confirm new chat password" value={confirmPassword} onChange={setConfirmPassword} maxLength={CHAT_PASSWORD_MAX} problem={problems?.confirmPassword} />
                )}
                {problems?.form && <p role="alert" className="text-sm text-danger">{problems.form}</p>}
                {done && <p role="status" className="text-sm text-success">Saved.</p>}
                <button type="submit" disabled={busy} className={primaryButton}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save changes
                </button>
            </form>
        </Card>
    )
}

/* ---- Shortcut ---------------------------------------------------------- */

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

export function ShortcutCard({ saved, onSaved }: { saved: string | null; onSaved: (shortcut: string | null) => void }) {
    const current = effectiveShortcut(saved)
    const [recording, setRecording] = useState(false)
    const [picked, setPicked] = useState<Shortcut | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const boxRef = useRef<HTMLDivElement | null>(null)
    const mac = isMac()

    useEffect(() => {
        if (recording) boxRef.current?.focus()
    }, [recording])

    const problem = picked ? shortcutProblem(picked) : null

    const save = async (value: string | null) => {
        setBusy(true)
        setError(null)
        try {
            await saveHiddenSettings({ shortcut: value })
            onSaved(value)
            setRecording(false)
            setPicked(null)
        } catch (err) {
            setError(errorText(err))
        } finally {
            setBusy(false)
        }
    }

    return (
        <Card icon={<Keyboard className="h-6 w-6 text-brand-text/50" />} title="Keyboard shortcut" description="On a computer, this shortcut opens a box for your secret key while Messages is open.">
            {!recording ? (
                <div className="flex flex-wrap items-center gap-3">
                    <kbd className="rounded-lg border border-brand-divider bg-brand-secondary px-3 py-1.5 font-mono text-sm text-brand-text">{shortcutLabel(current, mac)}</kbd>
                    <button type="button" onClick={() => { setRecording(true); setPicked(null); setError(null) }} className={quietButton}>Change</button>
                    {saved && formatShortcut(current) !== DEFAULT_SHORTCUT && (
                        <button type="button" disabled={busy} onClick={() => void save(null)} className={quietButton}>Use {DEFAULT_SHORTCUT}</button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    <div
                        ref={boxRef}
                        tabIndex={0}
                        role="textbox"
                        aria-label="Press the new shortcut"
                        onKeyDown={(e) => {
                            if (e.key === "Escape") { setRecording(false); return }
                            if (e.key === "Tab") return
                            e.preventDefault()
                            const s = shortcutFromEvent(e)
                            if (s) setPicked(s)
                        }}
                        className="flex min-h-12 items-center justify-center rounded-xl border border-dashed border-brand-divider bg-brand-secondary px-4 py-3 text-sm font-medium text-brand-text outline-hidden focus:border-primary-outline"
                    >
                        {picked ? <kbd className="font-mono">{shortcutLabel(picked, mac)}</kbd> : <span className="text-brand-text/50">Press two modifier keys and a letter or number</span>}
                    </div>
                    {problem && <p className="text-sm text-danger">{problem}</p>}
                    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
                    <div className="flex gap-2">
                        <button type="button" disabled={!picked || !!problem || busy} onClick={() => picked && void save(formatShortcut(picked))} className={primaryButton}>
                            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                            Save shortcut
                        </button>
                        <button type="button" onClick={() => setRecording(false)} className={quietButton}>Cancel</button>
                    </div>
                </div>
            )}
        </Card>
    )
}

/* ---- Strict mode ------------------------------------------------------- */

export function StrictCard({ strict, onSaved }: { strict: boolean; onSaved: (strict: boolean) => void }) {
    const [pending, setPending] = useState<boolean | null>(null)
    const [password, setPassword] = useState("")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const confirm = async (e: React.FormEvent) => {
        e.preventDefault()
        if (pending === null || busy || !password) return
        setBusy(true)
        setError(null)
        try {
            await saveHiddenSettings({ strict: pending, currentChatPassword: password })
            onSaved(pending)
            setPending(null)
            setPassword("")
        } catch (err) {
            setError(errorText(err))
        } finally {
            setBusy(false)
        }
    }

    const shown = pending ?? strict
    return (
        <Card icon={<ShieldCheck className="h-6 w-6 text-brand-text/50" />} title="Strict mode" description="What happens to your hidden chats if you forget your secrets.">
            <div className="flex items-center justify-between gap-4 py-1">
                <div>
                    <p className="text-sm font-semibold text-brand-text">Delete hidden chats on reset</p>
                    <p className="text-xs text-brand-highlight">{shown ? "On: a reset deletes your hidden chats for you." : "Off: a reset keeps your hidden chats."}</p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={shown}
                    aria-label="Strict mode"
                    onClick={() => { setPending(pending === null ? !strict : null); setError(null) }}
                    className={[
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200",
                        "focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-text/50 focus-visible:ring-offset-2",
                        shown ? "bg-brand-text" : "bg-brand-secondary",
                    ].join(" ")}
                >
                    <span className={["pointer-events-none inline-block h-5 w-5 rounded-full bg-brand-bg shadow-md transition-transform duration-200", shown ? "translate-x-5" : "translate-x-0"].join(" ")} />
                </button>
            </div>
            <div className="mt-3 flex gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-brand-text">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden />
                <p>{STRICT_MODE_WARNING}</p>
            </div>
            {pending !== null && (
                <form onSubmit={confirm} className="mt-4 space-y-3" noValidate>
                    <SecretField id="hidden-strict-password" label={`Chat password to turn strict mode ${pending ? "on" : "off"}`} value={password} onChange={setPassword} maxLength={CHAT_PASSWORD_MAX} autoFocus />
                    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
                    <div className="flex gap-2">
                        <button type="submit" disabled={busy || !password} className={primaryButton}>
                            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                            {pending ? "Turn on strict mode" : "Turn off strict mode"}
                        </button>
                        <button type="button" onClick={() => { setPending(null); setPassword(""); setError(null) }} className={quietButton}>Cancel</button>
                    </div>
                </form>
            )}
        </Card>
    )
}

/* ---- Forgot: reset after signing in again (step-up) -------------------- */

export function ForgotCard({ strict, onReset }: { strict: boolean; onReset: () => void }) {
    const [stage, setStage] = useState<"idle" | "verify" | "secrets" | "done">("idle")
    const [code, setCode] = useState("")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<React.ReactNode>(null)
    // The step-up token lives in this component's state only, for the 5 minutes it is valid.
    const [stepUpToken, setStepUpToken] = useState<string | null>(null)

    useEffect(() => {
        if (!stepUpToken) return
        const t = window.setTimeout(() => { setStepUpToken(null); setStage("verify") }, 5 * 60_000)
        return () => window.clearTimeout(t)
    }, [stepUpToken])

    const verify = async (e: React.FormEvent) => {
        e.preventDefault()
        if (busy || code.length < 6) return
        setBusy(true)
        setError(null)
        const out = await stepUpWithCode(code)
        setBusy(false)
        setCode("")
        if (out.ok) {
            setStepUpToken(out.token)
            setStage("secrets")
            return
        }
        if (out.reason === "no_2fa") {
            setError(<>Resetting needs two-step verification. <Link href="/settings/security" className="font-semibold text-primary-ink hover:underline">Turn it on in Security</Link>, then come back.</>)
        } else if (out.reason === "wrong_code") setError("That code isn't right. Try the current code from your authenticator app.")
        else if (out.reason === "replayed") setError("That code was already used. Wait for the next one.")
        else if (out.reason === "rate_limited") setError("Too many tries. Try again in a few minutes.")
        else setError("Couldn't confirm it's you. Try again.")
    }

    return (
        <Card id="forgot" icon={<KeyRound className="h-6 w-6 text-brand-text/50" />} title="Forgot your secret key or chat password?" description="Confirm it's you with your authenticator app, then choose new ones.">
            {stage === "idle" && (
                <button type="button" onClick={() => setStage("verify")} className={primaryButton}>Reset hidden chats</button>
            )}
            {stage === "verify" && (
                <form onSubmit={verify} className="space-y-3" noValidate>
                    <div className="space-y-1">
                        <label htmlFor="hidden-reset-code" className="block text-[12px] font-semibold text-brand-text/70">6-digit code from your authenticator app</label>
                        <input
                            id="hidden-reset-code"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            className="w-40 rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-brand-text outline-hidden focus:border-primary-outline focus:bg-brand-bg"
                            autoFocus
                        />
                    </div>
                    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
                    <div className="flex gap-2">
                        <button type="submit" disabled={busy || code.length < 6} className={primaryButton}>
                            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                            Confirm
                        </button>
                        <button type="button" onClick={() => { setStage("idle"); setError(null); setCode("") }} className={quietButton}>Cancel</button>
                    </div>
                </form>
            )}
            {stage === "secrets" && stepUpToken && (
                <SecretsForm
                    idPrefix="hidden-reset"
                    submitLabel={strict ? "Reset and delete hidden chats" : "Reset"}
                    onCancel={() => { setStage("idle"); setStepUpToken(null) }}
                    note={strict ? (
                        <p className="flex gap-2 rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-brand-text">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-danger" aria-hidden />
                            Strict mode is on: resetting deletes your hidden chats for you. The other people keep their messages.
                        </p>
                    ) : (
                        <p className="text-xs text-brand-highlight">Your hidden chats stay hidden; the new secrets open them.</p>
                    )}
                    onSubmit={async (secretKey, chatPassword) => {
                        try {
                            await resetHiddenChats(secretKey, chatPassword, stepUpToken)
                        } catch (err) {
                            const e = hiddenErrorOf(err)
                            if (e.kind === "step_up_required" || (err as { status?: number })?.status === 401) {
                                setStepUpToken(null)
                                setStage("verify")
                                throw new Error("Confirm it's you again.")
                            }
                            throw new Error(settingsErrorMessage(e))
                        }
                        setStepUpToken(null)
                        setStage("done")
                        onReset()
                    }}
                />
            )}
            {stage === "done" && <p role="status" className="text-sm text-success">Done. Use your new secret key and chat password from now on.</p>}
        </Card>
    )
}

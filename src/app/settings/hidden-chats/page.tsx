"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Lock } from "lucide-react"

import AppShell from "@/components/AppShell"
import { HIDDEN_CHATS_COPY } from "@/lib/chat/hiddenChats/copy"
import type { HiddenSettings } from "@/lib/chat/hiddenChats/requests"
import { fetchHiddenSettings } from "@/services/hiddenChatsApi"
import { SettingsLoadError, SettingsLoading } from "../_components/SettingsLoadState"
import { ChangeCard, ForgotCard, SetupCard, ShortcutCard, StrictCard } from "./sections"

/*
  Settings → Privacy → Hidden chats (contract 24 Oct 2026).

  Two secrets, set once per account and synced across devices: a secret key
  (typed into chat search, or after the shortcut) reveals the hidden chats;
  a separate chat password opens one. Changing either needs the current
  chat password; forgetting them means a reset after confirming it's you.
  Neither is ever shown back or kept in the browser.
*/
export default function HiddenChatsSettingsPage() {
    /** undefined loading · null not available on this server · settings */
    const [settings, setSettings] = useState<HiddenSettings | null | undefined>(undefined)
    const [failed, setFailed] = useState(false)

    const load = useCallback(async () => {
        setFailed(false)
        try {
            setSettings(await fetchHiddenSettings())
        } catch {
            setFailed(true)
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    // Arriving from "Forgot?" in Messages: the reset card.
    useEffect(() => {
        if (settings?.configured && typeof window !== "undefined" && window.location.hash === "#forgot") {
            document.getElementById("forgot")?.scrollIntoView({ block: "start" })
        }
    }, [settings])

    const patch = (p: Partial<HiddenSettings>) => setSettings((s) => (s ? { ...s, ...p } : s))

    return (
        <AppShell>
            <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
                <Link href="/settings/privacy" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-text transition-colors hover:text-brand-text/70">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Privacy
                </Link>

                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-text/10">
                        <Lock className="h-5 w-5 text-brand-text" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-brand-text">Hidden chats</h1>
                        <p className="text-sm text-brand-highlight">{HIDDEN_CHATS_COPY}</p>
                    </div>
                </div>

                {failed ? (
                    <SettingsLoadError onRetry={() => void load()} />
                ) : settings === undefined ? (
                    <SettingsLoading />
                ) : settings === null ? (
                    <p className="rounded-2xl border border-brand-divider bg-brand-card p-6 text-sm text-brand-highlight">
                        Hidden chats aren&apos;t available yet. Check back soon.
                    </p>
                ) : !settings.configured ? (
                    <SetupCard onSaved={(s) => setSettings(s)} />
                ) : (
                    <>
                        <div className="rounded-2xl border border-brand-divider bg-brand-card p-5 text-sm text-brand-text">
                            <p className="font-semibold">How to open them</p>
                            <p className="mt-1 text-brand-highlight">
                                Type your secret key into the search box in Messages and press Enter, or use the shortcut below.
                                Then enter your chat password to open a hidden chat. They lock again when you leave the tab or after a minute without activity.
                            </p>
                        </div>
                        <ChangeCard onSaved={() => undefined} />
                        <ShortcutCard saved={settings.shortcut} onSaved={(shortcut) => patch({ shortcut })} />
                        <StrictCard strict={settings.strict} onSaved={(strict) => patch({ strict })} />
                        <ForgotCard strict={settings.strict} onReset={() => void load()} />
                    </>
                )}
            </div>
        </AppShell>
    )
}

"use client"

import { useEffect, useRef, useState } from "react"
import { Bell, X } from "lucide-react"

import { useGlobalToast } from "@/contexts/ToastContext"
import { useAuthUser } from "@/store/auth"

import type { WebPush, WebPushResult } from "./client"
import { isWebPushConfigured } from "./config"
import { onMeaningfulAction } from "./meaningfulAction"
import { shouldOfferSoftPrompt, snoozeUntil } from "./softPrompt"
import type { WebPushStore } from "./state"

/*
  Web push, mounted once app-wide (src/app/providers.tsx):

  - the in-app card that offers it after a follow, comment or post. It
    renders nothing until a meaningful action qualifies (softPrompt.ts), so
    it never shows on load;
  - the sign-in sync: deletes this account's leftover rows and, when push is
    on for it here, re-registers if the token changed (client.ts sync()).

  When web push is not configured neither does anything: no listener, no
  import of the browser wiring, no request.
*/

export interface SoftPromptController {
    /** A meaningful action happened: true when the card should now show. */
    offer(): boolean
    turnOn(): Promise<WebPushResult>
    notNow(): void
}

export function createSoftPromptController(deps: {
    push: WebPush
    store: WebPushStore
    now: () => number
    userActivated: () => boolean
}): SoftPromptController {
    let offered = false
    return {
        offer() {
            const status = deps.push.status()
            const ok = shouldOfferSoftPrompt({
                visible: status.visible,
                permission: status.permission,
                deviceOn: status.on,
                snoozedUntil: deps.store.snoozedUntil(),
                now: deps.now(),
                offeredThisPage: offered,
                userActivated: deps.userActivated(),
            })
            if (ok) offered = true
            return ok
        },
        turnOn: () => deps.push.enable(),
        notNow() {
            deps.store.snooze(snoozeUntil(deps.now()))
        },
    }
}

function userActivated(): boolean {
    try {
        const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
        return ua ? ua.hasBeenActive : true
    } catch {
        return true
    }
}

export default function WebPushRoot() {
    const userId = useAuthUser()?.id ?? ""

    useEffect(() => {
        if (!userId || !isWebPushConfigured()) return
        void import("./browser").then((browser) => browser.browserWebPush().sync())
    }, [userId])

    return <WebPushSoftPrompt />
}

function WebPushSoftPrompt() {
    const [open, setOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    const controller = useRef<SoftPromptController | null>(null)
    const toast = useGlobalToast()

    useEffect(() => {
        if (!isWebPushConfigured()) return
        let cancelled = false
        let unsubscribe = () => {}
        // The browser wiring loads lazily, and only after mount.
        void Promise.all([import("./browser"), import("./state")]).then(([browser, state]) => {
            if (cancelled) return
            const push = browser.browserWebPush()
            controller.current = createSoftPromptController({
                push,
                store: state.browserWebPushStore,
                now: () => Date.now(),
                userActivated,
            })
            unsubscribe = onMeaningfulAction(() => {
                if (controller.current?.offer()) setOpen(true)
            })
        })
        return () => {
            cancelled = true
            unsubscribe()
        }
    }, [])

    if (!open) return null

    const notNow = () => {
        controller.current?.notNow()
        setOpen(false)
    }

    const turnOn = async () => {
        if (!controller.current) return
        setBusy(true)
        const result = await controller.current.turnOn()
        setBusy(false)
        setOpen(false)
        if (result.ok) {
            toast({ type: "success", title: "Notifications are on for this browser" })
        } else if (result.reason === "failed") {
            toast({ type: "error", title: "Couldn't turn on notifications", description: "Try again from Settings → Notifications." })
        } else if (result.reason === "dismissed") {
            controller.current.notNow()
        }
    }

    return (
        <div
            role="dialog"
            aria-labelledby="web-push-prompt-title"
            className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-sm rounded-2xl border border-brand-divider bg-brand-card p-4 shadow-lg sm:bottom-6 sm:left-auto sm:right-6 sm:mx-0"
        >
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-tint">
                    <Bell className="h-5 w-5 text-primary-ink" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                    <p id="web-push-prompt-title" className="text-sm font-semibold text-brand-text">
                        Get notified when people reply or follow you
                    </p>
                    <p className="mt-1 text-xs text-brand-highlight">
                        You can change this any time in Settings → Notifications.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={notNow}
                    aria-label="Close"
                    className="rounded-full p-1 text-brand-highlight transition-colors hover:text-brand-text"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
            </div>
            <div className="mt-4 flex justify-end gap-2">
                <button
                    type="button"
                    onClick={notNow}
                    disabled={busy}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-brand-text transition-colors hover:bg-brand-secondary disabled:opacity-50"
                >
                    Not now
                </button>
                <button
                    type="button"
                    onClick={() => void turnOn()}
                    disabled={busy}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
                >
                    {busy ? "Turning on…" : "Turn on"}
                </button>
            </div>
        </div>
    )
}

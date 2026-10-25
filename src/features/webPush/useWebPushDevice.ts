"use client"

import { useCallback, useEffect, useState } from "react"

import type { WebPushResult, WebPushStatus } from "./client"
import { isWebPushConfigured } from "./config"

/*
  Settings → Notifications → "Push on this device".

  Hidden when web push is not configured, when the browser lacks
  Notification / service workers / PushManager, and when signed out. When the
  browser has blocked notifications the switch is off and disabled, with
  "Blocked in browser settings" — the site cannot ask again; only the person
  can, in the browser's own settings.
*/

export interface DeviceSwitchView {
    hidden: boolean
    checked: boolean
    blocked: boolean
    note: string
}

export function deviceSwitchView(status: WebPushStatus | null): DeviceSwitchView {
    if (!status || !status.visible) return { hidden: true, checked: false, blocked: false, note: "" }
    if (status.permission === "denied") {
        return { hidden: false, checked: false, blocked: true, note: "Blocked in browser settings" }
    }
    return {
        hidden: false,
        checked: status.on,
        blocked: false,
        note: status.on ? "This browser shows notifications" : "Show notifications in this browser",
    }
}

export const DEVICE_SWITCH_FAILURES: Record<Exclude<WebPushResult, { ok: true }>["reason"], string> = {
    unconfigured: "Push isn't available here.",
    unsupported: "This browser doesn't support push notifications.",
    "signed-out": "Sign in to turn on push.",
    denied: "Notifications are blocked in your browser settings.",
    dismissed: "Push stays off until you allow notifications.",
    failed: "Couldn't update push on this device. Try again.",
}

export function useWebPushDevice() {
    const [status, setStatus] = useState<WebPushStatus | null>(null)
    const [busy, setBusy] = useState(false)

    // After mount only, so the server render and the first client render agree.
    useEffect(() => {
        if (!isWebPushConfigured()) return
        let cancelled = false
        void import("./browser").then((browser) => {
            if (!cancelled) setStatus(browser.browserWebPush().status())
        })
        return () => {
            cancelled = true
        }
    }, [])

    const setOn = useCallback(async (on: boolean): Promise<WebPushResult> => {
        const browser = await import("./browser")
        const push = browser.browserWebPush()
        setBusy(true)
        try {
            return on ? await push.enable() : await push.disable()
        } finally {
            setBusy(false)
            setStatus(push.status())
        }
    }, [])

    return { view: deviceSwitchView(status), busy, setOn }
}

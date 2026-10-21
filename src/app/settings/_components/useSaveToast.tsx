"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { saveFeedback, type Feedback, type SaveResult } from "../_lib/saveFeedback"

/**
 * The inline save message the settings pages show under their Save button.
 *
 * It takes a SaveResult, not a string, so a page cannot say "Saved" for a
 * request that failed: the text comes from saveFeedback, which shows the
 * server's error for anything but a 2xx. Errors stay up longer than the
 * success line because they need reading.
 */
export function useSaveToast() {
    const [message, setMessage] = useState<Feedback | null>(null)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current)
    }, [])

    const showResult = useCallback((result: SaveResult<unknown>, savedText?: string) => {
        const next = saveFeedback(result, savedText)
        setMessage(next)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setMessage(null), next.isError ? 6000 : 2500)
    }, [])

    const Toast = message ? (
        <p
            role={message.isError ? "alert" : "status"}
            className={[
                "mt-3 text-xs font-semibold",
                message.isError ? "text-danger" : "text-success",
            ].join(" ")}
        >
            {message.text}
        </p>
    ) : null

    return { showResult, Toast }
}

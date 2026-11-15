"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PERSON_PAGE, returnParams, usePersonCallback } from "@/hooks/usePersonVerification"
import { asServerError } from "../../../_lib/saveFeedback"

/*
 * Where DigiLocker sends the person back (PERSON_VERIFICATION_REDIRECT_URI).
 * code and state are read once, taken off the address bar before anything
 * else happens (so they never reach history, a referrer or a screenshot),
 * and posted in the body with the signed-in session.
 */
export default function PersonVerificationReturnPage() {
    const router = useRouter()
    const callback = usePersonCallback()
    const sent = useRef(false)
    const [missing, setMissing] = useState(false)

    useEffect(() => {
        if (sent.current) return
        sent.current = true
        const params = returnParams(window.location.search)
        window.history.replaceState(null, "", window.location.pathname)
        if (!params) {
            setMissing(true)
            return
        }
        callback.mutate(params, { onSuccess: () => router.replace(PERSON_PAGE) })
    }, [callback, router])

    const error = missing
        ? "This verification link is invalid or has expired; start again"
        : callback.error
          ? asServerError(callback.error).message
          : null

    return (
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-16 text-center sm:px-6" data-person-return>
            {!error && <p className="text-sm text-brand-highlight">Checking your DigiLocker details…</p>}
            {error && (
                <>
                    <p className="text-sm font-medium text-danger" role="alert" data-person-error>
                        {error}
                    </p>
                    <Link href={PERSON_PAGE} className="text-sm font-semibold text-brand-text underline-offset-4 hover:underline">
                        Back to verification
                    </Link>
                </>
            )}
        </div>
    )
}

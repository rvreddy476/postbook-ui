"use client"

import { useEffect, useState } from "react"
import { EditProfilePage } from "@/components/profile/EditProfilePage"

// EditProfilePage gates on `useAuthUser()` which only resolves on the
// client (reads localStorage). When Next.js prerenders this route at
// build time the server snapshot returns null → the harsh
// "Authorization Required" string gets baked into the static HTML and
// served on every cache HIT for a year (Cache-Control: s-maxage=31536000).
//
// Guarding with `mounted` defers the render until after hydration so
// the prerendered HTML is a neutral loading skeleton, never the
// auth-required wall. The client then resolves the session and shows
// the correct UI.
export default function SettingsProfilePage() {
    const [mounted, setMounted] = useState(false)
    useEffect(() => { setMounted(true) }, [])
    if (!mounted) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-brand-bg">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-divider border-t-brand-text" />
            </div>
        )
    }
    return <EditProfilePage />
}

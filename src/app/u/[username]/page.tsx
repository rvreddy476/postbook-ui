"use client"

import React, { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import AppShell from "@/components/AppShell"
import MinimalHeader from "@/components/MinimalHeader"
import { ProfilePage } from "@/components/profile/ProfilePage"
import { getSession, logoutUser } from "@/services/authService"
import { User } from "@/types"

/**
 * Somebody else's profile.
 *
 * A signed-in viewer gets AppShell, so the header and sidebar are the same
 * here as on every other page. /u/ is also a PUBLIC prefix in the
 * middleware — share links have to resolve for someone who is not signed
 * in — and AppShell redirects an anonymous visitor to /login, so the
 * signed-out case keeps the minimal header and no sidebar.
 */
export default function UserProfileRoute() {
    const params = useParams()
    const router = useRouter()
    const username = params.username as string
    const [currentUser, setCurrentUser] = useState<User | null>(null)
    const [sessionResolved, setSessionResolved] = useState(false)

    useEffect(() => {
        const sync = () => {
            setCurrentUser(getSession())
            setSessionResolved(true)
        }
        sync()
        window.addEventListener("postbook:session-changed", sync)
        return () => window.removeEventListener("postbook:session-changed", sync)
    }, [])

    const handleLogout = () => {
        logoutUser()
        // A navigation, not a background fetch a route change can abandon —
        // see AppShell.handleLogout for why that distinction matters.
        window.location.assign("/api/auth/logout")
    }

    const body = (
        <div className="mx-auto w-full max-w-5xl pb-12">
            <ProfilePage username={username} />
        </div>
    )

    // Don't commit to a chrome until we know whether anyone is signed in:
    // mounting AppShell for a signed-in viewer would otherwise flash the
    // signed-out layout first.
    if (!sessionResolved) {
        return <div className="min-h-screen bg-brand-bg" />
    }

    if (currentUser) {
        return <AppShell activeTab="Profile">{body}</AppShell>
    }

    return (
        <div className="min-h-screen bg-brand-bg font-sans">
            {/* Signed-out share-link view — logo is the home button. */}
            <MinimalHeader currentUser={null} onLogout={handleLogout} />
            <main className="flex-1 pt-16">{body}</main>
        </div>
    )
}

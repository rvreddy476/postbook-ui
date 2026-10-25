"use client"

import React, { useEffect, useState } from "react"
import AppShell from "@/components/AppShell"
import MinimalHeader from "@/components/MinimalHeader"
import { getSession, logoutUser } from "@/services/authService"
import { NavItem, User } from "@/types"

/**
 * The chrome of a page a shared link lands on (the pattern /u/<username>
 * set): a signed-in viewer gets AppShell, so the header and sidebar are the
 * same as everywhere else; a visitor with no session gets the minimal
 * header and no sidebar, because AppShell would send them to /login and a
 * shared link must open for someone who is not signed in.
 */
export function PublicPageChrome({ activeTab, children }: { activeTab?: NavItem; children: React.ReactNode }) {
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

    // Don't commit to a chrome until we know whether anyone is signed in:
    // mounting AppShell for a signed-in viewer would otherwise flash the
    // signed-out layout first.
    if (!sessionResolved) {
        return <div className="min-h-screen bg-brand-bg" />
    }

    if (currentUser) {
        return <AppShell activeTab={activeTab}>{children}</AppShell>
    }

    return (
        <div className="min-h-screen bg-brand-bg font-sans">
            <MinimalHeader currentUser={null} onLogout={handleLogout} />
            <main className="flex-1 pt-16">{children}</main>
        </div>
    )
}

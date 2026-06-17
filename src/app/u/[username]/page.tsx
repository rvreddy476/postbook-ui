"use client"

import React, { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import MinimalHeader from "@/components/MinimalHeader"
import Sidebar from "@/components/Sidebar"
import { ProfilePage } from "@/components/profile/ProfilePage"
import { getSession, logoutUser } from "@/services/authService"
import { User, NavItem } from "@/types"

export default function UserProfileRoute() {
    const params = useParams()
    const router = useRouter()
    const username = params.username as string
    const [currentUser, setCurrentUser] = useState<User | null>(null)

    useEffect(() => {
        const sync = () => {
            const user = getSession()
            setCurrentUser(user)
        }
        sync()
        window.addEventListener("postbook:session-changed", sync)
        return () => window.removeEventListener("postbook:session-changed", sync)
    }, [])

    const handleLogout = () => {
        logoutUser()
        router.push("/login")
    }

    const handleSetActiveTab = (tab: NavItem) => {
        if (tab === "Reels") router.push("/?tab=reels")
        else if (tab === "TV") router.push("/?tab=tv")
        else router.push("/")
    }

    return (
        <div className="min-h-screen bg-brand-bg font-sans selection:bg-rose-100 selection:text-rose-900">
            {/* Header always visible — logo is the home button */}
            <MinimalHeader currentUser={currentUser} onLogout={handleLogout} />

            <div className="flex pt-16">
                {/* Left Sidebar — always visible when logged in */}
                {currentUser && (
                    <div className="hidden md:flex fixed top-16 left-0 h-[calc(100vh-4rem)] z-[90]">
                        <Sidebar activeTab="Profile" setActiveTab={handleSetActiveTab} />
                    </div>
                )}

                {/* Main Content */}
                <main className={`flex-1 ${currentUser ? "md:ml-[72px]" : ""} pb-12 overflow-y-auto h-screen scrollbar-hide`}>
                    <div className="max-w-5xl mx-auto">
                        <ProfilePage username={username} />
                    </div>
                </main>
            </div>
        </div>
    )
}

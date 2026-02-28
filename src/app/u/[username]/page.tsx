"use client"

import React, { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import MinimalHeader from "@/components/MinimalHeader"
import { ProfilePage } from "@/components/profile/ProfilePage"
import { getSession } from "@/services/authService"
import { User } from "@/types"

export default function UserProfileRoute() {
    const params = useParams()
    const username = params.username as string
    const [currentUser, setCurrentUser] = useState<User | null>(null)
    const [isSessionLoaded, setIsSessionLoaded] = useState(false)

    useEffect(() => {
        const user = getSession()
        if (user) {
            setCurrentUser(user)
        }
        setIsSessionLoaded(true)
    }, [])

    if (!isSessionLoaded) {
        return <div className="min-h-screen bg-[#fcfaff]" />
    }

    return (
        <div className="min-h-screen bg-[#fcfaff] font-sans selection:bg-rose-100 selection:text-rose-900">
            {currentUser && <MinimalHeader currentUser={currentUser} />}

            <main className={`${currentUser ? "pt-20" : "pt-8"} pb-12 overflow-y-auto h-screen scrollbar-hide`}>
                <div className="max-w-5xl mx-auto">
                    <ProfilePage username={username} platform="postboek" />
                </div>
            </main>
        </div>
    )
}

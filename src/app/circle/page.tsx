'use client'

import React, { useState, useEffect } from 'react'
import { useAuthUser } from '@/store/auth'
import FriendsView from '@/components/circle/FriendsView'
import MinimalHeader from '@/components/MinimalHeader'
import Sidebar from '@/components/Sidebar'
import { getSession, logoutUser } from '@/services/authService'
import { useRouter } from 'next/navigation'
import { NavItem, User } from '@/types'

export default function CirclePage() {
    const [currentUser, setCurrentUser] = useState<User | null>(null)
    const [isSessionLoaded, setIsSessionLoaded] = useState(false)
    const authUser = useAuthUser()
    const router = useRouter()

    useEffect(() => {
        const user = getSession()
        if (user) {
            setCurrentUser(user)
        } else {
            router.push('/')
        }
        setIsSessionLoaded(true)
    }, [router])

    if (!isSessionLoaded || !currentUser) {
        return <div className="min-h-screen bg-brand-bg" />
    }

    if (!authUser) {
        return (
            <div className="flex h-screen items-center justify-center bg-brand-bg">
                <p className="text-brand-text/60">Please log in to view your circle.</p>
            </div>
        )
    }

    const handleLogout = () => {
        logoutUser()
        router.push('/login')
    }

    const handleSetActiveTab = (tab: NavItem) => {
        if (tab === 'Reels') router.push('/?tab=reels')
        else if (tab === 'TV') router.push('/?tab=tv')
        else router.push('/')
    }

    return (
        <div className="min-h-screen bg-brand-bg font-sans selection:bg-rose-100 selection:text-rose-900">
            <MinimalHeader currentUser={currentUser} onLogout={handleLogout} />

            <div className="flex pt-16">
                {/* Left Sidebar */}
                <div className="hidden md:flex fixed top-16 left-0 h-[calc(100vh-4rem)] z-[90]">
                    <Sidebar activeTab="My Circle" setActiveTab={handleSetActiveTab} />
                </div>

                {/* Main Content */}
                <main className="flex-1 md:ml-[72px] pb-12 overflow-y-auto h-screen scrollbar-hide">
                    <div className="max-w-3xl mx-auto px-4 pt-8">
                        <FriendsView />
                    </div>
                </main>
            </div>
        </div>
    )
}

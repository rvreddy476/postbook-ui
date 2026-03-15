'use client'

import React, { useState, useEffect } from 'react'
import { useAuthUser } from '@/store/auth'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Sparkles, Inbox, Send } from 'lucide-react'
import SuggestionsTab from '@/components/circle/SuggestionsTab'
import RequestsTab from '@/components/circle/RequestsTab'
import SentTab from '@/components/circle/SentTab'
import MyCircleTab from '@/components/circle/MyCircleTab'
import MinimalHeader from '@/components/MinimalHeader'
import Sidebar from '@/components/Sidebar'
import { getSession, logoutUser } from '@/services/authService'
import { usePendingFriendRequests, useSentFriendRequests } from '@/hooks/useConnections'
import { useRouter } from 'next/navigation'
import { NavItem, User } from '@/types'

type CircleTab = 'my-circle' | 'discover' | 'requests' | 'sent'

const tabs: { key: CircleTab; label: string; icon: typeof Users; gradient: string; activeGlow: string }[] = [
    { key: 'my-circle', label: 'My Circle', icon: Users, gradient: 'from-[#D8103F]/50 to-fuchsia-500', activeGlow: 'shadow-[#D8103F]/25' },
    { key: 'discover', label: 'Discover', icon: Sparkles, gradient: 'from-amber-500 to-orange-500', activeGlow: 'shadow-amber-500/25' },
    { key: 'requests', label: 'Requests', icon: Inbox, gradient: 'from-emerald-500 to-teal-500', activeGlow: 'shadow-emerald-500/25' },
    { key: 'sent', label: 'Sent', icon: Send, gradient: 'from-blue-500 to-indigo-500', activeGlow: 'shadow-blue-500/25' },
]

export default function CirclePage() {
    const [activeTab, setActiveTab] = useState<CircleTab>('my-circle')
    const [currentUser, setCurrentUser] = useState<User | null>(null)
    const [isSessionLoaded, setIsSessionLoaded] = useState(false)
    const authUser = useAuthUser()
    const router = useRouter()

    const { data: pendingData } = usePendingFriendRequests()
    const { data: sentData } = useSentFriendRequests()
    const pendingCount = pendingData?.items?.length ?? 0
    const sentCount = sentData?.items?.length ?? 0

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
        return <div className="min-h-screen bg-[#fcfaff]" />
    }

    if (!authUser) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#fcfaff]">
                <p className="text-slate-400">Please log in to view your circle.</p>
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

    const getBadge = (key: CircleTab): number | undefined => {
        if (key === 'requests' && pendingCount > 0) return pendingCount
        if (key === 'sent' && sentCount > 0) return sentCount
        return undefined
    }

    return (
        <div className="min-h-screen bg-[#fcfaff] font-sans selection:bg-rose-100 selection:text-rose-900">
            <MinimalHeader currentUser={currentUser} onLogout={handleLogout} />

            <div className="flex pt-16">
                {/* Left Sidebar */}
                <div className="hidden md:flex fixed top-16 left-0 h-[calc(100vh-4rem)] z-[90]">
                    <Sidebar activeTab="My Circle" setActiveTab={handleSetActiveTab} />
                </div>

                {/* Main Content */}
                <main className="flex-1 md:ml-[72px] pb-12 overflow-y-auto h-screen scrollbar-hide">
                    <div className="max-w-4xl mx-auto px-4 pt-8">
                        {/* Page Header */}
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D8103F]/50 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-[#D8103F]/20">
                                <Users className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-slate-900 tracking-tight">My Circle</h1>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">Manage your connections and discover new people</p>
                            </div>
                        </div>

                        {/* Tab switcher */}
                        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1 scrollbar-hide">
                            {tabs.map((t) => {
                                const Icon = t.icon
                                const isActive = activeTab === t.key
                                const badge = getBadge(t.key)

                                return (
                                    <button
                                        key={t.key}
                                        onClick={() => setActiveTab(t.key)}
                                        className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 whitespace-nowrap ${
                                            isActive
                                                ? `bg-gradient-to-r ${t.gradient} text-white shadow-lg ${t.activeGlow}`
                                                : 'bg-white text-slate-500 border border-slate-100 hover:border-slate-200 hover:shadow-sm hover:text-slate-700'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {t.label}
                                        {badge !== undefined && (
                                            <span className={`ml-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[9px] font-black ${
                                                isActive
                                                    ? 'bg-white/25 text-white'
                                                    : 'bg-rose-100 text-rose-600'
                                            }`}>
                                                {badge > 99 ? '99+' : badge}
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Tab content */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                            >
                                {activeTab === 'my-circle' && <MyCircleTab />}
                                {activeTab === 'discover' && <SuggestionsTab />}
                                {activeTab === 'requests' && <RequestsTab />}
                                {activeTab === 'sent' && <SentTab />}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </main>
            </div>
        </div>
    )
}

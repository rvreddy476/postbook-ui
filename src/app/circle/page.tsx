'use client'

import React, { useState } from 'react'
import { useAuthUser } from '@/store/auth'
import { motion, AnimatePresence } from 'framer-motion'
import SuggestionsTab from '@/components/circle/SuggestionsTab'
import RequestsTab from '@/components/circle/RequestsTab'
import SentTab from '@/components/circle/SentTab'
import MyCircleTab from '@/components/circle/MyCircleTab'
import Header from '@/components/Header'
import { getSession } from '@/services/authService'

type CircleTab = 'suggestions' | 'requests' | 'sent' | 'my-circle'

const tabs: { key: CircleTab; label: string }[] = [
    { key: 'suggestions', label: 'Suggestions' },
    { key: 'requests', label: 'Requests' },
    { key: 'sent', label: 'Sent' },
    { key: 'my-circle', label: 'My Circle' },
]

export default function CirclePage() {
    const [activeTab, setActiveTab] = useState<CircleTab>('suggestions')
    const authUser = useAuthUser()
    const currentUser = getSession()

    if (!authUser) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#fcfaff]">
                <p className="text-slate-400">Please log in to view your circle.</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#fcfaff]">
            {currentUser && (
                <Header
                    currentUser={currentUser}
                    activeTab="Friends"
                    setActiveTab={() => {}}
                    onCreateClick={() => {}}
                    onLogout={() => {}}
                    onToggleContactList={() => {}}
                />
            )}
            <div className="max-w-4xl mx-auto px-4 pt-28 pb-12">
                <h1 className="text-2xl font-black text-slate-800 mb-6">My Circle</h1>

                {/* Tab switcher */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 mb-6">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                                activeTab === t.key
                                    ? 'bg-white text-violet-600 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === 'suggestions' && <SuggestionsTab />}
                        {activeTab === 'requests' && <RequestsTab />}
                        {activeTab === 'sent' && <SentTab />}
                        {activeTab === 'my-circle' && <MyCircleTab />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    )
}

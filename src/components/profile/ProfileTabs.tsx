"use client"

import type { ProfileTab, AppPlatform } from "@/types/profile"
import { motion } from "framer-motion"

interface ProfileTabsProps {
    activeTab: ProfileTab
    onTabChange: (tab: ProfileTab) => void
    platform: AppPlatform
}

const allTabs: { key: ProfileTab; label: string; platforms?: AppPlatform[]; icon: string }[] = [
    { key: "creations", label: "Creations", icon: "💎" },
    { key: "about", label: "Identity", icon: "🆔" },
    { key: "connections", label: "Network", icon: "🌐" },
    { key: "pages", label: "Nexus", platforms: ["postboek"], icon: "🏢" },
    { key: "activity", label: "Echoes", icon: "📡" },
]

export function ProfileTabs({ activeTab, onTabChange, platform }: ProfileTabsProps) {
    const tabs = allTabs.filter(
        (tab) => !tab.platforms || tab.platforms.includes(platform)
    )

    return (
        <div className="flex bg-white/40 backdrop-blur-3xl p-2 rounded-[2.5rem] border border-white shadow-[0_8px_30px_rgba(0,0,0,0.02)] relative overflow-hidden">
            {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                    <button
                        key={tab.key}
                        onClick={() => onTabChange(tab.key)}
                        className={`flex-1 relative flex items-center justify-center gap-2 py-4 px-4 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 group ${isActive ? "text-slate-950" : "text-slate-400 hover:text-slate-600"
                            }`}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="active-tab-glow"
                                className="absolute inset-0 bg-white shadow-[0_10px_25px_-5px_rgba(0,0,0,0.05),0_4px_10px_-3px_rgba(0,0,0,0.02)] border border-slate-100/50 rounded-[1.8rem]"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}

                        <span className={`relative z-10 transition-transform duration-300 ${isActive ? "scale-105" : "group-hover:scale-110"}`}>
                            {tab.icon}
                        </span>
                        <span className="relative z-10 hidden sm:block">{tab.label}</span>

                        {isActive && (
                            <motion.div
                                layoutId="active-dot"
                                className="absolute -bottom-1 w-1 h-1 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                    </button>
                );
            })}
        </div>
    )
}

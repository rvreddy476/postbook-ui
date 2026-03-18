"use client"

import React, { useState } from "react"
import type { CreatorTier } from "@/types/monetization"

interface TierCardProps {
    tier: CreatorTier
    onEdit?: (tier: CreatorTier) => void
    onToggleActive?: (tier: CreatorTier) => void
    isUpdating?: boolean
}

function currencySymbol(currency: string): string {
    switch (currency?.toUpperCase()) {
        case "INR": return "\u20B9"
        case "USD": return "$"
        case "EUR": return "\u20AC"
        case "GBP": return "\u00A3"
        default: return currency || "$"
    }
}

const TierCard: React.FC<TierCardProps> = ({ tier, onEdit, onToggleActive, isUpdating }) => {
    const [showPerks, setShowPerks] = useState(true)
    const sym = currencySymbol(tier.currency)

    return (
        <div className={`bg-brand-card rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 ${
            tier.is_active ? "border-[#F0E6DC]" : "border-brand-divider opacity-70"
        }`}>
            {/* Top accent */}
            <div className={`h-1 ${tier.is_active ? "bg-gradient-to-r from-[#D4A574] to-[#7B5B3A]" : "bg-slate-300"}`} />

            <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-black text-[#3C2415] truncate">{tier.name}</h3>
                            {!tier.is_active && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest bg-brand-secondary text-brand-highlight border border-brand-divider flex-shrink-0">
                                    Inactive
                                </span>
                            )}
                        </div>
                        <p className="text-lg font-black text-[#D4A574]">
                            {sym}{tier.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            <span className="text-[9px] font-bold text-[#7B5B3A] ml-1">/ month</span>
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                        {onEdit && (
                            <button
                                onClick={() => onEdit(tier)}
                                className="p-2 rounded-xl text-[#7B5B3A] hover:bg-[#FAF5F0] hover:text-[#3C2415] transition-colors duration-200"
                                title="Edit tier"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </button>
                        )}
                        {onToggleActive && (
                            <button
                                onClick={() => onToggleActive(tier)}
                                disabled={isUpdating}
                                className={`p-2 rounded-xl transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                                    tier.is_active
                                        ? "text-[#7B5B3A] hover:bg-red-50 hover:text-red-500"
                                        : "text-brand-text/60 hover:bg-emerald-50 hover:text-emerald-500"
                                }`}
                                title={tier.is_active ? "Deactivate tier" : "Activate tier"}
                            >
                                {isUpdating ? (
                                    <div className="w-4 h-4 border-2 border-[#D4A574] border-t-transparent rounded-full animate-spin" />
                                ) : tier.is_active ? (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Subscriber count */}
                <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF5F0] border border-[#F0E6DC]">
                        <svg className="w-3.5 h-3.5 text-[#D4A574]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-[10px] font-black text-[#3C2415]">
                            {tier.subscriber_count}
                        </span>
                        <span className="text-[9px] font-bold text-[#7B5B3A]">
                            {tier.subscriber_count === 1 ? "subscriber" : "subscribers"}
                        </span>
                    </div>
                </div>

                {/* Perks */}
                {tier.perks && tier.perks.length > 0 && (
                    <div>
                        <button
                            onClick={() => setShowPerks(!showPerks)}
                            className="flex items-center gap-1.5 mb-2 text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] hover:text-[#3C2415] transition-colors"
                        >
                            <svg className={`w-3 h-3 transition-transform duration-200 ${showPerks ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                            {tier.perks.length} {tier.perks.length === 1 ? "Perk" : "Perks"}
                        </button>
                        {showPerks && (
                            <ul className="space-y-1.5 ml-1">
                                {tier.perks.map((perk, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <svg className="w-3.5 h-3.5 text-[#D4A574] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span className="text-xs font-bold text-[#3C2415]">{perk}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default TierCard

"use client"

import React from "react"
import type { Wallet } from "@/types/monetization"

interface WalletCardProps {
    wallet: Wallet | undefined
    isLoading: boolean
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

function formatAmount(amount: number, currency: string): string {
    const sym = currencySymbol(currency)
    return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function WalletCardSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-[#F0E6DC] p-6 shadow-sm animate-pulse">
            <div className="h-4 bg-[#F0E6DC] rounded-full w-24 mb-6" />
            <div className="grid grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                        <div className="h-3 bg-[#F0E6DC] rounded-full w-20" />
                        <div className="h-6 bg-[#F0E6DC] rounded-full w-28" />
                    </div>
                ))}
            </div>
        </div>
    )
}

const WalletCard: React.FC<WalletCardProps> = ({ wallet, isLoading }) => {
    if (isLoading || !wallet) {
        return <WalletCardSkeleton />
    }

    return (
        <div className="bg-white rounded-2xl border border-[#F0E6DC] p-6 shadow-sm hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
            {/* Decorative accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#D4A574] via-[#7B5B3A] to-[#D4A574]" />

            {/* Frozen banner */}
            {wallet.is_frozen && (
                <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
                    <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-600">Wallet Frozen</span>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4A574] to-[#7B5B3A] flex items-center justify-center shadow-lg shadow-[#D4A574]/20">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                </div>
                <div>
                    <h2 className="text-sm font-black text-[#3C2415]">Wallet</h2>
                    <p className="text-[9px] font-bold text-[#7B5B3A] uppercase tracking-widest">Your earnings overview</p>
                </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Balance */}
                <div className="bg-[#FAF5F0] rounded-xl p-4 border border-[#F0E6DC]">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1">Available Balance</p>
                    <p className="text-xl font-black text-[#3C2415]">{formatAmount(wallet.balance, wallet.currency)}</p>
                </div>

                {/* Lifetime earnings */}
                <div className="bg-[#FAF5F0] rounded-xl p-4 border border-[#F0E6DC]">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1">Lifetime Earnings</p>
                    <p className="text-xl font-black text-[#3C2415]">{formatAmount(wallet.lifetime_earnings, wallet.currency)}</p>
                </div>

                {/* Pending payout */}
                <div className="bg-[#FAF5F0] rounded-xl p-4 border border-[#F0E6DC]">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1">Pending Payout</p>
                    <p className="text-xl font-black text-[#D4A574]">{formatAmount(wallet.pending_payout, wallet.currency)}</p>
                </div>
            </div>
        </div>
    )
}

export default WalletCard

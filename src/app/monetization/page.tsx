"use client"

import React from "react"
import Link from "next/link"
import { useDashboard } from "@/hooks/useMonetization"
import EarningsDashboard from "@/components/monetization/EarningsDashboard"

export default function MonetizationPage() {
    const { data: dashboard, isLoading, isError } = useDashboard()

    return (
        <div className="min-h-screen bg-[#FAF5F0]">
            <div className="max-w-3xl mx-auto px-4 pt-10 pb-16">
                {/* Page heading */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-[0.8rem] bg-gradient-to-br from-[#D4A574] to-[#7B5B3A] flex items-center justify-center shadow-lg shadow-[#D4A574]/20">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-black tracking-tight text-[#3C2415]">Creator Dashboard</h1>
                    </div>
                    <p className="text-[11px] font-bold text-[#7B5B3A] uppercase tracking-widest ml-[52px]">
                        Manage your earnings, tiers & payouts
                    </p>
                </div>

                {/* Navigation tabs */}
                <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide pb-1">
                    <Link
                        href="/monetization"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex-shrink-0 bg-white text-[#3C2415] border-[#D4A574] border shadow-sm shadow-[#D4A574]/10"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                        </svg>
                        Dashboard
                    </Link>
                    <Link
                        href="/monetization/tiers"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex-shrink-0 bg-[#FAF5F0] text-[#7B5B3A] border-transparent border hover:bg-white hover:text-[#3C2415] hover:border-[#F0E6DC] transition-all duration-200"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Tiers
                    </Link>
                    <Link
                        href="/monetization/payouts"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex-shrink-0 bg-[#FAF5F0] text-[#7B5B3A] border-transparent border hover:bg-white hover:text-[#3C2415] hover:border-[#F0E6DC] transition-all duration-200"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Payouts
                    </Link>
                </div>

                {/* Divider */}
                <div className="h-px bg-[#F0E6DC] mb-6" />

                {/* Content */}
                {isError ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
                            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <p className="text-[11px] font-black uppercase tracking-widest text-[#3C2415]">Something went wrong</p>
                            <p className="text-[10px] font-bold text-[#7B5B3A] mt-0.5">Failed to load your dashboard. Please try again later.</p>
                        </div>
                    </div>
                ) : (
                    <EarningsDashboard dashboard={dashboard} isLoading={isLoading} />
                )}
            </div>
        </div>
    )
}

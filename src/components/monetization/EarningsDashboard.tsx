"use client"

import React from "react"
import Link from "next/link"
import type { Dashboard } from "@/types/monetization"
import WalletCard from "./WalletCard"
import TransactionTable from "./TransactionTable"

interface EarningsDashboardProps {
    dashboard: Dashboard | undefined
    isLoading: boolean
}

const EarningsDashboard: React.FC<EarningsDashboardProps> = ({ dashboard, isLoading }) => {
    return (
        <div className="space-y-6">
            {/* Wallet overview */}
            <WalletCard wallet={dashboard?.wallet} isLoading={isLoading} />

            {/* Quick actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                    href="/monetization/payouts"
                    className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-white border border-[#F0E6DC] shadow-sm hover:shadow-md hover:border-[#D4A574] transition-all duration-300 group"
                >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4A574] to-[#7B5B3A] flex items-center justify-center shadow-lg shadow-[#D4A574]/20 group-hover:scale-105 transition-transform duration-200">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-xs font-black text-[#3C2415]">Request Payout</p>
                        <p className="text-[9px] font-bold text-[#7B5B3A] uppercase tracking-widest">Withdraw your earnings</p>
                    </div>
                    <svg className="w-4 h-4 text-[#D4A574] ml-auto opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </Link>

                <Link
                    href="/monetization/tiers"
                    className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-white border border-[#F0E6DC] shadow-sm hover:shadow-md hover:border-[#D4A574] transition-all duration-300 group"
                >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7B5B3A] to-[#3C2415] flex items-center justify-center shadow-lg shadow-[#7B5B3A]/20 group-hover:scale-105 transition-transform duration-200">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-xs font-black text-[#3C2415]">Manage Tiers</p>
                        <p className="text-[9px] font-bold text-[#7B5B3A] uppercase tracking-widest">Create & edit subscription tiers</p>
                    </div>
                    <svg className="w-4 h-4 text-[#D4A574] ml-auto opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </Link>
            </div>

            {/* Earnings chart placeholder */}
            <div className="bg-white rounded-2xl border border-[#F0E6DC] p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-[#FAF5F0] border border-[#F0E6DC] flex items-center justify-center">
                        <svg className="w-4 h-4 text-[#D4A574]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-[#3C2415]">Earnings Overview</h3>
                        <p className="text-[9px] font-bold text-[#7B5B3A] uppercase tracking-widest">Monthly earnings trend</p>
                    </div>
                </div>

                {/* Chart placeholder bars */}
                <div className="flex items-end gap-2 h-40 pt-4 px-2">
                    {[35, 55, 45, 70, 60, 80, 65, 90, 75, 85, 70, 95].map((h, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div
                                className="w-full rounded-t-lg bg-gradient-to-t from-[#D4A574] to-[#D4A574]/40 transition-all duration-500"
                                style={{ height: `${h}%` }}
                            />
                            <span className="text-[7px] font-bold text-[#D4A574]">
                                {["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][i]}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tiers summary */}
            {dashboard?.tiers && dashboard.tiers.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#F0E6DC] p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#FAF5F0] border border-[#F0E6DC] flex items-center justify-center">
                                <svg className="w-4 h-4 text-[#D4A574]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                            <h3 className="text-xs font-black text-[#3C2415]">Your Tiers</h3>
                        </div>
                        <Link
                            href="/monetization/tiers"
                            className="text-[9px] font-black uppercase tracking-widest text-[#D4A574] hover:text-[#7B5B3A] transition-colors"
                        >
                            View All
                        </Link>
                    </div>
                    <div className="space-y-2">
                        {dashboard.tiers.map((tier) => (
                            <div key={tier.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#FAF5F0] border border-[#F0E6DC]">
                                <div className="flex items-center gap-3">
                                    <span className={`w-2 h-2 rounded-full ${tier.is_active ? "bg-emerald-400" : "bg-slate-300"}`} />
                                    <span className="text-xs font-black text-[#3C2415]">{tier.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-[9px] font-bold text-[#7B5B3A]">{tier.subscriber_count} subs</span>
                                    <span className="text-xs font-black text-[#D4A574]">
                                        {tier.currency === "INR" ? "\u20B9" : "$"}{tier.price.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent transactions */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-black text-[#3C2415]">Recent Transactions</h3>
                    <Link
                        href="/monetization/payouts"
                        className="text-[9px] font-black uppercase tracking-widest text-[#D4A574] hover:text-[#7B5B3A] transition-colors"
                    >
                        View All
                    </Link>
                </div>
                <TransactionTable
                    transactions={dashboard?.recent_transactions ?? []}
                    isLoading={isLoading}
                    compact
                />
            </div>
        </div>
    )
}

export default EarningsDashboard

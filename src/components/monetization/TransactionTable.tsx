"use client"

import React from "react"
import type { Transaction } from "@/types/monetization"

interface TransactionTableProps {
    transactions: Transaction[]
    isLoading: boolean
    hasNextPage?: boolean
    isFetchingNextPage?: boolean
    onLoadMore?: () => void
    compact?: boolean
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
    return `${sym}${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function formatTime(dateStr: string): string {
    const d = new Date(dateStr)
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
}

function typeBadge(type: Transaction["type"]): { label: string; className: string } {
    switch (type) {
        case "earning":
            return { label: "Earning", className: "bg-emerald-50 text-emerald-600 border-emerald-100" }
        case "payout":
            return { label: "Payout", className: "bg-blue-50 text-blue-600 border-blue-100" }
        case "refund":
            return { label: "Refund", className: "bg-amber-50 text-amber-600 border-amber-100" }
        case "adjustment":
            return { label: "Adjustment", className: "bg-slate-50 text-slate-600 border-slate-100" }
        case "subscription_payment":
            return { label: "Subscription", className: "bg-purple-50 text-purple-600 border-purple-100" }
        default:
            return { label: type, className: "bg-slate-50 text-slate-600 border-slate-100" }
    }
}

function amountColor(type: Transaction["type"]): string {
    switch (type) {
        case "earning":
        case "adjustment":
            return "text-emerald-600"
        case "payout":
        case "subscription_payment":
            return "text-[#3C2415]"
        case "refund":
            return "text-amber-600"
        default:
            return "text-[#3C2415]"
    }
}

function amountPrefix(type: Transaction["type"]): string {
    switch (type) {
        case "earning":
            return "+"
        case "payout":
        case "subscription_payment":
            return "-"
        case "refund":
            return "+"
        case "adjustment":
            return ""
        default:
            return ""
    }
}

function TransactionRowSkeleton() {
    return (
        <div className="flex items-center gap-4 py-3 px-4 animate-pulse">
            <div className="w-8 h-8 rounded-lg bg-[#F0E6DC] flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-[#F0E6DC] rounded-full w-20" />
                <div className="h-2.5 bg-[#F0E6DC] rounded-full w-32" />
            </div>
            <div className="h-4 bg-[#F0E6DC] rounded-full w-16" />
        </div>
    )
}

const TransactionTable: React.FC<TransactionTableProps> = ({
    transactions,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    onLoadMore,
    compact = false,
}) => {
    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl border border-[#F0E6DC] overflow-hidden shadow-sm">
                <div className="divide-y divide-[#F0E6DC]">
                    {Array.from({ length: compact ? 5 : 8 }).map((_, i) => (
                        <TransactionRowSkeleton key={i} />
                    ))}
                </div>
            </div>
        )
    }

    if (transactions.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-[#F0E6DC] p-10 shadow-sm">
                <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#FAF5F0] border border-[#F0E6DC] flex items-center justify-center">
                        <svg className="w-5 h-5 text-[#D4A574]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#7B5B3A]">No transactions yet</p>
                    <p className="text-[9px] font-bold text-[#D4A574]">Your transaction history will appear here.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-2xl border border-[#F0E6DC] overflow-hidden shadow-sm">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3 bg-[#FAF5F0] border-b border-[#F0E6DC]">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#7B5B3A]">Transaction</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] w-24 text-center">Status</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] w-28 text-right">Date</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] w-24 text-right">Amount</span>
            </div>

            {/* Transaction rows */}
            <div className="divide-y divide-[#F0E6DC]">
                {transactions.map((tx) => {
                    const badge = typeBadge(tx.type)
                    return (
                        <div key={tx.id} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 sm:gap-4 px-4 py-3 hover:bg-[#FAF5F0]/50 transition-colors duration-200">
                            {/* Type + reference */}
                            <div className="flex items-center gap-3 min-w-0">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border flex-shrink-0 ${badge.className}`}>
                                    {badge.label}
                                </span>
                                <span className="text-[10px] font-bold text-[#7B5B3A] truncate">
                                    {tx.reference_type && (
                                        <span className="text-[#D4A574]">{tx.reference_type}: </span>
                                    )}
                                    <span className="font-mono text-[9px]">{tx.reference_id || "--"}</span>
                                </span>
                            </div>

                            {/* Status */}
                            <div className="w-24 flex items-center justify-center sm:justify-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                                    tx.status === "completed" ? "bg-emerald-50 text-emerald-600" :
                                    tx.status === "pending" ? "bg-amber-50 text-amber-600" :
                                    tx.status === "failed" ? "bg-red-50 text-red-500" :
                                    "bg-[#FAF5F0] text-[#7B5B3A]"
                                }`}>
                                    {tx.status}
                                </span>
                            </div>

                            {/* Date */}
                            <div className="w-28 flex flex-col items-end justify-center">
                                <span className="text-[10px] font-bold text-[#3C2415]">{formatDate(tx.created_at)}</span>
                                <span className="text-[8px] font-bold text-[#D4A574]">{formatTime(tx.created_at)}</span>
                            </div>

                            {/* Amount */}
                            <div className="w-24 flex items-center justify-end">
                                <span className={`text-sm font-black ${amountColor(tx.type)}`}>
                                    {amountPrefix(tx.type)}{formatAmount(tx.amount, tx.currency)}
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Load more */}
            {hasNextPage && onLoadMore && (
                <div className="border-t border-[#F0E6DC] p-4 flex justify-center">
                    <button
                        onClick={onLoadMore}
                        disabled={isFetchingNextPage}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#FAF5F0] border border-[#F0E6DC] text-[#7B5B3A] hover:border-[#D4A574] hover:text-[#3C2415] hover:bg-white active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isFetchingNextPage ? (
                            <>
                                <div className="w-3 h-3 border-2 border-[#D4A574] border-t-transparent rounded-full animate-spin" />
                                Loading...
                            </>
                        ) : (
                            <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                                Load more
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    )
}

export default TransactionTable

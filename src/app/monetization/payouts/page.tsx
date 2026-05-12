"use client"

import React, { useState, useCallback } from "react"
import Link from "next/link"
import {
    useWallet,
    usePayoutMethods,
    useAddPayoutMethod,
    useRemovePayoutMethod,
    useRequestPayout,
    usePayoutHistory,
    useSaveTaxInfo,
} from "@/hooks/useMonetization"
import type { PayoutMethod } from "@/types/monetization"
import TransactionTable from "@/components/monetization/TransactionTable"
import PayoutMethodForm from "@/components/monetization/PayoutMethodForm"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function currencySymbol(currency: string): string {
    switch (currency?.toUpperCase()) {
        case "INR": return "\u20B9"
        case "USD": return "$"
        case "EUR": return "\u20AC"
        case "GBP": return "\u00A3"
        default: return currency || "$"
    }
}

function methodTypeLabel(type: string): string {
    switch (type) {
        case "upi": return "UPI"
        case "bank_transfer": return "Bank Transfer"
        case "paypal": return "PayPal"
        default: return type
    }
}

function methodIcon(type: string): string {
    switch (type) {
        case "upi":
            return "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
        case "bank_transfer":
            return "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        case "paypal":
            return "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        default:
            return "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
    }
}

function methodSummary(method: PayoutMethod): string {
    const d = method.details
    switch (method.method_type) {
        case "upi": return d.upi_id || "UPI ID"
        case "bank_transfer": return `${d.bank_name || "Bank"} ****${(d.account_number || "").slice(-4)}`
        case "paypal": return d.email || "PayPal"
        default: return JSON.stringify(d)
    }
}

// ---------------------------------------------------------------------------
// Payout Method Card
// ---------------------------------------------------------------------------

interface PayoutMethodCardProps {
    method: PayoutMethod
    onRemove: (id: string) => void
    isRemoving: boolean
}

function PayoutMethodCard({ method, onRemove, isRemoving }: PayoutMethodCardProps) {
    return (
        <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[#FAF5F0] border border-[#F0E6DC] hover:border-[#D4A574]/50 transition-all duration-200">
            <div className="w-9 h-9 rounded-lg bg-brand-card border border-[#F0E6DC] flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-[#D4A574]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={methodIcon(method.method_type)} />
                </svg>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#3C2415]">{methodTypeLabel(method.method_type)}</span>
                    {method.is_verified && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100">
                            Verified
                        </span>
                    )}
                </div>
                <p className="text-[10px] font-bold text-[#7B5B3A] truncate">{methodSummary(method)}</p>
            </div>
            <button
                onClick={() => onRemove(method.id)}
                disabled={isRemoving}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border border-[#F0E6DC] text-[#7B5B3A] bg-brand-card hover:border-red-200 hover:bg-red-50 hover:text-red-500 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isRemoving ? (
                    <div className="w-3 h-3 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                )}
                Remove
            </button>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Request Payout Modal
// ---------------------------------------------------------------------------

interface RequestPayoutFormProps {
    balance: number
    currency: string
    methods: PayoutMethod[]
    onSubmit: (payload: { amount: number; payout_method_id: string }) => void
    onCancel: () => void
    isPending: boolean
}

function RequestPayoutForm({ balance, currency, methods, onSubmit, onCancel, isPending }: RequestPayoutFormProps) {
    const [amount, setAmount] = useState("")
    const [methodId, setMethodId] = useState(methods[0]?.id ?? "")
    const sym = currencySymbol(currency)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const parsed = parseFloat(amount)
        if (isNaN(parsed) || parsed <= 0 || parsed > balance || !methodId) return
        onSubmit({ amount: parsed, payout_method_id: methodId })
    }

    const inputClass =
        "w-full px-4 py-3 rounded-xl border border-[#F0E6DC] bg-[#FAF5F0] text-sm font-bold text-[#3C2415] placeholder:text-[#D4A574]/60 focus:outline-none focus:ring-2 focus:ring-[#D4A574]/30 focus:border-[#D4A574] transition-all duration-200"

    return (
        <div className="bg-brand-card rounded-2xl border border-[#D4A574] p-6 shadow-md shadow-[#D4A574]/10">
            <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4A574] to-[#7B5B3A] flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-sm font-black text-[#3C2415]">Request Payout</h3>
                    <p className="text-[9px] font-bold text-[#7B5B3A]">
                        Available: {sym}{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Amount */}
                <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1.5">
                        Amount ({currency})
                    </label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-[#D4A574]">{sym}</span>
                        <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={balance}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className={`${inputClass} pl-8`}
                            required
                        />
                    </div>
                    {/* Quick amount buttons */}
                    <div className="flex items-center gap-2 mt-2">
                        {[25, 50, 75, 100].map((pct) => {
                            const val = (balance * pct / 100).toFixed(2)
                            return (
                                <button
                                    key={pct}
                                    type="button"
                                    onClick={() => setAmount(val)}
                                    className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest bg-[#FAF5F0] border border-[#F0E6DC] text-[#7B5B3A] hover:border-[#D4A574] hover:text-[#3C2415] transition-colors"
                                >
                                    {pct}%
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Payout method select */}
                <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1.5">
                        Payout Method
                    </label>
                    {methods.length === 0 ? (
                        <p className="text-[10px] font-bold text-red-500">No payout methods added. Please add one first.</p>
                    ) : (
                        <select
                            value={methodId}
                            onChange={(e) => setMethodId(e.target.value)}
                            className={`${inputClass} appearance-none cursor-pointer`}
                            required
                        >
                            {methods.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {methodTypeLabel(m.method_type)} - {methodSummary(m)}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#FAF5F0] border border-[#F0E6DC] text-[#7B5B3A] hover:bg-brand-card transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isPending || methods.length === 0}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-[#D4A574] to-[#7B5B3A] text-white hover:shadow-lg hover:shadow-[#D4A574]/25 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPending ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                Processing...
                            </>
                        ) : (
                            "Request Payout"
                        )}
                    </button>
                </div>
            </form>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Tax Info Form
// ---------------------------------------------------------------------------

interface TaxInfoFormProps {
    onSubmit: (payload: { country: string; pan_number: string; gst_number: string }) => void
    isPending: boolean
}

function TaxInfoForm({ onSubmit, isPending }: TaxInfoFormProps) {
    const [country, setCountry] = useState("IN")
    const [pan, setPan] = useState("")
    const [gst, setGst] = useState("")

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!country.trim()) return
        onSubmit({ country: country.trim(), pan_number: pan.trim(), gst_number: gst.trim() })
    }

    const inputClass =
        "w-full px-4 py-3 rounded-xl border border-[#F0E6DC] bg-[#FAF5F0] text-sm font-bold text-[#3C2415] placeholder:text-[#D4A574]/60 focus:outline-none focus:ring-2 focus:ring-[#D4A574]/30 focus:border-[#D4A574] transition-all duration-200"

    return (
        <form onSubmit={handleSubmit} className="bg-brand-card rounded-2xl border border-[#F0E6DC] p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7B5B3A] to-[#3C2415] flex items-center justify-center shadow-lg shadow-[#7B5B3A]/20">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-sm font-black text-[#3C2415]">Tax Information</h3>
                    <p className="text-[9px] font-bold text-[#7B5B3A] uppercase tracking-widest">Required for payouts in some regions</p>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1.5">Country</label>
                    <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className={`${inputClass} appearance-none cursor-pointer`}
                        required
                    >
                        <option value="IN">India</option>
                        <option value="US">United States</option>
                        <option value="GB">United Kingdom</option>
                        <option value="DE">Germany</option>
                        <option value="FR">France</option>
                        <option value="AU">Australia</option>
                        <option value="CA">Canada</option>
                    </select>
                </div>
                <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1.5">PAN Number</label>
                    <input
                        type="text"
                        value={pan}
                        onChange={(e) => setPan(e.target.value)}
                        placeholder="ABCDE1234F"
                        className={inputClass}
                    />
                </div>
                <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1.5">GST Number (optional)</label>
                    <input
                        type="text"
                        value={gst}
                        onChange={(e) => setGst(e.target.value)}
                        placeholder="22AAAAA0000A1Z5"
                        className={inputClass}
                    />
                </div>
            </div>

            <div className="mt-6">
                <button
                    type="submit"
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-[#7B5B3A] to-[#3C2415] text-white hover:shadow-lg hover:shadow-[#7B5B3A]/25 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isPending ? (
                        <>
                            <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Save Tax Info
                        </>
                    )}
                </button>
            </div>
        </form>
    )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PayoutsPage() {
    const { data: wallet, isLoading: walletLoading } = useWallet()
    const { data: methods, isLoading: methodsLoading } = usePayoutMethods()
    const addMethod = useAddPayoutMethod()
    const removeMethod = useRemovePayoutMethod()
    const requestPayout = useRequestPayout()
    const saveTaxInfo = useSaveTaxInfo()

    const {
        data: payoutData,
        isLoading: payoutsLoading,
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
    } = usePayoutHistory()

    const [showPayoutForm, setShowPayoutForm] = useState(false)
    const [showAddMethod, setShowAddMethod] = useState(false)
    const [removingId, setRemovingId] = useState<string | null>(null)
    const [taxSaved, setTaxSaved] = useState(false)

    const payoutMethods: PayoutMethod[] = methods ?? []
    const payoutHistory = payoutData?.pages.flatMap((p) => p.data) ?? []

    const handleAddMethod = useCallback(
        (payload: { method_type: string; details: Record<string, string> }) => {
            addMethod.mutate(payload, {
                onSuccess: () => setShowAddMethod(false),
            })
        },
        [addMethod]
    )

    const handleRemoveMethod = useCallback(
        (id: string) => {
            setRemovingId(id)
            removeMethod.mutate(id, {
                onSettled: () => setRemovingId(null),
            })
        },
        [removeMethod]
    )

    const handleRequestPayout = useCallback(
        (payload: { amount: number; payout_method_id: string }) => {
            requestPayout.mutate(payload, {
                onSuccess: () => setShowPayoutForm(false),
            })
        },
        [requestPayout]
    )

    const handleSaveTax = useCallback(
        (payload: { country: string; pan_number: string; gst_number: string }) => {
            saveTaxInfo.mutate(payload, {
                onSuccess: () => setTaxSaved(true),
            })
        },
        [saveTaxInfo]
    )

    return (
        <div className="min-h-screen bg-[#FAF5F0]">
            <div className="max-w-3xl mx-auto px-4 pt-10 pb-16">
                {/* Page heading */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-[0.8rem] bg-gradient-to-br from-[#D4A574] to-[#7B5B3A] flex items-center justify-center shadow-lg shadow-[#D4A574]/20">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-black tracking-tight text-[#3C2415]">Payouts</h1>
                    </div>
                    <p className="text-[11px] font-bold text-[#7B5B3A] uppercase tracking-widest ml-[52px]">
                        Manage payout methods, tax info & withdraw earnings
                    </p>
                </div>

                {/* Navigation tabs */}
                <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide pb-1">
                    <Link
                        href="/monetization"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex-shrink-0 bg-[#FAF5F0] text-[#7B5B3A] border-transparent border hover:bg-brand-card hover:text-[#3C2415] hover:border-[#F0E6DC] transition-all duration-200"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                        </svg>
                        Dashboard
                    </Link>
                    <Link
                        href="/monetization/tiers"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex-shrink-0 bg-[#FAF5F0] text-[#7B5B3A] border-transparent border hover:bg-brand-card hover:text-[#3C2415] hover:border-[#F0E6DC] transition-all duration-200"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Tiers
                    </Link>
                    <Link
                        href="/monetization/payouts"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex-shrink-0 bg-brand-card text-[#3C2415] border-[#D4A574] border shadow-sm shadow-[#D4A574]/10"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Payouts
                    </Link>
                </div>

{/* Divider */}
<div className="h-px bg-[#F0E6DC] mb-6" />

<div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Demo payouts</p>
    <p className="mt-1 text-[11px] font-bold text-amber-900">
        Razorpay live credentials are not configured in this environment, so payout requests and payment movement here should be treated as demo-mode behavior.
    </p>
</div>

{/* Balance summary + request payout button */}
                <div className="bg-brand-card rounded-2xl border border-[#F0E6DC] p-5 shadow-sm mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            {/* Phase 2 §D4: this is creator earnings (a pending payout),
                                not a consumer wallet. Labelled accordingly. */}
                            <p className="text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1">Pending payout</p>
                            {walletLoading ? (
                                <div className="h-7 w-28 bg-[#F0E6DC] rounded-full animate-pulse" />
                            ) : (
                                <p className="text-2xl font-black text-[#3C2415]">
                                    {currencySymbol(wallet?.currency ?? "INR")}
                                    {(wallet?.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                            )}
                        </div>
                        {!showPayoutForm && (
                            <button
                                onClick={() => setShowPayoutForm(true)}
                                disabled={walletLoading || (wallet?.balance ?? 0) <= 0 || wallet?.is_frozen}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-[#D4A574] to-[#7B5B3A] text-white hover:shadow-lg hover:shadow-[#D4A574]/25 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                Request Payout
                            </button>
                        )}
                    </div>
                    {wallet?.is_frozen && (
                        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
                            <svg className="w-3.5 h-3.5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-[9px] font-black uppercase tracking-widest text-red-600">
                                Earnings are frozen. Payouts are temporarily unavailable.
                            </span>
                        </div>
                    )}
                </div>

                {/* Request payout form */}
                {showPayoutForm && wallet && (
                    <div className="mb-6">
                        <RequestPayoutForm
                            balance={wallet.balance}
                            currency={wallet.currency}
                            methods={payoutMethods}
                            onSubmit={handleRequestPayout}
                            onCancel={() => setShowPayoutForm(false)}
                            isPending={requestPayout.isPending}
                        />
                    </div>
                )}

                {/* Payout Methods section */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs font-black text-[#3C2415]">Payout Methods</h2>
                        {!showAddMethod && (
                            <button
                                onClick={() => setShowAddMethod(true)}
                                className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[#D4A574] hover:text-[#7B5B3A] transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Add Method
                            </button>
                        )}
                    </div>

                    {/* Add payout method form */}
                    {showAddMethod && (
                        <div className="mb-4">
                            <PayoutMethodForm
                                onSubmit={handleAddMethod}
                                isPending={addMethod.isPending}
                            />
                            <button
                                onClick={() => setShowAddMethod(false)}
                                className="mt-2 text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] hover:text-[#3C2415] transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {/* Existing methods list */}
                    {methodsLoading ? (
                        <div className="space-y-2">
                            {[1, 2].map((i) => (
                                <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[#FAF5F0] border border-[#F0E6DC] animate-pulse">
                                    <div className="w-9 h-9 rounded-lg bg-[#F0E6DC]" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="h-3 bg-[#F0E6DC] rounded-full w-20" />
                                        <div className="h-2.5 bg-[#F0E6DC] rounded-full w-32" />
                                    </div>
                                    <div className="w-16 h-7 bg-[#F0E6DC] rounded-lg" />
                                </div>
                            ))}
                        </div>
                    ) : payoutMethods.length === 0 ? (
                        <div className="flex flex-col items-center py-8 gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#FAF5F0] border border-[#F0E6DC] flex items-center justify-center">
                                <svg className="w-5 h-5 text-[#D4A574]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#7B5B3A]">No payout methods</p>
                            <p className="text-[9px] font-bold text-[#D4A574]">Add a method to start receiving payouts.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {payoutMethods.map((m) => (
                                <PayoutMethodCard
                                    key={m.id}
                                    method={m}
                                    onRemove={handleRemoveMethod}
                                    isRemoving={removingId === m.id}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Tax Info */}
                <div className="mb-6">
                    {taxSaved && (
                        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100">
                            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Tax information saved successfully</span>
                        </div>
                    )}
                    <TaxInfoForm onSubmit={handleSaveTax} isPending={saveTaxInfo.isPending} />
                </div>

                {/* Payout History */}
                <div>
                    <h2 className="text-xs font-black text-[#3C2415] mb-4">Payout History</h2>
                    <TransactionTable
                        transactions={payoutHistory}
                        isLoading={payoutsLoading}
                        hasNextPage={hasNextPage}
                        isFetchingNextPage={isFetchingNextPage}
                        onLoadMore={() => fetchNextPage()}
                    />

                    {/* End indicator */}
                    {!hasNextPage && payoutHistory.length > 0 && (
                        <div className="mt-8 flex items-center gap-3">
                            <div className="flex-1 h-px bg-[#F0E6DC]" />
                            <p className="text-[8px] font-black uppercase tracking-widest text-[#D4A574] flex-shrink-0">
                                End of payout history
                            </p>
                            <div className="flex-1 h-px bg-[#F0E6DC]" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

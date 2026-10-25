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
    usePayoutsAvailable,
    isPayoutsNotEnabledError,
    type TaxInfoPayload,
} from "@/hooks/useMonetization"
import type { PayoutMethod } from "@/types/monetization"
import TransactionTable from "@/components/monetization/TransactionTable"
import PayoutMethodForm from "@/components/monetization/PayoutMethodForm"
import TaxInfoForm from "@/components/monetization/TaxInfoForm"
import RequestPayoutForm, { PayoutsOffNotice, currencySymbol, methodSummary, methodTypeLabel } from "@/components/monetization/RequestPayoutForm"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
        <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-background border border-border hover:border-primary-outline/50 transition-all duration-200">
            <div className="w-9 h-9 rounded-lg bg-brand-card border border-border flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-primary-ink" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={methodIcon(method.method_type)} />
                </svg>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-foreground">{methodTypeLabel(method.method_type)}</span>
                    {method.is_verified && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[7px] font-black tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100">
                            Verified
                        </span>
                    )}
                </div>
                <p className="text-[10px] font-bold text-muted-foreground truncate">{methodSummary(method)}</p>
            </div>
            <button
                onClick={() => onRemove(method.id)}
                disabled={isRemoving}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[8px] font-black tracking-widest border border-border text-muted-foreground bg-brand-card hover:border-red-200 hover:bg-red-50 hover:text-red-500 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
// Main Page
// ---------------------------------------------------------------------------

export default function PayoutsPage() {
    const { data: wallet, isLoading: walletLoading } = useWallet()
    const { data: methods, isLoading: methodsLoading } = usePayoutMethods()
    const addMethod = useAddPayoutMethod()
    const removeMethod = useRemovePayoutMethod()
    const requestPayout = useRequestPayout()
    const saveTaxInfo = useSaveTaxInfo()
    // Fails closed: until the server says withdrawals are open, the payout areas are read-only.
    const availability = usePayoutsAvailable()
    const [serverSaidOff, setServerSaidOff] = useState(false)
    const payoutsOff = serverSaidOff || availability.data !== true
    const showPayoutsOff = serverSaidOff || (!availability.isPending && availability.data !== true)

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
                onError: (err) => {
                    if (isPayoutsNotEnabledError(err)) setServerSaidOff(true)
                },
            })
        },
        [requestPayout]
    )

    const handleSaveTax = useCallback(
        (payload: TaxInfoPayload) => {
            // Tax details are not collected while payouts are off.
            if (payoutsOff) return
            saveTaxInfo.mutate(payload, {
                onSuccess: () => setTaxSaved(true),
            })
        },
        [saveTaxInfo, payoutsOff]
    )

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-3xl mx-auto px-4 pt-10 pb-16">
                {/* Page heading */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-[0.8rem] bg-linear-to-br from-primary to-primary-ink flex items-center justify-center shadow-lg shadow-[#D4A574]/20">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-black tracking-tight text-foreground">Payouts</h1>
                    </div>
                    <p className="text-[11px] font-bold text-muted-foreground tracking-widest ml-[52px]">
                        {showPayoutsOff ? "Payout methods, tax info & payout history" : "Manage payout methods, tax info & withdraw earnings"}
                    </p>
                </div>

                {/* Navigation tabs */}
                <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide pb-1">
                    <Link
                        href="/monetization"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest shrink-0 bg-background text-muted-foreground border-transparent border hover:bg-brand-card hover:text-foreground hover:border-border transition-all duration-200"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                        </svg>
                        Dashboard
                    </Link>
                    <Link
                        href="/monetization/tiers"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest shrink-0 bg-background text-muted-foreground border-transparent border hover:bg-brand-card hover:text-foreground hover:border-border transition-all duration-200"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Tiers
                    </Link>
                    <Link
                        href="/monetization/payouts"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest shrink-0 bg-brand-card text-foreground border-primary-outline border shadow-xs shadow-[#D4A574]/10"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Payouts
                    </Link>
                </div>

{/* Divider */}
<div className="h-px bg-secondary mb-6" />

{showPayoutsOff ? (
    <div className="mb-6">
        <PayoutsOffNotice />
    </div>
) : null}

{/* Balance summary + request payout button */}
                <div className="bg-brand-card rounded-2xl border border-border p-5 shadow-xs mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            {/* Phase 2 §D4: this is creator earnings (a pending payout),
                                not a consumer wallet. Labelled accordingly. */}
                            <p className="text-[9px] font-black tracking-widest text-muted-foreground mb-1">{showPayoutsOff ? "Estimated earnings" : "Pending payout"}</p>
                            {walletLoading ? (
                                <div className="h-7 w-28 bg-secondary rounded-full animate-pulse" />
                            ) : (
                                <p className="text-2xl font-black text-foreground">
                                    {currencySymbol(wallet?.currency ?? "INR")}
                                    {(wallet?.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                            )}
                        </div>
                        {!showPayoutForm && (
                            <button
                                onClick={() => setShowPayoutForm(true)}
                                disabled={payoutsOff || walletLoading || (wallet?.balance ?? 0) <= 0 || wallet?.is_frozen}
                                title={showPayoutsOff ? "Payouts are not available yet" : undefined}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black tracking-widest bg-linear-to-r from-primary to-primary-ink text-white hover:shadow-lg hover:shadow-[#D4A574]/25 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                {showPayoutsOff ? "Not available yet" : "Request Payout"}
                            </button>
                        )}
                    </div>
                    {wallet?.is_frozen && (
                        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
                            <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-[9px] font-black tracking-widest text-red-600">
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
                            payoutsOff={payoutsOff}
                        />
                    </div>
                )}

                {/* Payout Methods section */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs font-black text-foreground">Payout Methods</h2>
                        {!showAddMethod && (
                            <button
                                onClick={() => setShowAddMethod(true)}
                                disabled={payoutsOff}
                                title={showPayoutsOff ? "Payout methods can be added once payouts open" : undefined}
                                className="flex items-center gap-1.5 text-[9px] font-black tracking-widest text-primary-ink hover:text-muted-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Add Method
                            </button>
                        )}
                    </div>

                    {/* Add payout method form */}
                    {showAddMethod && !payoutsOff && (
                        <div className="mb-4">
                            <PayoutMethodForm
                                onSubmit={handleAddMethod}
                                isPending={addMethod.isPending}
                            />
                            <button
                                onClick={() => setShowAddMethod(false)}
                                className="mt-2 text-[9px] font-black tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {/* Existing methods list */}
                    {methodsLoading ? (
                        <div className="space-y-2">
                            {[1, 2].map((i) => (
                                <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-background border border-border animate-pulse">
                                    <div className="w-9 h-9 rounded-lg bg-secondary" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="h-3 bg-secondary rounded-full w-20" />
                                        <div className="h-2.5 bg-secondary rounded-full w-32" />
                                    </div>
                                    <div className="w-16 h-7 bg-secondary rounded-lg" />
                                </div>
                            ))}
                        </div>
                    ) : payoutMethods.length === 0 ? (
                        <div className="flex flex-col items-center py-8 gap-3">
                            <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center">
                                <svg className="w-5 h-5 text-primary-ink" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                            </div>
                            <p className="text-[10px] font-black tracking-widest text-muted-foreground">No payout methods</p>
                            <p className="text-[9px] font-bold text-primary-ink">{showPayoutsOff ? "You can add one once payouts open." : "Add a method to start receiving payouts."}</p>
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
                    {taxSaved && !payoutsOff && (
                        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100">
                            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-[10px] font-black tracking-widest text-emerald-600">Tax information saved successfully</span>
                        </div>
                    )}
                    <TaxInfoForm onSubmit={handleSaveTax} isPending={saveTaxInfo.isPending} payoutsOff={payoutsOff} />
                </div>

                {/* Payout History */}
                <div>
                    <h2 className="text-xs font-black text-foreground mb-4">Payout History</h2>
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
                            <div className="flex-1 h-px bg-secondary" />
                            <p className="text-[8px] font-black tracking-widest text-primary-ink shrink-0">
                                End of payout history
                            </p>
                            <div className="flex-1 h-px bg-secondary" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

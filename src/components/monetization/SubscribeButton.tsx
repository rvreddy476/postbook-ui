"use client"

import React, { useState } from "react"
import { useSubscribe, useUnsubscribe } from "@/hooks/useMonetization"

interface SubscribeButtonProps {
    creatorId: string
    tierId: string
    tierName?: string
    isSubscribed: boolean
    price?: number
    currency?: string
    onSuccess?: () => void
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

const SubscribeButton: React.FC<SubscribeButtonProps> = ({
    creatorId,
    tierId,
    tierName,
    isSubscribed,
    price,
    currency,
    onSuccess,
}) => {
    const [showConfirm, setShowConfirm] = useState(false)
    const subscribe = useSubscribe()
    const unsubscribe = useUnsubscribe()

    const isPending = subscribe.isPending || unsubscribe.isPending

    const handleSubscribe = () => {
        subscribe.mutate(
            { creatorId, tier_id: tierId },
            {
                onSuccess: () => {
                    setShowConfirm(false)
                    onSuccess?.()
                },
            }
        )
    }

    const handleUnsubscribe = () => {
        unsubscribe.mutate(creatorId, {
            onSuccess: () => {
                setShowConfirm(false)
                onSuccess?.()
            },
        })
    }

    if (isSubscribed) {
        return (
            <div className="relative">
                <button
                    onClick={() => setShowConfirm(!showConfirm)}
                    disabled={isPending}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#FAF5F0] border border-[#D4A574] text-[#3C2415] hover:bg-white hover:shadow-sm active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isPending ? (
                        <div className="w-3.5 h-3.5 border-2 border-[#D4A574] border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <svg className="w-3.5 h-3.5 text-[#D4A574]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                    <span>
                        {tierName ? `Subscribed: ${tierName}` : "Subscribed"}
                    </span>
                </button>

                {/* Confirm unsubscribe dropdown */}
                {showConfirm && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowConfirm(false)} />
                        <div className="absolute top-full mt-2 right-0 z-50 bg-white rounded-xl border border-[#F0E6DC] shadow-lg p-4 min-w-[220px]">
                            <p className="text-xs font-black text-[#3C2415] mb-1">Unsubscribe?</p>
                            <p className="text-[9px] font-bold text-[#7B5B3A] mb-4">
                                You will lose access to this creator&apos;s exclusive content at the end of the current billing period.
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="flex-1 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-[#FAF5F0] border border-[#F0E6DC] text-[#7B5B3A] hover:bg-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUnsubscribe}
                                    disabled={isPending}
                                    className="flex-1 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                                >
                                    {isPending ? "..." : "Unsubscribe"}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        )
    }

    return (
        <button
            onClick={handleSubscribe}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-[#D4A574] to-[#7B5B3A] text-white hover:shadow-lg hover:shadow-[#D4A574]/25 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isPending ? (
                <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
            ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
            )}
            <span>
                Subscribe
                {price !== undefined && currency ? ` ${currencySymbol(currency)}${price.toFixed(2)}/mo` : ""}
            </span>
        </button>
    )
}

export default SubscribeButton

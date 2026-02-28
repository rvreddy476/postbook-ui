"use client"

import React, { useState, useCallback } from "react"
import Link from "next/link"
import { useMyTiers, useCreateTier, useUpdateTier } from "@/hooks/useMonetization"
import type { CreatorTier } from "@/types/monetization"
import TierCard from "@/components/monetization/TierCard"

// ---------------------------------------------------------------------------
// Create / Edit Tier Form
// ---------------------------------------------------------------------------

interface TierFormProps {
    initialData?: CreatorTier | null
    onSubmit: (data: { name: string; price: number; currency: string; perks: string[] }) => void
    onCancel: () => void
    isPending: boolean
}

function TierForm({ initialData, onSubmit, onCancel, isPending }: TierFormProps) {
    const [name, setName] = useState(initialData?.name ?? "")
    const [price, setPrice] = useState(initialData?.price?.toString() ?? "")
    const [currency, setCurrency] = useState(initialData?.currency ?? "INR")
    const [perksText, setPerksText] = useState((initialData?.perks ?? []).join("\n"))

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const parsedPrice = parseFloat(price)
        if (!name.trim() || isNaN(parsedPrice) || parsedPrice <= 0) return
        const perks = perksText
            .split("\n")
            .map((p) => p.trim())
            .filter(Boolean)
        onSubmit({ name: name.trim(), price: parsedPrice, currency, perks })
    }

    const inputClass =
        "w-full px-4 py-3 rounded-xl border border-[#F0E6DC] bg-[#FAF5F0] text-sm font-bold text-[#3C2415] placeholder:text-[#D4A574]/60 focus:outline-none focus:ring-2 focus:ring-[#D4A574]/30 focus:border-[#D4A574] transition-all duration-200"

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#F0E6DC] p-6 shadow-sm">
            <h3 className="text-sm font-black text-[#3C2415] mb-5">
                {initialData ? "Edit Tier" : "Create New Tier"}
            </h3>

            <div className="space-y-4">
                {/* Name */}
                <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1.5">
                        Tier Name
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Supporter, Premium, VIP"
                        className={inputClass}
                        required
                    />
                </div>

                {/* Price + Currency row */}
                <div className="grid grid-cols-[1fr_auto] gap-3">
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1.5">
                            Monthly Price
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="99.00"
                            className={inputClass}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1.5">
                            Currency
                        </label>
                        <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className={`${inputClass} appearance-none cursor-pointer min-w-[90px]`}
                        >
                            <option value="INR">INR</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                        </select>
                    </div>
                </div>

                {/* Perks */}
                <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1.5">
                        Perks (one per line)
                    </label>
                    <textarea
                        value={perksText}
                        onChange={(e) => setPerksText(e.target.value)}
                        placeholder={"Exclusive posts\nEarly access to content\nMonthly Q&A session"}
                        rows={4}
                        className={`${inputClass} resize-none`}
                    />
                    <p className="text-[8px] font-bold text-[#D4A574] mt-1">
                        Enter each perk on a new line. Empty lines will be ignored.
                    </p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-6">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#FAF5F0] border border-[#F0E6DC] text-[#7B5B3A] hover:bg-white hover:border-[#D4A574]/50 transition-all duration-200"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-[#D4A574] to-[#7B5B3A] text-white hover:shadow-lg hover:shadow-[#D4A574]/25 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isPending ? (
                        <>
                            <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                            Saving...
                        </>
                    ) : (
                        initialData ? "Save Changes" : "Create Tier"
                    )}
                </button>
            </div>
        </form>
    )
}

// ---------------------------------------------------------------------------
// Tier Skeleton
// ---------------------------------------------------------------------------

function TierCardSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-[#F0E6DC] overflow-hidden shadow-sm animate-pulse">
            <div className="h-1 bg-[#F0E6DC]" />
            <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        <div className="h-4 bg-[#F0E6DC] rounded-full w-24" />
                        <div className="h-5 bg-[#F0E6DC] rounded-full w-20" />
                    </div>
                    <div className="flex gap-1.5">
                        <div className="w-8 h-8 bg-[#F0E6DC] rounded-xl" />
                        <div className="w-8 h-8 bg-[#F0E6DC] rounded-xl" />
                    </div>
                </div>
                <div className="h-8 bg-[#F0E6DC] rounded-xl w-28" />
                <div className="space-y-2">
                    <div className="h-3 bg-[#F0E6DC] rounded-full w-full" />
                    <div className="h-3 bg-[#F0E6DC] rounded-full w-3/4" />
                </div>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function TiersPage() {
    const { data: tiers, isLoading, isError } = useMyTiers()
    const createTier = useCreateTier()
    const updateTier = useUpdateTier()

    const [showForm, setShowForm] = useState(false)
    const [editingTier, setEditingTier] = useState<CreatorTier | null>(null)
    const [togglingId, setTogglingId] = useState<string | null>(null)

    const handleCreate = useCallback(
        (data: { name: string; price: number; currency: string; perks: string[] }) => {
            createTier.mutate(data, {
                onSuccess: () => {
                    setShowForm(false)
                },
            })
        },
        [createTier]
    )

    const handleEdit = useCallback(
        (data: { name: string; price: number; currency: string; perks: string[] }) => {
            if (!editingTier) return
            updateTier.mutate(
                { id: editingTier.id, ...data },
                {
                    onSuccess: () => {
                        setEditingTier(null)
                    },
                }
            )
        },
        [editingTier, updateTier]
    )

    const handleToggleActive = useCallback(
        (tier: CreatorTier) => {
            setTogglingId(tier.id)
            updateTier.mutate(
                { id: tier.id, is_active: !tier.is_active },
                {
                    onSettled: () => setTogglingId(null),
                }
            )
        },
        [updateTier]
    )

    const allTiers = tiers ?? []
    const activeTiers = allTiers.filter((t) => t.is_active)
    const inactiveTiers = allTiers.filter((t) => !t.is_active)

    return (
        <div className="min-h-screen bg-[#FAF5F0]">
            <div className="max-w-3xl mx-auto px-4 pt-10 pb-16">
                {/* Page heading */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-[0.8rem] bg-gradient-to-br from-[#D4A574] to-[#7B5B3A] flex items-center justify-center shadow-lg shadow-[#D4A574]/20">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-black tracking-tight text-[#3C2415]">Subscription Tiers</h1>
                    </div>
                    <p className="text-[11px] font-bold text-[#7B5B3A] uppercase tracking-widest ml-[52px]">
                        Create and manage your subscription tiers
                    </p>
                </div>

                {/* Navigation tabs */}
                <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide pb-1">
                    <Link
                        href="/monetization"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex-shrink-0 bg-[#FAF5F0] text-[#7B5B3A] border-transparent border hover:bg-white hover:text-[#3C2415] hover:border-[#F0E6DC] transition-all duration-200"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                        </svg>
                        Dashboard
                    </Link>
                    <Link
                        href="/monetization/tiers"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex-shrink-0 bg-white text-[#3C2415] border-[#D4A574] border shadow-sm shadow-[#D4A574]/10"
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

                {/* Error state */}
                {isError && (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
                            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <p className="text-[11px] font-black uppercase tracking-widest text-[#3C2415]">Something went wrong</p>
                            <p className="text-[10px] font-bold text-[#7B5B3A] mt-0.5">Failed to load your tiers.</p>
                        </div>
                    </div>
                )}

                {/* Create tier button */}
                {!showForm && !editingTier && !isError && (
                    <div className="mb-6">
                        <button
                            onClick={() => setShowForm(true)}
                            className="flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-[#D4A574] to-[#7B5B3A] text-white hover:shadow-lg hover:shadow-[#D4A574]/25 active:scale-[0.98] transition-all duration-200"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Create New Tier
                        </button>
                    </div>
                )}

                {/* Create form */}
                {showForm && (
                    <div className="mb-6">
                        <TierForm
                            onSubmit={handleCreate}
                            onCancel={() => setShowForm(false)}
                            isPending={createTier.isPending}
                        />
                    </div>
                )}

                {/* Edit form */}
                {editingTier && (
                    <div className="mb-6">
                        <TierForm
                            initialData={editingTier}
                            onSubmit={handleEdit}
                            onCancel={() => setEditingTier(null)}
                            isPending={updateTier.isPending}
                        />
                    </div>
                )}

                {/* Loading state */}
                {isLoading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <TierCardSkeleton key={i} />
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {!isLoading && !isError && allTiers.length === 0 && !showForm && (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D4A574] to-[#7B5B3A] flex items-center justify-center shadow-lg shadow-[#D4A574]/20 opacity-40">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <p className="text-[11px] font-black uppercase tracking-widest text-[#3C2415]">No tiers yet</p>
                            <p className="text-[10px] font-bold text-[#7B5B3A] mt-0.5">
                                Create your first subscription tier to start earning from your fans.
                            </p>
                        </div>
                    </div>
                )}

                {/* Active tiers */}
                {!isLoading && activeTiers.length > 0 && (
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[9px] font-black uppercase tracking-widest text-[#7B5B3A]">
                                {activeTiers.length} active {activeTiers.length === 1 ? "tier" : "tiers"}
                            </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {activeTiers.map((tier) => (
                                <TierCard
                                    key={tier.id}
                                    tier={tier}
                                    onEdit={(t) => {
                                        setShowForm(false)
                                        setEditingTier(t)
                                    }}
                                    onToggleActive={handleToggleActive}
                                    isUpdating={togglingId === tier.id}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Inactive tiers */}
                {!isLoading && inactiveTiers.length > 0 && (
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex-1 h-px bg-[#F0E6DC]" />
                            <p className="text-[8px] font-black uppercase tracking-widest text-[#D4A574] flex-shrink-0">
                                Inactive Tiers
                            </p>
                            <div className="flex-1 h-px bg-[#F0E6DC]" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {inactiveTiers.map((tier) => (
                                <TierCard
                                    key={tier.id}
                                    tier={tier}
                                    onEdit={(t) => {
                                        setShowForm(false)
                                        setEditingTier(t)
                                    }}
                                    onToggleActive={handleToggleActive}
                                    isUpdating={togglingId === tier.id}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

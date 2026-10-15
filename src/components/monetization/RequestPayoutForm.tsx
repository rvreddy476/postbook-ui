"use client"

import React, { useState } from "react"
import type { PayoutMethod } from "@/types/monetization"

/*
  The withdrawal form and the "payouts are off" notice. Withdrawals stay
  off until MONETIZATION_PAYOUTS_ENABLED is set: while they are, the page
  says so up front and the form is read-only, instead of letting a creator
  fill it in and be refused by the server.
*/

export function currencySymbol(currency: string): string {
    switch (currency?.toUpperCase()) {
        case "INR": return "₹"
        case "USD": return "$"
        case "EUR": return "€"
        case "GBP": return "£"
        default: return currency || "$"
    }
}

export function methodTypeLabel(type: string): string {
    switch (type) {
        case "upi": return "UPI"
        case "bank_transfer": return "Bank Transfer"
        case "paypal": return "PayPal"
        default: return type
    }
}

export function methodSummary(method: PayoutMethod): string {
    const d = method.details
    switch (method.method_type) {
        case "upi": return d.upi_id || "UPI ID"
        case "bank_transfer": return `${d.bank_name || "Bank"} ****${(d.account_number || "").slice(-4)}`
        case "paypal": return d.email || "PayPal"
        default: return JSON.stringify(d)
    }
}

export const PAYOUTS_OFF_TITLE = "Payouts are not available yet"
export const PAYOUTS_OFF_BODY =
    "Withdrawals have not opened. Your earnings are shown as estimates and stay in your account until they do. Nothing can be withdrawn or moved for now."

export function PayoutsOffNotice() {
    return (
        <div role="status" className="rounded-2xl border border-border bg-brand-card px-4 py-3">
            <p className="text-[11px] font-black tracking-widest text-foreground">{PAYOUTS_OFF_TITLE}</p>
            <p className="mt-1 text-[11px] font-bold text-muted-foreground">{PAYOUTS_OFF_BODY}</p>
        </div>
    )
}

export interface RequestPayoutFormProps {
    balance: number
    currency: string
    methods: PayoutMethod[]
    onSubmit: (payload: { amount: number; payout_method_id: string }) => void
    onCancel: () => void
    isPending: boolean
    /** Withdrawals are closed: every field and the submit are disabled, with the reason shown. */
    payoutsOff?: boolean
}

export default function RequestPayoutForm({ balance, currency, methods, onSubmit, onCancel, isPending, payoutsOff = false }: RequestPayoutFormProps) {
    const [amount, setAmount] = useState("")
    const [methodId, setMethodId] = useState(methods[0]?.id ?? "")
    const sym = currencySymbol(currency)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (payoutsOff) return
        const parsed = parseFloat(amount)
        if (isNaN(parsed) || parsed <= 0 || parsed > balance || !methodId) return
        onSubmit({ amount: parsed, payout_method_id: methodId })
    }

    const inputClass =
        "w-full px-4 py-3 rounded-xl border border-border bg-background text-sm font-bold text-foreground placeholder:text-primary-ink/60 focus:outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary-outline transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"

    return (
        <div className="bg-brand-card rounded-2xl border border-primary-outline p-6 shadow-md shadow-primary/10">
            <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-primary to-primary-ink flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-sm font-black text-foreground">Request Payout</h3>
                    <p className="text-[9px] font-bold text-muted-foreground">
                        {payoutsOff ? "Estimated" : "Available"}: {sym}{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            {payoutsOff ? <div className="mb-4"><PayoutsOffNotice /></div> : null}

            <form onSubmit={handleSubmit} className="space-y-4" aria-disabled={payoutsOff || undefined}>
                <fieldset disabled={payoutsOff} className="space-y-4 min-w-0 border-0 p-0 m-0">
                    {/* Amount */}
                    <div>
                        <label className="block text-[9px] font-black tracking-widest text-muted-foreground mb-1.5" htmlFor="payout-amount">
                            Amount ({currency})
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-primary-ink">{sym}</span>
                            <input
                                id="payout-amount"
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
                                        className="px-2.5 py-1 rounded-lg text-[8px] font-black tracking-widest bg-background border border-border text-muted-foreground hover:border-primary-outline hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {pct}%
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Payout method select */}
                    <div>
                        <label className="block text-[9px] font-black tracking-widest text-muted-foreground mb-1.5" htmlFor="payout-method">
                            Payout Method
                        </label>
                        {methods.length === 0 ? (
                            <p className="text-[10px] font-bold text-danger">No payout methods added. Please add one first.</p>
                        ) : (
                            <select
                                id="payout-method"
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
                </fieldset>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 px-4 py-3 rounded-xl text-[10px] font-black tracking-widest bg-background border border-border text-muted-foreground hover:bg-brand-card transition-all"
                    >
                        {payoutsOff ? "Close" : "Cancel"}
                    </button>
                    <button
                        type="submit"
                        disabled={payoutsOff || isPending || methods.length === 0}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black tracking-widest bg-linear-to-r from-primary to-primary-ink text-primary-foreground hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPending ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-primary-foreground/50 border-t-primary-foreground rounded-full animate-spin" />
                                Processing...
                            </>
                        ) : payoutsOff ? (
                            "Not available yet"
                        ) : (
                            "Request Payout"
                        )}
                    </button>
                </div>
            </form>
        </div>
    )
}

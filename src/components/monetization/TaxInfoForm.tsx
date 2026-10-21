"use client"

import React, { useState } from "react"
import type { TaxInfoPayload } from "@/hooks/useMonetization"

/*
  The payouts page's tax form. While payouts are off (founder, 15 Oct) it
  collects nothing: every field and the submit are disabled with the reason
  shown, and a submit is dropped before it reaches the caller.
*/

export const TAX_LOCKED_LINE = "Available when payouts open"

export function TaxLockedLine({ className = "", id }: { className?: string; id?: string }) {
    return <p id={id} className={`text-xs text-muted-foreground ${className}`.trim()}>{TAX_LOCKED_LINE}</p>
}

export interface TaxInfoFormProps {
    onSubmit: (payload: TaxInfoPayload) => void
    isPending: boolean
    /** Payouts are closed: the form is read-only and never submits. */
    payoutsOff?: boolean
}

export default function TaxInfoForm({ onSubmit, isPending, payoutsOff = false }: TaxInfoFormProps) {
    const [country, setCountry] = useState("IN")
    const [pan, setPan] = useState("")
    const [gst, setGst] = useState("")

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (payoutsOff) return
        if (!country.trim()) return
        onSubmit({ country: country.trim(), pan_number: pan.trim(), gst_number: gst.trim() })
    }

    const inputClass =
        "w-full px-4 py-3 rounded-xl border border-border bg-background text-sm font-bold text-foreground placeholder:text-primary-ink/60 focus:outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary-outline transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"

    return (
        <form onSubmit={handleSubmit} aria-disabled={payoutsOff || undefined} className="bg-brand-card rounded-2xl border border-border p-6 shadow-xs">
            <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-primary-ink to-primary-hover flex items-center justify-center shadow-lg shadow-primary-ink/20">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-sm font-black text-foreground">Tax Information</h3>
                    <p className="text-[9px] font-bold text-muted-foreground tracking-widest">Required for payouts in some regions</p>
                </div>
            </div>

            <fieldset disabled={payoutsOff} className="space-y-4 min-w-0 border-0 p-0 m-0">
                <div>
                    <label htmlFor="tax-country" className="block text-[9px] font-black tracking-widest text-muted-foreground mb-1.5">Country</label>
                    <select
                        id="tax-country"
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
                    <label htmlFor="tax-pan" className="block text-[9px] font-black tracking-widest text-muted-foreground mb-1.5">PAN Number</label>
                    <input
                        id="tax-pan"
                        type="text"
                        value={pan}
                        onChange={(e) => setPan(e.target.value)}
                        placeholder="ABCDE1234F"
                        className={inputClass}
                    />
                </div>
                <div>
                    <label htmlFor="tax-gst" className="block text-[9px] font-black tracking-widest text-muted-foreground mb-1.5">GST Number (optional)</label>
                    <input
                        id="tax-gst"
                        type="text"
                        value={gst}
                        onChange={(e) => setGst(e.target.value)}
                        placeholder="22AAAAA0000A1Z5"
                        className={inputClass}
                    />
                </div>
            </fieldset>

            <div className="mt-6">
                <button
                    type="submit"
                    disabled={payoutsOff || isPending}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black tracking-widest bg-linear-to-r from-primary-ink to-primary-hover text-white hover:shadow-lg hover:shadow-primary-ink/25 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isPending && !payoutsOff ? (
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
                {payoutsOff ? <TaxLockedLine className="mt-2 text-center" /> : null}
            </div>
        </form>
    )
}

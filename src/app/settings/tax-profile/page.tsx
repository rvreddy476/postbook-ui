"use client"

import { useState } from "react"
import AppShell from '@/components/AppShell'
import Link from "next/link"
import { motion } from "framer-motion"
import {
    ArrowLeft,
    Receipt,
    AlertTriangle,
    CheckCircle,
    Clock,
    Loader2,
} from "lucide-react"
import api from "@/lib/api"

/* ------------------------------------------------------------------ */
/*  Section Card                                                        */
/* ------------------------------------------------------------------ */

function SectionCard({
    icon,
    title,
    description,
    children,
    delay = 0,
}: {
    icon: React.ReactNode
    title: string
    description: string
    children: React.ReactNode
    delay?: number
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="rounded-2xl bg-brand-card border border-brand-divider shadow-sm"
        >
            <div className="p-6">
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-text/5">
                        {icon}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-bold text-brand-text">{title}</h2>
                        <p className="mt-1 text-sm text-brand-highlight">{description}</p>
                    </div>
                </div>
                <div className="mt-5">{children}</div>
            </div>
        </motion.div>
    )
}

/* ------------------------------------------------------------------ */
/*  Save Toast                                                          */
/* ------------------------------------------------------------------ */

function useSaveToast() {
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

    const show = (text: string, isError = false) => {
        setMessage({ text, isError })
        setTimeout(() => setMessage(null), 2000)
    }

    const Toast = message ? (
        <p
            className={[
                "mt-3 text-xs font-semibold",
                message.isError ? "text-red-500" : "text-emerald-600",
            ].join(" ")}
        >
            {message.text}
        </p>
    ) : null

    return { show, Toast }
}

/* ------------------------------------------------------------------ */
/*  PAN Validation                                                      */
/* ------------------------------------------------------------------ */

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/

/* ------------------------------------------------------------------ */
/*  Verification Badge                                                  */
/* ------------------------------------------------------------------ */

function VerificationBadge({ status }: { status: "verified" | "pending" | "unverified" }) {
    if (status === "verified") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle className="h-3.5 w-3.5" />
                Verified
            </span>
        )
    }
    if (status === "pending") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                <Clock className="h-3.5 w-3.5" />
                Pending Review
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-secondary px-3 py-1 text-xs font-semibold text-brand-highlight">
            Not Verified
        </span>
    )
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

export default function TaxProfilePage() {
    const [pan, setPan] = useState("")
    const [panError, setPanError] = useState<string | null>(null)
    const [hasGst, setHasGst] = useState(false)
    const [gstin, setGstin] = useState("")
    const [residency, setResidency] = useState<"india" | "outside">("india")
    const [verificationStatus, setVerificationStatus] = useState<"verified" | "pending" | "unverified">("unverified")
    const [isSaving, setIsSaving] = useState(false)
    const { show, Toast } = useSaveToast()

    const validatePan = (value: string) => {
        const upper = value.toUpperCase()
        setPan(upper)
        if (upper.length > 0 && !PAN_REGEX.test(upper)) {
            setPanError("Invalid PAN format (e.g., ABCDE1234F)")
        } else {
            setPanError(null)
        }
    }

    const handleSave = async () => {
        if (pan && !PAN_REGEX.test(pan)) {
            setPanError("Invalid PAN format")
            return
        }
        setIsSaving(true)
        try {
            const res = await api.put("/v1/users/me/tax-profile", {
                pan,
                has_gst: hasGst,
                gstin: hasGst ? gstin : "",
                tax_residency: residency,
            })
            setVerificationStatus(res.data?.data?.verification_status ?? "pending")
            show("Saved!")
        } catch {
            show("Could not save", true)
        } finally {
            setIsSaving(false)
        }
    }

    const inputClasses =
        "w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2 text-sm font-medium text-brand-text focus:border-brand-text/50 focus:bg-brand-card focus:outline-none focus:ring-2 focus:ring-brand-text/20"

    return (
        <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            {/* Back link */}
            <Link
                href="/settings"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-text transition-colors hover:text-brand-text/70"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Settings
            </Link>

            {/* Page header */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-text/10">
                    <Receipt className="h-5 w-5 text-brand-text" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-brand-text">Tax Profile</h1>
                    <p className="text-sm text-brand-highlight">
                        Manage your tax information for creator payouts.
                    </p>
                </div>
            </div>

            {/* Incomplete banner */}
            {verificationStatus === "unverified" && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4"
                >
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                    <p className="text-sm font-medium text-amber-800">
                        Your tax profile is incomplete. Complete it to enable creator payouts.
                    </p>
                </motion.div>
            )}

            {/* Section 1 — PAN */}
            <SectionCard
                icon={<Receipt className="h-6 w-6 text-brand-text/50" />}
                title="PAN Details"
                description="Your Permanent Account Number for tax purposes."
                delay={0.05}
            >
                <div className="space-y-1.5">
                    <label htmlFor="pan" className="block text-xs font-semibold text-brand-highlight">
                        PAN Number
                    </label>
                    <input
                        id="pan"
                        type="text"
                        maxLength={10}
                        value={pan}
                        onChange={(e) => validatePan(e.target.value)}
                        placeholder="ABCDE1234F"
                        className={inputClasses}
                    />
                    {panError && (
                        <p className="text-xs font-semibold text-red-500">{panError}</p>
                    )}
                </div>
            </SectionCard>

            {/* Section 2 — GST */}
            <SectionCard
                icon={<Receipt className="h-6 w-6 text-brand-text/50" />}
                title="GST Registration"
                description="If you are GST-registered, enter your GSTIN."
                delay={0.1}
            >
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-brand-text">I am GST registered</p>
                            <p className="text-xs text-brand-highlight">Toggle on if you have a GSTIN</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={hasGst}
                            onClick={() => setHasGst(!hasGst)}
                            className={[
                                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
                                "transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-text/50",
                                hasGst ? "bg-brand-text" : "bg-brand-secondary",
                            ].join(" ")}
                        >
                            <span
                                className={[
                                    "pointer-events-none inline-block h-5 w-5 rounded-full bg-brand-bg shadow-md",
                                    "transform transition-transform duration-200 ease-in-out",
                                    hasGst ? "translate-x-5" : "translate-x-0",
                                ].join(" ")}
                            />
                        </button>
                    </div>
                    {hasGst && (
                        <div className="space-y-1.5">
                            <label htmlFor="gstin" className="block text-xs font-semibold text-brand-highlight">
                                GSTIN
                            </label>
                            <input
                                id="gstin"
                                type="text"
                                maxLength={15}
                                value={gstin}
                                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                                placeholder="22AAAAA0000A1Z5"
                                className={inputClasses}
                            />
                        </div>
                    )}
                </div>
            </SectionCard>

            {/* Section 3 — Tax Residency */}
            <SectionCard
                icon={<Receipt className="h-6 w-6 text-brand-text/50" />}
                title="Tax Residency"
                description="Where you are a tax resident."
                delay={0.15}
            >
                <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="radio"
                            name="residency"
                            value="india"
                            checked={residency === "india"}
                            onChange={() => setResidency("india")}
                            className="h-4 w-4 accent-brand-text"
                        />
                        <span className="text-sm font-medium text-brand-text">India</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="radio"
                            name="residency"
                            value="outside"
                            checked={residency === "outside"}
                            onChange={() => setResidency("outside")}
                            className="h-4 w-4 accent-brand-text"
                        />
                        <span className="text-sm font-medium text-brand-text">Outside India</span>
                    </label>
                </div>
            </SectionCard>

            {/* Section 4 — Verification Status */}
            <SectionCard
                icon={<CheckCircle className="h-6 w-6 text-brand-text/50" />}
                title="Verification Status"
                description="Current status of your tax profile verification."
                delay={0.2}
            >
                <VerificationBadge status={verificationStatus} />
            </SectionCard>

            {/* Section 5 — TDS Summary (only when verified) */}
            {verificationStatus === "verified" && (
                <SectionCard
                    icon={<Receipt className="h-6 w-6 text-brand-text/50" />}
                    title="TDS Summary"
                    description="Tax Deducted at Source from your creator earnings."
                    delay={0.25}
                >
                    <div className="rounded-xl bg-brand-secondary p-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-brand-highlight">Total Earnings</p>
                                <p className="text-lg font-bold text-brand-text">--</p>
                            </div>
                            <div>
                                <p className="text-brand-highlight">TDS Deducted</p>
                                <p className="text-lg font-bold text-brand-text">--</p>
                            </div>
                            <div>
                                <p className="text-brand-highlight">Net Paid Out</p>
                                <p className="text-lg font-bold text-brand-text">--</p>
                            </div>
                            <div>
                                <p className="text-brand-highlight">TDS Rate</p>
                                <p className="text-lg font-bold text-brand-text">--</p>
                            </div>
                        </div>
                    </div>
                </SectionCard>
            )}

            {/* Save */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-text px-6 py-2.5 text-sm font-semibold text-brand-bg transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        "Save Tax Profile"
                    )}
                </button>
                {Toast}
            </motion.div>
        </div>
        </AppShell>
    )
}

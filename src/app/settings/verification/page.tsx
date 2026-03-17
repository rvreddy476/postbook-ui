"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
    ArrowLeft,
    BadgeCheck,
    CheckCircle2,
    Clock,
    XCircle,
} from "lucide-react"
import api from "@/lib/api"

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type VerificationStatus = "pending" | "approved" | "rejected"
type VerificationType = "individual" | "business" | "creator" | "public_figure"

interface VerificationRequest {
    id: string
    type: VerificationType
    status: VerificationStatus
    submitted_at: string
}

/* ------------------------------------------------------------------ */
/*  Type Options                                                        */
/* ------------------------------------------------------------------ */

const TYPE_OPTIONS: {
    value: VerificationType
    label: string
    description: string
}[] = [
    {
        value: "individual",
        label: "Individual",
        description: "A personal account representing yourself as a private individual.",
    },
    {
        value: "business",
        label: "Business",
        description: "A company, brand, or organization with a commercial presence.",
    },
    {
        value: "creator",
        label: "Creator",
        description: "A content creator, influencer, or artist with an established audience.",
    },
    {
        value: "public_figure",
        label: "Public Figure",
        description: "A politician, journalist, athlete, or other well-known public personality.",
    },
]

/* ------------------------------------------------------------------ */
/*  Skeleton                                                            */
/* ------------------------------------------------------------------ */

function PageSkeleton() {
    return (
        <div className="rounded-2xl bg-brand-card border border-[#D8103F]/10 shadow-sm p-6 space-y-4 animate-pulse">
            <div className="flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-slate-200" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 w-36 rounded bg-slate-200" />
                    <div className="h-3 w-52 rounded bg-slate-200" />
                </div>
            </div>
            <div className="space-y-3 pt-2">
                <div className="h-12 rounded-xl bg-slate-100" />
                <div className="h-12 rounded-xl bg-slate-100" />
                <div className="h-12 rounded-xl bg-slate-100" />
            </div>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Status Badge                                                        */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: VerificationStatus }) {
    const map: Record<VerificationStatus, { label: string; className: string }> = {
        pending: {
            label: "Pending Review",
            className: "bg-yellow-100 text-yellow-700 border border-yellow-200",
        },
        approved: {
            label: "Approved",
            className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
        },
        rejected: {
            label: "Not Approved",
            className: "bg-red-100 text-red-600 border border-red-200",
        },
    }
    const { label, className } = map[status]
    return (
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
            {label}
        </span>
    )
}

/* ------------------------------------------------------------------ */
/*  Application Form                                                    */
/* ------------------------------------------------------------------ */

function ApplicationForm({ onSubmitted }: { onSubmitted: () => void }) {
    const [selectedType, setSelectedType] = useState<VerificationType>("individual")
    const queryClient = useQueryClient()

    const mutation = useMutation({
        mutationFn: (type: VerificationType) =>
            api.post("/v1/trust/verification", { type, docs: {} }).then((r) => r.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["verification"] })
            onSubmitted()
        },
    })

    return (
        <div className="space-y-5">
            <p className="text-sm text-brand-highlight">
                Choose the category that best describes your account. Our team will review your
                request and respond within 7–10 business days.
            </p>

            <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-brand-highlight uppercase tracking-wide">
                    Account type
                </legend>
                {TYPE_OPTIONS.map((opt) => (
                    <label
                        key={opt.value}
                        className={[
                            "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                            selectedType === opt.value
                                ? "border-[#D8103F]/40 bg-[#D8103F]/5"
                                : "border-brand-divider bg-brand-card hover:border-[#D8103F]/20",
                        ].join(" ")}
                    >
                        <input
                            type="radio"
                            name="verification-type"
                            value={opt.value}
                            checked={selectedType === opt.value}
                            onChange={() => setSelectedType(opt.value)}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-[#D8103F]"
                        />
                        <div>
                            <p className="text-sm font-semibold text-brand-text">{opt.label}</p>
                            <p className="text-xs text-brand-highlight">{opt.description}</p>
                        </div>
                    </label>
                ))}
            </fieldset>

            {mutation.isError && (
                <p className="text-xs text-red-500 font-medium">
                    Submission failed. Please try again.
                </p>
            )}

            <button
                onClick={() => mutation.mutate(selectedType)}
                disabled={mutation.isPending}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                style={{ backgroundColor: "#D8103F" }}
            >
                {mutation.isPending ? "Submitting…" : "Submit Application"}
            </button>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

export default function VerificationPage() {
    const [justSubmitted, setJustSubmitted] = useState(false)

    const { data: request, isLoading, isError } = useQuery<VerificationRequest | null>({
        queryKey: ["verification"],
        queryFn: () =>
            api
                .get("/v1/trust/verification")
                .then((r) => r.data?.data ?? r.data)
                .catch(() => null),
    })

    const canReapply = request?.status === "rejected" && !justSubmitted

    return (
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            {/* Back link */}
            <Link
                href="/settings"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#D8103F] transition-colors hover:text-[#8a0a28]"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Settings
            </Link>

            {/* Page header */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D8103F]/10">
                    <BadgeCheck className="h-5 w-5 text-[#D8103F]" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-brand-text">Get Verified</h1>
                    <p className="text-sm text-brand-highlight">
                        Apply for a verified badge on your profile
                    </p>
                </div>
            </div>

            {isLoading ? (
                <PageSkeleton />
            ) : isError ? (
                <p className="text-sm text-brand-highlight">Could not load verification status.</p>
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl bg-brand-card border border-[#D8103F]/10 shadow-sm p-6"
                >
                    {/* ---- Approved ---- */}
                    {request?.status === "approved" && (
                        <div className="flex flex-col items-center gap-4 py-6 text-center">
                            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
                            <div>
                                <h2 className="text-lg font-bold text-brand-text">
                                    Congratulations! You&apos;re verified
                                </h2>
                                <p className="mt-1 text-sm text-brand-highlight">
                                    Your verified badge is now active on your profile.
                                </p>
                            </div>
                            <StatusBadge status="approved" />
                        </div>
                    )}

                    {/* ---- Pending ---- */}
                    {request?.status === "pending" && !justSubmitted && (
                        <div className="flex flex-col items-center gap-4 py-6 text-center">
                            <Clock className="h-14 w-14 text-yellow-500" />
                            <div>
                                <h2 className="text-lg font-bold text-brand-text">
                                    Your request is under review
                                </h2>
                                <p className="mt-1 text-sm text-brand-highlight">
                                    Submitted on{" "}
                                    {new Date(request.submitted_at).toLocaleDateString(undefined, {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                    })}
                                    . Our team typically responds within 7–10 business days.
                                </p>
                            </div>
                            <StatusBadge status="pending" />
                        </div>
                    )}

                    {/* ---- Just submitted ---- */}
                    {justSubmitted && (
                        <div className="flex flex-col items-center gap-4 py-6 text-center">
                            <Clock className="h-14 w-14 text-yellow-500" />
                            <div>
                                <h2 className="text-lg font-bold text-brand-text">
                                    Application submitted!
                                </h2>
                                <p className="mt-1 text-sm text-brand-highlight">
                                    Your request is now under review. We will notify you when a
                                    decision has been made.
                                </p>
                            </div>
                            <StatusBadge status="pending" />
                        </div>
                    )}

                    {/* ---- Rejected — show info + re-apply option ---- */}
                    {request?.status === "rejected" && !justSubmitted && (
                        <div className="space-y-5">
                            <div className="flex items-center gap-3">
                                <XCircle className="h-8 w-8 shrink-0 text-red-400" />
                                <div>
                                    <h2 className="text-base font-bold text-brand-text">
                                        Request not approved
                                    </h2>
                                    <p className="text-sm text-brand-highlight">
                                        Your previous application did not meet our verification
                                        criteria. You may apply again below.
                                    </p>
                                </div>
                            </div>
                            <StatusBadge status="rejected" />
                            <hr className="border-brand-divider" />
                            <h3 className="text-sm font-semibold text-brand-text">
                                Resubmit application
                            </h3>
                            <ApplicationForm onSubmitted={() => setJustSubmitted(true)} />
                        </div>
                    )}

                    {/* ---- No request yet ---- */}
                    {!request && !justSubmitted && !canReapply && (
                        <div className="space-y-5">
                            <div className="flex items-center gap-3">
                                <BadgeCheck className="h-8 w-8 shrink-0 text-[#D8103F]/60" />
                                <div>
                                    <h2 className="text-base font-bold text-brand-text">
                                        Apply for verification
                                    </h2>
                                    <p className="text-sm text-brand-highlight">
                                        A verified badge helps your followers know they are engaging
                                        with the real you.
                                    </p>
                                </div>
                            </div>
                            <hr className="border-brand-divider" />
                            <ApplicationForm onSubmitted={() => setJustSubmitted(true)} />
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    )
}

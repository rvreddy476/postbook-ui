"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
    ArrowLeft,
    BadgeCheck,
    CheckCircle2,
    Clock,
    XCircle,
} from "lucide-react"
import {
    useSubmitVerification,
    useVerificationRequest,
    type VerificationType,
} from "@/hooks/useTrust"
import { asServerError } from "../_lib/saveFeedback"

/*
 * Submits to trust-safety through the shared hooks in useTrust.ts
 * (POST /v1/verification-requests). This page used to call
 * /v1/trust/verification, which the gateway never routed.
 *
 * There is no self-service status read upstream (the list is admin-only), so
 * useVerificationRequest reports null and the page offers the form. A
 * duplicate request is refused by the server ("a pending verification request
 * already exists"), and that message is shown as is.
 */

type VerificationStatus = "pending" | "approved" | "rejected"

/* ------------------------------------------------------------------ */
/*  Type Options                                                        */
/* ------------------------------------------------------------------ */

// The four types trust-safety accepts (validVerificationTypes). The old
// "individual" and "public_figure" options were rejected with a 400.
const TYPE_OPTIONS: {
    value: VerificationType
    label: string
    description: string
}[] = [
    {
        value: "creator",
        label: "Creator",
        description: "A content creator, influencer, or artist with an established audience.",
    },
    {
        value: "business",
        label: "Business",
        description: "A company or brand with a commercial presence.",
    },
    {
        value: "organization",
        label: "Organization",
        description: "A non-profit, institution, club or other organization.",
    },
    {
        value: "government",
        label: "Government",
        description: "A government body, agency or official.",
    },
]

/* ------------------------------------------------------------------ */
/*  Status Badge                                                        */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: VerificationStatus }) {
    const map: Record<VerificationStatus, { label: string; className: string }> = {
        pending: {
            label: "Pending Review",
            className: "bg-warning/10 text-warning border border-warning/30",
        },
        approved: {
            label: "Approved",
            className: "bg-success/10 text-success border border-success/30",
        },
        rejected: {
            label: "Not Approved",
            className: "bg-danger/10 text-danger border border-danger/30",
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
    const [selectedType, setSelectedType] = useState<VerificationType>("creator")
    const mutation = useSubmitVerification()

    return (
        <div className="space-y-5">
            <p className="text-sm text-brand-highlight">
                Choose the category that best describes your account. Our team will review your
                request and respond within 7–10 business days.
            </p>

            <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-brand-highlight tracking-wide">
                    Account type
                </legend>
                {TYPE_OPTIONS.map((opt) => (
                    <label
                        key={opt.value}
                        className={[
                            "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                            selectedType === opt.value
                                ? "border-brand-text/40 bg-brand-text/5"
                                : "border-brand-divider bg-brand-card hover:border-brand-text/20",
                        ].join(" ")}
                    >
                        <input
                            type="radio"
                            name="verification-type"
                            value={opt.value}
                            checked={selectedType === opt.value}
                            onChange={() => setSelectedType(opt.value)}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-text"
                        />
                        <div>
                            <p className="text-sm font-semibold text-brand-text">{opt.label}</p>
                            <p className="text-xs text-brand-highlight">{opt.description}</p>
                        </div>
                    </label>
                ))}
            </fieldset>

            {mutation.isError && (
                <p className="text-xs text-danger font-medium" role="alert">
                    {asServerError(mutation.error).message}
                </p>
            )}

            <button
                onClick={() => mutation.mutate({ type: selectedType }, { onSuccess: onSubmitted })}
                disabled={mutation.isPending}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-primary-ink transition-opacity disabled:opacity-60"
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
    const { data: request } = useVerificationRequest()

    const status = request?.status as VerificationStatus | undefined

    return (
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            {/* Back link */}
            <Link
                href="/settings"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-text transition-colors hover:text-danger"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Settings
            </Link>

            {/* Page header */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-text/10">
                    <BadgeCheck className="h-5 w-5 text-brand-text" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-brand-text">Get Verified</h1>
                    <p className="text-sm text-brand-highlight">
                        Apply for a verified badge on your profile
                    </p>
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-brand-card border border-brand-text/10 shadow-xs p-6"
            >
                {/* ---- Approved ---- */}
                {status === "approved" && !justSubmitted && (
                    <div className="flex flex-col items-center gap-4 py-6 text-center">
                        <CheckCircle2 className="h-14 w-14 text-success" />
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

                {/* ---- Pending / just submitted ---- */}
                {(justSubmitted || status === "pending") && (
                    <div className="flex flex-col items-center gap-4 py-6 text-center" role="status">
                        <Clock className="h-14 w-14 text-warning" />
                        <div>
                            <h2 className="text-lg font-bold text-brand-text">
                                {justSubmitted ? "Application submitted" : "Your request is under review"}
                            </h2>
                            <p className="mt-1 text-sm text-brand-highlight">
                                {request?.created_at && !justSubmitted
                                    ? `Submitted on ${new Date(request.created_at).toLocaleDateString(undefined, {
                                          year: "numeric",
                                          month: "long",
                                          day: "numeric",
                                      })}. `
                                    : ""}
                                We will notify you when a decision has been made.
                            </p>
                        </div>
                        <StatusBadge status="pending" />
                    </div>
                )}

                {/* ---- Rejected: show info and the re-apply form ---- */}
                {status === "rejected" && !justSubmitted && (
                    <div className="space-y-5">
                        <div className="flex items-center gap-3">
                            <XCircle className="h-8 w-8 shrink-0 text-danger" />
                            <div>
                                <h2 className="text-base font-bold text-brand-text">
                                    Request not approved
                                </h2>
                                <p className="text-sm text-brand-highlight">
                                    {request?.rejection_reason ||
                                        "Your previous application did not meet our verification criteria."}{" "}
                                    You may apply again below.
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

                {/* ---- No known request ---- */}
                {!status && !justSubmitted && (
                    <div className="space-y-5">
                        <div className="flex items-center gap-3">
                            <BadgeCheck className="h-8 w-8 shrink-0 text-brand-text/60" />
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
        </div>
    )
}

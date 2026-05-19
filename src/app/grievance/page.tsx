"use client"

import { useState } from "react"
import AppShell from '@/components/AppShell'
import Link from "next/link"
import { motion } from "framer-motion"
import {
    ArrowLeft,
    Flag,
    CheckCircle,
    Loader2,
    Mail,
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
/*  Categories                                                          */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
    "Account Issue",
    "Content Moderation",
    "Privacy Concern",
    "Harassment or Bullying",
    "Spam or Fake Account",
    "Intellectual Property",
    "Payment or Billing",
    "Technical Bug",
    "Safety Concern",
    "Other",
] as const

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

export default function GrievancePage() {
    const [category, setCategory] = useState("")
    const [description, setDescription] = useState("")
    const [relatedContent, setRelatedContent] = useState("")
    const [email, setEmail] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [referenceId, setReferenceId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const canSubmit = category && description.length >= 50 && email.includes("@")

    const handleSubmit = async () => {
        if (!canSubmit) return
        setIsSubmitting(true)
        setError(null)
        try {
            const res = await api.post("/v1/grievances", {
                category,
                description,
                related_content_url: relatedContent || undefined,
                email,
            })
            setReferenceId(res.data?.data?.reference_id ?? res.data?.reference_id ?? "REF-SUBMITTED")
        } catch {
            setError("Could not submit your report. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const inputClasses =
        "w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2 text-sm font-medium text-brand-text focus:border-brand-text/50 focus:bg-brand-card focus:outline-none focus:ring-2 focus:ring-brand-text/20"

    if (referenceId) {
        return (
            <AppShell>
            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-text transition-colors hover:text-brand-text/70"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Home
                </Link>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-2xl bg-brand-card border border-brand-divider p-8 text-center shadow-sm"
                >
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                        <CheckCircle className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h2 className="text-xl font-bold text-brand-text">Report Submitted</h2>
                    <p className="mt-2 text-sm text-brand-highlight">
                        Your grievance has been received. We will review it and respond within 48 hours.
                    </p>
                    <div className="mt-4 rounded-xl bg-brand-secondary px-4 py-3">
                        <p className="text-xs text-brand-highlight">Reference ID</p>
                        <p className="text-lg font-bold text-brand-text font-mono">{referenceId}</p>
                    </div>
                </motion.div>
            </div>
            </AppShell>
        )
    }

    return (
        <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            {/* Back link */}
            <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-text transition-colors hover:text-brand-text/70"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Home
            </Link>

            {/* Page header */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-text/10">
                    <Flag className="h-5 w-5 text-brand-text" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-brand-text">Report a Problem</h1>
                    <p className="text-sm text-brand-highlight">
                        Submit a grievance and we will investigate.
                    </p>
                </div>
            </div>

            {/* Form */}
            <SectionCard
                icon={<Flag className="h-6 w-6 text-brand-text/50" />}
                title="Grievance Form"
                description="Provide details about your issue."
                delay={0.05}
            >
                <div className="space-y-5">
                    {/* Category */}
                    <div className="space-y-1.5">
                        <label htmlFor="category" className="block text-xs font-semibold text-brand-highlight">
                            Category *
                        </label>
                        <select
                            id="category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className={inputClasses}
                        >
                            <option value="">Select a category</option>
                            {CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                    {cat}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <label htmlFor="description" className="block text-xs font-semibold text-brand-highlight">
                            Description * <span className="text-brand-text/40">(min 50 characters)</span>
                        </label>
                        <textarea
                            id="description"
                            rows={5}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe the issue in detail..."
                            className={inputClasses + " resize-none"}
                        />
                        <p className="text-xs text-brand-text/40">
                            {description.length}/50 characters minimum
                        </p>
                    </div>

                    {/* Related content */}
                    <div className="space-y-1.5">
                        <label htmlFor="related" className="block text-xs font-semibold text-brand-highlight">
                            Related Content URL <span className="text-brand-text/40">(optional)</span>
                        </label>
                        <input
                            id="related"
                            type="url"
                            value={relatedContent}
                            onChange={(e) => setRelatedContent(e.target.value)}
                            placeholder="https://atpost.com/post/..."
                            className={inputClasses}
                        />
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                        <label htmlFor="email" className="block text-xs font-semibold text-brand-highlight">
                            Your Email *
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className={inputClasses}
                        />
                    </div>

                    {error && (
                        <p className="text-xs font-semibold text-red-500">{error}</p>
                    )}

                    {/* Submit */}
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit || isSubmitting}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand-text px-6 py-2.5 text-sm font-semibold text-brand-bg transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            "Submit Report"
                        )}
                    </button>
                </div>
            </SectionCard>

            {/* Grievance Officer Card */}
            <SectionCard
                icon={<Mail className="h-6 w-6 text-brand-text/50" />}
                title="Resident Grievance Officer"
                description="Contact our grievance officer for unresolved issues."
                delay={0.1}
            >
                <div className="rounded-xl bg-brand-secondary p-4 space-y-2">
                    <div className="text-sm">
                        <p className="font-semibold text-brand-text">Grievance Officer</p>
                        <p className="text-brand-highlight">VChat Platform</p>
                    </div>
                    <div className="text-sm text-brand-highlight">
                        <p>Email: grievance@atpost.com</p>
                        <p>Response time: Within 48 hours</p>
                        <p>Escalation: Within 15 days of initial complaint</p>
                    </div>
                </div>
            </SectionCard>
        </div>
        </AppShell>
    )
}

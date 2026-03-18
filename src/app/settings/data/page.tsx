"use client"

import { useState } from "react"
import AppShell from '@/components/AppShell'
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
    ArrowLeft,
    Download,
    Database,
    Trash2,
    Loader2,
    AlertTriangle,
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
/*  Delete Confirmation Modal                                           */
/* ------------------------------------------------------------------ */

function DeleteModal({
    open,
    onClose,
}: {
    open: boolean
    onClose: () => void
}) {
    const [confirmation, setConfirmation] = useState("")
    const [isDeleting, setIsDeleting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const canDelete = confirmation === "DELETE"

    const handleDelete = async () => {
        if (!canDelete) return
        setIsDeleting(true)
        setError(null)
        try {
            await api.delete("/v1/users/me")
            window.location.href = "/"
        } catch {
            setError("Could not delete account. Please try again.")
            setIsDeleting(false)
        }
    }

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-brand-text/40 backdrop-blur-sm p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-md rounded-2xl bg-brand-card border border-brand-divider p-6 shadow-xl"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                                <AlertTriangle className="h-5 w-5 text-rose-600" />
                            </div>
                            <h3 className="text-lg font-bold text-brand-text">Delete Account</h3>
                        </div>

                        <p className="text-sm text-brand-highlight mb-4">
                            This action is permanent and cannot be undone. All your posts, messages,
                            and data will be permanently deleted.
                        </p>

                        <div className="space-y-1.5 mb-4">
                            <label htmlFor="delete-confirm" className="block text-xs font-semibold text-brand-highlight">
                                Type <span className="font-bold text-brand-text">DELETE</span> to confirm
                            </label>
                            <input
                                id="delete-confirm"
                                type="text"
                                value={confirmation}
                                onChange={(e) => setConfirmation(e.target.value)}
                                placeholder="DELETE"
                                className="w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2 text-sm font-medium text-brand-text focus:border-rose-400 focus:bg-brand-card focus:outline-none focus:ring-2 focus:ring-rose-200"
                            />
                        </div>

                        {error && (
                            <p className="text-xs font-semibold text-red-500 mb-3">{error}</p>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 rounded-xl border border-brand-divider px-4 py-2 text-sm font-semibold text-brand-text transition-colors hover:bg-brand-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={!canDelete || isDeleting}
                                className="flex-1 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isDeleting ? (
                                    <span className="inline-flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Deleting...
                                    </span>
                                ) : (
                                    "Delete My Account"
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

export default function DataPage() {
    const [isDownloading, setIsDownloading] = useState(false)
    const [downloadMsg, setDownloadMsg] = useState<string | null>(null)
    const [showDeleteModal, setShowDeleteModal] = useState(false)

    const handleDownload = async () => {
        setIsDownloading(true)
        setDownloadMsg(null)
        try {
            const res = await api.get("/v1/auth/data-export")
            const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = "my-data.json"
            a.click()
            URL.revokeObjectURL(url)
            setDownloadMsg("Your data has been downloaded.")
        } catch {
            setDownloadMsg("Export failed. Please try again.")
        } finally {
            setIsDownloading(false)
        }
    }

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
                    <Database className="h-5 w-5 text-brand-text" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-brand-text">Your Data</h1>
                    <p className="text-sm text-brand-highlight">
                        Download, understand, and manage your personal data.
                    </p>
                </div>
            </div>

            {/* Card 1 — Download */}
            <SectionCard
                icon={<Download className="h-6 w-6 text-brand-text/50" />}
                title="Download Your Data"
                description="Get a copy of all your account data."
                delay={0.05}
            >
                <div className="space-y-3">
                    <p className="text-sm text-brand-highlight">
                        We will compile your profile information, posts, messages, and activity
                        into a single JSON file you can download.
                    </p>
                    <button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand-text px-5 py-2.5 text-sm font-semibold text-brand-bg transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                        {isDownloading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Preparing...
                            </>
                        ) : (
                            <>
                                <Download className="h-4 w-4" />
                                Request Data Download
                            </>
                        )}
                    </button>
                    {downloadMsg && (
                        <p className="text-xs font-semibold text-emerald-600">{downloadMsg}</p>
                    )}
                </div>
            </SectionCard>

            {/* Card 2 — What we collect */}
            <SectionCard
                icon={<Database className="h-6 w-6 text-brand-text/50" />}
                title="What we collect"
                description="Here is a summary of the data we store about you."
                delay={0.1}
            >
                <ul className="space-y-2 text-sm text-brand-highlight">
                    <li className="flex items-start gap-2">
                        <span className="text-brand-text mt-0.5 shrink-0">&#10022;</span>
                        <span>Profile information (name, bio, avatar, contact details)</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-brand-text mt-0.5 shrink-0">&#10022;</span>
                        <span>Posts, comments, and reactions you create</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-brand-text mt-0.5 shrink-0">&#10022;</span>
                        <span>Messages you send and receive</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-brand-text mt-0.5 shrink-0">&#10022;</span>
                        <span>Connections, follows, and group memberships</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-brand-text mt-0.5 shrink-0">&#10022;</span>
                        <span>Login history and device information</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-brand-text mt-0.5 shrink-0">&#10022;</span>
                        <span>Usage analytics (screen time, interactions)</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-brand-text mt-0.5 shrink-0">&#10022;</span>
                        <span>Payment and transaction records (if applicable)</span>
                    </li>
                </ul>
            </SectionCard>

            {/* Card 3 — Delete Account */}
            <SectionCard
                icon={<Trash2 className="h-6 w-6 text-rose-500/50" />}
                title="Delete Account"
                description="Permanently remove your account and all associated data."
                delay={0.15}
            >
                <div className="space-y-3">
                    <p className="text-sm text-brand-highlight">
                        Once deleted, your account cannot be recovered. All posts, messages,
                        and personal data will be permanently erased.
                    </p>
                    <button
                        onClick={() => setShowDeleteModal(true)}
                        className="rounded-xl border border-rose-300 px-5 py-2.5 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50"
                    >
                        Delete My Account
                    </button>
                </div>
            </SectionCard>

            <DeleteModal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} />
        </div>
        </AppShell>
    )
}

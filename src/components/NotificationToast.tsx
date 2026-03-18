"use client"

import React, { useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Bell, AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"

export interface NotificationToastData {
    id: string
    title: string
    body?: string
    imageUrl?: string
    deepLink?: string
    severity?: "normal" | "critical"
    duration?: number
}

interface NotificationToastProps {
    toast: NotificationToastData
    onDismiss: (id: string) => void
}

/**
 * Individual notification toast — slides in from the right.
 *
 * - Normal severity: auto-dismisses after `duration` (default 5s)
 * - Critical severity: shows a persistent banner with alert styling,
 *   auto-dismisses after 10s
 * - Clicking the body navigates to `deepLink`
 */
function NotificationToastItem({ toast, onDismiss }: NotificationToastProps) {
    const router = useRouter()
    const isCritical = toast.severity === "critical"
    const dismissDelay = toast.duration ?? (isCritical ? 10_000 : 5_000)

    useEffect(() => {
        const timer = setTimeout(() => onDismiss(toast.id), dismissDelay)
        return () => clearTimeout(timer)
    }, [toast.id, dismissDelay, onDismiss])

    const handleClick = () => {
        if (toast.deepLink) {
            router.push(toast.deepLink)
        }
        onDismiss(toast.id)
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 80, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={`
                relative w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl shadow-xl border backdrop-blur-md
                cursor-pointer overflow-hidden
                ${isCritical
                    ? "bg-rose-50/95 border-rose-200 dark:bg-rose-950/90 dark:border-rose-800"
                    : "bg-brand-card/95 border-brand-divider dark:bg-brand-card/90"
                }
            `}
            onClick={handleClick}
        >
            {/* Progress bar */}
            <motion.div
                className={`absolute bottom-0 left-0 h-[2px] ${
                    isCritical ? "bg-rose-400" : "bg-brand-accent"
                }`}
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: dismissDelay / 1000, ease: "linear" }}
            />

            <div className="flex items-start gap-3 p-3.5">
                {/* Icon / Image */}
                {toast.imageUrl ? (
                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-brand-divider flex-shrink-0">
                        <img
                            src={toast.imageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                    </div>
                ) : (
                    <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isCritical
                                ? "bg-rose-100 text-rose-600 dark:bg-rose-900 dark:text-rose-300"
                                : "bg-brand-secondary text-brand-accent"
                        }`}
                    >
                        {isCritical ? (
                            <AlertTriangle size={18} />
                        ) : (
                            <Bell size={18} />
                        )}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p
                        className={`text-[11px] font-black uppercase tracking-widest leading-snug ${
                            isCritical
                                ? "text-rose-700 dark:text-rose-200"
                                : "text-brand-text"
                        }`}
                    >
                        {toast.title}
                    </p>
                    {toast.body && (
                        <p
                            className={`text-[10px] font-bold mt-0.5 leading-snug line-clamp-2 ${
                                isCritical
                                    ? "text-rose-600/80 dark:text-rose-300/80"
                                    : "text-brand-text/60"
                            }`}
                        >
                            {toast.body}
                        </p>
                    )}
                </div>

                {/* Dismiss button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onDismiss(toast.id)
                    }}
                    className={`w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 transition-colors ${
                        isCritical
                            ? "text-rose-400 hover:bg-rose-200/50 dark:hover:bg-rose-800/50"
                            : "text-brand-text/30 hover:text-brand-text/60 hover:bg-brand-secondary"
                    }`}
                >
                    <X size={14} />
                </button>
            </div>
        </motion.div>
    )
}

// ---------------------------------------------------------------------------
// Container — renders a stack of toasts, fixed top-right
// ---------------------------------------------------------------------------

interface NotificationToastContainerProps {
    toasts: NotificationToastData[]
    onDismiss: (id: string) => void
}

export function NotificationToastContainer({ toasts, onDismiss }: NotificationToastContainerProps) {
    const handleDismiss = useCallback(
        (id: string) => onDismiss(id),
        [onDismiss]
    )

    return (
        <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
            <AnimatePresence mode="popLayout">
                {toasts.map((t) => (
                    <div key={t.id} className="pointer-events-auto">
                        <NotificationToastItem toast={t} onDismiss={handleDismiss} />
                    </div>
                ))}
            </AnimatePresence>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Hook — manages toast state; wire into useNotificationSocket
// ---------------------------------------------------------------------------

import { useState } from "react"

/**
 * Hook to manage notification toast state.
 *
 * Usage:
 *   const { toasts, addToast, dismissToast, ToastContainer } = useNotificationToasts()
 *   // In your notification listener:
 *   addToast({ id: notif.id, title: "New comment", body: "...", deepLink: "/post/123" })
 *   // In your JSX:
 *   <ToastContainer />
 */
export function useNotificationToasts() {
    const [toasts, setToasts] = useState<NotificationToastData[]>([])

    const addToast = useCallback((toast: NotificationToastData) => {
        setToasts((prev) => {
            // Deduplicate by id
            if (prev.some((t) => t.id === toast.id)) return prev
            // Max 5 visible toasts
            return [toast, ...prev].slice(0, 5)
        })
    }, [])

    const dismissToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
    }, [])

    const Container = useCallback(
        () => <NotificationToastContainer toasts={toasts} onDismiss={dismissToast} />,
        [toasts, dismissToast]
    )

    return { toasts, addToast, dismissToast, ToastContainer: Container }
}

export default NotificationToastItem

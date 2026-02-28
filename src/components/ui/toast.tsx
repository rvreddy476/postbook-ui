"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ToastType = "success" | "error" | "info" | "warning"

export interface ToastData {
    id: string
    type: ToastType
    title: string
    description?: string
    customContent?: React.ReactNode
}

/* ------------------------------------------------------------------ */
/*  Style maps                                                         */
/* ------------------------------------------------------------------ */

const iconMap: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="h-5 w-5 text-emerald-600" />,
    error: <XCircle className="h-5 w-5 text-rose-600" />,
    info: <Info className="h-5 w-5 text-violet-600" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-600" />,
}

const containerStyles: Record<ToastType, string> = {
    success: "border-emerald-200 bg-emerald-50",
    error: "border-rose-200 bg-rose-50",
    info: "border-violet-200 bg-violet-50",
    warning: "border-amber-200 bg-amber-50",
}

const titleStyles: Record<ToastType, string> = {
    success: "text-emerald-800",
    error: "text-rose-800",
    info: "text-violet-800",
    warning: "text-amber-800",
}

const descStyles: Record<ToastType, string> = {
    success: "text-emerald-700",
    error: "text-rose-700",
    info: "text-violet-700",
    warning: "text-amber-700",
}

const progressStyles: Record<ToastType, string> = {
    success: "bg-emerald-400",
    error: "bg-rose-400",
    info: "bg-violet-400",
    warning: "bg-amber-400",
}

/* ------------------------------------------------------------------ */
/*  Single Toast                                                       */
/* ------------------------------------------------------------------ */

const DISMISS_MS = 5000

function ToastItem({
    toast,
    onDismiss,
}: {
    toast: ToastData
    onDismiss: (id: string) => void
}) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={`pointer-events-auto relative w-80 overflow-hidden rounded-2xl border shadow-lg ${containerStyles[toast.type]}`}
        >
            {toast.customContent ? (
                <div className="relative">
                    {toast.customContent}
                    <button
                        onClick={() => onDismiss(toast.id)}
                        className="absolute top-2 right-2 shrink-0 rounded-full p-1 transition-colors hover:bg-black/5"
                    >
                        <X className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                </div>
            ) : (
                <div className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 shrink-0">{iconMap[toast.type]}</span>
                    <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold ${titleStyles[toast.type]}`}>
                            {toast.title}
                        </p>
                        {toast.description && (
                            <p className={`mt-0.5 text-xs ${descStyles[toast.type]}`}>
                                {toast.description}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => onDismiss(toast.id)}
                        className="shrink-0 rounded-full p-1 transition-colors hover:bg-black/5"
                    >
                        <X className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                </div>
            )}

            {/* Progress bar */}
            <motion.div
                className={`h-0.5 ${progressStyles[toast.type]}`}
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: DISMISS_MS / 1000, ease: "linear" }}
            />
        </motion.div>
    )
}

/* ------------------------------------------------------------------ */
/*  Toast Container                                                    */
/* ------------------------------------------------------------------ */

export function ToastContainer({ toasts, dismiss }: { toasts: ToastData[]; dismiss: (id: string) => void }) {
    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 pointer-events-none">
            <AnimatePresence mode="popLayout">
                {toasts.map((t) => (
                    <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
                ))}
            </AnimatePresence>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

let counter = 0

export function useToast() {
    const [toasts, setToasts] = useState<ToastData[]>([])
    const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

    const dismiss = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
        const timer = timersRef.current.get(id)
        if (timer) {
            clearTimeout(timer)
            timersRef.current.delete(id)
        }
    }, [])

    const toast = useCallback(
        ({
            type = "info",
            title,
            description,
            customContent,
        }: {
            type?: ToastType
            title: string
            description?: string
            customContent?: React.ReactNode
        }) => {
            const id = `toast-${++counter}-${Date.now()}`
            const newToast: ToastData = { id, type, title, description, customContent }

            setToasts((prev) => {
                // Keep max 3 — remove the oldest if at capacity
                const updated = [...prev, newToast]
                if (updated.length > 3) {
                    const removed = updated[0]
                    const timer = timersRef.current.get(removed.id)
                    if (timer) {
                        clearTimeout(timer)
                        timersRef.current.delete(removed.id)
                    }
                    return updated.slice(1)
                }
                return updated
            })

            const timer = setTimeout(() => {
                dismiss(id)
            }, DISMISS_MS)
            timersRef.current.set(id, timer)

            return id
        },
        [dismiss]
    )

    // Cleanup all timers on unmount
    useEffect(() => {
        const timers = timersRef.current
        return () => {
            timers.forEach((t) => clearTimeout(t))
            timers.clear()
        }
    }, [])

    const Container = useCallback(
        () => <ToastContainer toasts={toasts} dismiss={dismiss} />,
        [toasts, dismiss]
    )

    return { toast, ToastContainer: Container }
}

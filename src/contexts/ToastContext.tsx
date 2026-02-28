"use client"

import React, { createContext, useContext } from "react"
import { useToast, ToastData } from "@/components/ui/toast"

type ToastFn = (opts: {
    type?: "success" | "error" | "info" | "warning"
    title: string
    description?: string
    customContent?: React.ReactNode
}) => string

interface ToastContextValue {
    toast: ToastFn
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const { toast, ToastContainer } = useToast()

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <ToastContainer />
        </ToastContext.Provider>
    )
}

export function useGlobalToast(): ToastFn {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error("useGlobalToast must be used within ToastProvider")
    return ctx.toast
}

"use client"

import { useCallback, useEffect, useRef } from "react"
import { X } from "lucide-react"

interface DialogProps {
    open: boolean
    onClose: () => void
    children: React.ReactNode
    title?: string
}

export function Dialog({ open, onClose, children, title }: DialogProps) {
    const overlayRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = ""
        }
        return () => {
            document.body.style.overflow = ""
        }
    }, [open])

    const handleOverlayClick = useCallback(
        (e: React.MouseEvent) => {
            if (e.target === overlayRef.current) onClose()
        },
        [onClose]
    )

    if (!open) return null

    return (
        <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        >
            <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl mx-4">
                <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-violet-100 bg-white rounded-t-2xl">
                    {title && <h2 className="text-lg font-semibold text-gray-900">{title}</h2>}
                    <button
                        onClick={onClose}
                        className="ml-auto p-1.5 rounded-full hover:bg-violet-50 transition-colors"
                    >
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    )
}

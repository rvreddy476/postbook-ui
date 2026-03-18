"use client"

import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
    open: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    description: string
    confirmLabel?: string
    cancelLabel?: string
    destructive?: boolean
    loading?: boolean
}

export function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    destructive = false,
    loading = false,
}: ConfirmDialogProps) {
    return (
        <Dialog open={open} onClose={onClose} title={title}>
            <div className="space-y-6">
                <p className="text-sm text-brand-text/80 leading-relaxed">
                    {description}
                </p>
                <div className="flex justify-end gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        disabled={loading}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={destructive ? "destructive" : "default"}
                        size="sm"
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading ? "Please wait..." : confirmLabel}
                    </Button>
                </div>
            </div>
        </Dialog>
    )
}

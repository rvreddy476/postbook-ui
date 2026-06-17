"use client"

import { X } from "lucide-react"
import { ImageAdjustEditor } from "./ImageAdjustEditor"

type ImageAdjustDialogProps = {
    file: File
    previewUrl?: string
    title: string
    outputWidth: number
    outputHeight: number
    onCancel: () => void
    onApply: (file: File) => void
    isApplying?: boolean
}

export function ImageAdjustDialog({
    file,
    previewUrl,
    title,
    outputWidth,
    outputHeight,
    onCancel,
    onApply,
    isApplying = false,
}: ImageAdjustDialogProps) {
    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
            <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-brand-divider bg-brand-card shadow-2xl">
                <div className="flex items-center justify-between border-b border-brand-divider px-4 py-3">
                    <div>
                        <h2 className="text-sm font-black text-brand-text">{title}</h2>
                        <p className="text-xs text-brand-text/50">Drag, zoom, or rotate before saving.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isApplying}
                        className="grid h-9 w-9 place-items-center rounded-xl text-brand-text/60 transition hover:bg-brand-secondary hover:text-brand-text disabled:opacity-50"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-4">
                    <div className="mx-auto aspect-square w-full max-w-md overflow-hidden rounded-2xl bg-black">
                        <ImageAdjustEditor
                            file={file}
                            previewUrl={previewUrl}
                            title={title}
                            outputWidth={outputWidth}
                            outputHeight={outputHeight}
                            isApplying={isApplying}
                            onCancel={onCancel}
                            onApply={onApply}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Loader2, RotateCcw, RotateCw, X, ZoomIn } from "lucide-react"
import { cn } from "@/lib/utils"

type ImageAdjustEditorProps = {
    file: File
    previewUrl?: string
    title: string
    outputWidth: number
    outputHeight: number
    onCancel: () => void
    onApply: (file: File) => void
    isApplying?: boolean
    className?: string
    compact?: boolean
}

type Point = { x: number; y: number }

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value))
}

function outputName(file: File) {
    const base = file.name.replace(/\.[^.]+$/, "") || "image"
    return `${base}-adjusted.jpg`
}

function rotatedBounds(width: number, height: number, degrees: number) {
    const radians = (Math.abs(degrees) * Math.PI) / 180
    const cos = Math.abs(Math.cos(radians))
    const sin = Math.abs(Math.sin(radians))
    return {
        width: width * cos + height * sin,
        height: width * sin + height * cos,
    }
}

export function ImageAdjustEditor({
    file,
    previewUrl,
    title,
    outputWidth,
    outputHeight,
    onCancel,
    onApply,
    isApplying = false,
    className,
    compact = false,
}: ImageAdjustEditorProps) {
    const createdImageUrl = useMemo(() => previewUrl ? null : URL.createObjectURL(file), [file, previewUrl])
    const imageUrl = previewUrl ?? createdImageUrl ?? ""
    const imageRef = useRef<HTMLImageElement | null>(null)
    const frameRef = useRef<HTMLDivElement | null>(null)
    const dragRef = useRef<{ pointerId: number; start: Point; origin: Point } | null>(null)
    const [frameSize, setFrameSize] = useState({ width: 1, height: 1 })
    const [zoom, setZoom] = useState(1)
    const [rotation, setRotation] = useState(0)
    const [pan, setPan] = useState<Point>({ x: 0, y: 0 })

    useEffect(() => {
        if (!createdImageUrl) return
        return () => URL.revokeObjectURL(createdImageUrl)
    }, [createdImageUrl])

    useEffect(() => {
        const frame = frameRef.current
        if (!frame) return
        const rect = frame.getBoundingClientRect()
        setFrameSize({ width: rect.width || 1, height: rect.height || 1 })
        const observer = new ResizeObserver(([entry]) => {
            const rect = entry.contentRect
            setFrameSize({ width: rect.width || 1, height: rect.height || 1 })
        })
        observer.observe(frame)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !isApplying) onCancel()
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [isApplying, onCancel])

    const previewPan = {
        x: (pan.x / outputWidth) * frameSize.width,
        y: (pan.y / outputHeight) * frameSize.height,
    }

    const movePan = useCallback(
        (next: Point) => {
            const maxX = outputWidth * 0.45 * zoom
            const maxY = outputHeight * 0.45 * zoom
            setPan({
                x: clamp(next.x, -maxX, maxX),
                y: clamp(next.y, -maxY, maxY),
            })
        },
        [outputHeight, outputWidth, zoom],
    )

    const reset = () => {
        setZoom(1)
        setRotation(0)
        setPan({ x: 0, y: 0 })
    }

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (isApplying) return
        event.currentTarget.setPointerCapture(event.pointerId)
        dragRef.current = {
            pointerId: event.pointerId,
            start: { x: event.clientX, y: event.clientY },
            origin: pan,
        }
    }

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        const dx = ((event.clientX - drag.start.x) / frameSize.width) * outputWidth
        const dy = ((event.clientY - drag.start.y) / frameSize.height) * outputHeight
        movePan({ x: drag.origin.x + dx, y: drag.origin.y + dy })
    }

    const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
    }

    const apply = async () => {
        const image = imageRef.current
        if (!image) return

        const canvas = document.createElement("canvas")
        canvas.width = outputWidth
        canvas.height = outputHeight
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, outputWidth, outputHeight)
        const bounds = rotatedBounds(image.naturalWidth, image.naturalHeight, rotation)
        const baseScale = Math.max(outputWidth / bounds.width, outputHeight / bounds.height)
        const scale = baseScale * zoom
        ctx.translate(outputWidth / 2 + pan.x, outputHeight / 2 + pan.y)
        ctx.rotate((rotation * Math.PI) / 180)
        ctx.scale(scale, scale)
        ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92))
        if (!blob) return
        onApply(new File([blob], outputName(file), { type: "image/jpeg", lastModified: Date.now() }))
    }

    return (
        <div className={cn("relative h-full w-full overflow-hidden bg-black", className)}>
            <div
                ref={frameRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                className="absolute inset-0 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
            >
                <img
                    ref={imageRef}
                    src={imageUrl}
                    alt=""
                    draggable={false}
                    onLoad={(event) => {
                        const rect = frameRef.current?.getBoundingClientRect()
                        if (rect) setFrameSize({ width: rect.width || 1, height: rect.height || 1 })
                    }}
                    onError={() => {
                        onCancel()
                    }}
                    className="absolute left-1/2 top-1/2 h-full w-full max-w-none select-none object-cover"
                    style={{
                        transform: `translate(-50%, -50%) translate(${previewPan.x}px, ${previewPan.y}px) rotate(${rotation}deg) scale(${zoom})`,
                    }}
                />
                <div className="pointer-events-none absolute inset-0 bg-black/10" />
                <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/35" />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,.22)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.22)_1px,transparent_1px)] bg-[size:33.333%_33.333%]" />
            </div>

            {!compact && (
                <div className="absolute left-4 top-4 rounded-xl bg-black/45 px-3 py-2 text-white backdrop-blur-md">
                    <div className="text-xs font-black uppercase tracking-wider">{title}</div>
                    <div className="text-[11px] text-white/70">Drag the image to adjust its position.</div>
                </div>
            )}

            <div
                className={cn(
                    "absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-2xl bg-black/55 p-2 text-white shadow-lg backdrop-blur-md",
                    compact && "inset-x-1 bottom-1 flex-wrap rounded-xl p-1.5",
                )}
            >
                <div className={cn("flex min-w-0 flex-1 items-center gap-2", compact && "basis-full")}>
                    <ZoomIn className="h-3.5 w-3.5 shrink-0 text-white/80" />
                    <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.01"
                        value={zoom}
                        disabled={isApplying}
                        onChange={(event) => setZoom(Number(event.target.value))}
                        className="min-w-0 flex-1 accent-white"
                        aria-label="Zoom"
                    />
                </div>

                <div className="flex shrink-0 items-center gap-1">
                    <button type="button" disabled={isApplying} onClick={() => setRotation((value) => value - 90)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/12 transition hover:bg-white/20 disabled:opacity-50" aria-label="Rotate left">
                        <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" disabled={isApplying} onClick={() => setRotation((value) => value + 90)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/12 transition hover:bg-white/20 disabled:opacity-50" aria-label="Rotate right">
                        <RotateCw className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" disabled={isApplying} onClick={reset} className="grid h-8 w-8 place-items-center rounded-lg bg-white/12 transition hover:bg-white/20 disabled:opacity-50" aria-label="Reset adjustments">
                        <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={onCancel} disabled={isApplying} className="grid h-8 w-8 place-items-center rounded-lg bg-white/12 transition hover:bg-white/20 disabled:opacity-50" aria-label="Cancel">
                        <X className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={apply} disabled={isApplying} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-black text-black transition hover:opacity-90 disabled:opacity-60">
                        {isApplying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        {!compact && "Save"}
                    </button>
                </div>
            </div>
        </div>
    )
}

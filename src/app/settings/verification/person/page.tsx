"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Camera, CheckCircle2, Fingerprint } from "lucide-react"
import {
    SELFIE_CLIP_MS,
    digilockerTarget,
    lastAttemptFailed,
    personStep,
    uploadMime,
    usePersonStatus,
    useStartPersonVerification,
    useSubmitPersonSelfie,
} from "@/hooks/usePersonVerification"
import { pickRecorderMime } from "@/features/dating/model/verification"
import { uploadSelfieClip } from "@/features/dating/api/media"
import { asServerError } from "../../_lib/saveFeedback"

/*
 * Settings › Get Verified › Verify you're a real person (15 Nov 2026). The
 * server's `next` decides the step: digilocker → selfie → done. Words match
 * the Android screen (:feature:profile PersonVerificationScreen).
 */

const PRIMARY =
    "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-text px-4 py-2.5 text-sm font-semibold text-brand-bg transition-opacity disabled:opacity-40"

function ErrorLine({ message }: { message: string | null }) {
    if (!message) return null
    return (
        <p className="text-xs font-medium text-danger" role="alert" data-person-error>
            {message}
        </p>
    )
}

function DigiLockerStep({ failed }: { failed: boolean }) {
    const start = useStartPersonVerification()
    return (
        <div className="space-y-4" data-person-step="digilocker">
            {failed && (
                <div className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-brand-text" data-person-failed>
                    Your last attempt didn&apos;t pass. You can try again.
                </div>
            )}
            <button
                type="button"
                className={PRIMARY}
                disabled={start.isPending}
                onClick={() =>
                    start.mutate(undefined, {
                        onSuccess: (r) => {
                            window.location.assign(digilockerTarget(r.authorize_url))
                        },
                    })
                }
            >
                {start.isPending ? "Opening DigiLocker…" : "Continue with DigiLocker"}
            </button>
            <p className="text-xs text-brand-highlight">You&apos;ll sign in to DigiLocker and come back here.</p>
            <ErrorLine message={start.error ? asServerError(start.error).message : null} />
        </div>
    )
}

function detectMime(): string {
    if (typeof window === "undefined" || typeof navigator === "undefined") return ""
    const Recorder = (window as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder
    return pickRecorderMime({
        hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === "function",
        hasMediaRecorder: typeof Recorder === "function",
        isTypeSupported: (mime) => Recorder?.isTypeSupported?.(mime) === true,
    })
}

function SelfieStep() {
    const submit = useSubmitPersonSelfie()
    const video = useRef<HTMLVideoElement>(null)
    const stream = useRef<MediaStream | null>(null)
    const [phase, setPhase] = useState<"idle" | "camera" | "recording" | "checking">("idle")
    const [note, setNote] = useState<string | null>(null)

    const stop = () => {
        stream.current?.getTracks().forEach((t) => t.stop())
        stream.current = null
    }
    useEffect(() => stop, [])

    const take = async () => {
        setNote(null)
        submit.reset()
        const mime = detectMime()
        if (!mime) return setNote("This browser can't record a selfie. Use the app on your phone.")
        let s: MediaStream
        try {
            s = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false,
            })
        } catch {
            return setNote("Allow the camera to take your selfie.")
        }
        stream.current = s
        setPhase("camera")
        if (video.current) {
            video.current.srcObject = s
            void video.current.play().catch(() => undefined)
        }
        const recorder = new MediaRecorder(s, { mimeType: mime, videoBitsPerSecond: 1_000_000 })
        const chunks: Blob[] = []
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data)
        }
        recorder.onstop = async () => {
            stop()
            const type = uploadMime(mime)
            const clip = new Blob(chunks, { type })
            if (clip.size === 0) {
                setPhase("idle")
                return setNote("The recording didn't work. Try again.")
            }
            setPhase("checking")
            try {
                const mediaId = await uploadSelfieClip(clip, type)
                submit.mutate(mediaId, { onSettled: () => setPhase("idle") })
            } catch {
                setPhase("idle")
                setNote("The selfie didn't upload. Check your connection and try again.")
            }
        }
        // A beat for the camera to settle, then a short clip.
        setTimeout(() => {
            setPhase("recording")
            recorder.start()
            setTimeout(() => recorder.state !== "inactive" && recorder.stop(), SELFIE_CLIP_MS)
        }, 600)
    }

    const busy = phase !== "idle" || submit.isPending
    return (
        <div className="space-y-4" data-person-step="selfie">
            <p className="text-sm text-brand-text">Now a quick selfie. Look at the camera and keep your face in the frame.</p>
            <div className={`overflow-hidden rounded-xl bg-black ${phase === "camera" || phase === "recording" ? "" : "hidden"}`}>
                <video ref={video} muted playsInline className="aspect-[4/3] w-full -scale-x-100 object-cover" />
            </div>
            <button type="button" className={PRIMARY} disabled={busy} onClick={() => void take()}>
                <Camera className="h-4 w-4" aria-hidden />
                {phase === "recording" ? "Recording…" : phase === "checking" || submit.isPending ? "Checking…" : "Take selfie"}
            </button>
            <ErrorLine message={note ?? (submit.error ? asServerError(submit.error).message : null)} />
        </div>
    )
}

export default function PersonVerificationPage() {
    const { data, isLoading } = usePersonStatus()
    const status = data?.status ?? null
    const step = personStep(status, data?.off ?? false)

    return (
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
            <Link
                href="/settings/verification"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-text transition-colors hover:text-danger"
            >
                <ArrowLeft className="h-4 w-4" />
                Back
            </Link>
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-text/10">
                    <Fingerprint className="h-5 w-5 text-brand-text" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-brand-text">Verify you&apos;re a real person</h1>
                    <p className="text-sm text-brand-highlight">
                        We check your Aadhaar through DigiLocker, then take a quick selfie to match it. Your display name
                        must match the name on your Aadhaar.
                    </p>
                </div>
            </div>
            <div className="space-y-6 rounded-2xl border border-brand-text/10 bg-brand-card p-6 shadow-xs">
                {isLoading && <p className="text-sm text-brand-highlight">Loading…</p>}
                {!isLoading && step === "off" && (
                    <p className="text-sm text-brand-highlight" data-person-step="off">
                        Identity verification is not available yet.
                    </p>
                )}
                {!isLoading && step === "digilocker" && <DigiLockerStep failed={lastAttemptFailed(status)} />}
                {!isLoading && step === "selfie" && <SelfieStep />}
                {!isLoading && step === "done" && (
                    <div className="flex flex-col items-center gap-3 py-4 text-center" data-person-step="done">
                        <CheckCircle2 className="h-14 w-14 text-success" aria-hidden />
                        <h2 className="text-lg font-bold text-brand-text">You&apos;re verified</h2>
                        <p className="text-sm text-brand-highlight">Your account is verified as a real person.</p>
                        <Link href="/settings/verification/official" className={`${PRIMARY} mt-2 max-w-xs`}>
                            Apply for the Official mark
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}

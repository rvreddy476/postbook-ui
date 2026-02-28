"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
    ArrowLeft,
    Shield,
    ShieldCheck,
    Laptop,
    Smartphone,
    Monitor,
    Globe,
    Copy,
    Check,
    Loader2,
    AlertTriangle,
    KeyRound,
    LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import {
    useSetup2FA,
    useVerify2FASetup,
    useDisable2FA,
    useSessions,
    useRevokeSession,
    useLogoutAll,
    type Setup2FAResponse,
    type Session,
} from "@/hooks/useSecurity"

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TWO_FA_KEY = "postbook_2fa_enabled"

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseUserAgent(ua: string): string {
    if (!ua) return "Unknown device"

    let browser = "Unknown browser"
    if (ua.includes("Edg/")) browser = "Edge"
    else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera"
    else if (ua.includes("Chrome/")) browser = "Chrome"
    else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari"
    else if (ua.includes("Firefox/")) browser = "Firefox"

    let os = "Unknown OS"
    if (ua.includes("Windows")) os = "Windows"
    else if (ua.includes("Mac OS")) os = "macOS"
    else if (ua.includes("Linux")) os = "Linux"
    else if (ua.includes("Android")) os = "Android"
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS"

    return `${browser} on ${os}`
}

function getPlatformIcon(platform: string) {
    const p = platform.toLowerCase()
    if (p.includes("mobile") || p.includes("android") || p.includes("ios")) {
        return <Smartphone className="h-5 w-5 text-violet-500" />
    }
    if (p.includes("desktop") || p.includes("windows") || p.includes("mac") || p.includes("linux")) {
        return <Monitor className="h-5 w-5 text-violet-500" />
    }
    if (p.includes("web")) {
        return <Globe className="h-5 w-5 text-violet-500" />
    }
    return <Laptop className="h-5 w-5 text-violet-500" />
}

function formatDate(iso: string): string {
    try {
        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        }).format(new Date(iso))
    } catch {
        return iso
    }
}

/* ------------------------------------------------------------------ */
/*  2FA Enable Dialog                                                  */
/* ------------------------------------------------------------------ */

function Enable2FADialog({
    open,
    onClose,
    onEnabled,
    toast,
}: {
    open: boolean
    onClose: () => void
    onEnabled: () => void
    toast: (opts: { type?: "success" | "error" | "info" | "warning"; title: string; description?: string }) => string
}) {
    const [step, setStep] = useState(1)
    const [setupData, setSetupData] = useState<Setup2FAResponse | null>(null)
    const [verifyCode, setVerifyCode] = useState("")
    const [copied, setCopied] = useState(false)
    const [copiedCodes, setCopiedCodes] = useState(false)
    const [error, setError] = useState("")

    const setup2FA = useSetup2FA()
    const verify2FA = useVerify2FASetup()

    // Initiate setup when dialog opens
    useEffect(() => {
        if (open && !setupData && !setup2FA.isPending) {
            setup2FA.mutate(undefined, {
                onSuccess: (data) => {
                    setSetupData(data)
                },
                onError: (err) => {
                    const message =
                        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                        "Failed to initiate 2FA setup. Please try again."
                    toast({ type: "error", title: "Setup Failed", description: message })
                    onClose()
                },
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setStep(1)
            setSetupData(null)
            setVerifyCode("")
            setCopied(false)
            setCopiedCodes(false)
            setError("")
        }
    }, [open])

    const handleCopySecret = useCallback(() => {
        if (setupData?.secret) {
            navigator.clipboard.writeText(setupData.secret)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }, [setupData])

    const handleVerify = useCallback(() => {
        if (verifyCode.length !== 6) {
            setError("Please enter a 6-digit code")
            return
        }
        setError("")
        verify2FA.mutate(verifyCode, {
            onSuccess: () => {
                setStep(3)
                toast({ type: "success", title: "2FA Enabled", description: "Two-factor authentication is now active." })
            },
            onError: (err) => {
                const message =
                    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                    "Invalid verification code. Please try again."
                setError(message)
            },
        })
    }, [verifyCode, verify2FA, toast])

    const handleCopyAllCodes = useCallback(() => {
        if (setupData?.recovery_codes) {
            navigator.clipboard.writeText(setupData.recovery_codes.join("\n"))
            setCopiedCodes(true)
            setTimeout(() => setCopiedCodes(false), 2000)
        }
    }, [setupData])

    const handleDone = useCallback(() => {
        onEnabled()
        onClose()
    }, [onEnabled, onClose])

    return (
        <Dialog open={open} onClose={onClose} title="Enable Two-Factor Authentication">
            <AnimatePresence mode="wait">
                {setup2FA.isPending && (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center py-12"
                    >
                        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                        <p className="mt-3 text-sm text-slate-500">Setting up 2FA...</p>
                    </motion.div>
                )}

                {/* Step 1: QR Code & Secret */}
                {!setup2FA.isPending && step === 1 && setupData && (
                    <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-5"
                    >
                        <div className="space-y-1">
                            <h3 className="text-sm font-semibold text-slate-900">
                                Step 1: Set up your authenticator app
                            </h3>
                            <p className="text-xs text-slate-500">
                                Scan the QR code below with your authenticator app (Google Authenticator, Authy, etc.)
                                or manually enter the secret key.
                            </p>
                        </div>

                        {/* QR code URL for the user to scan */}
                        <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                            <p className="mb-2 text-xs font-semibold text-slate-600">QR Code URL</p>
                            <p className="break-all rounded-lg bg-white p-3 font-mono text-xs text-slate-700 border border-slate-200">
                                {setupData.qr_code_url}
                            </p>
                        </div>

                        {/* Secret key */}
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-slate-600">Secret Key</p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm tracking-wider text-slate-800">
                                    {setupData.secret}
                                </code>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopySecret}
                                    className="shrink-0"
                                >
                                    {copied ? (
                                        <Check className="h-4 w-4 text-emerald-500" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>

                        <Button
                            onClick={() => setStep(2)}
                            className="w-full orchid-gradient text-white"
                            size="lg"
                        >
                            Next
                        </Button>
                    </motion.div>
                )}

                {/* Step 2: Verify Code */}
                {step === 2 && (
                    <motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-5"
                    >
                        <div className="space-y-1">
                            <h3 className="text-sm font-semibold text-slate-900">
                                Step 2: Verify your authenticator
                            </h3>
                            <p className="text-xs text-slate-500">
                                Enter the 6-digit code from your authenticator app to confirm the setup.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600">Verification Code</label>
                            <Input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                placeholder="000000"
                                value={verifyCode}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, "").slice(0, 6)
                                    setVerifyCode(val)
                                    if (error) setError("")
                                }}
                                className="text-center font-mono text-lg tracking-[0.5em]"
                            />
                        </div>

                        {error && (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setStep(1)}
                                className="flex-1"
                            >
                                Back
                            </Button>
                            <Button
                                onClick={handleVerify}
                                disabled={verify2FA.isPending || verifyCode.length !== 6}
                                className="flex-1 orchid-gradient text-white"
                            >
                                {verify2FA.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    "Verify"
                                )}
                            </Button>
                        </div>
                    </motion.div>
                )}

                {/* Step 3: Recovery Codes */}
                {step === 3 && setupData && (
                    <motion.div
                        key="step3"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-5"
                    >
                        <div className="space-y-1">
                            <h3 className="text-sm font-semibold text-slate-900">
                                Step 3: Save your recovery codes
                            </h3>
                            <p className="text-xs text-slate-500">
                                These codes can be used to access your account if you lose your authenticator device.
                                Each code can only be used once.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                <p className="text-sm font-semibold text-amber-700">
                                    Save these codes in a safe place! You will not be able to see them again.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {setupData.recovery_codes.map((code) => (
                                <div
                                    key={code}
                                    className="rounded-lg bg-slate-100 px-3 py-2 text-center font-mono text-sm tracking-wider text-slate-800"
                                >
                                    {code}
                                </div>
                            ))}
                        </div>

                        <Button
                            variant="outline"
                            onClick={handleCopyAllCodes}
                            className="w-full"
                        >
                            {copiedCodes ? (
                                <>
                                    <Check className="h-4 w-4 text-emerald-500" />
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <Copy className="h-4 w-4" />
                                    Copy All Codes
                                </>
                            )}
                        </Button>

                        <Button
                            onClick={handleDone}
                            className="w-full orchid-gradient text-white"
                            size="lg"
                        >
                            Done
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </Dialog>
    )
}

/* ------------------------------------------------------------------ */
/*  2FA Disable Dialog                                                 */
/* ------------------------------------------------------------------ */

function Disable2FADialog({
    open,
    onClose,
    onDisabled,
    toast,
}: {
    open: boolean
    onClose: () => void
    onDisabled: () => void
    toast: (opts: { type?: "success" | "error" | "info" | "warning"; title: string; description?: string }) => string
}) {
    const [password, setPassword] = useState("")
    const [code, setCode] = useState("")
    const [error, setError] = useState("")

    const disable2FA = useDisable2FA()

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setPassword("")
            setCode("")
            setError("")
        }
    }, [open])

    const handleDisable = useCallback(() => {
        if (!password.trim()) {
            setError("Password is required")
            return
        }
        if (code.length !== 6) {
            setError("Please enter a 6-digit code")
            return
        }
        setError("")

        disable2FA.mutate(
            { password, code },
            {
                onSuccess: () => {
                    toast({
                        type: "success",
                        title: "2FA Disabled",
                        description: "Two-factor authentication has been disabled.",
                    })
                    onDisabled()
                    onClose()
                },
                onError: (err) => {
                    const message =
                        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                        "Failed to disable 2FA. Check your password and code."
                    setError(message)
                },
            }
        )
    }, [password, code, disable2FA, toast, onDisabled, onClose])

    return (
        <Dialog open={open} onClose={onClose} title="Disable Two-Factor Authentication">
            <div className="space-y-5">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <p className="text-sm font-semibold text-amber-700">
                            Disabling 2FA will make your account less secure. You will need to set it up again if you want to re-enable it.
                        </p>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600">Password</label>
                    <Input
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value)
                            if (error) setError("")
                        }}
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600">Authentication Code</label>
                    <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="000000"
                        value={code}
                        onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 6)
                            setCode(val)
                            if (error) setError("")
                        }}
                        className="text-center font-mono text-lg tracking-[0.5em]"
                    />
                </div>

                {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                        {error}
                    </div>
                )}

                <div className="flex gap-3">
                    <Button variant="outline" onClick={onClose} className="flex-1">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDisable}
                        disabled={disable2FA.isPending}
                        className="flex-1 bg-rose-600 text-white hover:bg-rose-700"
                    >
                        {disable2FA.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            "Disable 2FA"
                        )}
                    </Button>
                </div>
            </div>
        </Dialog>
    )
}

/* ------------------------------------------------------------------ */
/*  Session Item                                                       */
/* ------------------------------------------------------------------ */

function SessionItem({
    session,
    isCurrent,
    onRevoke,
    isRevoking,
}: {
    session: Session
    isCurrent: boolean
    onRevoke: (id: string) => void
    isRevoking: boolean
}) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white/60 px-4 py-3 transition-colors hover:bg-white/80"
        >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50">
                {getPlatformIcon(session.platform)}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">
                        {parseUserAgent(session.user_agent)}
                    </p>
                    {isCurrent && (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            Current
                        </span>
                    )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                    <span>{session.ip}</span>
                    <span className="text-slate-300">|</span>
                    <span>{formatDate(session.created_at)}</span>
                </div>
            </div>
            {!isCurrent && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRevoke(session.id)}
                    disabled={isRevoking}
                    className="shrink-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                >
                    {isRevoking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Revoke"}
                </Button>
            )}
        </motion.div>
    )
}

/* ------------------------------------------------------------------ */
/*  Session Skeleton                                                   */
/* ------------------------------------------------------------------ */

function SessionSkeleton() {
    return (
        <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white/60 px-4 py-3">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-200" />
            <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
            </div>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function SecuritySettingsPage() {
    const router = useRouter()
    const { toast, ToastContainer } = useToast()

    // 2FA state — persisted in localStorage
    const [is2FAEnabled, setIs2FAEnabled] = useState(false)
    const [enableDialogOpen, setEnableDialogOpen] = useState(false)
    const [disableDialogOpen, setDisableDialogOpen] = useState(false)

    // Read 2FA flag from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(TWO_FA_KEY)
            if (stored === "true") setIs2FAEnabled(true)
        } catch {
            // localStorage not available
        }
    }, [])

    const handle2FAEnabled = useCallback(() => {
        setIs2FAEnabled(true)
        try {
            localStorage.setItem(TWO_FA_KEY, "true")
        } catch {
            // ignore
        }
    }, [])

    const handle2FADisabled = useCallback(() => {
        setIs2FAEnabled(false)
        try {
            localStorage.removeItem(TWO_FA_KEY)
        } catch {
            // ignore
        }
    }, [])

    // Sessions
    const { data: sessions, isLoading: sessionsLoading, error: sessionsError } = useSessions()
    const revokeSession = useRevokeSession()
    const logoutAll = useLogoutAll()
    const [revokingId, setRevokingId] = useState<string | null>(null)

    // Determine current session (best effort — first session or one matching device)
    const currentSessionId = useMemo(() => {
        if (!sessions || sessions.length === 0) return null
        // The most recently created session is likely the current one
        const sorted = [...sessions].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        return sorted[0].id
    }, [sessions])

    const handleRevokeSession = useCallback(
        (sessionId: string) => {
            setRevokingId(sessionId)
            revokeSession.mutate(sessionId, {
                onSuccess: () => {
                    toast({ type: "success", title: "Session Revoked", description: "The session has been terminated." })
                    setRevokingId(null)
                },
                onError: (err) => {
                    const message =
                        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                        "Failed to revoke session."
                    toast({ type: "error", title: "Error", description: message })
                    setRevokingId(null)
                },
            })
        },
        [revokeSession, toast]
    )

    const handleLogoutAll = useCallback(() => {
        logoutAll.mutate(undefined, {
            onSuccess: (data) => {
                toast({
                    type: "success",
                    title: "All Sessions Revoked",
                    description: `${data.sessions_revoked} session(s) have been terminated.`,
                })
            },
            onError: (err) => {
                const message =
                    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                    "Failed to revoke all sessions."
                toast({ type: "error", title: "Error", description: message })
            },
        })
    }, [logoutAll, toast])

    // Show error toast for session fetching failure
    useEffect(() => {
        if (sessionsError) {
            console.error("[SecuritySettings]", "Failed to load sessions", sessionsError)
            toast({
                type: "error",
                title: "Failed to load sessions",
                description: "Could not retrieve your active sessions.",
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionsError])

    const otherSessions = useMemo(
        () => (sessions ?? []).filter((s) => s.id !== currentSessionId),
        [sessions, currentSessionId]
    )

    return (
        <>
            <ToastContainer />

            {/* Enable / Disable 2FA Dialogs */}
            <Enable2FADialog
                open={enableDialogOpen}
                onClose={() => setEnableDialogOpen(false)}
                onEnabled={handle2FAEnabled}
                toast={toast}
            />
            <Disable2FADialog
                open={disableDialogOpen}
                onClose={() => setDisableDialogOpen(false)}
                onDisabled={handle2FADisabled}
                toast={toast}
            />

            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
                {/* Back button */}
                <button
                    onClick={() => router.push("/settings/profile")}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 transition-colors hover:text-violet-800"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Profile Settings
                </button>

                {/* Page title */}
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Security Settings</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Manage your account security, two-factor authentication, and active sessions.
                    </p>
                </div>

                {/* --------------------------------------------------------- */}
                {/*  Two-Factor Authentication Card                           */}
                {/* --------------------------------------------------------- */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="rounded-2xl bg-white border border-violet-100 shadow-sm"
                >
                    <div className="p-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50">
                                {is2FAEnabled ? (
                                    <ShieldCheck className="h-6 w-6 text-emerald-500" />
                                ) : (
                                    <Shield className="h-6 w-6 text-violet-500" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-bold text-slate-900">
                                        Two-Factor Authentication
                                    </h2>
                                    {is2FAEnabled && (
                                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                            Enabled
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1 text-sm text-slate-500">
                                    {is2FAEnabled
                                        ? "Your account is protected with an additional authentication step."
                                        : "Add an extra layer of security to your account by requiring a code from your authenticator app."}
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 flex items-center gap-3">
                            {is2FAEnabled ? (
                                <Button
                                    onClick={() => setDisableDialogOpen(true)}
                                    className="bg-rose-600 text-white hover:bg-rose-700"
                                >
                                    <KeyRound className="h-4 w-4" />
                                    Disable 2FA
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => setEnableDialogOpen(true)}
                                    className="orchid-gradient text-white"
                                >
                                    <Shield className="h-4 w-4" />
                                    Enable 2FA
                                </Button>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* --------------------------------------------------------- */}
                {/*  Active Sessions Card                                     */}
                {/* --------------------------------------------------------- */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-2xl bg-white border border-violet-100 shadow-sm"
                >
                    <div className="p-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50">
                                <Laptop className="h-6 w-6 text-violet-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h2 className="text-lg font-bold text-slate-900">Active Sessions</h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Devices and browsers where your account is currently signed in.
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 space-y-2">
                            {/* Loading skeletons */}
                            {sessionsLoading && (
                                <div className="space-y-2">
                                    <SessionSkeleton />
                                    <SessionSkeleton />
                                    <SessionSkeleton />
                                </div>
                            )}

                            {/* Error state */}
                            {!sessionsLoading && sessionsError && (
                                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                                    Failed to load sessions. Please try again later.
                                </div>
                            )}

                            {/* Empty state */}
                            {!sessionsLoading && !sessionsError && sessions && sessions.length === 0 && (
                                <div className="py-8 text-center">
                                    <Laptop className="mx-auto h-10 w-10 text-slate-300" />
                                    <p className="mt-2 text-sm font-medium text-slate-500">
                                        No active sessions found.
                                    </p>
                                </div>
                            )}

                            {/* Session list */}
                            {!sessionsLoading && sessions && sessions.length > 0 && (
                                <AnimatePresence mode="popLayout">
                                    {/* Current session first */}
                                    {sessions
                                        .filter((s) => s.id === currentSessionId)
                                        .map((s) => (
                                            <SessionItem
                                                key={s.id}
                                                session={s}
                                                isCurrent={true}
                                                onRevoke={handleRevokeSession}
                                                isRevoking={revokingId === s.id}
                                            />
                                        ))}
                                    {/* Other sessions */}
                                    {otherSessions.map((s) => (
                                        <SessionItem
                                            key={s.id}
                                            session={s}
                                            isCurrent={false}
                                            onRevoke={handleRevokeSession}
                                            isRevoking={revokingId === s.id}
                                        />
                                    ))}
                                </AnimatePresence>
                            )}
                        </div>

                        {/* Revoke all button */}
                        {!sessionsLoading && otherSessions.length > 0 && (
                            <div className="mt-4 border-t border-slate-100 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={handleLogoutAll}
                                    disabled={logoutAll.isPending}
                                    className="w-full text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                                >
                                    {logoutAll.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <LogOut className="h-4 w-4" />
                                    )}
                                    Revoke All Other Sessions
                                </Button>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </>
    )
}

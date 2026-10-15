"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog } from "@/components/ui/dialog"
import { logoutUser } from "@/services/authService"
import {
    deleteAccountErrorMessage,
    useDeleteAccount,
    type DeletionSchedule,
} from "@/hooks/useSecurity"

/**
 * The single account-deletion flow on the web, used by both Security and
 * Your Data. It re-verifies the password (DELETE /v1/auth/account with
 * {password}); the server schedules a purge 30 days out and revokes every
 * session, so on success this signs the browser out as well.
 */

const SIGN_OUT_DELAY_MS = 5000

function formatPurgeDate(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "in 30 days"
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
}

/** Clear this tab's session, then let the logout route clear the cookies. */
function signOutAfterDeletion() {
    try {
        logoutUser()
    } catch {
        // The navigation below still clears the cookies.
    }
    try {
        localStorage.removeItem("postbook_unread_state")
    } catch {
        // ignore
    }
    window.location.assign("/api/auth/logout")
}

export function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [confirmText, setConfirmText] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState("")
    const [scheduled, setScheduled] = useState<DeletionSchedule | null>(null)
    const deleteAccount = useDeleteAccount()
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (!open) {
            setConfirmText("")
            setPassword("")
            setShowPassword(false)
            setError("")
        }
    }, [open])

    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current)
    }, [])

    const canSubmit = confirmText === "DELETE" && password.length > 0 && !deleteAccount.isPending

    const handleDelete = useCallback(() => {
        if (confirmText !== "DELETE") {
            setError('Please type "DELETE" to confirm.')
            return
        }
        if (!password) {
            setError("Enter your password to confirm.")
            return
        }
        setError("")
        deleteAccount.mutate(password, {
            onSuccess: (schedule) => {
                setPassword("")
                setScheduled(schedule)
                // The server has already revoked every session; finish the
                // sign-out here after the user has had a moment to read this.
                timer.current = setTimeout(signOutAfterDeletion, SIGN_OUT_DELAY_MS)
            },
            onError: (err) => {
                setPassword("")
                setError(deleteAccountErrorMessage(err))
            },
        })
    }, [confirmText, password, deleteAccount])

    // Once scheduled, closing the dialog must not leave a signed-out session
    // looking signed in.
    const handleClose = scheduled ? signOutAfterDeletion : onClose

    return (
        <Dialog open={open || scheduled !== null} onClose={handleClose} title="Delete Account">
            {scheduled ? (
                <div className="space-y-5" role="status">
                    <p className="text-sm font-semibold text-brand-text">
                        Your account is scheduled for deletion on {formatPurgeDate(scheduled.scheduled_purge_date)}.
                    </p>
                    <p className="text-sm text-brand-highlight">
                        You have been signed out on every device. Sign in before that date if you change your mind;
                        signing in cancels the deletion.
                    </p>
                    <Button onClick={signOutAfterDeletion} className="w-full">
                        Sign out now
                    </Button>
                </div>
            ) : (
                <div className="space-y-5">
                    <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                            <div>
                                <p className="text-sm font-semibold text-danger">
                                    This action is irreversible after 30 days.
                                </p>
                                <p className="mt-1 text-xs text-brand-highlight">
                                    Your account and all associated data will be permanently deleted after a 30-day
                                    grace period. During this period, you can sign in to cancel the deletion.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="delete-confirm" className="text-xs font-semibold text-brand-highlight">
                            Type <strong className="text-danger">DELETE</strong> to confirm
                        </label>
                        <Input
                            id="delete-confirm"
                            type="text"
                            placeholder="DELETE"
                            autoComplete="off"
                            value={confirmText}
                            onChange={(e) => {
                                setConfirmText(e.target.value)
                                if (error) setError("")
                            }}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="delete-password" className="text-xs font-semibold text-brand-highlight">
                            Your password
                        </label>
                        <div className="relative">
                            <Input
                                id="delete-password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value)
                                    if (error) setError("")
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && canSubmit) handleDelete()
                                }}
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                className="absolute inset-y-0 right-0 flex items-center px-3 text-brand-text/60 hover:text-brand-text"
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger"
                        >
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <Button variant="outline" onClick={onClose} className="flex-1">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDelete}
                            disabled={!canSubmit}
                            className="flex-1 bg-danger text-white hover:opacity-90"
                        >
                            {deleteAccount.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                "Delete Account"
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </Dialog>
    )
}

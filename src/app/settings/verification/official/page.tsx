"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Building2, Clock, Landmark, ShieldCheck } from "lucide-react"
import {
    REGISTRATION_MAX,
    applicationComplete,
    lastRefused,
    markWords,
    officialStep,
    useAcceptGovernmentInvitation,
    useConfirmOfficialEmail,
    useOfficialStatus,
    useSubmitOfficial,
    type OfficialApplication,
    type OfficialStatus,
    type RegistrationKind,
} from "@/hooks/useOfficialMark"
import { asServerError } from "../../_lib/saveFeedback"

/*
 * Settings › Get Verified › Official mark (15 Nov 2026). The server's `next`
 * decides the step: apply → email_code → review → done. Words match the
 * Android screen (:feature:profile OfficialMarkScreen).
 */

const INPUT =
    "w-full rounded-xl border border-brand-divider bg-brand-card px-3 py-2.5 text-sm text-brand-text placeholder:text-brand-highlight/70 focus:border-brand-text/40 focus:outline-none"
const PRIMARY =
    "inline-flex w-full items-center justify-center rounded-xl bg-brand-text px-4 py-2.5 text-sm font-semibold text-brand-bg transition-opacity disabled:opacity-40"
const LINK = "text-sm font-semibold text-brand-text underline-offset-4 hover:underline"

function Field({
    id,
    label,
    helper,
    children,
}: {
    id: string
    label: string
    helper?: string
    children: React.ReactNode
}) {
    return (
        <div className="space-y-1.5">
            <label htmlFor={id} className="block text-xs font-semibold tracking-wide text-brand-highlight">
                {label}
            </label>
            {children}
            {helper && <p className="text-xs text-brand-highlight">{helper}</p>}
        </div>
    )
}

function ErrorLine({ error }: { error: unknown }) {
    if (!error) return null
    const e = asServerError(error)
    return (
        <div className="space-y-2">
            <p className="text-xs font-medium text-danger" role="alert" data-official-error>
                {e.message}
            </p>
            {/* The Official mark needs the person mark first (15 Nov 2026). */}
            {e.code === "PERSON_VERIFICATION_REQUIRED" && (
                <Link href="/settings/verification/person" className={LINK} data-official-person-link>
                    Verify you&apos;re a real person
                </Link>
            )}
        </div>
    )
}

function ApplyForm({ refused, onSubmitted }: { refused: boolean; onSubmitted: () => void }) {
    const [a, setA] = useState<OfficialApplication>({ legalName: "", kind: "gstin", number: "", domain: "", email: "" })
    const submit = useSubmitOfficial()
    const set = (patch: Partial<OfficialApplication>) => setA((prev) => ({ ...prev, ...patch }))

    return (
        <form
            className="space-y-5"
            data-official-step="apply"
            onSubmit={(e) => {
                e.preventDefault()
                if (applicationComplete(a)) submit.mutate(a, { onSuccess: onSubmitted })
            }}
        >
            {refused && (
                <div className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-brand-text" data-official-refused>
                    Your last application was not accepted.
                </div>
            )}
            <Field id="official-legal-name" label="Registered legal name" helper="As on the GST or company registration">
                <input
                    id="official-legal-name"
                    className={INPUT}
                    value={a.legalName}
                    maxLength={200}
                    onChange={(e) => set({ legalName: e.target.value })}
                />
            </Field>
            <div className="space-y-1.5">
                <div role="radiogroup" aria-label="Registration" className="inline-flex rounded-xl border border-brand-divider p-1">
                    {(["gstin", "cin"] as RegistrationKind[]).map((k) => (
                        <button
                            key={k}
                            type="button"
                            role="radio"
                            aria-checked={a.kind === k}
                            onClick={() => set({ kind: k, number: a.number.slice(0, REGISTRATION_MAX[k]) })}
                            className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${
                                a.kind === k ? "bg-brand-text text-brand-bg" : "text-brand-highlight"
                            }`}
                        >
                            {k.toUpperCase()}
                        </button>
                    ))}
                </div>
                <Field id="official-number" label={a.kind.toUpperCase()}>
                    <input
                        id="official-number"
                        className={`${INPUT} uppercase tracking-wider`}
                        value={a.number}
                        maxLength={REGISTRATION_MAX[a.kind]}
                        autoCapitalize="characters"
                        onChange={(e) => set({ number: e.target.value.toUpperCase() })}
                    />
                </Field>
            </div>
            <Field
                id="official-domain"
                label="Official domain"
                helper="Your organisation's own website, for example example.com"
            >
                <input
                    id="official-domain"
                    className={INPUT}
                    value={a.domain}
                    inputMode="url"
                    autoCapitalize="none"
                    maxLength={253}
                    onChange={(e) => set({ domain: e.target.value })}
                />
            </Field>
            <Field
                id="official-email"
                label="Signatory's work e-mail"
                helper="Must be on the official domain. We'll send a code there."
            >
                <input
                    id="official-email"
                    type="email"
                    className={INPUT}
                    value={a.email}
                    autoCapitalize="none"
                    maxLength={254}
                    onChange={(e) => set({ email: e.target.value })}
                />
            </Field>
            <button type="submit" className={PRIMARY} disabled={!applicationComplete(a) || submit.isPending}>
                {submit.isPending ? "Sending…" : "Send code"}
            </button>
            <ErrorLine error={submit.error} />
        </form>
    )
}

function CodeStep({ onStartAgain }: { onStartAgain: () => void }) {
    const [code, setCode] = useState("")
    const confirm = useConfirmOfficialEmail()
    return (
        <form
            className="space-y-4"
            data-official-step="email_code"
            onSubmit={(e) => {
                e.preventDefault()
                if (code.trim()) confirm.mutate(code)
            }}
        >
            <p className="text-sm text-brand-text">Enter the 6-digit code we sent to the signatory&apos;s work e-mail.</p>
            <input
                aria-label="Code"
                className={`${INPUT} tracking-[0.3em]`}
                value={code}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={16}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <button type="submit" className={PRIMARY} disabled={!code.trim() || confirm.isPending}>
                {confirm.isPending ? "Checking…" : "Confirm"}
            </button>
            <ErrorLine error={confirm.error} />
            <button type="button" className={LINK} onClick={onStartAgain}>
                Start again
            </button>
        </form>
    )
}

function GovernmentInvitation() {
    const [open, setOpen] = useState(false)
    const [code, setCode] = useState("")
    const accept = useAcceptGovernmentInvitation()
    if (!open) {
        return (
            <button type="button" className={LINK} onClick={() => setOpen(true)} data-official-gov-open>
                I have a Government invitation
            </button>
        )
    }
    return (
        <form
            className="space-y-3"
            data-official-gov
            onSubmit={(e) => {
                e.preventDefault()
                if (code.trim()) accept.mutate(code)
            }}
        >
            <Field id="official-invite" label="Invitation code">
                <input
                    id="official-invite"
                    className={INPUT}
                    value={code}
                    autoCapitalize="characters"
                    maxLength={64}
                    onChange={(e) => setCode(e.target.value)}
                />
            </Field>
            <button type="submit" className={PRIMARY} disabled={!code.trim() || accept.isPending}>
                {accept.isPending ? "Accepting…" : "Accept"}
            </button>
            <ErrorLine error={accept.error} />
        </form>
    )
}

function Done({ status }: { status: OfficialStatus }) {
    const w = markWords(status)
    const Icon = status.verification_level === "government" ? Landmark : ShieldCheck
    return (
        <div className="flex flex-col items-center gap-3 py-6 text-center" data-official-step="done">
            <Icon className="h-14 w-14 text-success" aria-hidden />
            <h2 className="text-lg font-bold text-brand-text">{w.heading}</h2>
            <p className="text-sm text-brand-highlight">{w.line}</p>
        </div>
    )
}

export default function OfficialMarkPage() {
    const { data, isLoading } = useOfficialStatus()
    const [restart, setRestart] = useState(false)
    const status = data?.status ?? null
    let step = officialStep(status, data?.off ?? false)
    if (restart && step === "email_code") step = "apply"

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
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-text/10">
                    <Building2 className="h-5 w-5 text-brand-text" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-brand-text">Official mark</h1>
                    <p className="text-sm text-brand-highlight">
                        For organisations, brands, media outlets and public bodies. Your account must already be
                        verified as a person.
                    </p>
                </div>
            </div>

            <div className="space-y-6 rounded-2xl border border-brand-text/10 bg-brand-card p-6 shadow-xs">
                {isLoading && <p className="text-sm text-brand-highlight">Loading…</p>}
                {!isLoading && step === "off" && (
                    <p className="text-sm text-brand-highlight" data-official-step="off">
                        Official verification is not available yet.
                    </p>
                )}
                {!isLoading && step === "apply" && <ApplyForm refused={!restart && lastRefused(status)} onSubmitted={() => setRestart(false)} />}
                {!isLoading && step === "email_code" && <CodeStep onStartAgain={() => setRestart(true)} />}
                {!isLoading && step === "review" && (
                    <div className="flex items-start gap-3" data-official-step="review">
                        <Clock className="mt-0.5 h-6 w-6 shrink-0 text-warning" aria-hidden />
                        <div>
                            <p className="text-sm font-semibold text-brand-text">Your application is being reviewed.</p>
                            <p className="text-sm text-brand-highlight">We&apos;ll let you know when it&apos;s done.</p>
                        </div>
                    </div>
                )}
                {!isLoading && step === "done" && status && <Done status={status} />}
                {!isLoading && step !== "done" && step !== "off" && (
                    <>
                        <hr className="border-brand-divider" />
                        <GovernmentInvitation />
                    </>
                )}
            </div>
        </div>
    )
}

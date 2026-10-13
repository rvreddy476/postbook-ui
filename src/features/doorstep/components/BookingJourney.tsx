"use client"

import Link from "next/link"
import { ArrowLeft, Check, LockKeyhole, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

const steps = ["Service", "Professional & time", "Review & pay"]

export function BookingSteps({ active, automatic = false }: { active: 0 | 1 | 2; automatic?: boolean }) {
  const labels = automatic ? ["Service", "Date & time", "Confirm & pay"] : steps
  return <nav className="dsc-journey" aria-label="Booking progress"><ol>{labels.map((label, i) => <li key={label} aria-current={i === active ? "step" : undefined} className={i < active ? "is-complete" : ""}><span aria-hidden>{i < active ? <Check size={14} /> : i + 1}</span><strong>{label}</strong></li>)}</ol><span className="dsc-journey__secure"><LockKeyhole size={14} aria-hidden />Secure booking</span></nav>
}

export function BookingHeading({ title, description, back, backLabel = "Back to services", active, automatic = false }: { title: string; description: string; back: string; backLabel?: string; active: 0 | 1 | 2; automatic?: boolean }) {
  return <><BookingSteps active={active} automatic={automatic} /><div className="dsc-booking-heading"><Link href={back} className="dsc-link"><ArrowLeft size={16} aria-hidden />{backLabel}</Link><h1>{title}</h1><p>{description}</p></div></>
}

export function CheckoutSection({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="dsc-checkout-section" aria-label={title}><div className="dsc-checkout-section__heading"><span><Icon size={20} aria-hidden /></span><h2>{title}</h2>{action}</div><div className="dsc-checkout-section__body">{children}</div></section>
}

/** Explains the real payment integration; it does not invent payment methods. */
export function SecurePaymentNote() {
  return <div className="dsc-payment-note"><span><LockKeyhole size={21} aria-hidden /></span><div><strong>Secure online payment</strong><p>Available payment methods appear in the secure checkout. We verify payment before sending the request to your professional.</p></div></div>
}

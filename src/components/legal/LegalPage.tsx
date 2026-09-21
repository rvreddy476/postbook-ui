import React from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { TERMS_EFFECTIVE_DATE, TERMS_VERSION } from '@/lib/legal'

interface LegalPageProps {
  title: string
  intro: string
  children: React.ReactNode
}

/**
 * Shared shell for the terms and privacy pages.
 *
 * These are reachable from the registration consent line, which is the
 * whole point: a person is asked to accept them, so they have to be able
 * to read them first. Both carry the version registration records, so
 * what was agreed to is answerable from the page itself.
 */
export default function LegalPage({ title, intro, children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <header className="sticky top-0 z-10 border-b border-brand-divider bg-brand-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-5">
          <Link
            href="/register"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-brand-text/60 transition-colors hover:bg-brand-secondary hover:text-brand-text"
            aria-label="Back"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-ink">
              <span className="text-[11px] font-bold -tracking-[0.02em] text-white">VC</span>
            </span>
            <span className="text-[15px] font-semibold -tracking-[0.014em]">VChat</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-[32px] font-bold leading-tight -tracking-[0.02em]">{title}</h1>
        <p className="mt-2 text-sm text-brand-text/60">
          Version {TERMS_VERSION} · Effective {TERMS_EFFECTIVE_DATE}
        </p>
        <p className="mt-5 text-[15px] leading-relaxed text-brand-text/80">{intro}</p>

        <div className="mt-8 space-y-8">{children}</div>

        <p className="mt-12 border-t border-brand-divider pt-6 text-[13px] leading-relaxed text-brand-text/50">
          This page is the version recorded against your account when you
          register. If you have a question about it, contact us before
          creating an account.
        </p>
      </main>
    </div>
  )
}

/** One numbered section of a legal document. */
export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[17px] font-semibold -tracking-[0.014em]">{heading}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-brand-text/75">{children}</div>
    </section>
  )
}

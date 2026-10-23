"use client"

/*
  /l/<id>: where every Action button lands. GET /v1/links/:id names the
  target; a domain this browser has not continued to before gets the
  "You're leaving VChat" page (the domain, Continue, Go back); a known one
  redirects at once. A link that is gone (404) says so. Signed out works:
  the route is public (middleware) and the read is a public route.
*/

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ExternalLink, Link2Off, Loader2, ShieldCheck } from "lucide-react"

import { useLinkTarget } from "../hooks"
import { continueTo, decideLinkVisit, seenDomains, type LinkTarget } from "../links"
import "../action-button.css"

/** Leaves the app for `url`; replace, so Back from the site skips this page. */
function go(url: string, mode: "replace" | "assign") {
  if (mode === "replace") window.location.replace(url)
  else window.location.assign(url)
}

export function LeavingScreen({ linkId }: { linkId: string }) {
  const link = useLinkTarget(linkId)
  if (link.isPending) return <LeavingShell busy />
  if (link.isError) return <LinkError onRetry={() => void link.refetch()} />
  if (!link.data) return <LinkGone />
  return <LeavingDecision target={link.data} />
}

function LeavingDecision({ target }: { target: LinkTarget }) {
  const seen = useMemo(() => seenDomains(), [])
  // Decided once, on the client (storage is per browser): never during the server render.
  const [visit, setVisit] = useState<ReturnType<typeof decideLinkVisit> | null>(null)
  useEffect(() => {
    const decided = decideLinkVisit(target, seen)
    setVisit(decided)
    if (decided.kind === "redirect") go(decided.url, "replace")
  }, [target, seen])

  if (!visit || visit.kind === "redirect") return <LeavingShell busy />
  return <LeavingCard domain={visit.domain} onContinue={() => go(continueTo(target, seen), "assign")} />
}

function LeavingShell({ busy, children }: { busy?: boolean; children?: React.ReactNode }) {
  return (
    <main className="leaving-page" data-leaving-page="">
      {busy ? (
        <p className="leaving-card__hint" role="status">
          <Loader2 aria-hidden="true" className="mx-auto mb-2 h-6 w-6 animate-spin" />
          Opening the link…
        </p>
      ) : (
        children
      )}
    </main>
  )
}

function useGoBack() {
  const router = useRouter()
  return () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back()
    else router.push("/")
  }
}

export function LeavingCard({ domain, onContinue }: { domain: string; onContinue: () => void }) {
  const back = useGoBack()
  return (
    <LeavingShell>
      <section className="leaving-card" aria-labelledby="leaving-title" data-leaving="interstitial">
        <span className="leaving-card__icon" aria-hidden="true">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <h1 id="leaving-title" className="leaving-card__title">
          You&apos;re leaving VChat
        </h1>
        <p className="leaving-card__domain" data-leaving-domain="">
          {domain}
        </p>
        <p className="leaving-card__hint">This site isn&apos;t part of VChat. Only continue if you trust it, and never share passwords, OTPs or payment details because a post asked you to.</p>
        <div className="leaving-card__actions">
          <button type="button" className="leaving-card__button" onClick={back}>
            Go back
          </button>
          <button type="button" className="leaving-card__button leaving-card__button--primary" onClick={onContinue} data-leaving-continue="">
            Continue <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </section>
    </LeavingShell>
  )
}

export function LinkGone() {
  const back = useGoBack()
  return (
    <LeavingShell>
      <section className="leaving-card" aria-labelledby="leaving-gone-title" data-leaving="gone">
        <span className="leaving-card__icon" aria-hidden="true">
          <Link2Off className="h-6 w-6" />
        </span>
        <h1 id="leaving-gone-title" className="leaving-card__title">
          This link is no longer available
        </h1>
        <p className="leaving-card__hint">The creator may have removed it, or it was taken down.</p>
        <div className="leaving-card__actions">
          <button type="button" className="leaving-card__button leaving-card__button--primary" onClick={back}>
            Go back
          </button>
        </div>
      </section>
    </LeavingShell>
  )
}

function LinkError({ onRetry }: { onRetry: () => void }) {
  const back = useGoBack()
  return (
    <LeavingShell>
      <section className="leaving-card" aria-labelledby="leaving-error-title" data-leaving="error">
        <h1 id="leaving-error-title" className="leaving-card__title">
          We couldn&apos;t open this link
        </h1>
        <p className="leaving-card__hint">Check your connection and try again.</p>
        <div className="leaving-card__actions">
          <button type="button" className="leaving-card__button" onClick={back}>
            Go back
          </button>
          <button type="button" className="leaving-card__button leaving-card__button--primary" onClick={onRetry}>
            Try again
          </button>
        </div>
      </section>
    </LeavingShell>
  )
}

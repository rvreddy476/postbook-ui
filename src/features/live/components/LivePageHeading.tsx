import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { LiveStatusView } from "../status"
import { LiveStatusBadge } from "./LiveStatus"

export function LivePageHeading({ title, view, studio = false, children }: { title: string; view: LiveStatusView; studio?: boolean; children?: React.ReactNode }) {
  return (
    <header className="live-heading">
      <Link href="/live" className="live-heading__back" aria-label="Back to live streams"><ArrowLeft size={20} aria-hidden="true" /></Link>
      <div className="live-heading__copy">
        <div className="live-heading__eyebrow">{studio ? "Your broadcast studio" : "Creator broadcasts"}<LiveStatusBadge view={view} /></div>
        <h1 className="live-page__title">{title || "Live stream"}</h1>
        {children}
      </div>
    </header>
  )
}

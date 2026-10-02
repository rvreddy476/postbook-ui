"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import { MessageCircle, Sparkles } from "lucide-react"

import { chatHref } from "../model/matches"
import type { Person } from "../model/people"
import { DatingPhoto } from "./DatingPhoto"

/** The full-screen moment after a spark is returned. */
export function MatchCelebration({ person, conversationId, onClose }: { person: Person | null; conversationId: string; onClose: () => void }) {
  const hello = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    hello.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const name = person?.firstName || "them"
  return (
    <div className="pulse-match" role="dialog" aria-modal="true" aria-labelledby="pulse-match-title">
      <div className="pulse-match__inner">
        <span className="pulse-match__burst" aria-hidden="true">
          <Sparkles size={28} />
        </span>
        <h2 id="pulse-match-title" className="pulse-match__title">
          You both sparked
        </h2>
        <p className="pulse-match__body">
          You and {name} chose each other. Say hello while it&apos;s fresh.
        </p>
        {person ? <DatingPhoto path={person.photoUrl} alt={`${person.firstName || "Your match"} photo`} className="pulse-match__photo" /> : null}
        <div className="pulse-match__actions">
          <Link ref={hello} href={chatHref(conversationId)} className="pulse-btn pulse-btn--primary">
            <MessageCircle size={16} aria-hidden="true" />
            <span>Say hello</span>
          </Link>
          <button type="button" className="pulse-btn pulse-btn--quiet" onClick={onClose}>
            <span>Keep browsing</span>
          </button>
        </div>
      </div>
    </div>
  )
}

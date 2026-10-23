"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useAuthUser } from "@/store/auth"

import { useCreatorLevels } from "../hooks"
import { activeLevels } from "../model"
import { JoinSheet } from "./JoinSheet"

export interface JoinButtonProps {
  creatorId: string
  creatorName?: string
  requiredTierId?: string | null
  className?: string
  children?: ReactNode
}

const BUTTON = "inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover"

/** "Join": opens the Join sheet; signed out, it goes to sign in and comes back here. */
export function JoinButton({ creatorId, creatorName, requiredTierId, className = BUTTON, children = "Join" }: JoinButtonProps) {
  const user = useAuthUser()
  const pathname = usePathname() || "/"
  const [open, setOpen] = useState(false)
  if (!user) {
    return (
      <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={className} data-membership="join-sign-in">
        {children}
      </Link>
    )
  }
  if (user.id === creatorId) return null
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} data-membership="join-open">
        {children}
      </button>
      <JoinSheet open={open} onClose={() => setOpen(false)} creatorId={creatorId} creatorName={creatorName} requiredTierId={requiredTierId} />
    </>
  )
}

/** The profile's "Join" next to Follow: only for a creator with at least one active level, never on your own page. */
export function ProfileJoinButton({ creatorId, creatorName, className }: { creatorId: string; creatorName?: string; className?: string }) {
  const levels = useCreatorLevels(creatorId)
  if (activeLevels(levels.data ?? []).length === 0) return null
  return <JoinButton creatorId={creatorId} creatorName={creatorName} className={className} />
}

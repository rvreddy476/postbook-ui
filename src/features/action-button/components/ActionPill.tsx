"use client"

/*
  The Action button where viewers see it. Every variant links to the
  row's `href` (/l/<id>, the leaving page), never to the raw url.

    card     PostCard under the media, and the watch page under the player
    reel     the pill above a reel's caption, on the dark stage
    profile  beside Follow and Message on a profile or channel

  The author's own button that is not live (blocked, under review) is drawn
  as a note with the reason instead of a link; viewers never get one.
*/

import Link from "next/link"
import { AlertTriangle, ExternalLink } from "lucide-react"

import { useActionStats } from "../hooks"
import { pillText, statusExplanation, tapsText, visibleAction, type PostAction } from "../model"
import "../action-button.css"

export interface ActionPillProps {
  action: PostAction | null | undefined
  /** The viewer wrote the post (or owns the profile): a button that is not live shows its reason. */
  isAuthor?: boolean
  /** Members-only and this viewer is not a member: nothing. */
  locked?: boolean
  variant?: "card" | "reel" | "profile"
  className?: string
}

export function ActionPill({ action, isAuthor = false, locked = false, variant = "card", className = "" }: ActionPillProps) {
  const shown = visibleAction(action, { isAuthor, locked })
  if (!shown) return null

  const status = statusExplanation(shown.status)
  if (status) {
    return (
      <p role="status" data-action-pill={variant} data-action-status={shown.status} className={`action-pill action-pill--${variant} action-pill--inactive ${className}`}>
        <AlertTriangle aria-hidden="true" className="action-pill__icon" />
        <span className="action-pill__text">
          <span className="action-pill__label">{status.title}</span>
          <span className="action-pill__domain">{shown.labelText}{shown.domain ? ` · ${shown.domain}` : ""}</span>
        </span>
      </p>
    )
  }

  return (
    <Link
      href={shown.href}
      prefetch={false}
      data-action-pill={variant}
      aria-label={`${shown.labelText}, opens ${shown.domain || "a website"}`}
      title={pillText(shown)}
      onClick={(e) => e.stopPropagation()}
      className={`action-pill action-pill--${variant} ${className}`}
    >
      {variant === "profile" ? (
        <>
          <span className="action-pill__label">{shown.labelText}</span>
          <ExternalLink aria-hidden="true" className="action-pill__icon" />
        </>
      ) : (
        <>
          <span className="action-pill__text">
            <span className="action-pill__label">{shown.labelText}</span>
            {shown.domain ? (
              <>
                <span aria-hidden="true" className="action-pill__sep">·</span>
                <span className="action-pill__domain">{shown.domain}</span>
              </>
            ) : null}
          </span>
          <ExternalLink aria-hidden="true" className="action-pill__icon" />
        </>
      )}
    </Link>
  )
}

/** Taps on the author's button (GET /v1/posts/:id/action/stats); nothing until there is a number. */
export function ActionTaps({ postId, enabled = true, className = "", prefix = "" }: { postId: string; enabled?: boolean; className?: string; prefix?: string }) {
  const stats = useActionStats(postId, enabled)
  if (!stats.data) return null
  return (
    <span data-action-taps="" className={className} title="Taps on the action button">
      {prefix}
      {tapsText(stats.data)}
    </span>
  )
}

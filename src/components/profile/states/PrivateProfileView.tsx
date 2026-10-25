"use client"

import Link from "next/link"
import { Clock, Lock, UserPlus } from "lucide-react"
import type { FollowButtonState } from "../profileParity"

/*
  A private account the viewer does not follow (parity, private
  state). Rendered BELOW the normal profile header — name, handle, bio and
  counts stay visible, as profile-service intends ("a private profile is
  findable and shows its counts") — in place of the tabs and grids. No
  content leaks: post-service refuses the posts regardless.

  Follow on a private account sends a request; until it is answered the
  button reads "Requested".
*/

interface PrivateProfileViewProps {
    username: string
    signedIn: boolean
    followState: FollowButtonState
    followBusy?: boolean
    onFollow: () => void
    signInHref?: string
}

const BTN =
    "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-outline disabled:opacity-60"

export function PrivateProfileView({
    username,
    signedIn,
    followState,
    followBusy = false,
    onFollow,
    signInHref = "/login",
}: PrivateProfileViewProps) {
    return (
        <section
            aria-labelledby="private-profile-title"
            className="mx-auto mt-6 mb-12 max-w-xl rounded-2xl border border-brand-divider bg-brand-card p-8 text-center shadow-xs sm:p-10"
        >
            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-secondary">
                <Lock className="h-7 w-7 text-muted-foreground" aria-hidden />
            </div>
            <h2 id="private-profile-title" className="text-lg font-semibold text-brand-text">
                This account is private
            </h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                Follow @{username} to see their videos and reels.
            </p>
            <div className="mt-6 flex justify-center">
                {!signedIn ? (
                    <Link href={signInHref} className={`${BTN} bg-primary-ink text-primary-foreground hover:bg-primary-hover`}>
                        <UserPlus className="h-4 w-4" aria-hidden />
                        Follow
                    </Link>
                ) : followState === "requested" ? (
                    <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        title="Follow request sent"
                        className={`${BTN} border border-brand-divider bg-brand-card text-brand-text`}
                    >
                        <Clock className="h-4 w-4" aria-hidden />
                        Requested
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={onFollow}
                        disabled={followBusy}
                        className={`${BTN} bg-primary-ink text-primary-foreground hover:bg-primary-hover`}
                    >
                        <UserPlus className="h-4 w-4" aria-hidden />
                        {followState === "follow_back" ? "Follow back" : "Follow"}
                    </button>
                )}
            </div>
        </section>
    )
}

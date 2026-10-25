"use client"

import { formatProfileCount } from "./profileParity"

/*
  Following · Followers under the profile name (T-20). Numbers come from
  graph-service (/v1/graph/counts/:id through the profile BFF). When the
  lists are viewable the counts open them; otherwise they are plain text.
  A likes total is deliberately absent: no endpoint serves another
  account's likes received (analytics creator/me is owner-only).
*/

interface ProfileCountsProps {
    followerCount: number
    followingCount: number
    onOpen?: () => void
}

export function ProfileCounts({ followerCount, followingCount, onOpen }: ProfileCountsProps) {
    const items = [
        { key: "following", value: followingCount, label: "Following" },
        { key: "followers", value: followerCount, label: followerCount === 1 ? "Follower" : "Followers" },
    ]
    return (
        <ul
            aria-label="Profile counts"
            className="flex items-center justify-center gap-5 pt-1 text-sm md:justify-start"
            data-testid="profile-counts"
        >
            {items.map((item) => {
                const body = (
                    <>
                        <strong className="font-bold text-brand-text" data-count={item.key}>
                            {formatProfileCount(item.value)}
                        </strong>{" "}
                        <span className="text-muted-foreground">{item.label}</span>
                    </>
                )
                return (
                    <li key={item.key}>
                        {onOpen ? (
                            <button
                                type="button"
                                onClick={onOpen}
                                className="rounded-md hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-outline"
                            >
                                {body}
                            </button>
                        ) : (
                            body
                        )}
                    </li>
                )
            })}
        </ul>
    )
}

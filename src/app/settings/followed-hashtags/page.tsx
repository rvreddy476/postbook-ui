"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Hash, Loader2 } from "lucide-react"

import AppShell from "@/components/AppShell"
import { useFollowedHashtags, useToggleHashtagFollow } from "@/hooks/useHashtagFollow"
import {
    MAX_FOLLOWED_HASHTAGS,
    hashtagFollowErrorText,
    hashtagSegment,
    type FollowedHashtag,
} from "@/features/hashtag/hashtagFollow"
import { SettingsLoadError, SettingsLoading } from "../_components/SettingsLoadState"
import "../_components/settings-hub.css"
import "../messaging/messaging-settings.css"

/*
  Settings › Followed hashtags (post-service GET /v1/hashtags/followed,
  546eec063): the tags you follow, newest follow first, each with Unfollow.
  Their posts are the home feed's Hashtags tab. Following happens on a tag's
  own page.
*/

function FollowedHashtagRow({ hashtag }: { hashtag: FollowedHashtag }) {
    const toggle = useToggleHashtagFollow(hashtag.tag)
    const [error, setError] = useState<string | null>(null)

    return (
        <li>
            <div className="settings-hub__block">
                <div className="settings-hub__row settings-hub__row--static">
                    <span className="settings-hub__icon">
                        <Hash size={18} strokeWidth={1.75} aria-hidden />
                    </span>
                    <Link href={`/hashtag/${hashtagSegment(hashtag.tag)}`} className="settings-hub__label hover:underline">
                        {hashtag.displayName}
                    </Link>
                    <button
                        type="button"
                        className="msg-settings__button"
                        disabled={toggle.isPending}
                        aria-label={`Unfollow ${hashtag.displayName}`}
                        onClick={() => {
                            setError(null)
                            toggle.mutate(false, { onError: (err) => setError(hashtagFollowErrorText(err, "unfollow")) })
                        }}
                    >
                        {toggle.isPending ? "Unfollowing…" : "Unfollow"}
                    </button>
                </div>
                {error ? (
                    <p className="msg-settings__error msg-settings__error--inline" role="alert">{error}</p>
                ) : null}
            </div>
        </li>
    )
}

export default function FollowedHashtagsPage() {
    const query = useFollowedHashtags()
    const tags = query.data?.pages.flatMap((page) => page.items) ?? []

    return (
        <AppShell>
            <div className="settings-hub">
                <div className="settings-hub__inner">
                    <Link href="/settings" className="msg-settings__back">
                        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
                        Settings
                    </Link>
                    <h1 className="settings-hub__title">Followed hashtags</h1>
                    <p className="msg-settings__intro">
                        Posts with these hashtags show in the Hashtags tab of your home feed. You can follow up to {MAX_FOLLOWED_HASHTAGS}.
                    </p>

                    {query.isError ? (
                        <SettingsLoadError onRetry={() => void query.refetch()} />
                    ) : query.isLoading ? (
                        <SettingsLoading />
                    ) : tags.length === 0 ? (
                        <p className="msg-settings__empty">
                            You don&apos;t follow any hashtags yet. Open a hashtag and press Follow.{" "}
                            <Link href="/trending" className="font-semibold text-primary-ink hover:underline">See trending hashtags</Link>
                        </p>
                    ) : (
                        <div className="settings-hub__groups">
                            <section className="settings-hub__group" aria-label="Hashtags you follow">
                                <ul className="settings-hub__card">
                                    {tags.map((h) => (
                                        <FollowedHashtagRow key={h.tag} hashtag={h} />
                                    ))}
                                </ul>
                            </section>
                            {query.hasNextPage ? (
                                <button
                                    type="button"
                                    className="msg-settings__button"
                                    disabled={query.isFetchingNextPage}
                                    onClick={() => void query.fetchNextPage()}
                                >
                                    {query.isFetchingNextPage ? <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden /> : null}
                                    {query.isFetchingNextPage ? "Loading…" : "Show more"}
                                </button>
                            ) : null}
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    )
}

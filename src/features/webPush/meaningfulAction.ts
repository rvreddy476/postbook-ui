/*
  "Meaningful actions" — the moments the push soft prompt may follow
  (founder, 15 Oct 2026): a follow, a comment, or a post.

  They are recognised in ONE place, the API client's success path
  (src/lib/api.ts), by the write that the server accepted — rather than in
  each of the dozen components that can follow, comment or post. A new
  surface that uses the same routes is covered without remembering to.

  Nothing is announced when web push is not configured.
*/

import { isWebPushConfigured } from "./config"

export type MeaningfulAction = "follow" | "comment" | "post"

export const MEANINGFUL_ACTION_EVENT = "momentum:meaningful-action"

const ID = "[^/]+"

/** POST routes, matched on the path alone. */
const ROUTES: [RegExp, MeaningfulAction][] = [
    // graph-service follow (useEditProfile.followUser) and business pages.
    [/^\/v1\/graph\/follow$/, "follow"],
    [new RegExp(`^/v1/pages/${ID}/follow$`), "follow"],
    // Comments and replies on posts, group posts, channel updates, Q&A answers.
    [new RegExp(`^/v1/posts/${ID}/comments$`), "comment"],
    [new RegExp(`^/v1/comments/${ID}/reply$`), "comment"],
    [new RegExp(`^/v1/groups/${ID}/posts/v2/${ID}/comments$`), "comment"],
    [new RegExp(`^/v1/broadcast-channels/${ID}/updates/${ID}/comments$`), "comment"],
    [new RegExp(`^/v1/qa/answers/${ID}/comments$`), "comment"],
    // Posts: the feed composer and reels (POST /v1/posts), groups, community spaces.
    [/^\/v1\/posts$/, "post"],
    [new RegExp(`^/v1/groups/${ID}/posts/v2$`), "post"],
    [new RegExp(`^/v1/communities/${ID}/spaces/${ID}/posts$`), "post"],
]

/** The action a successful request represents, or null. */
export function meaningfulActionFor(method: string | undefined, url: string | undefined): MeaningfulAction | null {
    if (!method || method.toLowerCase() !== "post" || !url) return null
    let path: string
    try {
        path = new URL(url, "http://local.invalid").pathname.replace(/\/+$/, "")
    } catch {
        return null
    }
    for (const [re, action] of ROUTES) if (re.test(path)) return action
    return null
}

/** Fired after the server accepted the write. No-op unless web push is configured. */
export function announceMeaningfulAction(action: MeaningfulAction, configured: boolean = isWebPushConfigured()): void {
    if (!configured || typeof window === "undefined") return
    try {
        window.dispatchEvent(new CustomEvent(MEANINGFUL_ACTION_EVENT, { detail: { action } }))
    } catch {
        /* nothing listens in this environment */
    }
}

export function onMeaningfulAction(listener: (action: MeaningfulAction) => void): () => void {
    if (typeof window === "undefined") return () => undefined
    const handler = (event: Event) => {
        const action = (event as CustomEvent<{ action?: MeaningfulAction }>).detail?.action
        if (action) listener(action)
    }
    window.addEventListener(MEANINGFUL_ACTION_EVENT, handler)
    return () => window.removeEventListener(MEANINGFUL_ACTION_EVENT, handler)
}

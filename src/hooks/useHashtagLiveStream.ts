// Real-time hashtag stream subscription. Opens an SSE connection to
// `GET /v1/hashtags/<tag>/stream` and counts incoming `new_post`
// events. The consumer (e.g. /hashtag/[tag] page) renders an inline
// "N new posts" pill from the count; tapping the pill calls
// `acknowledge()` to reset the counter and triggers a refetch via
// react-query (caller's responsibility).
//
// Why a counter and not the full post body: media URLs are short-
// lived presigned URLs, so we'd have to re-sign every push. Pushing
// just a notification + asking the client to refetch is the same UX
// Twitter ships and avoids that signature dance.

"use client";

import { useEffect, useRef, useState } from "react";

export function useHashtagLiveStream(tag: string | undefined) {
    const [newPostCount, setNewPostCount] = useState(0);
    const sourceRef = useRef<EventSource | null>(null);

    useEffect(() => {
        if (!tag) return;
        const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";
        const url = `${base}/v1/hashtags/${encodeURIComponent(tag)}/stream`;
        const es = new EventSource(url);
        sourceRef.current = es;

        const onNewPost = () => setNewPostCount((n) => n + 1);
        es.addEventListener("new_post", onNewPost);
        // Connection-level errors auto-retry inside EventSource; we
        // don't surface a UI error since the strip is decorative.

        return () => {
            es.removeEventListener("new_post", onNewPost);
            es.close();
            sourceRef.current = null;
        };
    }, [tag]);

    const acknowledge = () => setNewPostCount(0);

    return { newPostCount, acknowledge };
}

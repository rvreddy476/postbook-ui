"use client";

import { useEffect, useState } from "react";

import { useFeedDelta, POLL_INTERVALS } from "@/hooks/useFeedDelta";

/*
  The Following tab's dot: GET /v1/feed/delta?feed_type=following, anchored
  on the newest created_at of the Following page — or, before that page has
  been opened, the moment the feed was opened. Polled every minute while
  the page is visible (useFeedDelta skips a hidden tab), never while
  Following is the tab on screen, and cleared when Following is opened.
*/
export function followingDotAnchor(newestFollowing: string | undefined, openedAt: string): string {
  return newestFollowing || openedAt;
}

export function useFollowingDot({ onFollowing, newestFollowing, signedIn }: { onFollowing: boolean; newestFollowing: string | undefined; signedIn: boolean }) {
  const [openedAt] = useState(() => new Date().toISOString());
  const { newCount, setAnchor, consumeNew } = useFeedDelta({
    feedType: "following",
    enabled: signedIn && !onFollowing,
    intervalMs: POLL_INTERVALS.following,
  });
  const anchor = followingDotAnchor(newestFollowing, openedAt);
  useEffect(() => {
    setAnchor(anchor);
  }, [anchor, setAnchor]);
  useEffect(() => {
    if (onFollowing) consumeNew();
  }, [onFollowing, consumeNew]);
  return { showDot: !onFollowing && newCount > 0, clear: consumeNew };
}

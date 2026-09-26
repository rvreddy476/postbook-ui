"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

import { CreateButton } from "@/features/reels/components/CreateButton";
import { ProfileDropdown } from "@/features/reels/components/ProfileDropdown";
import { useUnreadCount } from "@/hooks/useActivityNotifications";

/*
  The small cluster that floats over the top-right of the main area under
  the "sidebar" chrome, where TikTok keeps its upload button and avatar:
  Create, notifications, the account menu. Nothing else — search lives in
  the menu and the header is gone.
*/
export function VideoTopCluster() {
  const unread = useUnreadCount();
  return (
    <div className="video-shell__top-cluster">
      <CreateButton variant="pill" />
      <Link href="/notifications" className="video-shell__top-action" aria-label="Notifications">
        <Bell size={20} strokeWidth={1.75} aria-hidden />
        {(unread.data?.count ?? 0) > 0 ? <span className="video-shell__top-dot" aria-hidden /> : null}
      </Link>
      <ProfileDropdown />
    </div>
  );
}

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ban, Clock, EyeOff, Link2, ListPlus, MoreVertical } from "lucide-react";
import ShareDialog from "@/components/ShareDialog";
import { useGlobalToast } from "@/contexts/ToastContext";
import { useAuthUser } from "@/store/auth";
import { useQueue } from "@/features/posttube/library";
import type { PostTubeVideo } from "../types";
import { sendFeedFeedback } from "../data/posttubeApi";
import { SaveToPlaylistDialog } from "./SaveToPlaylistDialog";
import { tileMenuRows, type TileMenuKey } from "./tileMenuRows";
import { ShareIcon } from "@/components/icons/ShareIcon";

const ICONS: Record<TileMenuKey, (props: { "aria-hidden"?: boolean }) => React.ReactNode> = {
  "copy-link": Link2,
  "dont-recommend": Ban,
  "not-interested": EyeOff,
  playlist: ListPlus,
  share: ShareIcon,
  "watch-later": Clock,
};

/*
  The "⋮" beside a tile's title. It sits outside the tile's link (a button
  inside a link is invalid and every click would navigate). The list is
  portalled and fixed-positioned, because a shelf scrolls sideways and its
  overflow would clip a dropdown drawn inside it.
*/
export function VideoTileMenu({ video }: { video: PostTubeVideo }) {
  const [open, setOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  return (
    <div className="tube-tile__menu">
      <button
        ref={button}
        type="button"
        className="tube-tile__menu-button"
        aria-label={`More actions for ${video.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical aria-hidden />
      </button>
      {open && (
        <TileMenuList
          video={video}
          anchor={button}
          onClose={(restoreFocus) => {
            setOpen(false);
            if (restoreFocus) button.current?.focus();
          }}
          onPlaylist={() => setPlaylistOpen(true)}
          onShare={() => setShareOpen(true)}
        />
      )}
      {/* Mounted only when asked for: a grid of tiles should not run a
          playlist query and a share dialog per tile. */}
      {playlistOpen && <SaveToPlaylistDialog open postId={video.id} onClose={() => setPlaylistOpen(false)} />}
      {shareOpen && <ShareDialog postId={video.id} isOpen onClose={() => setShareOpen(false)} />}
    </div>
  );
}

function TileMenuList({
  video,
  anchor,
  onClose,
  onPlaylist,
  onShare,
}: {
  video: PostTubeVideo;
  anchor: React.RefObject<HTMLButtonElement | null>;
  onClose: (restoreFocus: boolean) => void;
  onPlaylist: () => void;
  onShare: () => void;
}) {
  const user = useAuthUser();
  const queue = useQueue();
  const toast = useGlobalToast();
  const list = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);

  const queued = queue.queued(video.id);
  const rows = tileMenuRows({ signedIn: !!user, own: user?.id === video.author_id, queued });

  // Below the button, right-aligned to it; above when there is no room.
  useLayoutEffect(() => {
    const b = anchor.current?.getBoundingClientRect();
    const l = list.current;
    if (!b || !l) return;
    const width = l.offsetWidth;
    const height = l.offsetHeight;
    const below = b.bottom + 4 + height <= window.innerHeight - 8;
    setPlace({
      top: below ? b.bottom + 4 : Math.max(8, b.top - 4 - height),
      left: Math.min(Math.max(8, b.right - width), window.innerWidth - width - 8),
    });
    l.querySelector<HTMLButtonElement>("button")?.focus();
  }, [anchor]);

  useEffect(() => {
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!list.current?.contains(t) && !anchor.current?.contains(t)) onClose(false);
    };
    const away = () => onClose(false);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("scroll", away, true);
    window.addEventListener("resize", away);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("scroll", away, true);
      window.removeEventListener("resize", away);
    };
  }, [anchor, onClose]);

  const run = async (key: TileMenuKey) => {
    onClose(key !== "playlist" && key !== "share");
    try {
      switch (key) {
        case "copy-link":
          await navigator.clipboard.writeText(`${window.location.origin}/posttube/watch/${video.id}`);
          toast({ type: "success", title: "Link copied" });
          return;
        case "share":
          onShare();
          return;
        case "playlist":
          onPlaylist();
          return;
        case "watch-later": {
          const ok = await queue.toggle(video.id);
          toast(ok
            ? { type: "success", title: queued ? "Removed from Watch later" : "Saved to Watch later" }
            : { type: "error", title: "Could not update Watch later" });
          return;
        }
        case "not-interested":
          await sendFeedFeedback({ post_id: video.id, signal: "not_interested" });
          toast({ type: "success", title: "Got it", description: "We'll show fewer videos like this." });
          return;
        case "dont-recommend":
          await sendFeedFeedback({ author_id: video.author_id, signal: "not_interested" });
          toast({ type: "success", title: "Got it", description: `We won't recommend ${video.channel_name} any more.` });
          return;
      }
    } catch {
      toast({ type: "error", title: key === "copy-link" ? "Could not copy the link" : "Could not save that" });
    }
  };

  return createPortal(
    <div
      ref={list}
      role="menu"
      aria-label="Video actions"
      className="tube-tile__menu-list"
      style={place ? { top: place.top, left: place.left } : { top: -9999, left: -9999 }}
      onKeyDown={(e) => {
        if (e.key === "Escape" || e.key === "Tab") {
          e.preventDefault();
          onClose(true);
          return;
        }
        const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
        const i = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.key === "ArrowDown" ? (i + 1) % items.length
          : e.key === "ArrowUp" ? (i - 1 + items.length) % items.length
          : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : -1;
        if (next >= 0) {
          e.preventDefault();
          items[next]?.focus();
        }
      }}
    >
      {rows.map((row) => {
        const Icon = ICONS[row.key];
        return (
          <button key={row.key} type="button" role="menuitem" className="tube-tile__menu-item" onClick={() => void run(row.key)}>
            <Icon aria-hidden />
            <span>{row.label}</span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Clapperboard, ImagePlus, ListPlus, Mic, PenLine, Plus, Radio, Sparkles, Upload } from "lucide-react";
import "./app-bar.css";

export type CreateMenuRowKey = "photos" | "videos" | "post" | "live" | "collection" | "podcast" | "upload";

export interface CreateMenuItem {
  key: CreateMenuRowKey;
  label: string;
  hint: string;
  href: string;
}

export type CreateMenuContext = "reels" | "posttube" | "default";

/**
 * Where the header lives: Reels, PostTube (`/posttube/*`, and `/tube/*`,
 * which app/tube redirects there), or anywhere else.
 */
export function createMenuContext(pathname: string | null | undefined): CreateMenuContext {
  if (!pathname) return "default";
  if (pathname.startsWith("/reels")) return "reels";
  if (pathname === "/posttube" || pathname.startsWith("/posttube/") || pathname === "/tube" || pathname.startsWith("/tube/")) return "posttube";
  return "default";
}

/**
 * The rows of the Create menu, as data. Reels and the default keep the two
 * rows (Videos goes to the reel composer inside Reels, to the PostTube
 * upload elsewhere). Inside PostTube the menu offers what a creator can
 * make there, in alphabetical order: Create post → the feed composer (the
 * channel Posts tab reads ordinary posts; there is no channel-only
 * composer), Go live → /live/new (the form the PostTube Live page links),
 * New collection → the Collections page with its create sheet open,
 * New podcast → the podcast upload studio, Upload video → the long-video
 * upload studio.
 */
export function createMenuItems(pathname: string | null | undefined): CreateMenuItem[] {
  const context = createMenuContext(pathname);
  if (context === "posttube") {
    return [
      { key: "post", label: "Create post", hint: "A text or photo post", href: "/create/post" },
      { key: "live", label: "Go live", hint: "Start a live stream", href: "/live/new" },
      { key: "collection", label: "New collection", hint: "Group videos into a list", href: "/posttube/playlists?new=1" },
      { key: "podcast", label: "New podcast", hint: "Upload an episode", href: "/posttube/upload?type=podcast" },
      { key: "upload", label: "Upload video", hint: "Publish a long video", href: "/posttube/upload?type=long" },
    ];
  }
  return [
    { key: "photos", label: "Photos", hint: "Post photos", href: "/create/post" },
    { key: "videos", label: "Videos", hint: "Upload a video or reel", href: context === "reels" ? "/reels/create" : "/posttube/upload?type=long" },
  ];
}

const ROW_ICON: Record<CreateMenuRowKey, typeof ImagePlus> = {
  photos: ImagePlus,
  videos: Clapperboard,
  post: PenLine,
  live: Radio,
  collection: ListPlus,
  podcast: Mic,
  upload: Upload,
};

export interface CreateButtonProps {
  /**
   * "pill": Plus + "Create" + a chevron (label hidden under 640px), the
   * prominent header control. "icon" (default, what older callers get): the
   * original square sparkle button.
   */
  variant?: "pill" | "icon";
  /** Start open — for static renders; the menu is closed by default. */
  defaultOpen?: boolean;
}

/*
  Create: a dropdown of the rows createMenuItems() gives for the current
  pathname (two everywhere, five inside PostTube). Escape and an outside
  click close it; arrows move between the rows; every row is a real link.
  Style through app-bar.css (.create-menu).
*/
export function CreateButton({ variant = "icon", defaultOpen = false }: CreateButtonProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(defaultOpen);
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const items = createMenuItems(pathname);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, handleClickOutside]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Arrow keys walk the rows (wrapping); Home/End jump.
  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const rows = rowRefs.current.filter((r): r is HTMLAnchorElement => Boolean(r));
    if (rows.length === 0) return;
    const at = rows.findIndex((r) => r === document.activeElement);
    let next = -1;
    if (e.key === "ArrowDown") next = at < 0 ? 0 : (at + 1) % rows.length;
    else if (e.key === "ArrowUp") next = at < 0 ? rows.length - 1 : (at - 1 + rows.length) % rows.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = rows.length - 1;
    if (next < 0) return;
    e.preventDefault();
    rows[next].focus();
  };

  const onTriggerKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      // Focus lands on the first row once it is in the tree.
      requestAnimationFrame(() => rowRefs.current[e.key === "ArrowDown" ? 0 : items.length - 1]?.focus());
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger */}
      {variant === "pill" ? (
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          onKeyDown={onTriggerKey}
          className="context-app-bar__create"
          aria-label="Create"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <Plus className="context-app-bar__create-plus" strokeWidth={2.5} aria-hidden />
          <span className="context-app-bar__create-label">Create</span>
          <ChevronDown className="context-app-bar__create-chevron" strokeWidth={2.25} aria-hidden />
        </motion.button>
      ) : (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          onKeyDown={onTriggerKey}
          className="group relative flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-ink text-primary-foreground shadow-md transition-shadow hover:shadow-lg"
          aria-label="Create"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <Sparkles className="h-[17px] w-[17px]" />
          <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-accent ring-2 ring-brand-card">
            <Plus className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
          </div>
        </motion.button>
      )}

      {/* Dropdown */}
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            aria-label="Create new"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "circOut" }}
            className="create-menu"
            onKeyDown={onMenuKey}
          >
            {items.map((item, i) => {
              const Icon = ROW_ICON[item.key];
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  role="menuitem"
                  className="create-menu__row"
                  data-row={item.key}
                  ref={(el) => {
                    rowRefs.current[i] = el;
                  }}
                  onClick={() => setOpen(false)}
                >
                  <span className="create-menu__icon">
                    <Icon aria-hidden />
                  </span>
                  <span className="create-menu__text">
                    <span className="create-menu__label">{item.label}</span>
                    <span className="create-menu__hint">{item.hint}</span>
                  </span>
                </Link>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

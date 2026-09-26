import {
  Bookmark,
  CalendarClock,
  Clapperboard,
  Compass,
  FileText,
  History,
  HelpCircle,
  Home,
  ListVideo,
  Settings,
  ShieldCheck,
  ThumbsUp,
  Tv,
  UserRound,
  Video,
  type LucideIcon,
} from "lucide-react";

/*
  The left menu of the two video apps, as data.

  One list serves both apps: Reels and PostTube are two doors into the same
  library (channel, history, playlists, uploads), so the "You" section is
  identical and only the highlighted top entry changes. Keeping it pure —
  no hooks, no pathname — is what lets the tests pin the lists down.
*/

export type VideoApp = "reels" | "tube";

export interface VideoNavItem {
  /** Stable key; unique within the whole nav. */
  key: string;
  label: string;
  icon: LucideIcon;
  /** A link. Exactly one of href / action is set. */
  href?: string;
  /** A button the shell handles (today: the Explore launcher). */
  action?: "explore";
  /** Highlighted regardless of the pathname: the app the viewer is inside. */
  active?: boolean;
}

export interface VideoNavSection {
  key: "top" | "you" | "footer";
  /** Section heading; the top group has none. */
  title?: string;
  items: VideoNavItem[];
  /** Shown in the 72px rail as icon + tiny label. */
  rail: boolean;
}

export const VIDEO_NAV_TOP: readonly Omit<VideoNavItem, "active">[] = [
  { key: "home", label: "Home", icon: Home, href: "/" },
  { key: "reels", label: "Reels", icon: Clapperboard, href: "/reels" },
  { key: "tube", label: "PostTube", icon: Tv, href: "/posttube" },
  { key: "explore", label: "Explore", icon: Compass, action: "explore" },
];

export const VIDEO_NAV_YOU: readonly VideoNavItem[] = [
  { key: "channel", label: "Your channel", icon: UserRound, href: "/posttube/channel" },
  { key: "history", label: "History", icon: History, href: "/posttube/history" },
  { key: "playlists", label: "Playlists", icon: ListVideo, href: "/posttube/playlists" },
  { key: "uploads", label: "Your videos", icon: Video, href: "/posttube/uploads" },
  { key: "saved", label: "Saved", icon: Bookmark, href: "/saved" },
  { key: "liked", label: "Liked reels", icon: ThumbsUp, href: "/reels/liked" },
  { key: "scheduled", label: "Scheduled", icon: CalendarClock, href: "/posttube/scheduled" },
];

export const VIDEO_NAV_FOOTER: readonly VideoNavItem[] = [
  { key: "settings", label: "Settings", icon: Settings, href: "/settings" },
  { key: "help", label: "Help", icon: HelpCircle, href: "/help" },
  { key: "terms", label: "Terms", icon: FileText, href: "/terms" },
  { key: "privacy", label: "Privacy", icon: ShieldCheck, href: "/privacy" },
];

/** The whole menu for one app. Pure. */
export function videoNav(app: VideoApp): VideoNavSection[] {
  return [
    {
      key: "top",
      rail: true,
      items: VIDEO_NAV_TOP.map((item) => ({ ...item, active: item.key === app })),
    },
    { key: "you", title: "You", rail: true, items: [...VIDEO_NAV_YOU] },
    { key: "footer", rail: false, items: [...VIDEO_NAV_FOOTER] },
  ];
}

/**
 * Whether a link is the current page. Exact match, or the pathname sits
 * under it — except "/" which only matches itself, and the two app roots,
 * which are the `active` flag's job (the app, not the page, is highlighted).
 */
export function isNavItemCurrent(item: Pick<VideoNavItem, "href">, pathname: string | null | undefined): boolean {
  if (!item.href) return false;
  const path = (pathname || "/").split("?")[0];
  if (item.href === "/") return path === "/";
  return path === item.href || path.startsWith(`${item.href}/`);
}

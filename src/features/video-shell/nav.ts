import {
  Bell,
  Bookmark,
  CalendarClock,
  CircleUserRound,
  Clapperboard,
  Compass,
  FileText,
  History,
  HelpCircle,
  Home,
  LayoutGrid,
  ListVideo,
  MessageSquare,
  Radio,
  Settings,
  ShieldCheck,
  ThumbsUp,
  Tv,
  Upload,
  UserRound,
  UserRoundCheck,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";

/*
  The left menu of the two video apps, as data.

  PostTube keeps the library menu (channel, history, playlists, uploads)
  with the app roots on top. Reels has its own list, shaped like TikTok's:
  For You / Following / Explore / Friends / LIVE / Messages / Activity /
  Upload / Profile, then a divider group with the way back to Home,
  PostTube and Liked reels. Keeping it pure — no hooks, no pathname — is
  what lets the tests pin the lists down.
*/

export type VideoApp = "reels" | "tube";

export interface VideoNavItem {
  /** Stable key; unique within the whole nav. */
  key: string;
  label: string;
  icon: LucideIcon;
  /** A link. Exactly one of href / action is set. May carry a query (`/reels?feed=following`). */
  href?: string;
  /** A button the shell handles (today: the Explore launcher). */
  action?: "explore";
  /** Highlighted regardless of the pathname: the app the viewer is inside. */
  active?: boolean;
  /** Current only on this exact path — not on pages under it. */
  exact?: boolean;
  /** Current only when none of these query keys is present (For You vs Following). */
  absentParams?: readonly string[];
}

export interface VideoNavSection {
  key: "top" | "you" | "apps" | "footer";
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

/** The reels menu: the nine the rail shows as icons. */
export const REELS_NAV_TOP: readonly VideoNavItem[] = [
  { key: "for-you", label: "For You", icon: Home, href: "/reels", exact: true, absentParams: ["feed"] },
  { key: "following", label: "Following", icon: UserRoundCheck, href: "/reels?feed=following", exact: true },
  { key: "explore", label: "Explore", icon: Compass, action: "explore" },
  { key: "friends", label: "Friends", icon: Users, href: "/connections" },
  { key: "live", label: "LIVE", icon: Radio, href: "/live" },
  { key: "messages", label: "Messages", icon: MessageSquare, href: "/messenger" },
  { key: "activity", label: "Activity", icon: Bell, href: "/notifications" },
  { key: "upload", label: "Upload", icon: Upload, href: "/reels/create" },
  { key: "profile", label: "Profile", icon: CircleUserRound, href: "/profile" },
];

/** Below a divider: the way out of the reels app. */
export const REELS_NAV_APPS: readonly VideoNavItem[] = [
  { key: "home", label: "Home", icon: LayoutGrid, href: "/" },
  { key: "tube", label: "PostTube", icon: Tv, href: "/posttube" },
  { key: "liked", label: "Liked reels", icon: ThumbsUp, href: "/reels/liked" },
];

/** The whole menu for one app. Pure. */
export function videoNav(app: VideoApp): VideoNavSection[] {
  if (app === "reels") {
    return [
      { key: "top", rail: true, items: REELS_NAV_TOP.map((item) => ({ ...item })) },
      { key: "apps", rail: false, items: REELS_NAV_APPS.map((item) => ({ ...item })) },
      { key: "footer", rail: false, items: [...VIDEO_NAV_FOOTER] },
    ];
  }
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
 * under it — except "/" which only matches itself, `exact` items, and the
 * PostTube app root, which is the `active` flag's job (the app, not the
 * page, is highlighted).
 *
 * `search` is the location's query string (with or without the "?"). An
 * href that carries a query is current only when every one of its pairs is
 * in the search; an item with `absentParams` is current only when none of
 * those keys is — so "/reels" (For You) and "/reels?feed=following" never
 * light up together. A "?" inside `pathname` is honoured when `search` is
 * not given.
 */
export function isNavItemCurrent(
  item: Pick<VideoNavItem, "href" | "exact" | "absentParams">,
  pathname: string | null | undefined,
  search?: string | null,
): boolean {
  if (!item.href) return false;
  const [rawPath, inlineSearch] = (pathname || "/").split("?");
  const path = rawPath || "/";
  const [hrefPath, hrefQuery] = item.href.split("?");
  const params = new URLSearchParams(search ?? inlineSearch ?? "");

  const pathMatches = hrefPath === "/" || item.exact ? path === hrefPath : path === hrefPath || path.startsWith(`${hrefPath}/`);
  if (!pathMatches) return false;

  if (hrefQuery) {
    for (const [k, v] of new URLSearchParams(hrefQuery)) {
      if (params.get(k) !== v) return false;
    }
  }
  for (const k of item.absentParams ?? []) {
    if (params.has(k)) return false;
  }
  return true;
}

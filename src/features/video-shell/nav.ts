import {
  Bell,
  CalendarClock,
  CircleUserRound,
  Clapperboard,
  Compass,
  Ellipsis,
  FileText,
  Flame,
  Heart,
  HelpCircle,
  History,
  Home,
  Info,
  LayoutDashboard,
  LayoutGrid,
  ListPlus,
  ListVideo,
  LogOut,
  MessageSquare,
  Moon,
  Radio,
  Settings,
  Shapes,
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

  PostTube's menu uses the RUTUBE words (founder, 28 Sep): Watch (home),
  Reels, Subscriptions, Live, Trending, Topics; then You: Your channel, History,
  Watch later, Liked videos, Collections, Your videos, Scheduled, Creator Hub. A route a
  later wave delivers is listed already but flagged `comingSoon`, so the
  sidebar draws it disabled with a small "soon" tag until the page exists —
  the shape is settled once and only the flag changes. The way back to the
  app home is the header's product badge. Reels has its own list, shaped
  like TikTok's:
  For You / Explore / Following / Friends / LIVE / Messages / Activity /
  Upload / Profile. Under the "sidebar" chrome (search in the menu, no
  header) the list ends with "More", which opens a panel beside the icon
  rail holding the way back to Home, PostTube and Liked reels, the theme
  switch and log out — under the "header" chrome those live in a divider
  group instead. Keeping it pure — no hooks, no pathname — is what lets
  the tests pin the lists down.
*/

export type VideoApp = "reels" | "tube";

/**
 * Which frame the shell draws. "header": the app header on top and the
 * menu below it. "sidebar": no header — search sits at the top of the menu
 * and a small cluster floats over the top-right of the main area.
 */
export type VideoChrome = "header" | "sidebar";

export interface VideoNavItem {
  /** Stable key; unique within the whole nav. */
  key: string;
  label: string;
  icon: LucideIcon;
  /** A link. Exactly one of href / action is set. May carry a query (`/reels?feed=following`). */
  href?: string;
  /** A button the shell handles: the Explore launcher or the More panel. */
  action?: "explore" | "more";
  /** Highlighted regardless of the pathname: the app the viewer is inside. */
  active?: boolean;
  /** Current only on this exact path — not on pages under it. */
  exact?: boolean;
  /** Current only when none of these query keys is present (For You vs Following). */
  absentParams?: readonly string[];
  /**
   * The route is planned but not built yet: the sidebar renders the row
   * disabled with a "soon" tag instead of a link. Drop the flag when the
   * page lands; the nav test checks the flag against the app directory.
   */
  comingSoon?: boolean;
}

export interface VideoNavSection {
  key: "top" | "you" | "apps" | "footer";
  /** Section heading; the top group has none. */
  title?: string;
  items: VideoNavItem[];
  /** Shown in the 72px rail as icon + tiny label. */
  rail: boolean;
}

/** The PostTube top group. Watch is the home grid and is current only there. */
export const VIDEO_NAV_TOP: readonly VideoNavItem[] = [
  { key: "watch", label: "Watch", icon: Tv, href: "/posttube", exact: true },
  { key: "reels", label: "Reels", icon: Clapperboard, href: "/reels" },
  { key: "following", label: "Subscriptions", icon: UserRoundCheck, href: "/posttube/subscriptions" },
  { key: "live", label: "Live", icon: Radio, href: "/posttube/live" },
  { key: "trending", label: "Trending", icon: Flame, href: "/posttube/trending" },
  { key: "topics", label: "Topics", icon: Shapes, href: "/posttube/topics" },
];

/** The PostTube "You" group: the viewer's own library, then the creator's side. */
export const VIDEO_NAV_YOU: readonly VideoNavItem[] = [
  { key: "channel", label: "Your channel", icon: UserRound, href: "/posttube/channel" },
  { key: "recent", label: "History", icon: History, href: "/posttube/history" },
  { key: "queue", label: "Watch later", icon: ListPlus, href: "/posttube/queue" },
  { key: "loved", label: "Liked videos", icon: Heart, href: "/posttube/loved" },
  { key: "collections", label: "Collections", icon: ListVideo, href: "/posttube/playlists" },
  { key: "uploads", label: "Your videos", icon: Video, href: "/posttube/uploads" },
  { key: "scheduled", label: "Scheduled", icon: CalendarClock, href: "/posttube/scheduled" },
  { key: "hub", label: "Creator Hub", icon: LayoutDashboard, href: "/posttube/hub" },
];

export const VIDEO_NAV_FOOTER: readonly VideoNavItem[] = [
  { key: "settings", label: "Settings", icon: Settings, href: "/settings" },
  { key: "help", label: "Help", icon: HelpCircle, href: "/help" },
  { key: "terms", label: "Terms", icon: FileText, href: "/terms" },
  { key: "privacy", label: "Privacy", icon: ShieldCheck, href: "/privacy" },
];

/** The reels menu: the nine the rail shows as icons, in TikTok's order. */
export const REELS_NAV_TOP: readonly VideoNavItem[] = [
  { key: "for-you", label: "For You", icon: Home, href: "/reels", exact: true, absentParams: ["feed"] },
  { key: "explore", label: "Explore", icon: Compass, action: "explore" },
  { key: "following", label: "Following", icon: UserRoundCheck, href: "/reels?feed=following", exact: true },
  { key: "friends", label: "Friends", icon: Users, href: "/connections" },
  { key: "live", label: "LIVE", icon: Radio, href: "/reels/live" },
  { key: "messages", label: "Messages", icon: MessageSquare, href: "/messenger" },
  { key: "activity", label: "Activity", icon: Bell, href: "/notifications" },
  { key: "upload", label: "Upload", icon: Upload, href: "/reels/create" },
  { key: "profile", label: "Profile", icon: CircleUserRound, href: "/profile" },
];

/** Below a divider (header chrome only): the way out of the reels app. */
export const REELS_NAV_APPS: readonly VideoNavItem[] = [
  { key: "home", label: "Home", icon: LayoutGrid, href: "/" },
  { key: "tube", label: "PostTube", icon: Tv, href: "/posttube" },
  { key: "liked", label: "Liked reels", icon: ThumbsUp, href: "/reels/liked" },
];

/** The last entry of the sidebar-chrome reels menu: opens the More panel. */
export const REELS_NAV_MORE: VideoNavItem = { key: "more", label: "More", icon: Ellipsis, action: "more" };

/**
 * The footer under the sidebar chrome, as TikTok's reads: two rows of
 * links in a two-column grid ("About  Help" / "Terms & Policies  Privacy"),
 * then the copyright line. Every link is a real route.
 */
export const REELS_SIDEBAR_FOOTER: readonly VideoNavItem[] = [
  { key: "about", label: "About", icon: Info, href: "/about" },
  { key: "help", label: "Help", icon: HelpCircle, href: "/help" },
  { key: "terms", label: "Terms & Policies", icon: FileText, href: "/terms" },
  { key: "privacy", label: "Privacy", icon: ShieldCheck, href: "/privacy" },
];
export const REELS_SIDEBAR_COPYRIGHT = "© 2026 VChat";

/**
 * TikTok's left-menu geometry, measured live and used as px in
 * video-shell.css; the tests pin these against the CSS. The expanded column
 * is 240 wide; the rail 72 (icons only); the More panel opens as a 320px
 * panel beside the rail (392 in all). Nav rows are 40px tall with a 4px gap
 * (44 pitch), starting 24px under the 40px search pill at y 64, which puts
 * every row within 5px of TikTok's. More-panel rows are 48px; its Dark
 * mode row is 60px with three 32×25 segments.
 */
export const REELS_SIDEBAR_METRICS = {
  expandedWidth: 240,
  railWidth: 72,
  morePanelWidth: 320,
  logoTop: 20,
  logoHeight: 28,
  searchTop: 64,
  searchHeight: 40,
  listTop: 128,
  rowHeight: 40,
  rowGap: 4,
  moreRowHeight: 48,
  themeRowHeight: 60,
  segmentWidth: 32,
  segmentHeight: 25,
  footerPadding: 24,
} as const;

/** The whole menu for one app under one chrome. Pure. */
export function videoNav(app: VideoApp, chrome: VideoChrome = "header"): VideoNavSection[] {
  if (app === "reels") {
    if (chrome === "sidebar") {
      return [
        { key: "top", rail: true, items: [...REELS_NAV_TOP.map((item) => ({ ...item })), { ...REELS_NAV_MORE }] },
        { key: "footer", rail: false, items: [...REELS_SIDEBAR_FOOTER] },
      ];
    }
    return [
      { key: "top", rail: true, items: REELS_NAV_TOP.map((item) => ({ ...item })) },
      { key: "apps", rail: false, items: REELS_NAV_APPS.map((item) => ({ ...item })) },
      { key: "footer", rail: false, items: [...VIDEO_NAV_FOOTER] },
    ];
  }
  return [
    { key: "top", rail: true, items: VIDEO_NAV_TOP.map((item) => ({ ...item })) },
    { key: "you", title: "You", rail: true, items: VIDEO_NAV_YOU.map((item) => ({ ...item })) },
    { key: "footer", rail: false, items: [...VIDEO_NAV_FOOTER] },
  ];
}

/* ---- the More panel --------------------------------------------------- */

/**
 * What a More-panel row does when it is not a link: open the Explore
 * launcher, show the theme switch (a row with its own control, no click),
 * or log out.
 */
export type MorePanelAction = "explore" | "theme" | "logout";

export interface MorePanelItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  action?: MorePanelAction;
}

export interface MorePanelSection {
  key: "settings" | "tools" | "apps" | "other";
  title: string;
  items: MorePanelItem[];
}

/** The More panel, section by section, as TikTok's reads. Pure data. */
export const REELS_MORE_PANEL: readonly MorePanelSection[] = [
  {
    key: "settings",
    title: "Settings",
    items: [
      { key: "general", label: "General", icon: Settings, href: "/settings" },
      { key: "theme", label: "Dark mode", icon: Moon, action: "theme" },
    ],
  },
  {
    key: "tools",
    title: "Tools",
    items: [
      { key: "upload", label: "Upload", icon: Upload, href: "/reels/create" },
      { key: "channel", label: "Your channel", icon: UserRound, href: "/posttube/channel" },
      { key: "live-tools", label: "LIVE tools", icon: Radio, href: "/live" },
    ],
  },
  {
    key: "apps",
    title: "Apps",
    items: [
      { key: "home", label: "Home", icon: LayoutGrid, href: "/" },
      { key: "tube", label: "PostTube", icon: Tv, href: "/posttube" },
      { key: "liked", label: "Liked reels", icon: ThumbsUp, href: "/reels/liked" },
      { key: "explore", label: "Explore", icon: Compass, action: "explore" },
    ],
  },
  {
    key: "other",
    title: "Other",
    items: [
      { key: "help-center", label: "Help Center", icon: HelpCircle, href: "/help" },
      { key: "logout", label: "Log out", icon: LogOut, action: "logout" },
    ],
  },
];

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

import {
  ArrowDownToLine,
  BadgeCheck,
  Bell,
  Database,
  EyeOff,
  FileText,
  Flag,
  Gauge,
  Globe,
  Hourglass,
  LayoutGrid,
  Lock,
  LogOut,
  MapPin,
  MessageCircle,
  Receipt,
  ShieldCheck,
  SunMoon,
  Tv,
  User,
  UserCheck,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";

/*
  The /settings index as data: the second level behind the More panel's one
  "Settings & privacy" row (founder's walk of TikTok's Settings and privacy
  page, 17 Oct). Grouped cards, an icon per row, our own words. Every link
  is a page that exists under src/app (settingsHub.test.ts and nav.test.ts
  check it), so there is no Help row until a help page exists.

  Two rows are not links: "theme" draws the System / Dark / Light switch
  inside its card (themeChoice.ts, the key the root layout reads) and
  "logout" is the red Log out row, which asks before it signs you out.
  Pure data — no hooks — so the tests pin the order down.
*/

export type SettingsRowAction = "theme" | "logout";

export interface SettingsRow {
  /** Unique across the whole page. */
  key: string;
  label: string;
  icon: LucideIcon;
  /** A link. Exactly one of href / action is set. */
  href?: string;
  action?: SettingsRowAction;
}

export interface SettingsGroup {
  key: "account" | "privacy" | "messaging" | "notifications" | "display" | "data" | "support" | "session";
  /** Card heading; the Log out card has none. */
  title?: string;
  rows: SettingsRow[];
}

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    key: "account",
    title: "Account",
    rows: [
      { key: "profile", label: "Profile", icon: User, href: "/settings/profile" },
      { key: "security", label: "Account & security", icon: ShieldCheck, href: "/settings/security" },
      { key: "verification", label: "Verification", icon: BadgeCheck, href: "/settings/verification" },
      { key: "addresses", label: "Addresses", icon: MapPin, href: "/settings/addresses" },
      { key: "tax-profile", label: "Tax profile", icon: Receipt, href: "/settings/tax-profile" },
    ],
  },
  {
    key: "privacy",
    title: "Privacy & safety",
    rows: [
      { key: "privacy", label: "Privacy", icon: Lock, href: "/settings/privacy" },
      { key: "social-preferences", label: "Who can connect with you", icon: Users, href: "/settings/social-preferences" },
      { key: "friend-requests", label: "Friend requests", icon: UserCheck, href: "/settings/friend-requests" },
      { key: "blocked", label: "Blocked accounts", icon: UserX, href: "/settings/blocked" },
      { key: "hidden-channels", label: "Hidden channels", icon: EyeOff, href: "/settings/hidden-channels" },
    ],
  },
  {
    key: "messaging",
    title: "Inbox & messaging",
    rows: [
      { key: "messaging", label: "Inbox & messaging", icon: MessageCircle, href: "/settings/messaging" },
    ],
  },
  {
    key: "notifications",
    title: "Notifications",
    rows: [
      { key: "notifications", label: "Notifications", icon: Bell, href: "/settings/notifications" },
    ],
  },
  {
    key: "display",
    title: "Content & display",
    rows: [
      { key: "appearance", label: "Appearance", icon: SunMoon, action: "theme" },
      { key: "wellbeing", label: "Time & wellbeing", icon: Hourglass, href: "/settings/wellbeing" },
      { key: "modules", label: "Module profiles", icon: Globe, href: "/settings/modules" },
      { key: "channel", label: "Channel settings", icon: Tv, href: "/settings/channel" },
      { key: "mini-apps", label: "Mini apps", icon: LayoutGrid, href: "/apps" },
    ],
  },
  {
    key: "data",
    title: "Data & storage",
    rows: [
      { key: "data-saver", label: "Data saver", icon: Gauge, href: "/settings/data-saver" },
      { key: "your-data", label: "Your data", icon: Database, href: "/settings/data" },
      { key: "offline", label: "Offline", icon: ArrowDownToLine, href: "/posttube/offline" },
    ],
  },
  {
    key: "support",
    title: "Support & about",
    rows: [
      { key: "report", label: "Report a problem", icon: Flag, href: "/grievance" },
      { key: "terms", label: "Terms & Policies", icon: FileText, href: "/terms" },
      { key: "privacy-policy", label: "Privacy policy", icon: ShieldCheck, href: "/privacy" },
    ],
  },
  {
    key: "session",
    rows: [
      { key: "logout", label: "Log out", icon: LogOut, action: "logout" },
    ],
  },
];

/** The words on the appearance switch, in THEME_CHOICES order. */
export const APPEARANCE_WORDS = { auto: "System", dark: "Dark", light: "Light" } as const;

/**
 * The Log out row's two steps. A press only asks; nothing signs you out
 * until the second, explicit "Log out" in the confirm step. Pure, so the
 * test can walk it without a DOM.
 */
export type LogoutStep = "idle" | "confirming";
export type LogoutEvent = "press" | "cancel" | "confirm";

export function nextLogoutStep(step: LogoutStep, event: LogoutEvent): { step: LogoutStep; logout: boolean } {
  if (event === "press") return { step: "confirming", logout: false };
  if (event === "cancel") return { step: "idle", logout: false };
  // "confirm" only counts from the confirm step.
  return { step, logout: step === "confirming" };
}

import {
  Briefcase,
  Clapperboard,
  Globe2,
  Heart,
  HelpCircle,
  MessageSquare,
  Radio,
  Shield,
  ShoppingBag,
  Sparkles,
  Tv,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

/*
  One product, many apps. The header names the app the viewer is inside —
  "Reels" on /reels, "PostTube" on /posttube, "Groups" on /groups — rather
  than the same generic bar everywhere. This is the ONE table that says
  which route is which app; the header reads it from the pathname, so a
  new app is one row here and nothing else.

  Order matters: the first prefix that matches wins, and the root "/" only
  matches when nothing else did.
*/

export interface AppBrand {
  /** Stable key (also the data-app attribute on the header). */
  key: string;
  /** The wordmark shown in the header. */
  name: string;
  /** Where the wordmark links. */
  href: string;
  icon: LucideIcon;
  /** The search box hint inside this app. */
  searchPlaceholder: string;
  /** Route prefixes that belong to this app. */
  prefixes: readonly string[];
}

const HOME: AppBrand = {
  key: "home",
  name: "VChat",
  href: "/",
  icon: Sparkles,
  searchPlaceholder: "Search people, posts, hashtags...",
  prefixes: ["/"],
};

export const APP_BRANDS: readonly AppBrand[] = [
  { key: "reels", name: "Reels", href: "/reels", icon: Clapperboard, searchPlaceholder: "Search reels, creators, hashtags...", prefixes: ["/reels"] },
  { key: "tube", name: "PostTube", href: "/posttube", icon: Tv, searchPlaceholder: "Search videos and channels...", prefixes: ["/posttube", "/tube"] },
  { key: "groups", name: "Groups", href: "/groups", icon: Users, searchPlaceholder: "Search groups...", prefixes: ["/groups"] },
  { key: "communities", name: "Communities", href: "/communities", icon: Globe2, searchPlaceholder: "Search communities...", prefixes: ["/communities"] },
  { key: "connections", name: "Connections", href: "/connections", icon: UserRoundPlus, searchPlaceholder: "Search people...", prefixes: ["/connections"] },
  { key: "messenger", name: "Messenger", href: "/messages", icon: MessageSquare, searchPlaceholder: "Search conversations...", prefixes: ["/messages", "/messenger", "/chat"] },
  { key: "live", name: "Live", href: "/live", icon: Radio, searchPlaceholder: "Search live streams...", prefixes: ["/live"] },
  { key: "ask", name: "Ask", href: "/qa", icon: HelpCircle, searchPlaceholder: "Search questions...", prefixes: ["/qa"] },
  { key: "pages", name: "Pages", href: "/pages", icon: Briefcase, searchPlaceholder: "Search pages...", prefixes: ["/pages"] },
  { key: "shop", name: "Shop", href: "/commerce", icon: ShoppingBag, searchPlaceholder: "Search products and sellers...", prefixes: ["/commerce", "/shop"] },
  { key: "match", name: "PostMatch", href: "/postmatch", icon: Heart, searchPlaceholder: "Search...", prefixes: ["/postmatch"] },
  { key: "admin", name: "Admin", href: "/admin", icon: Shield, searchPlaceholder: "Search users, reports...", prefixes: ["/admin"] },
  HOME,
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === "/") return true;
  return pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}?`);
}

/** The app a pathname belongs to; the home brand when none claims it. */
export function resolveAppBrand(pathname: string | null | undefined): AppBrand {
  const path = (pathname || "/").split("?")[0];
  for (const brand of APP_BRANDS) {
    if (brand === HOME) continue;
    if (brand.prefixes.some((p) => matchesPrefix(path, p))) return brand;
  }
  return HOME;
}

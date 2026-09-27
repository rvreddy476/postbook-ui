import { BarChart3, Captions, LayoutDashboard, Library, MessageSquareText, Palette, SlidersHorizontal, type LucideIcon } from "lucide-react";

/*
  The hub's own section rail (inside the PostTube shell, not the shell's
  nav). Vocabulary is ours: Overview, Library, Insights, Conversations,
  Captions, Branding, Preferences. Branding is a link into the channel
  settings another lane builds at /settings/channel.
*/
export interface HubNavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Only the exact path is current (the Overview at the hub root). */
  exact?: boolean;
  /** Leaves the hub (Branding). */
  external?: boolean;
}

export const HUB_ROOT = "/posttube/hub";

export const HUB_NAV: readonly HubNavItem[] = [
  { key: "overview", label: "Overview", href: HUB_ROOT, icon: LayoutDashboard, exact: true },
  { key: "library", label: "Library", href: `${HUB_ROOT}/library`, icon: Library },
  { key: "insights", label: "Insights", href: `${HUB_ROOT}/insights`, icon: BarChart3 },
  { key: "conversations", label: "Conversations", href: `${HUB_ROOT}/conversations`, icon: MessageSquareText },
  { key: "captions", label: "Captions", href: `${HUB_ROOT}/captions`, icon: Captions },
  { key: "branding", label: "Branding", href: "/settings/channel", icon: Palette, external: true },
  { key: "preferences", label: "Preferences", href: `${HUB_ROOT}/preferences`, icon: SlidersHorizontal },
];

export function isHubItemCurrent(item: HubNavItem, pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

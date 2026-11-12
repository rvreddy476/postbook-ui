import {
  Bell,
  BookOpen,
  AtSign,
  Bookmark,
  Briefcase,
  Film,
  Flame,
  HelpCircle,
  Home,
  House,
  Heart,
  MessageSquare,
  PanelsTopLeft,
  ShoppingBag,
  Tv,
  Users,
  UtensilsCrossed,
  Video,
} from 'lucide-react';
import { PARKED_NAV_IDS } from '@/lib/parkedProducts';
import { hiddenNavIds } from '@/lib/productFeatures';

/*
  The web rail and its More menu (components/Sidebar.tsx).

  Launch is four products: Social, Shorts (Reels), Long video (PostTube)
  and Commerce (MStore). Everything else is PARKED: built, its pages still
  served, but not offered in navigation until it launches. PARKED_NAV_IDS
  (lib/parkedProducts.ts) is the one list — take an id out of it and the
  entry comes back exactly where it was, here and in the launcher. Messenger
  stays: chat is part of Social.

  Communities was already consolidated into Groups and Channels are a mobile
  product; neither has an entry here.
*/

export type SidebarItem = {
  id: string;
  label: string;
  icon: typeof Home;
  href?: string;
  /**
   * Icon colour class. Every item inherits the rail's own colour so the nav
   * reads as ONE surface; only the ACTIVE item takes the accent.
   */
  color: string;
  /** Opens in a new browser tab (PostTube is a separate surface). */
  newTab?: boolean;
};

// The parked list lives in lib/parkedProducts.ts, so the launcher and the
// per-app rail (lib/appBrand.ts) read the same one.
export { PARKED_NAV_IDS };

// Primary rail — always visible. Sized so the rail never scrolls.
export const ALL_PRIMARY_ITEMS: readonly SidebarItem[] = [
  { id: 'Home', label: 'Home', icon: Home, href: '/', color: 'text-current' },
  { id: 'Feed', label: 'Feed', icon: PanelsTopLeft, href: '/feed', color: 'text-current' },
  { id: 'Reels', label: 'Reels', icon: Film, href: '/reels', color: 'text-current' },
  { id: 'Groups', label: 'Groups', icon: Users, href: '/groups', color: 'text-current' },
];

// Everything else opens from the "More" button instead of overflowing.
// Go Live sits right after PostTube: the post composer has no "go live"
// button, so this is the creators' way in.
export const ALL_MORE_ITEMS: readonly SidebarItem[] = [
  { id: 'Trending', label: 'Trending', icon: Flame, href: '/trending', color: 'text-current' },
  { id: 'Messenger', label: 'Messenger', icon: MessageSquare, color: 'text-current' },
  { id: 'Notifications', label: 'Notifications', icon: Bell, color: 'text-current' },
  { id: 'PostTube', label: 'PostTube', icon: Tv, href: '/posttube', newTab: true, color: 'text-current' },
  { id: 'GoLive', label: 'Go Live', icon: Video, href: '/live/new', color: 'text-current' },
  { id: 'Ask', label: 'Ask', icon: HelpCircle, href: '/qa', color: 'text-current' },
  { id: 'Pages', label: 'Pages', icon: Briefcase, href: '/pages', color: 'text-current' },
  { id: 'Shop', label: 'Shop', icon: ShoppingBag, href: '/shop', color: 'text-current' },
  { id: 'Feast', label: 'Feast', icon: UtensilsCrossed, href: '/feast', color: 'text-current' },
  { id: 'Doorstep', label: 'Doorstep', icon: House, href: '/doorstep', color: 'text-current' },
  { id: 'PostMatch', label: 'Pulse', icon: Heart, href: '/dating', color: 'text-current' },
  // Echo (premium short notes): shown only while GET /v1/features says echo is open.
  { id: 'Echo', label: 'Echo', icon: AtSign, href: '/echo', color: 'text-current' },
  { id: 'Saved', label: 'Saved', icon: Bookmark, href: '/saved', color: 'text-current' },
  { id: 'Memories', label: 'Memories', icon: BookOpen, href: '/memories', color: 'text-current' },
];

/** The entries offered now: every item whose id is not parked. */
export function launchedItems(items: readonly SidebarItem[], parked: ReadonlySet<string> = PARKED_NAV_IDS): SidebarItem[] {
  return items.filter((item) => !parked.has(item.id));
}

// The static lists assume no features answer yet: the parked list plus every
// product that fails closed (Echo), so nothing reading them can leak a way in.
export const primaryItems: readonly SidebarItem[] = launchedItems(ALL_PRIMARY_ITEMS, hiddenNavIds(null));
export const moreItems: readonly SidebarItem[] = launchedItems(ALL_MORE_ITEMS, hiddenNavIds(null));

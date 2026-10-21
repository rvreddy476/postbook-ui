/*
  The "Open in app" banner's rules, pure so they are unit-tested: which
  routes carry it, which visitors see it, and where its two buttons go.

  It shows only where a shared link lands (the routes below), only on a
  phone (an Android or iOS user agent AND a phone-width viewport: a tablet
  or a desktop window narrowed for a moment gets nothing), and never again
  for a week once it is dismissed.
*/

import { appIntentHref, playStoreHref } from "./shareRef";

/** Phone width: up to and including this many CSS pixels. */
export const PHONE_MAX_WIDTH = 767;

/** How long a dismissal is remembered. */
export const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

export const DISMISS_STORAGE_KEY = "pb_open_in_app_dismissed_at";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const REF = "[A-Za-z0-9%._-]{1,128}";

/** The routes a shared link lands on. A list, so a new share surface is added here on purpose. */
const APP_ROUTES: readonly RegExp[] = [
  new RegExp(`^/post/${UUID}/?$`, "i"),
  new RegExp(`^/reels/${UUID}/?$`, "i"),
  new RegExp(`^/posttube/watch/${UUID}/?$`, "i"),
  new RegExp(`^/shop/products/${REF}/?$`),
  new RegExp(`^/u/${REF}/?$`),
  new RegExp(`^/posttube/channel/${REF}/?$`),
  new RegExp(`^/channel/${REF}/?$`),
  new RegExp(`^/reels/sound/${UUID}/?$`, "i"),
  new RegExp(`^/hashtag/${REF}/?$`),
];

export function isAppRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return APP_ROUTES.some((re) => re.test(pathname));
}

export type Platform = "android" | "ios" | "other";

/** Android, iOS (iPadOS reports itself as a Mac and is not a phone), or neither. */
export function platformOf(userAgent: string | null | undefined): Platform {
  const ua = userAgent ?? "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipod/i.test(ua)) return "ios";
  return "other";
}

export interface BannerInput {
  pathname: string | null | undefined;
  userAgent: string | null | undefined;
  /** window.innerWidth; null before the page has measured. */
  width: number | null | undefined;
  /** The stored dismissal time (ms since epoch), null when never dismissed. */
  dismissedAt: number | null | undefined;
  now: number;
  /** NEXT_PUBLIC_PLAY_STORE_URL; "" or undefined when unset. */
  playStoreUrl: string | null | undefined;
  /** NEXT_PUBLIC_APP_STORE_URL (optional, there is no iOS app today). */
  appStoreUrl?: string | null | undefined;
}

export type BannerDecision =
  | { show: false }
  | { show: true; platform: "android" | "ios"; openInApp: boolean; getTheApp: boolean };

/**
 * Whether to show, and which of the two buttons. Android always has "Open in
 * app" (the intent falls back to the page or the store on its own); "Get the
 * app" needs a store link. iOS has no app yet, so it shows only when an App
 * Store link is configured, and then only "Get the app".
 */
export function bannerDecision(input: BannerInput): BannerDecision {
  if (!isAppRoute(input.pathname)) return { show: false };
  if (typeof input.width !== "number" || input.width <= 0 || input.width > PHONE_MAX_WIDTH) return { show: false };
  if (typeof input.dismissedAt === "number" && input.now - input.dismissedAt < DISMISS_FOR_MS) return { show: false };
  const platform = platformOf(input.userAgent);
  const play = (input.playStoreUrl ?? "").trim();
  const appStore = (input.appStoreUrl ?? "").trim();
  if (platform === "android") return { show: true, platform, openInApp: true, getTheApp: play.length > 0 };
  if (platform === "ios") return appStore ? { show: true, platform, openInApp: false, getTheApp: true } : { show: false };
  return { show: false };
}

export interface BannerLinks {
  /** intent:// for Android; null on iOS. */
  openInApp: string | null;
  /** The store page with the Install Referrer; null when no store link is set. */
  getTheApp: string | null;
}

/**
 * The two addresses for a page. `pageUrl` is the absolute https address of
 * the page, `ref` the share ref it was opened with (or a fresh one).
 */
export function bannerLinks(input: {
  platform: "android" | "ios";
  pageUrl: string;
  ref: string | null;
  playStoreUrl: string | null | undefined;
  appStoreUrl?: string | null | undefined;
  packageName?: string | null;
}): BannerLinks {
  let link: string | null = null;
  try {
    const u = new URL(input.pageUrl);
    link = `${u.pathname}${u.search}`;
  } catch {
    link = null;
  }
  if (input.platform === "ios") {
    const store = (input.appStoreUrl ?? "").trim();
    return { openInApp: null, getTheApp: /^https:\/\//i.test(store) ? store : null };
  }
  const getTheApp = playStoreHref(input.playStoreUrl, { ref: input.ref, link });
  const openInApp = appIntentHref(input.pageUrl, { packageName: input.packageName, fallbackUrl: getTheApp ?? input.pageUrl });
  return { openInApp, getTheApp };
}

/*
  Which feed the stage shows, from the URL. `/reels` is For You;
  `/reels?feed=following` is Following. Pure, so the sidebar's "current"
  rule and the stage read the same answer.
*/

export type ReelFeedKind = "for-you" | "following";

export const FEED_PARAM = "feed";

export function feedFromSearch(params: URLSearchParams | null | undefined): ReelFeedKind {
  return params?.get(FEED_PARAM) === "following" ? "following" : "for-you";
}

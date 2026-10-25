import type { PostDetail } from "@/types/profile";

/*
  The embed of a post on another site: an iframe of /post/<id>/embed, a bare
  player. /post/ is already a public prefix in middleware, so the frame
  opens with no session — and a third-party frame has none anyway.

  Only a PUBLIC video post is embeddable. post-service's direct read already
  404s private and followers-only posts for a stranger and redacts
  members-only ones; this check is the second gate, for the case where the
  page is opened by a signed-in viewer who may see more than the public
  does. Unlisted is refused too: an embed on someone else's page is not a
  link the author chose to hand out.
*/

type EmbedFields = Pick<PostDetail, "visibility" | "media" | "tier_required_id" | "body_redacted" | "age_restricted">;

/** The video the embed plays, or null when the post must not be embedded. */
export function embeddableVideoId(post: EmbedFields | null | undefined): string | null {
  if (!post) return null;
  if ((post.visibility ?? "").toLowerCase() !== "public") return null;
  if (post.tier_required_id || post.body_redacted) return null;
  if (post.age_restricted) return null;
  const video = (post.media ?? []).find((m) => m.kind === "video" && m.media_id);
  return video ? video.media_id : null;
}

export function isEmbeddablePost(post: EmbedFields | null | undefined): boolean {
  return embeddableVideoId(post) !== null;
}

export function embedPath(postId: string): string {
  return `/post/${encodeURIComponent(postId)}/embed`;
}

/** The snippet "Copy embed code" puts on the clipboard. */
export function embedCode(origin: string, postId: string): string {
  return `<iframe src="${origin}${embedPath(postId)}" width="550" height="420" frameborder="0" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>`;
}

/** The one line the embed page shows for anything it will not play. */
export const EMBED_UNAVAILABLE_TEXT = "This video isn't available to embed.";

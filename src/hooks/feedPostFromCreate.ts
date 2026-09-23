import type { PostDetail } from "@/types/profile"

/**
 * Make a create response renderable as a feed card.
 *
 * `POST /v1/posts` answers with the post as post-service stores it: id, text,
 * visibility, rich_text, timestamps — and `author_id` on its own. It carries
 * no author profile, no `counts` and no `media[]`, because those are assembled
 * by the feed's hydration step, not by the create. Dropping the response into
 * the feed cache unchanged therefore renders a card with no name, no avatar
 * and no picture.
 *
 * Every missing piece is already known on the client at that moment, which is
 * what makes this safe rather than a guess:
 *
 *   - the author is always the current user, and PostCard short-circuits on
 *     `isOwnPost` to use `useMyProfile()` anyway rather than the post's author
 *     fields, so nothing here needs to invent them;
 *   - a post one millisecond old has no likes, comments or shares;
 *   - the composer uploaded the media itself and holds each id and kind.
 *
 * This is a STAND-IN, not a source of truth. Fan-out lands about a second
 * later and `invalidateQueries` replaces it with the server's row; the feed
 * de-duplicates by `id`, so the swap is invisible.
 */
export function feedPostFromCreate(
    created: PostDetail,
    media?: { media_id: string; kind: string }[],
): PostDetail {
    return {
        ...created,
        counts: created.counts ?? { likes: 0, comments: 0, shares: 0 },
        // `||` rather than `??`: the server sends an empty array, not null,
        // when it has not hydrated media, and an empty array would win over
        // what the composer actually uploaded.
        media: (created.media && created.media.length > 0 ? created.media : media) || [],
        viewer_reaction: null,
        is_bookmarked: false,
    }
}

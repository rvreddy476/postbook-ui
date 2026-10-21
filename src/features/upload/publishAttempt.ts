/*
  One publish attempt: what stays the same when the person presses Publish
  again after a failure, so a retry cannot publish the video twice.

  - `key` is the Idempotency-Key for POST /v1/posts. post-service binds it
    to the whole request body (C-P0-5): the same key with the same body
    replays the first post; the same key with a different body is refused
    with 409 IDEMPOTENCY_KEY_REUSED.
  - `cover` remembers the cover already uploaded for this attempt. Without
    it every retry uploaded the cover again, got a new cover_media_id, and
    the changed body was refused, so the stable key could never help.

  The attempt is kept when the outcome is unknown (no response, a 5xx, or
  the first request still running) and dropped when the server answered
  with a definite refusal (any other 4xx: nothing was created, so the next
  press starts a new attempt) or the publish succeeded.
*/

export interface PublishAttempt {
  key: string;
  cover: { source: unknown; mediaId: string } | null;
}

export function newPublishAttempt(makeKey: () => string = () => crypto.randomUUID()): PublishAttempt {
  return { key: makeKey(), cover: null };
}

/** True when a failed publish may still have created the post, so a retry must reuse the attempt. */
export function keepPublishAttempt(err: unknown): boolean {
  const response = (err as { response?: { status?: unknown; data?: { error?: { code?: unknown } } } } | null)?.response;
  if (!response || typeof response.status !== "number") return true;
  if (response.status >= 500) return true;
  return response.data?.error?.code === "IDEMPOTENCY_IN_PROGRESS";
}

/** The cover media id already uploaded in this attempt for the same source, if any. */
export function cachedCover(attempt: PublishAttempt, source: unknown): string | null {
  return attempt.cover && attempt.cover.source === source ? attempt.cover.mediaId : null;
}

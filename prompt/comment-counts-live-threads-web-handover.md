# Comment counts and live threads — web wiring

2026-09-26. Workspace: `C:/workspace/postbook-ui`, branch `chore/production-hardening`.
Read the complete backend handover at `C:/workspace/modernsmapp/docs/handoffs/2026-09-26-comment-counts-and-live-threads.md` before implementation.

## Behaviour

- Reel detail consumes `counts.comments` including replies and zero, and the returned author ID/name/username/avatar. Detail refresh now updates creator fields in feed and deep-link reel copies. An avatar media ID is rendered through the media serve route when no avatar URL is supplied. Titles are never synthesized from descriptions. No first-page comment-count inference remains in the reel/post thread path (the previous tree already used server totals there).
- Post room subscriptions are reference-counted desired state. No subscribe is sent before socket open. Every socket open/reconnect sends active subscriptions again, followed by thread/detail refresh. Leaving the final mounted consumer sends unsubscribe; leaving offline cannot replay a stale subscription. Shared reel/drawer/post-card consumers cannot unsubscribe each other.
- `comment_change` is handled by the production messageService socket. Event IDs are deduplicated and versions at or below the per-post watermark are discarded; ordering survives reconnects. State is bounded to 500 recently seen posts and 500 IDs per post. Invalid counts/versions/change types are rejected.
- Accepted changes set absolute comment counts across reel, post-detail and feed caches, then invalidate authorized comment/around reads for created, replied, edited, deleted, moderated and reaction changes. No comment body is taken from a frame. Legacy `post_update.comments` is also an absolute total; reaction/share refresh behaviour is retained.
- Existing mutation-success/settled handlers still refresh locally, independent of self-echo. Existing reel 15-second open-thread / 30-second closed-thread refresh remains. Shared post threads also poll and periodically retry subscriptions; silently refused rooms do not disable HTTP fallback.
- Group typing now accepts only `post_id`; any legacy user identity is discarded. Anonymous posts can send/listen for typing and show only “Someone is typing…”, expiring after inactivity. Group live-comment room subscriptions remain disabled. Delivery of typing still depends on backend routing/gates; this pass does not enable those gates.

## Files changed in this pass

1. `src/services/messageService.ts` — dispatch, socket lifecycle, identity-free typing.
2. `src/lib/postThreadLive.ts` — new dedupe/version gate, reference-counted rooms and thread lifecycle binding.
3. `src/lib/commentCache.ts` — authoritative count cache patching.
4. `src/hooks/usePostRoom.ts` — shared live-thread subscription, reconnect refresh and polling.
5. `src/features/reels/hooks/useReelLive.ts` — shared room hook and refreshed creator fields.
6. `src/features/reels/model.ts` — returned author ID and media-avatar mapping.
7. `src/components/CommentSection.tsx` — live subscription while a normal post thread is expanded.
8. `src/components/groups/GroupPostCommentSection.tsx` — neutral typing and continued group-comment room hold.
9. `src/lib/__tests__/postThreadLive.test.ts` — 12 new tests.
10. This handover.

Earlier uncommitted UI work was preserved. No staging, commit or push. No modernsmapp source/config files edited.

## Executed checks

```text
bunx tsc --noEmit
exit 0

bunx bun test src/lib/__tests__/postThreadLive.test.ts
12 pass
0 fail
66 expect() calls

bunx bun test
358 pass
0 fail
1001 expect() calls
Ran 358 tests across 36 files.

bun run build
Compiled successfully
TypeScript passed
Generated 160/160 pages
exit 0

git diff --check
exit 0 (existing Windows line-ending notices only)
```

The reconnect regression drives the REAL `connectToHub` WebSocket handlers using an in-test transport and signing response: initial subscribe, disconnect, scheduled reconnect, resubscribe, reconnect refresh notification, duplicate/older-frame rejection, and final unsubscribe. No real credentials or test content are used. Other tests cover offline cleanup, shared ownership, silent-refusal refresh, all change types, legacy counts, reply-inclusive totals, author mapping, and identity-free typing.

Initial sandboxed Bun/TypeScript attempts hit filesystem permission errors; the final gates above were rerun with appropriate workspace access and passed. The build retains the existing Next middleware deprecation warning. No two-account live mutation exercise was performed in this pass; backend live proof is recorded in its handover, not claimed as independently rerun here.

## Deployment

Executed the requested `docker compose build web` followed by `docker compose up -d --no-build --force-recreate web`. Build and restart succeeded; final check: `web: Up 15 seconds (healthy)`. The build-time `CHAT_PROXY_SECRET_MISSING` warning was checked against the running container: `Runtime chat signing configured: true` (presence check only, no secret disclosed). No backend source/config edits were needed.

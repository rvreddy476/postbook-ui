# Reels design and live comments — 26 September 2026

Workspace: C:/workspace/postbook-ui. Branch: chore/production-hardening. The separate C:/workspace/postbook-ui-reels worktree was inspected read-only and left untouched. No backend changes; no commit/push in this pass.

## Changes

- Reuses the app's Header/Sidebar via AppShell, replacing Reels' separate branding/header. Theme-based workspace, compact feed switcher, viewport-height portrait stage, adjacent desktop comments and mobile sheet.
- Maps the real title field separately from text/description. Overlay shows title only; description remains accessible in the existing details menu. Missing titles are not manufactured from descriptions.
- View count is now a compact upper-left badge. Expanded player centers a 9:16 content area, with video object-fit contain in fullscreen; browser width no longer stretches/crops it into a landscape stage.
- Active reel joins the existing post room; matching events trigger debounced authoritative reads, never local count increments. Subscription/timer cleanup happens on reel change/unmount. Existing socket infrastructure re-subscribes rooms after reconnect.
- Visible active reel refreshes on focus/reconnect and every 30 seconds, or 15 seconds with comments open; no background polling. This also reconciles processing state and edits for which the backend currently publishes no post-room event.
- Create/reply/edit/delete/comment-like/dislike invalidations include deep-link comment lists, reel live metadata and pinned detail. Pinned and feed copies share absolute count updates. Duplicate events cannot increment counts twice.
- Comment body scrolls independently of the composer. Submission failure retains the draft and displays an error; a successful response does not erase text typed while the request was in flight. Null comment arrays are accepted. Comment/refreshed reply counts no longer remain permanently initialized to stale values. Swiping within comments does not navigate the reel.
- Reduced-motion reel transitions and consistent spatial controls follow the workspace apple-design skill.

## Checks

### Follow-up: clipped playback settings

- Settings now anchor below the full-width playback-controls bar, capped to the portrait width; they no longer open leftward outside the clipping frame. Long desktop panes have bounded internal scrolling, with wheel/touch events kept out of reel navigation.
- Mobile menu portals target the active fullscreen root when present. Fullscreen exit remains bottom-right, clear of the settings menu.
- Type-check passed; 34 focused Reels tests passed with 105 expectations. Docker production build/recreation passed. Live browser verified all four root labels and the full speed submenu without clipping.

### Follow-up: reference-style expanded view

- Removed For you/Following feed tabs; the default reel feed remains active.
- Fullscreen now targets the entire Reels workspace, not just the player. Portrait video remains centered with themed surrounding space, creator/title details at lower-left on wide screens, and the action rail on the right. Comments and dialogs remain descendants of the fullscreen root.
- Responsive spacing follows the workspace design skill; mobile retains overlay details and caps portrait height by available width.
- Re-ran type-check, 339 tests (0 failures), local build and Docker web rebuild/recreation successfully. Live browser confirmed tabs absent, portrait fullscreen geometry, left details/right controls, and comments accessible while expanded.
- During the live check, playback initially worked but later displayed an unavailable-media state. Cause not diagnosed by this layout-only follow-up; no claim of uninterrupted media E2E. Previously documented backend counter/title/author boundaries remain.

- bunx tsc --noEmit: exit 0.
- bunx bun test: 338 passed, 0 failed, 889 expectations, 34 files.
- bun run build: exit 0, 160 static pages.
- Added tests for title/description separation, overlay markup, absolute count updates across feed and pinned copies, and comment action invalidation targets.
- Docker web rebuild/recreation succeeded; container reported healthy. Verified the deployed reel on desktop and at 390 × 844: shared shell, playback, upper-left views, desktop comments/mobile sheet, and centered portrait fullscreen with side margins. Reset the temporary viewport override afterward.

## Boundaries

- Backend EditComment currently only updates the store, with no realtime publication. This web pass cannot guarantee immediate cross-device edits: open comments reconcile every 15 seconds. True event completeness requires backend work (below).
- Live post 7b1d256c-4fa9-4d49-bfdc-870370037117 has a visible comment but its refreshed total remains zero. Source inspection identifies divergent counter paths: post-service/internal/service/post.go:1453 reads Scylla GetCounts for post detail, while CreateCommentPG at 2486 and deletion at 2583 update sharded PostgreSQL/Redis comment counters. internal/store/scylla/interactions.go:193 reads post_counters. Reconcile these paths server-side; do not invent a total from the client's first comment page. This remains a visible backend defect.
- This live deep-linked reel also renders the existing author fallback “Someone” and no title. Title rendering is unit-proven for a populated title field, not proven populated for this existing reel. Check detail/feed author enrichment and stored title before calling that particular record complete.
- Six-reaction comment APIs remain the separately documented backend dependency; this pass does not invent them.
- No two-account live create/edit/delete/reply or mobile physical-device gesture proof is claimed. Existing processing-media problems cannot be repaired by changing page CSS.

## Copy-paste backend follow-up

In C:/workspace/modernsmapp, inspect post-service comment event publication and ws-gateway post-room delivery. Do not edit the web or other parallel workspaces. First fix the counter-read mismatch: GET /v1/posts/:id currently reads Scylla post_counters while PG comment mutations update sharded PostgreSQL/Redis counters. The dev reel 7b1d256c-4fa9-4d49-bfdc-870370037117 has a visible comment but detail returns a zero total. Make list/detail/event totals converge to one authoritative definition, including replies/deletes and idempotent retries; provide regression proofs without counting only the first page. Also check title and author enrichment consistency between feed and direct post detail (the web currently shows “Someone” and no title on that reel); do not manufacture a title from its description. Make successful comment create, reply, edit, delete and reaction changes reliably notify authorized viewers of the parent post, including reconnect reconciliation. Preserve parent visibility, moderation and block checks; never expose held/private bodies to unauthorized room subscribers. Include post_id, comment_id, change type and an event identity/version so clients can deduplicate/invalidate safely. Verify delivery with two independent viewers, including deletion/reply/edits and disconnect/reconnect. Document actual wire frames and remaining delivery guarantees; do not claim an EditComment store update is a realtime event. Preserve unrelated changes; no commit/push without founder authorization.

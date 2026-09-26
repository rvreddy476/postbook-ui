# Groups discovery and shared reactions — 26 September 2026

Workspace: C:/workspace/postbook-ui, chore/production-hardening. Existing dirty changes preserved; no staging, commits or pushes. No backend edits.

## Implemented

- Groups directory opens Discover by default, with the reference-inspired sidebar, hero/search, view pills, category strip, cover cards, community-size section and supporting panel. Feed remains reachable through /groups?view=feed. Existing detail pages retain their shell.
- Real groups, uploaded covers and member counts only; missing covers use a themed illustration. No fabricated members, growth percentages, trending claims or portrait identities. Consequently this is not a pixel-identical copy of the supplied photomontage.
- Shared ReactionControl supports six choices, hover, touch hold, keyboard selection and immediate pending selection without a spinner. Confirmed counts remain authoritative; failed requests roll selection back and display a retryable error.
- Group posts use the existing PUT/DELETE adapter and shared cache patch. Main-feed PostCard uses six reactions, including its inline reel presentation; Smile maps to the existing post-service wire value haha. Toggle POSTs are not automatically retried.
- Ordinary comments/replies reuse the control in Like-only mode, using returned counts. Separate Reels/Tube screens are not migrated in this pass.

## Missing API support — not simulated

Ordinary comments/replies expose like/dislike only; group comments/replies have no reaction write endpoint. Six-choice controls cannot truthfully persist there yet. See comment-reactions-backend-request.md for the complete Claude request. Existing ordinary-comment reads also need viewer selection fields for reload persistence.

## Verification

- bunx tsc --noEmit: exit 0.
- bunx bun test: 306 passed, 0 failed, 797 expectations across 28 files.
- bun run build: exit 0; 160 static pages generated. Existing middleware deprecation warning remains.
- Disposable seeded preview: desktop discovery layout, actual-category filtering (Technology returned the two matching fixture groups), mobile dark layout and shared pending-state behavior checked in browser.
- Held request: Like emoji appeared immediately while total stayed 9; refusal restored unselected state with an error. Love appeared immediately with total 9; acknowledgement changed the confirmed total to 10. Six choices visible in the picker.
- Preview used the real Groups page and shared reaction control with a fixture-only shell and cache. This proves component behavior, not authenticated live API persistence or the real global-header mobile integration.
- Temporary preview worktree removed after checks; preview-only held-request markers absent from real src. Existing separate reels worktree left untouched.
- The original browser tab could not be restored after a local connection error because the generated error-page URL was blocked. A fresh live tab successfully loaded https://cleestudio.com/groups after deployment: new shell/hero/topics visible, three real memberships in the sidebar, and an honest empty discovery state. Live reaction writes were not exercised in this pass; pending/rollback behavior was verified in the isolated preview.

## Deployment

Requested Docker web rebuild and recreation completed with exit 0. Final check: `web: Up 31 seconds (healthy)`. Production image built from the real workspace, not the seeded preview. Build-time existing ChatProxy missing-secret warning was printed; chat configuration was not changed or verified in this UI pass.

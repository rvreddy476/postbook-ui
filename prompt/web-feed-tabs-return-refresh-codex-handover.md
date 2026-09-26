# Feed tab integration, search alignment and return refresh — 25 September 2026

Workspace: C:\workspace\postbook-ui. Existing dirty changes preserved; no stage/commit/branch/push. No backend/mobile changes.

## Implemented

1. Saved shortcut removed only from the For you/Following tab bar. Bookmark actions elsewhere remain. Tabs are text-only, compact, underlined when selected, and directly join the first post (no detached-card gap or doubled top border). Keyboard tab navigation remains intact. Approved 452px card width and media sizing stay unchanged.
2. Home header measures the rendered feed column (including sidebar/discovery layout), aligning search to its left edge. The field matches feed width where space permits, shrinks before touching action controls, and becomes the existing search button/panel below 180px available input space. ResizeObserver follows header, feed, main and actions; no polling or horizontal scrolling. Other routes retain normal header layout.
3. Return policy: one minute or more outside the focused/visible page triggers one refresh when it becomes both visible and focused again. Short tab switches and idle reading inside the page do not refresh. Offline return waits for online. Focus plus visibility events are deduplicated; no overlapping return requests. Listeners clean up on unmount.
4. Refresh restarts the active ranked/chronological query at its first cursor: cancel the existing query, retain the first cached page while loading, remove stale continuation pages, refetch from the server, consume the new-post notice and return to the feed top on success. Errors use the existing feed retry surface. No page reload, logout, or composer-state reset. Query requests now receive the cancellation signal; default focus refetch is disabled for this home-feed hook to avoid bypassing/doubling the return policy.

## Verification

- `bunx tsc --noEmit`: PASS.
- `bunx bun test`: 256 PASS, 0 FAIL, 550 expectations across 21 files.
- Five new tests run the production event installer against EventTarget window/document seams and a deterministic clock: short vs eligible absence, paired-event deduplication, active-page inactivity, offline reconnect, held refresh, cleanup, retry after error; plus aligned input width/fallback calculation.
- Native browser hide/minimise/one-minute elapsed journey is not claimed by those unit tests; browser geometry and live deployment observations follow below.

## Boundaries

No whole-app refresh is used, so an open composer or message draft is not destroyed. Only the active feed is fetched on return. No server policy/ranking changes, new API endpoints, dependencies or timers for periodic full-feed fetching. Existing delta polling remains unchanged.

## Deployment and live checks

- Founder-authorized `docker compose build web`, `docker compose up -d --no-build --force-recreate web`, and requested container status: exit 0. Build/typecheck completed and all 159 pages generated. Existing middleware deprecation/build-environment ChatProxy warning unchanged.
- Live 1280px viewport: search and feed both left=390/right=842/width=452 CSSpx. Tabs height=45.33px and bottom=125.33px equals first post top=125.33px; first post top corners are square at the join. No Saved link in tabs. Post dimensions remain 452 x 475.96px.
- Live 1024px viewport: feed/search left=414px, search width=216px with 16px clearance to action rail. Field deliberately shortens rather than overlap.
- Live 320px viewport: header width=scrollWidth=320px, search-button fallback; feed width=296px; tabs-to-first-post gap=0; Saved absent.
- Real Refresh feed button exercised after deployment: returned enabled, 16 rendered posts, no feed error. No post/account mutation performed. Native one-minute background return remains unit-verified rather than claimed as an executed OS-level journey.
- Viewport override reset; no theme changes made in this pass. `git diff --check` passed.

# Responsive header correction — 25 September 2026

Workspace: C:\workspace\postbook-ui. Existing dirty work preserved. No Git staging, commit, push or branch.

## Request and implementation

Search overlapped the action rail because a three-column equal-outer-track grid reserved a centred search without guaranteeing enough space for the actions. Header.tsx now uses a flexible search region and a non-shrinking action region. New header.css scopes the presentation and uses the header's actual available width, not monitor width alone, so the expanded sidebar is accounted for.

- Search field up to 400px, flexible remaining space; at less than 720px of header content width it becomes an explicit search button with the existing search panel.
- Secondary shortcuts appear at 520px of header content width; essential create, messages, notifications and account controls remain available below that threshold. No horizontal scroller.
- Solid theme-token surface, restrained border/shadow, 12px rounded icon targets, accented create action, account separator and subdued avatar border; no oversized pill around all icons.
- Search explicitly names its actual scope (people), retains the existing API/search selection behavior, and has an accessible label and clear-search label.
- Profile navigation is a single link instead of a button nested in a link. Existing account menu, notifications, unread badges, themes, routing and action callbacks are preserved.
- Header remains 64px high and retains sidebar offset behavior. Approved feed/card dimensions are untouched. No backend/mobile/Flutter changes or dependency changes.

## Verification

- `bunx tsc --noEmit`: PASS after retrying with workspace/cache access (initial sandbox EPERM was an access failure).
- `bunx bun test`: 251 PASS, 0 FAIL, 537 expectations across 20 files after access retry.
- `git diff --check`: PASS; only existing line-ending notices.
- Founder-authorized Docker web build/deployment and browser checks recorded below after completion.

## Deployment and browser results

- `docker compose build web` then `docker compose up -d --no-build --force-recreate web` then the requested `docker ps` status command: exit 0. Production build compiled, typechecked and generated all 159 pages. Immediate container status was Up (health starting).
- Live https://cleestudio.com/ reloaded after deployment. At 1280px viewport, expanded sidebar left 1024px for the header; search region ended at 886px and actions began at 902px (16px clear gap). Screenshot checked in light mode.
- At 1024px viewport with expanded sidebar, dark mode: header 768px wide, search region 338px, 16px clear gap to actions; header scrollWidth equals header width. Screenshot checked.
- At 320px viewport after the sidebar-offset transition settled: header width/scrollWidth both 320px, actions end at 310px (10px margin). Compact search opens a 320px-wide panel and focuses the actual Search people field. No search query submitted.
- Original light theme restored and temporary viewport overrides reset. Feed/card sizing files untouched.
- Build still reports existing Next middleware deprecation and build-environment ChatProxy configuration warning; this pass does not alter that configuration.

## Scope boundaries

No real posts, messages, notification-read actions or account mutations are submitted as UI tests. This is header presentation, not a rewrite of notification/search logic. Existing Events shortcut behavior is unchanged. No new backend promises.

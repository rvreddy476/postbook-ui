# Single home feed — 25 September 2026

The founder clarified that For you/Following themselves must be completely removed, not the automatic return refresh.

Workspace: C:\workspace\postbook-ui. Preserve all existing uncommitted work. No Git staging, commit, branch or push.

## Changes

- Feed.tsx: removed the entire tab/refresh toolbar, tab state, inactive chronological query, keyboard tab handlers, tab IDs and references. Home now mounts only its existing ranked query with excludeSelf=false and circleOnly=false. No backend feed/ranking changes.
- Replaced obsolete tabpanel semantics with a named Feed posts section.
- Removed obsolete tab CSS and the first card's tab-joining overrides; first post again has normal rounded top corners and a complete border. Approved card width/height/media behavior and header/search alignment are unchanged.
- Empty feed copy no longer suggests a Following tab. Existing discover/create actions remain.
- Automatic one-minute-away return refresh, new-post notice, pagination, error retry and live engagement updates remain. No new replacement toolbar or invented feature was added.

## Verification

- `bunx tsc --noEmit`: PASS.
- `bunx bun test`: 256 PASS, 0 FAIL, 550 expectations across 21 files.
- Founder-authorized web build/deploy and live verification recorded after completion below.

## Deployed result

- Docker web build/typecheck completed, 159 pages generated; recreate/status command exited 0. Immediate status Up (health starting).
- Reloaded cleestudio.com: zero tabs/tablists/tabpanels and no toolbar; 16 posts rendered. Feed top and first-post top both 80px; card remains 452px wide with restored 14px top corners. No content mutation performed.
- Source scan found no remaining activeTab/following/tablist/tabpanel/home-feed-tab references in Feed.tsx or home-feed.css. Diff check produced only existing line-ending notices.

# Groups workspace and Add members popup

Date: 25 September 2026. Web workspace C:\workspace\postbook-ui.

## Implemented

- `/groups/[groupId]` now uses the shared authenticated AppShell/Header, including while group details load or are unavailable.
- Shared GroupsWorkspace for `/groups` and group detail: left navigation with default Feed, joined-group names, filter and create-group link; mobile collapsible navigation.
- Group links open the specific group discussion/feed. GroupView is keyed by the route identifier so local modal/search state cannot carry into another group.
- `/groups` retains aggregate group feed as the default, discovery/invites/my-groups views, real group search and existing engagement. Removed duplicated old left rail and the placeholder sponsored right rail in favour of the shared layout.
- Header includes a desktop Home brand link when there is no global sidebar. Existing mobile Back remains.
- Add members is a native modal dialog with Escape, focus restoration, initial search focus and an inert background. Uses connections and real server suggestions; name/username search is debounced 300ms with query cancellation and no stale-result display.
- Selection cap 50; excludes self and known members from suggestions, de-duplicates candidates. Server remains the authority for all membership decisions and existing-member checks.
- Uses existing batch add/invite API and truthful aggregate summary: added / invited / skipped. No names attached to skipped outcomes. Strict outcome parsing prevents malformed successes being silently interpreted as zero.
- No user location inferred, no online status exposed, no external generated avatar request. Related labels use only known server reason codes; no raw explain_text/institution names displayed.
- Header responsive treatment adjusts actions beneath the cover on narrow/tablet widths. Group tab row wraps rather than overflowing horizontally.

## Files

New: GroupsWorkspace.tsx, groups-workspace.css, groupPeople.ts, group-people.css, __tests__/groupPeople.test.tsx under src/components/groups/.
Changed: src/app/groups/page.tsx; src/app/groups/[groupId]/page.tsx; GroupCoverHeader.tsx; GroupInviteModal.tsx; src/hooks/useGroups.ts; src/components/Header.tsx.

Existing create/settings pages already have AppShell; this pass does not rewrite their forms. No backend/mobile changes. Entire pre-existing dirty tree preserved; no Git mutations.

## Verification

Working directory C:\workspace\postbook-ui:

```powershell
bunx tsc --noEmit
bunx bun test
```

Typecheck exit 0. Final run: 271 tests pass, 0 fail; 622 expectations, 23 files. Seven new tests cover search envelopes/errors, safe candidate filtering, server-only reason labels, explicit count outcomes and default/active group links. Initial tests exposed a real undefined-handle active-selection bug, corrected before deployment, plus brittle attribute-order expectations, corrected to inspect the same element independent of attribute order.

Deployment uses the founder-authorised build/recreate command from C:\workspace\modernsmapp\Architecture\docker. Builds and recreations exited 0, with 160/160 pages generated. The final build includes tablet action positioning, desktop Home brand, initial dialog focus and mobile action contrast. Existing middleware-deprecation/build-time ChatProxy-secret warning unchanged; runtime chat configuration was not audited.

```powershell
docker compose build web
docker compose up -d --no-build --force-recreate web
docker ps --filter name=atpost_stack-web-1 --format 'web: {{.Status}}'
```

Live read-only checks on https://cleestudio.com:
- MyFamily group detail displays shared Header, left group navigation area, default Discussion and Add members button.
- Connections populate the modal.
- Searching “Minnare” returns Minnareddy nalabolu, username minna (real search endpoint).
- Selecting enables Add / invite; unselecting disables it. No actual membership change or invitation sent.
- Suggested for you returns people from the real suggestion service. Tested account did not show city/school/workplace-specific labels; those cohorts remain unverified live.
- Escape closes the modal and restores focus to Add members.
- At 390px, Header remains at viewport top; workspace clientWidth and scrollWidth both 375px (remaining 15px is the page scrollbar), no horizontal overflow. Member dialog width 352px fits; initial focus verified on its search box.
- Mobile inspection exposed pre-existing white-on-white Share/Joined controls under the cover; scoped theme-token styles correct their contrast. Focus ring now surrounds the search field as a whole.
- Final deployed dark-mode group page and member popup visually inspected. At tablet 820px, workspace width/scrollWidth both 805px, cover actions correctly move below the cover and desktop VChat Home link is visible. Light theme restored; viewport override reset.

## Backend blocker — do not claim complete end-to-end closure

GET /v1/groups/my returns 500 on the deployed service; group details/members/media/feed return 200. Sidebar intentionally displays an error/retry, not a misleading empty list. Root cause not proven; backend was not changed. No need for a new list API.

Backend task for Claude is saved at C:\workspace\modernsmapp\prompt\groups-web-api-followup-for-claude.md. It covers the existing list failure, pagination and real relation-suggestion availability/privacy verification. Current useMyGroups inherits the existing default first-page limit; full multi-page group navigation is not claimed.

Further boundaries: no live add/invite mutation was performed, because no disposable recipients were specified. Batch wire/result handling is tested and wired to the real existing route, but admission delivery needs the backend's disposable-fixture proof. No new moderation policy or authority. Full group/admin/mobile regression audit not performed.

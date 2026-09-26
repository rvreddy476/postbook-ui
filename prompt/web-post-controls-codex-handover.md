# Flat post-controls menu — 25 September 2026

Workspace: C:\workspace\postbook-ui. Preserve the existing dirty tree; no Git mutations performed.

## Request and implementation

Replace the two-page, reference-copied post menu with one compact panel; remove its duplicate Save entry and More options navigation. Keep existing functionality with clear icons and plain language.

- New reusable `src/components/feed/PostControls.tsx`, styled by `post-controls.css`, replaces the menu markup in PostCard.tsx.
- Trigger is a sliders icon named Post controls, replacing the ellipsis. One 272px-max panel; no submenus, separators or redundant explanatory paragraphs.
- Non-owner actions, all visible together: Recommend similar (existing interested signal), Hide this update (existing hide/undo), Mute this author, Copy embed code, Report a concern, Block this account.
- Owner actions remain Pin/Unpin update and Delete update. Delete remains disabled while its mutation is pending.
- Uses existing theme colors and Lucide icons; no new dependency. Each item has an explicit accessible name; initial item focus, ArrowUp/Down, Home/End, Escape with trigger-focus restoration, and close on focus leaving the menu are implemented.
- Removed the old menuPage state and copied-platform comments. Removed the unsupported report-menu promise that the author will not be told.
- Save was removed FROM THIS MENU. The existing bottom action-row bookmark remains unchanged, avoiding removal of the saving feature without a request to remove it platform-wide.
- The founder-approved 452px feed width/card proportions are untouched.

## Boundaries

Existing callbacks/API contracts, confirmations, optimistic state, permissions and error handling are unchanged. The existing native report-reason prompt remains deferred: this pass is the menu redesign, not report-flow development. No report, mute, block, delete, bookmark or feedback mutation should be triggered during the browser presentation check. No backend/Flutter/iOS changes.

## Verification

- `bunx tsc --noEmit`: PASS after correcting the explicitly typed menu-action array's optional disabled field.
- `bunx bun test src/components/feed/__tests__/postControls.test.tsx`: 3 PASS, 0 FAIL, 20 expectations. Actual component SSR checks flat list, six named actions, absent Save/submenu, owner-only actions and disabled deletion.
- `bunx bun test`: PASS, exit 0, full existing regression suite.
- `git diff --check`: PASS (normal line-ending notices only).
- Deployment uses the founder's standing command: build web, up --no-build --force-recreate web, then report container status. Final deployment/browser outcome appended below when observed.

## Final deployment and live verification

- Both deployment builds completed successfully; the second includes viewport collision handling. Production build generated 159 pages, passed TypeScript, and web was recreated successfully (exit 0). Immediate status: Up, health starting; this is not a claim of a completed health probe.
- The first live check exposed the mobile bottom navigation covering the last menu item. PostControls now measures its anchor and the navigation, repositioning upward on resize/scroll when necessary. MobileBottomNav gained only the accessible label `Primary mobile navigation` for that measurement.
- After the collision adjustment, the focused component tests passed again (3/3, 20 expectations); the production build/type check passed again.
- Reloaded https://cleestudio.com/ after deployment. All six actions are present in one menu; the last action bottom measured 460.22px, panel bottom 468.88px, navigation top 477.33px. No action is covered. Feed card width remains 452 CSS pixels.
- Independently exercised ArrowDown (Recommend similar -> Hide this update), End (Block this account), and Escape (trigger focused, aria-expanded=false). No action was submitted. Screenshot verified the final menu visually in the signed-in light-theme view; dark-theme appearance uses shared tokens but was not independently captured in this final check.
- No Git staging, commit, branch or push was performed; existing dirty changes remain.

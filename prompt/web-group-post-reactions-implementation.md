# Group post reactions — web wiring

Date: 26 September 2026. Workspace: `C:/workspace/postbook-ui`, branch `chore/production-hardening`.

Read the complete backend contract at `C:/workspace/modernsmapp/docs/handoffs/2026-09-26-group-post-reactions.md`. No backend, mobile, theme-token, dependency or lockfile edits. Existing dirty work preserved; no staging, commit, branch creation or push.

## Implemented

- Shared `GroupReactionControl` / `GroupReactionSummary` on `GroupPostCard` (group discussion and in-group search, cross-group feed), and the messenger's separate group-post card.
- Heart shortcut: PUT Like when unreacted; DELETE when selected. Six choices: Like, Love, Smile, Wow, Sad, Angry. Selecting the current choice removes it. Mouse pointer entry opens the picker; touch/pen hold is 450ms with movement cancellation. A labelled disclosure button and arrow-key navigation provide alternatives; Escape closes and returns focus.
- Reads `viewer_reaction`, `reaction_counts`, and the legacy `viewer_sparked === true` fallback. Total is the returned `spark_count`, not a sum of emoji counts: legacy supernova weighting is preserved.
- Only PUT/DELETE `/v1/groups/:groupId/posts/v2/:postId/reaction` drives the new control. Old spark hooks remain exported for compatibility but have no remaining UI callers (source search).
- Strict six-value request allowlist and response validation, including post identity, non-negative integer counts and viewer flag. No optimistic count arithmetic. Pending/error states retain the previously acknowledged values. Errors show a generic retry action; retry repeats the absolute requested state, never an inverse toggle.
- `applyGroupFeedPatch` replaces all four reaction fields across every cached group-feed/search/cross-group page and the direct `['group-post-v2', groupId, postId]` cache shape, preserving unrelated fields/page metadata. Per-query-client write reservation prevents overlapping writes for the same post, including duplicate card instances. Reads started before/during a write are cancelled before acknowledgement is applied so late stale responses cannot undo it.
- New CSS uses existing Momentum theme tokens, native emoji plus Lucide controls, and the existing `dark` class. No new palette or theme file.

### Single-post surface boundary

There was no dedicated group-post detail route/hook in this web tree. `/post/[postId]` belongs to the separate social post-service and is unchanged. A direct group-post cache and an individually mounted real GroupPostCard were verified, but this pass does not claim a newly created group-post permalink/detail journey. Existing group card share links still point to the group itself.

## Executed verification

Commands from `C:/workspace/postbook-ui`:

```text
bunx tsc --noEmit
exit 0

bunx bun test
300 pass
0 fail
764 expect() calls
Ran 300 tests across 27 files.

bun run build
Compiled successfully
Finished TypeScript
Generating static pages (160/160)
exit 0

git diff --check
exit 0 (existing CRLF normalization warnings only)
```

The existing Next middleware-to-proxy deprecation warning remains; no unrelated migration was attempted.

`groupReactions.test.tsx` covers real Axios serialization for every PUT value and body-free DELETE; pre-transport allowlist refusal; malformed/mismatched acknowledgements; weighted totals; cache fan-out/metadata; repeated acknowledgements; held writes and duplicate refusal; late stale read cancellation; 403/404/422/503 unchanged state and successful retry; repeated DELETE; and accessible tally/selection rendering. Group card presentation tests now render inside the actual query provider.

## Isolated seeded-cache preview

- Created a detached disposable worktree at `C:/workspace/modernsmapp/scratchpad/web-reactions-preview-0926`, copied current working web sources, and ran `bun install --frozen-lockfile`, then `bun run dev --hostname 127.0.0.1 --port 3107`.
- Only that disposable tree received the `/posts-demo` fixture, minimal layout and scripted Axios adapter. Seeded actual QueryClient group-feed, search, cross-group and direct-post caches; rendered the real GroupPostCard and reaction control. No fixture request reached the backend and no live user's reaction was changed.
- Browser-executed: shortcut Like; Love replacement; all six choices; selected Angry removal through DELETE; all three other cache views reflect Love with total 7; forced 403 retains total 6 with Retry; held retry keeps 6 and disables the trigger; release updates to 7 only from the response.
- Keyboard: ArrowDown opens, ArrowRight focuses Love, Escape closes and returns focus to the reaction trigger.
- Visual: desktop light and 390px mobile dark. Mobile document width was 390px with no horizontal overflow; picker bounds were approximately x=33..333 within the viewport. All six choices and labels visible.
- Closed the preview tab, reset viewport, stopped the preview server, and removed the exact disposable worktree. `git worktree list` again lists only the main web workspace; the preview directory no longer exists. No fixture markers were found in the real app's `src` tree.

## Verification boundaries

- Physical touch/long-press behavior is implemented and source-checked but not exercised on a physical touch device. The explicit picker button and keyboard path were browser-executed.
- The seeded adapter proves frontend/cache behavior, not live backend durability or access enforcement. The supplied backend handover records those proofs; no live reaction writes were rerun in this pass.
- Messenger's group-post surface shares the tested control; its complete chat navigation journey was not separately device-tested.

## Web deployment

Executed from `C:/workspace/modernsmapp/Architecture/docker` against the real web source, never the preview:

```text
docker compose build web
Image atpost_stack-web Built

docker compose up -d --no-build --force-recreate web
Container atpost_stack-web-1 Recreated / Started

docker ps --filter name=atpost_stack-web-1 --format 'web: {{.Status}}'
web: Up 31 seconds (healthy)
```

The Docker build also ran `bun run build` on the final source: compile, TypeScript and all 160 static pages succeeded. Build-time output includes the pre-existing ChatProxy missing-secret warning; runtime chat configuration was not changed or verified by this reactions pass. Compose also ran its declared dependency checks/scylla-init as part of the user's exact deploy workflow; no backend image was rebuilt.

**Public smoke check:** initially returned Cloudflare **1033 (Tunnel error)** at 04:59 UTC while the web container was healthy. After the founder confirmed the site was running, refreshed `https://cleestudio.com/groups/bengaluru-weekend-riders`: the authenticated group feed loaded successfully. Opened the deployed reaction picker on the pinned post and visually verified all six labelled choices (Like, Love, Smile, Wow, Sad, Angry), then closed it with Escape. No live reaction was submitted. The public page/picker smoke-check blocker is resolved; live write durability remains covered by the supplied backend evidence, not independently rerun here. No tunnel configuration or service was changed.

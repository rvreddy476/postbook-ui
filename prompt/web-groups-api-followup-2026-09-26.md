# Groups web API follow-up — 26 September 2026

Read the complete backend handover at C:/workspace/modernsmapp/docs/handoffs/2026-09-26-groups-web-api-followup.md before edits. Web source is C:/workspace/postbook-ui, not the backend repository.

## Changes

- Extracted the composer's complete membership loader into src/lib/groupMemberships.ts and wired useMyGroups to it. Requests limit=100 and offsets 0,100,... until a short page, including a final empty page when necessary. No total/has_more assumption; no limit above 100.
- Sidebar and Add groups now share this loader/query; query cache is scoped to the signed-in user and requests receive the cancellation signal. Partial-page failures reject the whole load; repeated full pages with no new IDs fail instead of looping; overlapping IDs are deduplicated.
- Preserved the sidebar's real error and Try again state. No mock membership or 500 workaround remains in this path.
- Made create-group idempotency_key required in the web mutation type. All three existing create surfaces already supply their stable intent key: create page, GroupCreateModal, messenger CreateGroupPanel.
- Corrected the invite-hook comment: denied targets are skipped, not automatically invited. Member picker retains aggregate-only results and uncertainty on failed submissions.
- Retained server-code-only coarse recommendation labels; POPULAR/absent/unknown codes remain generic. Added coverage that raw explain_text never becomes a reason label. Preserved feed/v2 data ?? [].
- No CSS/token/palette changes, new dependencies, backend edits, Git mutations or database fixtures.

## Executed checks

From C:/workspace/postbook-ui:

```
bunx tsc --noEmit --incremental false
bun test
```

Type check exit 0; Bun 284 pass, 0 fail, 687 expectations across 25 files. New tests cover exactly-full pagination, later-page failure, overlapping pages, and shared account-scoped wiring. Existing 101-group test remains green.

From C:/workspace/modernsmapp/Architecture/docker:

```
docker compose build web
docker compose up -d --no-build --force-recreate web
docker ps --filter name=atpost_stack-web-1 --format 'web: {{.Status}}'
```

Build/recreate exit 0; production build generated 160/160 pages. Existing warnings: deprecated Next middleware convention and missing dev chat proxy signing secret (not changed by this pass).

## Browser verification after deployment

Reloaded the signed-in cleestudio.com MyFamily group page. Membership navigation shows MyFamily, MyFamilyDigest and Bengaluru Weekend Riders without error. Empty group displays No posts yet. Opened Write a post -> Add groups: all three real memberships appear, current group checked/disabled. Searching Bengaluru leaves only Bengaluru Weekend Riders. Cancelled and closed without posting, inviting or changing memberships.

Pagination above 100 and failure behavior were tested with deterministic fixtures, not by creating real memberships. No new live invite/create write was performed. Private recommendation filtering and admission rechecks are backend-reported proofs, not independently re-audited here. The handover's old §6 AcceptInvite-not-executed statement is superseded by its §5a execution record.

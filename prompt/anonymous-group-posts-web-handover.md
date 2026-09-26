# Anonymous group posts and audited reveal — web wiring

26 September 2026. Workspace: C:/workspace/postbook-ui, branch chore/production-hardening. Backend handover read completely: C:/workspace/modernsmapp/docs/handoffs/2026-09-26-anonymous-posts-reveal.md. Backend untouched; no staging, commit or push. Earlier dirty Reels work preserved.

## Implemented

- Group feed/search and cross-group feed profile batches exclude anonymous aliases. Anonymous cards ignore any name/avatar enrichment and retain their neutral “Anonymous member” header.
- Comment normalization preserves is_anonymous and the wire user_id. Anonymous author comments/replies use “Anonymous member (author)” and a neutral Lucide avatar; neither alias nor anonymous avatar enters profile lookup. An alias match also masks older comments lacking the flag. Anonymous-post submissions wait for the server's masked comment identity rather than briefly showing the current user's real identity.
- Owner/admin/moderator get an explicit Reveal author action with the required audit warning. A regular member, including an ordinary author, gets no action. Backend remains authoritative: 403/404 are displayed without a profile lookup.
- Reveal uses direct no-store reads, not a query or mutation cache. The returned real profile is shown inline as a separate “Revealed to you · recorded” panel; the anonymous post is never rewritten. Hide, unmount, post/group change, account change, or loss of eligible role discards it. In-flight reads are aborted and late responses cannot repopulate another scope. No revealed identifier/profile is written to storage or feed caches.
- Media paths remain /v1/media/{id}/serve; no signed-URL assumptions introduced. cross_post_group_id is not required.
- The specific 500 attachment-anonymization refusal shows a Try again toast plus inline explanation and retains the draft/attachments; no automatic public-post fallback.
- Anonymous posts do not subscribe to scoped comment rooms or send/display typing attribution. Polling remains. The handover's backend typing-identity gap must close before enabling anonymous realtime rooms.
- Reels uses 6px top/bottom stage padding rather than 16px; portrait height and corresponding width grow by 20px / 11.25px when viewport width permits. Fullscreen receives the same extra space. Aspect ratio remains 9:16.

## Verification

- bunx tsc --noEmit: exit 0.
- bunx bun test: 345 passed, 0 failed, 927 expectations, 35 files.
- bun run build: exit 0, 160 static pages.
- git diff --check: no whitespace errors (existing CRLF notices only).
- Six new tests cover alias exclusions, role allowlist, masked comment/reply markup, actual reveal/profile request paths and no-store headers, 403/404 refusal without profile lookup, and attachment-refusal classification.

## Isolated seeded-cache preview

Created detached throwaway worktree C:/workspace/postbook-ui-anonymous-preview from HEAD and copied the dirty web changes into it. Only that worktree received a /posts-demo route, mock Axios adapter, seeded feed/search/cross-group caches, synthetic viewer session and preview-only provider. It ran at 127.0.0.1:3107. Deployment-tree checks confirmed neither preview route nor provider exists in C:/workspace/postbook-ui.

Browser journeys through the real GroupFeedTab/GroupPostCard/comment components:

1. Owner menu contains Reveal author and exact warning; success displays “Audited Person” inline without changing “Anonymous member”.
2. Anonymous top-level comment and reply both display “Anonymous member (author)”; injected secret names/avatars are not rendered.
3. Changing role to member removes reveal action and already revealed profile.
4. Admin 403 displays permission error, no private profile.
5. Held reveal → change viewer account → release response: no revealed identity appears in the new account.
6. Search results retain masking in dark mode; moderator 404 displays unavailable-post copy.
7. Fixture inspection after success and late-response tests: private query cache clean=true; storage clean=true; alias profile requests=0. Reveal requests reflected explicit clicks only.

Preview tab closed, development server stopped, and the disposable worktree removed after verification. Its synthetic fixture is not retained; all implementation changes and tests remain in the main workspace. No seeded data was sent to dev APIs or inserted into the deployment image. This is mock-contract/UI evidence, not a claim that a real audit-table entry was inspected. No live real-person reveal was performed.

Docker web build and recreation completed successfully; container reported healthy. Live Reels browser check confirmed playback and the enlarged portrait frame with reduced top/bottom padding. No commit or push was performed.

## Remaining boundaries

- Backend scoped-room typing safety remains open as disclosed; web does not enable it.
- The specific composer refusal's classification is unit-tested and its draft-retaining catch path inspected; a real media-service outage was not induced.
- Previous Reels backend count/title/author issues remain tracked separately.

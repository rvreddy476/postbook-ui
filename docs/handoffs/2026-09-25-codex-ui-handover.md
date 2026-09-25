# Handover: VChat web UI (postbook-ui) — state as of 2026-09-25

You are taking over ALL web UI work. Claude (a separate agent) owns the Go
backend and will write or change APIs only when the founder asks. You consume
contracts; you do not edit anything under `C:\workspace\modernsmapp`.

## 0. Repos, branches, tooling — hard rules

- Web repo: `C:\workspace\postbook-ui`, branch `chore/production-hardening`
  (Next.js 16 App Router, React 19, Tailwind 4, react-query, framer-motion,
  Lucide icons). HEAD at handover: `9f14f8e`.
- **Bun only.** `bunx tsc --noEmit`, `bunx bun test`, `bun run build`.
  Never npm / yarn / pnpm. TypeScript stays on 5.9.x (TS 7 breaks `next build`).
- **Colour and font live in ONE file.** `src/ui/theme.css` defines
  `--theme-*` (76 tokens, light + dark); `src/app/globals.css` maps them into
  `@theme` as `--color-brand-text`, `--color-danger`, etc. Use only
  `brand-text brand-bg brand-card brand-secondary brand-divider
  brand-highlight primary-ink primary-hover bg-primary-grad danger warning
  success`. Never write a raw Tailwind palette class (`bg-red-50`,
  `text-amber-600`, `from-purple-200`…) — a `-50`/`-100` value is light-mode-
  only and renders as a white block in dark mode. A custom token missing any
  of its five declarations compiles to NOTHING, silently: check the chain
  `--theme-x` → `--x` (light AND dark blocks) → `--color-x` before using a
  new one. ~7,500 legacy spots still bypass the token file; do not add more.
- Dark mode is a `dark` class on `<html>` (set in `src/components/Header.tsx`),
  not `prefers-color-scheme`. There is also a `light` class; both may be present.
- Design system "Momentum": navy palette, ember gradient accent
  (`bg-primary-grad`), fonts Bodoni / Outfit / Figtree, Lucide icons. Light
  theme accent is cerulean `#3b82c4` on white (4.06:1 — use `#2f6ba3` /
  `primary-ink` for text). References the founder gave: Facebook group page
  and Facebook post "…" menu for Groups/Feed; RUTUBE + YouTube for MTube/MShorts.
- **Do not remove or rename any API the web calls** — the Android app shares
  them. Do not touch `src/components/messenger/ChannelPanel.tsx` or its
  imports: the messenger keeps its broadcast-channel surface on purpose.
- Never commit anything from `.env` or `.secrets/`. Never enter credentials
  into a form to test.

## 1. Verifying UI without a session (the recipe that works)

`/groups/*` and the feed are behind login. Build a throwaway seeded-cache
preview in a SEPARATE worktree so nothing leaks into the deployed image:

1. `git worktree add --detach C:\workspace\postbook-ui-deploy HEAD`
   then `bun install --frozen-lockfile` there.
2. Add `src/app/dev-preview/<thing>/page.tsx`: get `useQueryClient()`, call
   `qc.setQueryDefaults(key, {staleTime: Infinity, gcTime: Infinity,
   retry: false})` for every key, then `qc.setQueryData(...)`, then render
   the real component. Without those defaults every query refetches, 401s,
   and the fixture vanishes — it looks like a rendering bug and is not.
   Wrap any `useSearchParams` reader in `<Suspense>` or prerender fails.
3. Add `"/dev-preview/"` to `PUBLIC_PREFIXES` in `src/middleware.ts`.
4. `bun run build` then `PORT=3001 bun run start`; open
   `http://localhost:3001/dev-preview/<thing>`.
5. Delete the preview route and the middleware line before building the
   deploy image. `git status` must be clean in the worktree.

Cache shapes you will seed:
- `['my-profile']` → profile object; `['user-profile', userId]` → same shape
- `['home-feed', feedMode, excludeSelf, circleOnly]` → infinite
  `{pages:[{data: PostDetail[], meta:{next_cursor}}], pageParams:['']}`
- `['group', groupId]` → Group; `['group-members', id]` → GroupMember[];
  `['group-feed-v2', id]` and `['group-media', id]` → infinite
  `{pages:[{data, offset}], pageParams:[0]}`; `['group-events', id]` →
  GroupEvent[]; `['group-post-search', id, query]` same page shape as the feed.

Framer-motion note: if the agent's browser window is occluded, rAF throttles
and entrance/exit animations freeze mid-fade — a panel looks transparent and
Escape looks broken. Prove it with `document.getAnimations().forEach(a=>a.finish())`
and by reading `aria-expanded`, not by screenshot.

## 2. Deploying to dev

From `C:\workspace\modernsmapp\Architecture\docker`:
`docker compose build web && docker compose up -d --no-build --force-recreate web`.
The image builds from `../../../postbook-ui` — the WORKING TREE — so build
from a clean worktree at the commit you mean to ship. Confirm with
`docker inspect atpost_stack-web-1 --format '{{.Image}}'` equal to
`docker images --no-trunc atpost_stack-web`, and grep a new string in
`/app/.next/static/chunks` inside the container. Dev is public at
`https://cleestudio.com` via `cloudflared tunnel run` (uses
`~/.cloudflared/config.yml`; do NOT run `Architecture/docker/cloudflared-dev.yml`
— it was missing the apex UI rule and took the site down once; it is fixed
but the default config is the one to use).

## 3. What is built and deployed (all on dev, all pushed)

Groups (`src/app/groups/*`, `src/components/groups/*`, hooks `useGroups.ts`,
`useGroupEvents.ts`, `useGroupAdmin.ts`):
- `/groups` is a pure directory (My Feed / Discover / My Groups / Invites);
  `/groups/[groupId]` is the group page: `GroupView.tsx` shell, tabs in
  `?tab=` (about | discussion (default) | members | events | media),
  `GroupCoverHeader.tsx` (name, member count, group type ONLY; five join
  states: Join / Request to join / Invite only / Requested / Joined▾),
  `GroupJoinedMenu.tsx` (Notification settings → account-wide page, labelled
  "For all groups"; Copy link; Group settings for admins; Exit group),
  `GroupShareDialog.tsx` (shares a URL — there are NO invite links in
  group-service; never label it "Invite link"), `RecentMediaCard.tsx` in the
  right rail only when media exists (otherwise the feed takes the full column),
  in-group search icon at the end of the tab row (min 2 chars, results reuse
  the feed cards, rail hidden while searching, box width matches results).
- Engagement truth: cards read `post.viewer_sparked === true` etc. from the
  server; optimistic patches live in `patchGroupFeed.ts` and hit BOTH the feed
  and the active search cache. No local reaction state anywhere.
- Events tab (`tabs/GroupEventsTab.tsx`, `events/EventCard.tsx`,
  `events/EventComposer.tsx`): Upcoming/Past partitioned client-side (server
  sorts ASC, oldest first — never just map); boundary is the event's END;
  times render in the event's own IANA `timezone`; all validation is client-
  side because the server validates nothing.
- Composer for groups (`CreatePortal.tsx` in group mode, `CrossPostPicker.tsx`,
  `groupComposer.ts`, `GroupPostMeta.tsx`): group chip instead of audience,
  "+ Add groups" (max 4 extra), anonymous toggle only when
  `group.allow_anonymous_posts === true`, Poll tile hidden, place/feeling/
  activity/tags travel in `type_payload` and render back on the card.
- Members tab: role badges tokenised; the creator shows as Owner (server
  derives it — see §5).
- Admin settings page (`/groups/[groupId]/settings`): pending posts, join
  requests, banned list all reach real endpoints now.
- Wording: it is a **Group**, never a "Space" (Communities keeps its own
  "spaces" concept — different product).
- Web channel pages (`/channels/*`) are deleted; `ChannelPanel` in the
  messenger stays; notification deep links `/channels/<id>` are translated in
  `Header.tsx` to `/messenger?lane=channels&channel=<id>`.

Feed (`src/components/PostCard.tsx`, `src/components/feed/*`,
`src/hooks/usePostActions.ts`):
- Post "…" menu: Interested / Not interested / — / Save post / Report post /
  — / More options › (second page with Back: Hide all from, Embed, Block).
  Own post: Pin/Unpin, Delete. All toasts via `useGlobalToast()`; no `alert()`.
- Not interested removes the post optimistically, snapshots the lists, toast
  carries Undo (`feed/HiddenPostToast.tsx`); on failure restores.
- Composer sends `content_type: "post"` for a video attachment
  (`feed/chooseContentType.ts`). The server now keeps a "post" a post.

## 4. Verified vs NOT verified at handover

Verified in a browser via seeded cache: group page in admin / member /
outsider / private / empty states, light and dark; events partition; members
badges; search open/results/min-length; feed menu both pages; own-post menu;
Not-interested failure path (request refused → card restored → error toast).
NOT verified by anyone signed in: a real cross-post with a named refusal; an
anonymous post on the wire; the Not-interested SUCCESS toast with Undo; the
group composer end to end; the deployed `/groups` page with real data. The
founder's dev account is `rvreddy1991@gmail.com`; seeded group
"Bengaluru Weekend Riders" (5 posts, 2 events, 4 members) exists on dev.

## 5. Contracts with sharp edges (read before designing against them)

- Go zero values: a bool arrives as `false`, a missing field as `undefined`,
  an empty list as `null` or `[]`. Read flags as `=== true`, never `?? true`;
  coalesce lists with `?? []`; fall through on EMPTY strings, not just absent.
- Group member roles in the DB are only `admin | moderator | member`. "owner"
  is DERIVED from `groups.creator_id` by the server (`viewer_role` and the
  members list both do it now). Never store or compare "owner" locally.
- `GET /v1/groups/:id/posts/v2/search?q=&limit=&offset=`: 400 on blank q;
  404 for BOTH a missing group and a private group you are not in (deliberate:
  no existence oracle); results are relevance-ordered — do not float pinned.
- `POST /v1/groups/:id/posts/v2` with `also_post_to: [uuid]` returns a batch
  `{published, pending, skipped, targets:[{group_id, post_id, outcome}]}`;
  WITHOUT `also_post_to` it returns the bare post (mobile depends on that —
  branch on what you SENT, never sniff the body). `idempotency_key` in the
  body is REQUIRED for a batch; one key per composer action, reused on retry.
  Cap is 4 extra groups (5 targets including the primary). Outcomes:
  published | pending_approval | not_a_member | banned | not_permitted |
  anonymous_not_allowed | blocked_content | unavailable (unavailable is
  deliberately vague — never spell out "private").
- Anonymous posts: gate the toggle on `allow_anonymous_posts === true`; copy
  must say "your name is hidden from other members", never "nobody can tell";
  a target group that disallows anonymity is SKIPPED, never downgraded.
- Events: list returns `data: null` when empty; sorted ASC; `POST` validates
  nothing (title ≤200 chars or the DB 500s); there is no `viewer_rsvp` on the
  wire, no edit route, `max_attendees` is not enforced.
- Feed feedback: `POST /v1/feed/feedback {post_id | author_id, signal:
  "interested" | "not_interested"}`; latest wins; interested undoes.
- Posts: `POST/DELETE /v1/posts/:id/bookmark`, `POST /v1/posts/:id/report`,
  `DELETE /v1/posts/:id`, `PUT /v1/posts/:id/pin`.
- Reels never appear in the home feed (server filters short-form); a video
  posted from the feed composer is `content_type: "post"` — feed only, never
  Reels/Tube, never monetized. Reels/Tube flows send `flick`/`long_video`
  explicitly.
- Group routes (group-service, prefix `/v1/groups`): `GET /my`, `/discover`,
  `/search?q=`, `/by-handle/:handle`, `/:id`, `/:id/feed/v2`, `/:id/members`,
  `/:id/members/banned`, `/:id/events`, `/:id/media`, `/:id/join-requests`,
  `/:id/posts/v2/pending`, `/:id/posts/v2/:postId`, `.../comments`,
  `/:id/rules`, `/:id/invites`, `/invites/my`; `POST /:id/join`, `/leave`,
  `/invite`, `/events`, `/events/:eventId/rsvp`, `/posts/v2`,
  `/posts/v2/:postId/{spark|echo|stash|view|comments|approve|reject}`,
  `/join-requests/:reqId/{approve|reject}`, `/members/:userId/ban`,
  `/invites/:inviteId/{accept|reject}`, `/handle/check`; `PUT /:id`,
  `/:id/members/:userId/role`, `/:id/rules`; `DELETE /:id`, `/:id/events/:eventId`,
  `/:id/members/:userId`, `/:id/members/:userId/ban`, `/posts/v2/:postId/{spark|echo|stash}`.

## 6. Open UI items (yours), with locations

1. Signed-in walkthrough of everything in §4 "NOT verified"; fix what it finds.
2. `src/components/CreatePortal.tsx:923-925` — raw palette (`text-neutral-900`,
   `ring-rose-500`) in the styled-background editor.
3. `src/components/groups/GroupPostCard.tsx:47-54` — `avatarColors` is a
   6-hue raw palette; needs a design decision, not a find-and-replace.
4. Shared channel-post links carry `?update=<id>` but the messenger does not
   scroll to it (`PostbookMessenger.tsx` reads `?channel=` only).
5. "Not interested" also removes the post from `['profile-posts']`; the
   server hides it from feed surfaces only — decide whether profile should match.
6. Mobile-width pass on `/groups/[groupId]` (cover actions wrap below `sm`,
   rail hides below `lg`) — built for it, not yet reviewed on a phone.
7. `GroupMembersTab` menuitems have no accessible name in the a11y tree
   (nested divs); same pattern in `PostCard` menu — add `aria-label`s.
8. Report post still uses `prompt()` for the reason — replace with a picker.
9. The "Top" comment sort orders by `spark_count`, which is always zero.
10. Legacy raw-palette audit across the app (~7,500 spots) — Momentum tokens.

## 7. Things that look like UI bugs but need BACKEND — ask the founder to route to Claude

- `viewer_rsvp` on events (so the chosen RSVP survives reload).
- Per-group mute / notification preference (no route, no column).
- Invite links for groups (only user-id invites exist).
- Event edit (no PUT/PATCH); `max_attendees` enforcement.
- `GetGroupFeedV2` answers 403 vs 404 (an existence oracle the search
  endpoint deliberately avoids).
- Poll support in group posts (nothing tallies votes).
- Anonymous COMMENTS as a user choice (realtime payload is unmasked).
- Group-service does not sanitize HTML; cards render text, keep it that way.

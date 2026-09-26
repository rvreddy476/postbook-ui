# Web authentication and feed redesign — handover

Date: 25 September 2026

## Workspace and scope

- Workspace: `C:\workspace\postbook-ui`
- Branch: `chore/production-hardening`
- Observed HEAD: `71dde0f6488111c7ecf22dc561e9ed3301a9fe77`.
- Changes are uncommitted and unstaged. No push or deployment performed.
- `C:\workspace\modernsmapp` and the parallel Commerce/Mopedu workspaces were not changed.
- Requested scope: professional responsive login, registration, and home-feed presentation, supporting the existing light/dark themes.

## Delivered surfaces

### Login and registration

Shared `AuthShell.tsx` and namespaced `auth.css` provide the desktop split layout, mobile form-first layout, VChat branding, theme switch, skip link, legal links, focus states and reduced-motion rules. Styles use the existing theme variables; no replacement palette or font system was introduced.

Login retains the existing authentication API, MFA/recovery/step-up flows and internal return navigation. Added explicit verification submission, duplicate-submit guards, accessible errors, password visibility controls and autocomplete. `authRedirect.ts` rejects external/protocol-relative/backslash/control-character return paths.

Registration retains the existing API fields and birthday validation. Consent is explicitly unticked and required. Verification/resend use the real hooks, with busy states and feedback. A successful verification does not itself imply an authenticated session: successful uncomplicated login is required before navigating home; otherwise the user goes to login. The already-created-account flow no longer encourages recreating the account. The birthday picker supports the narrow-screen grid without changing its existing date rules.

Page titles avoid duplicating the site name.

### Feed and shell

Rebuilt feed presentation with a readable content column, new heading, Saved/Refresh actions, keyboard-operable For you/Following tabs, loading skeletons, refresh notice, separate empty/error states, pagination retry and end-of-feed state.

Existing ranked/chronological query identities, backend ordering, viewer-scoped delta behavior, realtime count updates and real PostCard actions remain. `uniqueFeedPosts` handles absent data and duplicate IDs without reranking. Refresh failure preserves visible posts. Previously hidden stories and inline composer were not restored; no decorative filters pretending to query the server were added.

The surrounding shell now reserves the right rail for sufficiently wide screens. Browser checks found an existing tablet header overflow; responsive header/search breakpoints and spacing were corrected. Account/search controls have accessible names. Feature routing and chat/composer behavior were not rewritten.

## Main files

- `src/app/login/page.tsx`, `src/app/login/layout.tsx`
- `src/app/register/page.tsx`, `src/app/register/layout.tsx`
- `src/components/auth/AuthShell.tsx`, `auth.css`, `authRedirect.ts`
- `src/components/auth/__tests__/authPresentation.test.tsx`
- `src/components/ui/dob-picker.tsx`
- `src/components/Feed.tsx`
- `src/components/feed/home-feed.css`, `feedPresentation.ts`
- `src/components/feed/__tests__/feedPresentation.test.ts`
- `src/components/Header.tsx`
- `src/features/postboek/PostBoekApp.tsx`

No changes to package.json, bun.lock, backend APIs, Flutter/iOS, or ChannelPanel.tsx/imports.

## Executed checks

All commands below ran in `C:\workspace\postbook-ui`.

| Command | Result |
| --- | --- |
| `bunx tsc --noEmit` | Passed. Initial sandbox attempt could not write tsconfig.tsbuildinfo; rerun with filesystem permission passed. |
| `bunx bun test` | 248 passed, 0 failed; 517 expect calls across 19 files. Includes 14 new auth/feed tests. |
| `bun run build` | Passed after final source/formatting changes: compiled successfully; TypeScript completed; 159/159 static pages generated. |
| `git diff --check` | Passed; only normal Git line-ending notices where emitted. |
| `git diff --name-only -- bun.lock package.json` | Empty. |

Pinned `bunx --bun prettier@3.6.2 --write` formatted the new/rewritten auth/feed files; no formatter dependency was added to the project. The existing Next.js middleware-to-proxy deprecation warning remains; migration was not part of this pass.

## Browser evidence and boundaries

Checked desktop 1440px, tablet 768px, and phone 390px/320px layouts. Login/registration and feed were inspected in light and dark themes. Registration was also checked using the built production preview at 320px. Consent started unchecked and submission was disabled until requirements were met. The final birthday select typography was tightened for the narrowest viewport.

Feed checks used a temporary detached worktree containing explicitly isolated fixture data, not a mock route added to deployable source. The preview exercised the real Header/Sidebar/PostCard presentation with two text posts, Following empty state, keyboard tab switching, and refresh-error state retaining those posts. Tablet header overflow was reproduced and corrected: header client/scroll widths became 512/512 at the tested tablet layout; at 320px they became 320/320.

No credentials were entered, accounts created, or real posts/actions submitted. Authentication, MFA, registration verification and signed-in feed API journeys therefore remain LIVE-UNVERIFIED. Media-specific PostCard rendering, screen-reader/device accessibility and system reduced-motion preference were not independently exercised. Source rules alone are not device proof. Passing the production build is not a claim of full production launch certification.

The isolated feed preview worktree and its fixture-only changes were removed. It contained no user changes or secrets. Temporary Next-generated AGENTS.md/CLAUDE.md files created during preview startup were removed from the main web workspace; they were absent at the start. The original workspace is the sole remaining Git worktree. The ordinary local production preview is loopback-only, not a deployment.

## Deferred by the user — do not fold back into this pass

- Previously identified unnamed post menu actions and accessible report-reason picker.
- Existing CreatePortal/composer theme violations outside this redesign.
- Keeping Not interested mutations scoped to feed rather than profile caches.
- Group-page mobile/light/dark review.
- Legacy palette cleanup outside the new auth/feed styles.

## Next handover

Review the redesigned screens visually with the founder. Preserve these uncommitted changes. If approved, run the existing live authentication and signed-in feed journeys in the normal development environment; do not infer those results from the fixture preview or unit tests. Do not reopen the explicitly deferred cleanup items without a new request. Do not stage, commit, push or deploy without authorization.

## Founder correction — compact feed, 25 September 2026

This supersedes the earlier description of the visible feed heading.

- Removed all three promotional lines: the eyebrow, “Your daily catch-up.” and its subtitle. Retained a screen-reader-only Home feed heading.
- Put Saved and Refresh directly beside For you/Following in one compact toolbar; removed the redundant ranking caption.
- Home feed and discovery rail now use one shared vertical scroll area with hidden scrollbar chrome, rather than two independently scrolling columns. Scrolling remains available so content is not clipped or inaccessible. Other screen modes retain their required scrolling; their main/rail scrollbar chrome is hidden using the existing no-scrollbar utility. This is not a global ban on scrolling in dialogs or other application routes.
- Renamed both home suggestion surfaces to “People you might be interested in.” The mobile/inline strip is now a responsive two/four-column grid of four suggestions rather than a horizontally scrolling strip of ten; See all still opens the existing connections route. Existing suggestion eligibility and message/request actions remain unchanged.
- Tightened the rail heading/card layout, used theme-token avatar fallbacks, and gave profile/dismiss actions person-specific accessible names. No recommendation algorithm or backend contract changed.

Executed after the correction: `bunx tsc --noEmit` passed; `bunx bun test` reported 248 pass / 0 fail / 517 expectations; `bun run build` passed (159/159 static pages); `git diff --check` passed. Only a comment and this handover changed after those gates. The revised authenticated feed was not browser-retested in this correction; previous screenshots cover the earlier layout, not this update. No credentials entered or live writes performed. Existing dirty work preserved; no staging, commit, push or deployment.

## Founder correction — square, viewport-aware media cards

The founder reported that the large media card exceeded the window. Changes in `src/components/PostCard.tsx` add explicit author/header/media/action class hooks. `src/components/feed/home-feed.css` scopes the new sizing to the home feed:

- The feed column is capped by `clamp(260px, calc(100svh - 320px), 640px)` as well as its available container width, reserving space for navigation, author details and controls. Small viewport units avoid card resizing as phone browser chrome moves.
- Photos, native videos and carousel slides use one stable 1:1 stage. Its content is absolutely contained to establish a definite height, fixing the prior intrinsic-video sizing/clipping problem. Media uses object-fit: contain, so portrait/landscape assets are not stretched or cropped. Existing VideoPlayer fullscreen behavior is retained.
- Author avatar is 36px in the home feed, author metadata wraps safely, card corner radius is 14px, and action rows keep 44px minimum button height with wrapping available on extremely narrow layouts.
- Scoped CSS leaves dedicated post/profile/reel media sizing unchanged; text/polls are not forced into squares, and long captions/expanded comments may still require normal page scrolling. Reference-based PostTube EmbedCard routing is unchanged.

Verification after these source changes: `bunx tsc --noEmit` passed; `bunx bun test` 248 pass / 0 fail / 517 expectations; `bun run build` passed, 159/159 static pages. Existing Next middleware deprecation remains unrelated.

Browser geometry check used a disposable synthetic markup fixture loading the ACTUAL built CSS (not a signed-in application journey). Measured square media dimensions: 1366x768 viewport → 446.67x446.67; 1440x900 → 578.67x578.67; 390x844 → 364.67x364.67; 320x640 → 279.33x279.33; 844x390 landscape → 258.67x258.67. No horizontal document overflow at those sizes. Light laptop and dark phone styling inspected; object-fit computed as contain. Short landscape windows deliberately retain vertical scrolling rather than shrinking controls or clipping content. These measurements prove stylesheet geometry only, not live video playback, carousel interaction, real caption length or authenticated API behavior. The temporary fixture server/file/tab were removed and the viewport override reset.

No backend, API, dependency, authentication, commit, staging, push or deployment changes. Earlier dirty work preserved.

## Latest founder correction — rectangular cards (supersedes square layout)

The founder accepted the height but rejected the narrow width. The feed now fills its available reading column up to 700px independently of window height. Media uses a 3:2 landscape stage with the previous `clamp(260px, calc(100svh - 320px), 640px)` height ceiling, so widening cannot restore the original oversized media height. Portrait content remains contained/letterboxed, not stretched or cropped. Tab labels cannot wrap onto two lines; the toolbar can wrap its control groups when space is genuinely insufficient rather than overflow.

Only home-feed.css and the associated PostCard sizing comment changed in this correction. `bun run build` completed compilation, TypeScript and generation of all 159 pages; see execution result for final status. `git diff --check` passed and index stayed empty. No browser recheck or additional unit run in this CSS-only pass; the previous square-fixture measurements are historical, not evidence for this rectangle. No deployment performed.

## Latest reference — Paint selection 679 x 715 (supersedes previous aspect ratios)

The founder supplied an explicit reference size. Home feed width is now capped at 679 CSS pixels. Media cards use a flex column with a 715px baseline overall height, scaled down for available column width and short viewports (100svh minus 100px). The actual profile/caption/actions consume their natural height; the media fills the remainder. The former square and 3:2 stage rules are removed. Header avatar is 40px. Photo/video contain behavior and theme tokens remain unchanged. Dedicated post/profile layouts remain outside the home-feed CSS scope.

The baseline is a minimum rather than a clipping height: long captions, polls or expanded comments can extend the card. Media retains a 180px minimum usable area, so very narrow cards may be taller than a mathematically scaled reference. Text-only cards do not get a forced 715px height. The screenshot's verified-account tooltip is not fabricated, nor is its content or verification badge copied into the product.

Executed `bun run build`: PASS, including TypeScript and 159/159 static pages. Browser geometry proof with the built stylesheet and disposable synthetic card markup: at 1440x900, the outer card measured EXACTLY 679x715 CSS px and media 677.67x543.67; at 1366x768 card 679x668; at 390x844 card 366x385.40; at 320x640 card 296x371.33. All measured action rows stayed inside their cards, with no horizontal document overflow. This is a stylesheet/layout proof, not an authenticated application or live playback test. Temporary server, fixture and browser tab removed; viewport reset. No additional unit run for this CSS/class-hook-only adjustment. No staging, commit, push or deployment.

## Screenshot discrepancy investigation — 915x663 versus 679x715

The founder's next screenshot still showed a 915x663 physical-pixel selection. Do NOT claim the actual signed-in page matches based on the synthetic fixture above.

Read-only inspection of running `atpost_stack-web-1` found the latest reference CSS already installed in `/app/.next/static/chunks/1apbt7zamt97t.css`: `.home-feed` max-width 679px, container-type inline-size, and the viewport-reduced minimum card height. Container creation time: 2026-09-25T14:17:35.338403784Z; image sha256:56f5cbcd0777888542268df2602e09fb6cac928737f5e4f53979bf1a33ed418b. Thus assuming the container simply lacks the change is unsupported. No container was rebuilt/restarted by this investigation.

One known source mismatch corrected: removed the `100svh - 100px` height cap. At the full 679px CSS width the media-card baseline is now 715px regardless of desktop window height; only narrower columns scale that baseline down. Content expansion remains allowed. The previous statement that short windows shrink the baseline is superseded.

The physical-pixel width mismatch is NOT yet diagnosed. Browser zoom, display scaling, a cached tab, or a different page surface must be distinguished by inspecting the founder's actual page. No application-level zoom was found in the feed shell/theme files inspected. Browser inventory exposed no existing user tabs; requested the page URL and browser zoom percentage. Do not change global zoom, divide widths by devicePixelRatio, or shrink CSS dimensions to compensate for an unverified browser setting. No authenticated-browser confirmation obtained, and no claim of pixel-exact visual closure.

## Actual signed-in page measured after founder sign-in

The founder signed in personally in the in-app browser at https://cleestudio.com/. Inspected the real home feed read-only; no credentials were read, copied or entered by the agent and no engagement actions were triggered.

At the current browser size, innerWidth=655, innerHeight=550, devicePixelRatio=1.5, visualViewport.scale=1. The feed and first card measured 607.33 CSS px wide (available content width), with max-width 679px. The first media card measured 450 CSS px high and its media stage 301.63px. The article, ancestors and HTML had computed zoom=1 and transform=none. Thus screenshot raster dimensions cannot be equated directly with CSS pixels; devicePixelRatio does not by itself identify whether browser zoom, OS scaling or both contribute.

Most importantly, the LIVE CSSOM still contains `min-height: min(715px, 105.302cqw, max(360px, -100px + 100svh))`. At this viewport, its height branch is exactly 450px, explaining the flattened card. The corrected local rule removes that branch and predicts ~639.53px baseline height at the same 607.33px width (not yet live-verified). Local build previously passed; the running site does not yet contain that last height correction. The 679px width limit IS live and functioning at the observed width.

Next action requires founder approval to rebuild/restart ONLY the public-facing development `web` service, with no dependency restarts or backend changes. Then reload the same signed-in page and measure the real card again. No public deployment done in this inspection; do not report visual closure until that check. The reference Facebook screenshot does not establish its CSS viewport or zoom and no Facebook login is necessary for the current diagnosis.

## Latest correction — compact size after real-page refresh

Founder deployed the preceding height correction and requested a refresh, reporting it still too large. Refreshed https://cleestudio.com/ in the signed-in browser. Actual viewport 655x550 CSS px, devicePixelRatio 1.5; first card measured 607.33x639.52 CSS px, starting at y=159.33 and ending at y=798.85. Media measured 606x491.15. This confirmed the height correction was deployed AND confirmed the card was oversized for the viewed surface. The earlier use of screenshot pixels as desktop CSS dimensions was the wrong design assumption.

Changed the local home-feed width cap from 679 to 452 CSS px. Keep the reference proportion through `min-height: calc(100cqw * 715 / 679)`; at full compact width, baseline height is approximately 475.96 CSS px. At the observed 1.5 raster scale that corresponds approximately to 678x714 physical pixels. This is a FIXED compact design size, NOT devicePixelRatio-dependent JavaScript or a zoom override. Width still shrinks for narrower containers; long/expanded content remains readable. Against the actual measured first card, this reduces both baseline dimensions about 25.6%.

Only home-feed.css changed in this correction, plus this handover. Public site was not redeployed by the agent. The new compact size still needs the next frontend deployment and an actual signed-in measurement; do not conflate the measured old size with the predicted new size. No session/credential manipulation or engagement actions. Preserve all existing dirty changes.

## Standing founder instruction — deploy completed UI changes

The founder explicitly authorized running the following after completed UI changes, without another deployment-confirmation loop:

```sh
cd /c/workspace/modernsmapp/Architecture/docker && docker compose build web && docker compose up -d --no-build --force-recreate web && docker ps --filter name=atpost_stack-web-1 --format 'web: {{.Status}}'
```

On PowerShell use the same working directory and commands with explicit exit-code checks so a failed build prevents the restart. This authorization does not include Git commits/pushes or unrelated service changes. Keep completion messages concise and report failures truthfully.

Executed the authorized deployment successfully. `web: Up Less than a second (health: starting)` was the immediate status. Compose also ran its existing scylla-init dependency; no backend code changed. Refreshed the signed-in public site and measured the REAL first card at 452x475.96 CSS px: the compact correction is now live. No Git mutations. Health-starting is not a completed health check.

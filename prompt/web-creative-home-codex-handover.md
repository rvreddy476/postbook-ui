# Creative Home and preserved Feed — 25 September 2026

Workspace: C:\workspace\postbook-ui. Existing dirty tree retained. No Git stage/commit/branch/push. No backend, Android, Flutter or iOS changes.

## Confirmed routing

- `/`: new editorial Home for signed-in users, the default destination after login without a requested redirect. Signed-out visitors retain the existing landing page.
- `/feed`: original single ranked feed, unchanged in visual presentation and functionality. This new route is authenticated by the existing middleware's default protected-route rule.
- Separate Home and Feed links in desktop navigation and mobile navigation. Mobile Feed uses a real route link so it does not depend on feature-specific callback switches. Reels, Create, Messages and Profile stay accessible.

## Implementation

- `CreativeHome.tsx` and scoped `creative-home.css`: compact Home title, direct Open feed link, working Create/Open studio controls using the existing CreatePortal, Saved collection link, personal profile panel with real profile data, and reused RightPanel for live suggestions/discovery.
- Posts remain from the same authoritative ranked feed. Feed now accepts an optional presentation (classic by default); only the new Home supplies editorial. No mocked posts, invented engagement counts, re-ranking, filtering or new data authority.
- Editorial-only styling: quiet accented text cards with larger body typography, journal serif headings, contained edge-to-edge media, refined author/avatar/action spacing, poll border accent. Creator-supplied background styling is classified separately and not replaced by the text treatment. Media precedence remains with the existing renderer. New styling uses theme tokens and honors reduced motion.
- Reuses existing PostCard, comments, reactions, sharing, paywall, moderation/privacy contracts, polling, pagination and return-refresh logic. No duplicated social-action implementation. PostCard gained only a CSS class on its existing text wrapper; classic style has no rule for that new class.
- `PostBoekApp` has explicit Home/Feed initial surfaces with independent page keys; both use the same authenticated shell. Home owns its new side panel; Feed keeps the old right panel and 452px card layout. Search alignment supports both routes. Shared navigation gained Feed; mobile Create now opens its existing portal instead of falling through to the generic tab fallback.
- No change to auth redirect validation: its existing default `/` now naturally leads to the creative Home. No logout or login exercised during UI verification.

## Verification

- `bunx tsc --noEmit`: PASS.
- `bunx bun test`: 260 PASS, 0 FAIL, 564 expectations, 22 files.
- New tests cover content-format selection and creator-style preservation, no payload mutation, explicit separate page surfaces/keys, and mobile Feed's real link with active state.
- Final production build additionally checks types after the CSS-class and accessible-heading refinements. Deployment/live observations appended below.

## Boundaries

No new recommendation algorithm, artificial trend data, new cloud services, or separate long-video distribution policy. Existing PostTube links/references stay separate. New Home does not submit any user content automatically. Full authenticated mutation journeys are not re-run for a presentation/routing change; their existing implementations and APIs are reused.

## Deployment and live verification

- Authorized Docker web build and recreation completed with exit 0; TypeScript passed in the production build and 160 pages were generated (one new /feed page). Existing middleware deprecation/build-environment ChatProxy warning unchanged.
- Live `/` at 1280px: creative Home present, real video/photo/text/journal entries rendered, text-body computed font 22px, feed width 452px, header search and reading column both left=392px. Screenshot checked in light mode.
- Desktop Feed link -> `/feed`: no CreativeHome or editorial wrappers, active Feed nav state, first card width 452px/height 475.96px/top 80px, feed top 80px, search/feed left=390px. This matches the preserved layout. Home link returns to the new page.
- New Create a post control opened the existing portal, whose Journal/Post choices were visible; closed without creating or changing a draft.
- Mobile dark mode at 390px: header/main widths and scrollWidths all 390px (no horizontal overflow). Home and Feed are both available. Real mobile Feed link reached /feed with 16 classic posts; Home button returned to / with CreativeHome present.
- Original light theme restored, temporary viewport override reset, new Home left open. No post, reaction, message, report or account mutation submitted. Theme was temporarily switched solely for visual QA and restored.
- `git diff --check`: no whitespace defects (existing line-ending notices only).

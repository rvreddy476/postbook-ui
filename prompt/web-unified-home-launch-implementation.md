# Unified Home — launch-first implementation

Date: 25 September 2026

## Decision and authority

The founder supplied the second-opinion brief and explicitly requested implementation if the direction was sound. The attachment itself is a concept-only critique prompt, with several sections abbreviated as “unchanged”; it is not a complete implementation specification. This pass uses its concrete verified-state constraints and the founder's established Home/Feed separation, not assumed missing requirements.

Agree with the launch-first correction. Implement a destination Home, not a conversations-list default and not a second social feed. With no editorial team, recommendation engine or launched transactional services, the first version provides real entrances and useful return shortcuts. It is deliberately not a fabricated editorial dashboard. Future expansion needs explicit product and service-readiness decisions.

## Workspace and scope

- Actual web source: C:\workspace\postbook-ui, branch chore/production-hardening.
- Deployment compose: C:\workspace\modernsmapp\Architecture\docker.
- Preserve all previous dirty work. No stage, commit, branch, push or PR.
- No backend, Android, Flutter, iOS, Commerce or Mopedu implementation changes.
- Attempted required Framer setup was rejected before execution; no Framer setup or package installation was performed. Existing Next.js implementation used directly.

## Implemented

- Home at `/` remains the signed-in default. `/feed` remains the separate existing social feed.
- Replaced CreativeHome's Feed, profile data hook and RightPanel with a self-contained service destination.
- Distinct video entrance with separate `/reels` and `/posttube` links; long video stays a separate product.
- Prominent `/messenger` card; groups and a single Feed entrance.
- Watch-history, saved-items and connections shortcuts; saved items and PostTube playlists library links.
- Existing Create callback opens the existing composer; no new composer or publishing implementation.
- Native keyboard-operable, initially collapsed “More on VChat” disclosure with profile, existing search, subscriptions and a non-actionable future-services note.
- Shopping/Food/Mopedu have no links or buttons; labelled “In development · not available yet”. No wallet, dating, news, live-broadcast or advertising claims.
- The Home component makes zero backend calls and downloads no media. All its destination links disable prefetch. This does NOT mean the shared authenticated shell makes zero/two calls, and does NOT establish an end-to-end network-byte budget.
- CSS-only abstract illustrations, light/dark theme tokens, 44px minimum shortcut/create/library targets, visible focus outlines, container-responsive layout and no nested Home scrolling.
- Home width cap expanded to 960px outer / 920px content only; Feed's 452px rendered width unchanged.

## Files changed by this pass

1. src/components/home/CreativeHome.tsx
2. src/components/home/creative-home.css
3. src/components/home/__tests__/creativeHome.test.tsx
4. src/features/postboek/PostBoekApp.tsx — only Home width cap changed in this pass; its other dirty changes predate this pass.
5. This handover.

Existing optional editorial Feed machinery is left untouched; Home no longer invokes it. Do not attribute the entire working-tree diff to this pass.

## Executed checks

Working directory C:\workspace\postbook-ui:

```powershell
bunx tsc --noEmit
bunx bun test
git diff --check
```

Results: typecheck exit 0; 264 tests pass, 0 fail, 593 expectations across 22 files. Diff check exit 0; existing LF/CRLF warnings only.

Four added tests verify actual rendered Home route links resolve to source pages, one Feed entry, separate short/long video routes, provider-free render with no feed/media, future services are non-actionable/closed by default, and existing Create callback runs.

Working directory C:\workspace\modernsmapp\Architecture\docker:

```powershell
docker compose build web
docker compose up -d --no-build --force-recreate web
docker ps --filter name=atpost_stack-web-1 --format 'web: {{.Status}}'
```

Build exit 0: compiled, TypeScript passed, 160/160 pages generated. Recreate exit 0. Final health: `web: Up 3 minutes (healthy)`.

Existing build warnings: middleware convention deprecated; ChatProxy secret absent at build time. This pass does not resolve or re-verify runtime chat secret configuration.

## Live browser verification

Signed-in https://cleestudio.com/ through the real browser session; no credentials retrieved, no account/content mutations.

- Desktop 1280x960: Home rendered at width 920px, scrollWidth 920, zero Home feed elements and zero media elements; screenshot inspected.
- Home Feed card navigated to `/feed`: Home absent, existing feed present, width 452px. Home navigation returned to `/`.
- Mobile 390x844 light: one 366px content column; main clientWidth/scrollWidth both 390; screenshot inspected.
- Mobile 320x800 dark: main clientWidth/scrollWidth both 320; screenshot inspected; no horizontal overflow.
- Desktop directory click: native `open=true`, actual links visible, future section has zero links/buttons.
- Home Create opened the existing real composer with empty draft and disabled Post; closed without edits.
- Light theme restored; temporary viewport override reset before handoff.

## Boundaries and follow-up decisions

- This is a launch Home shell, not full delivery of every creative idea in the strategy. No personal pinning, live content previews, active-order aggregation, editorial collections, ads, new search engine or new recommendation system.
- Existing app language remains English. No new localisation infrastructure or claim of multilingual launch readiness; founder language priorities remain open.
- No location request, inference, saved city or cross-service profile sharing.
- No changes to group discovery policy or moderation controls; linking an existing route does not close the missing moderation-owner launch gate.
- Route existence verified for every Home link; Feed transition/Create/disclosure verified live. End-to-end group/chat/video/playlist workflows were not re-audited.
- No physical-device/4G performance benchmark, screen-reader audit, or whole-shell two-call/byte-budget proof. Home itself avoids new requests, image/video payloads and prefetch.
- Keep placeholders and ads absent until backed by real services, ownership and explicit consent/disclosure rules.

## Copyable next-review prompt

Review C:\workspace\postbook-ui\prompt\web-unified-home-launch-implementation.md. Inspect the new Home at https://cleestudio.com/ on mobile/desktop and light/dark. Keep `/feed` unchanged. Assess whether the real-service destination hierarchy is useful for a new user; do not invent editorial content, activity counts, ads or actionable unlaunched services. Suggest focused refinements before introducing new backend dependencies. Preserve the dirty tree; no Git mutations.

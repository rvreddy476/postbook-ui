# Group composer — compact options, anonymity and group picker

Date: 26 September 2026. Workspace: C:\workspace\postbook-ui. Existing dirty tree preserved; no Git operations, backend edits or mobile edits.

## Delivered

- Compact Add groups and Post anonymously cards beneath the editor, small labelled tools and a small right-aligned Post button. No decorative Save draft control: no draft persistence is implemented by this pass.
- Visible, accessible anonymous switch. Enabled only when the group's existing allow_anonymous_posts flag is true; otherwise disabled with an explanation. Switching on replaces the profile presentation with an anonymous icon/title.
- Separate information popup opened by the information icon. Explains member-facing anonymity and identification risks, not copied Facebook language or an unsupported claim about moderator access.
- Add groups opens a separate searchable modal over the still-mounted composer. Current destination is checked/disabled. Selection is local until Done; Cancel and Escape abandon popup-only edits. Selected destinations remain visible as removable chips.
- Picker fetches every page of the existing /v1/groups/my limit=100/offset contract, scoped by authenticated user in the query key. Empty, malformed, failed and non-advancing pagination are distinct. Actual account has three groups; 101-group pagination is unit-proven, not live-fixtured. No new backend API needed.
- Existing cap remains four additional groups (five total). Archived/known-ineligible destinations cannot be newly selected; anonymous mode disables groups without anonymous support. Missing viewer_role is not invented: final server authorization remains authoritative.
- Native child dialogs preserve the editor draft, restore opener focus and isolate Escape and keyboard shortcuts from the composer. Search receives initial focus.
- Fixed outer composer frame retained; only the body/list scrolls when needed. At 367x550, base panel 532/532 and body 304/304 clientHeight/scrollHeight; no horizontal overflow. Dark mobile picker 421/421, width338/338. Desktop 1280x800 visually inspected.

## Privacy correction

Removed the previous effect that automatically cleared anonymous intent when permissions changed. A selected anonymous intent now stays selected and submission refuses before upload if the permission is withdrawn. Only the author can deliberately switch back to a named post. Existing server-side gates and wire contract retained.

## Executed gates

From C:\workspace\postbook-ui:

    bunx tsc --noEmit --incremental false
    bun test

PASS: 280 tests, 0 failures, 671 expectations, 25 files. New tests cover pagination beyond the first page, empty/error/repeated pages, known destination eligibility, switch presentation and nested-keyboard/privacy source wiring. Source guards are not claimed as browser runtime proofs.

From C:\workspace\modernsmapp\Architecture\docker:

    docker compose build web
    docker compose up -d --no-build --force-recreate web
    docker ps --filter name=atpost_stack-web-1 --format 'web: {{.Status}}'

Final build/deploy exit0, 160/160 pages. Existing middleware-deprecation/dev-chat-secret warnings unchanged.

## Live checks

- MyFamily: anonymous switch visibly disabled according to actual group policy; information popup explains why.
- Bengaluru Weekend Riders: switch enabled after real detail response, toggling updates author presentation. Anonymous-mode picker disables MyFamily/MyFamilyDigest as unsupported destinations.
- Picker loads three real memberships, including locked current group. Searching Digest finds MyFamilyDigest. Select + Done shows chip; remove restores no additional destinations. No publishing.
- Info-popup Escape returns to composer and restores info-button focus.
- Final deployment: Add groups autofocuses Search your groups; Escape closes only the child dialog, preserving the exact temporary draft. Draft then cleared; nothing posted or uploaded.
- Light/dark tested; original light theme, normal viewport and original MyFamily route restored.

## Boundaries

No anonymous post or cross-post was published during these UI checks. Physical mobile keyboard, live accounts over100 groups and permission revocation during upload were not live-executed. API pagination uses offsets, so concurrent membership changes are still subject to that backend contract. No group policy was changed to enable anonymous posting. No new production-readiness claim.

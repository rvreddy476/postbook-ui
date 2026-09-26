# Group New Post popup — 26 September 2026

## Follow-up: fixed frame, content-only scrolling (supersedes the panel-scroll layout below)

User requested no scrolling of the entire popup. Group composer now uses a viewport-bounded flex frame: header, tool row and full-width centered Post button remain outside the scrolling editing body. More/Background options and errors render inside the editing body in group mode; ordinary composers retain their previous placement. Reduced default spacing; no anonymity toggle is added unless the existing group permission allows it.

Verification: typecheck passed; full suite 275 pass / 0 fail / 642 expectations. Final two CSS spacing/alignment adjustments followed by focused modal guards 4 pass / 0 fail. Rebuilt and recreated web with the standard Docker command; build 160/160 pages, exit 0.

Live final deployment at 367x550: outer panel clientHeight=scrollHeight=532, editing body clientHeight=scrollHeight=258 (no default scroll). Opening More + Background: outer panel stays 532/532, body becomes 258/337; footer remains visible at y469–541. Desktop 1280x800 and mobile dark 390x844 checked: no default overflow, expanded options scroll within the body, desktop footer position unchanged. Temporary theme/viewport changes restored; clean popup left open. No post published, no backend/Git mutations. Physical phone keyboard unverified.

## Implemented

The detail route mounted CreatePortal directly in the page: it is an editor panel, not a modal. Sticky group tabs and the floating write button covered the editor; mobile content overflowed horizontally.

- Added GroupPostDialog: native dialog.showModal(), portalled to document.body, above page stacking contexts. Background is inert and page scrolling is suspended. Close/Escape restore the opener and original body overflow. Backdrop clicks do not discard writing.
- All three group entry points use it: GroupView, GroupFeedTab and the groups directory composer.
- Group-scoped CSS: 600px desktop maximum, viewport-bounded dimensions, compact identity and group destination, accessible labelled tools, sticky header/footer and a single scrollable panel when screen height requires it. Mobile tools use a three-column grid. No global composer redesign or publishing contract changes.
- CrossPostPicker now distinguishes a failed groups lookup from an empty list and offers retry.
- Shared CreatePortal changes are class hooks, group-only title and group-only tool labels. Ordinary feed composer layout unchanged.

## Executed verification

From C:\workspace\postbook-ui:

    bunx tsc --noEmit --incremental false
    bun test

PASS: 274 tests, 0 failures, 637 expectations, 24 files. Three new tests are explicitly source/wiring guards, not substitutes for browser checks. Initial sandbox execution encountered filesystem EPERM; successful run used approved elevated execution. No dependency or baseline changes.

Deployment from C:\workspace\modernsmapp\Architecture\docker:

    docker compose build web
    docker compose up -d --no-build --force-recreate web
    docker ps --filter name=atpost_stack-web-1 --format 'web: {{.Status}}'

Build generated 160/160 pages. Existing middleware deprecation and missing dev chat proxy secret warnings remain outside this change.

Live browser: MyFamily group, actual signed-in account. Native :modal true; dialog owns editor focus and background is inert. Desktop 1280x800: centered 600px dialog. Mobile 390x844: 374px dialog, panel clientWidth=scrollWidth=373, all base controls fit without scrolling. Short landscape 667x375: dialog within viewport, footer visible, panel clientWidth=scrollWidth=583. Original narrow 367x550: no horizontal overflow, vertical overflow remains accessible inside modal. Light and dark visually inspected; temporary viewport and theme changes restored.

Typed a temporary layout-check draft: Post enabled. Cleared without submitting; Escape restored focus to Write a post and body overflow. Expanded More/Background and Add groups; additional groups displayed correctly. No post, upload or membership change was made. Native Tab can visit browser chrome at the end of the modal; no custom focus-loop claim is made.

Not verified: new publication/upload E2E (publishing logic unchanged), physical phone keyboard behaviour, every optional tool combination. This pass does not claim backend or production closure. Existing dirty tree preserved; no staging, commit, branch or push.

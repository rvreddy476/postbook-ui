# postbook-ui

The web client for the ATPost / modernsmapp super-app. Next.js 15 App Router,
React 19, TypeScript, Tailwind CSS 3.

## A note on the name

This repo does not agree with itself about what the product is called, and
this README is not going to settle it:

| Where | Name |
| --- | --- |
| `package.json`, repo directory | `postbook-ui` |
| `src/app/layout.tsx` metadata (browser tab, Open Graph, JSON-LD) | **VChat** |
| `src/features/postboek/` (app-shell composition) | `postboek` |
| Checkout dialog title in `src/app/checkout/page.tsx` | VChat |
| Backend repo (`C:\workspace\modernsmapp`) | ATPost |

"VChat" is what a visitor actually sees. Pick one and rename the rest; until
then, expect all five in the codebase. Note the folder is `postboek`, not
`postbook` — an earlier README documented a `src/features/postbook/` that has
never existed.

## Tech stack

- Next.js 15 (App Router, `output: 'standalone'`)
- React 19, TypeScript 5.9
- Tailwind CSS 3.4 (`tailwind.config.ts`, PostCSS)
- TanStack Query 5 for server state; `@tanstack/react-virtual` for long lists
- axios for HTTP
- Tiptap 3 (rich text), emoji-mart, lucide-react, framer-motion
- hls.js and livekit-client for video and live
- face-api.js (a `trustedDependency`, used by camera features)

There is **no Gemini / `@google/genai` dependency**. An earlier README claimed
one; it was never in `package.json` and is not installed. The Next.js route
that proxied Gemini (`src/app/api/ai/`) had no callers and has been deleted.

Package manager is **bun** (`bun.lock`). The `scripts` block still says `next
dev` / `next build`; run them with `bun run`.

## Theme

Near-monochrome, not the orchid/violet palette an earlier README described.

`src/ui/theme.css` defines the palettes and `src/app/globals.css` maps them
onto the `--brand-*` custom properties that `tailwind.config.ts` consumes:

- **X Platform** (the active default) — white `#fff` with near-black
  `rgb(15 20 25)` text, and a `.dark` variant that is pure black with
  off-white text. Its `--theme-prismatic-violet` and `--theme-prismatic-rose`
  are both set to that same near-black, so the "prismatic" gradients render
  as flat ink.
- **Paper & Asphalt** (preserved, inactive) — warm paper `rgb(239 237 227)`
  with a crimson `#D8103F` accent. Activate by putting
  `.theme-paper-asphalt` on `<html>`.

Tailwind still exposes legacy `orchid.*` aliases; they resolve to the same
`--brand-*` variables as everything else.

## Project structure

```text
src/
  app/            51 route groups (feed, reels, posttube, commerce, checkout,
                  messenger, channels, communities, dating/postmatch, live,
                  admin, seller, settings, …) plus layout and global CSS
  app/api/        server-side handlers: auth, chat, notifications, postmatch,
                  profile, and `proxy` (see below)
  components/     shared UI
  features/       self-contained surfaces: postboek (app shell), reels,
                  posttube, live, figo, slambooks, upload, settings
  hooks/          TanStack Query hooks, one per backend domain
  lib/            axios clients (`api.ts`, `postmatchApi.ts`, …) and utilities
  services/       auth strategies, message/call/user services
  store/          client state
  types/          shared types (plus a legacy top-level `types.ts`)
  ui/             theme.css and primitives
```

## How the browser reaches the backend

Almost nothing talks to a service directly. `next.config.ts` rewrites
`/v1/:path*` onto `/api/proxy/:path*`, and
`src/app/api/proxy/[...path]/route.ts` forwards server-side to
`API_GATEWAY_URL`, passing through `authorization`, `x-user-id`,
`x-csrf-token`, `content-type`, `accept` and `cookie`.

So a hook that calls `api.get('/v1/commerce/orders')` is really calling the
api-gateway, and the gateway address is never exposed to the browser. Client
code should use relative `/v1/...` paths for this reason.

Routing is by prefix and the gateway is the source of truth for which
prefixes exist — its table is
`Architecture/services/api-gateway/cmd/server/main.go` in the backend repo.
Three prefixes this client wants are **missing** from it, so they 404 at the
edge even though the handlers exist upstream: `/v1/crossposts`
(post-service), `/v1/unread` (notification-service) and
`/v1/verification-requests` (trust-safety-service). `/v1/payments` is absent
deliberately and must stay that way — payment intents are opened through
`POST /v1/commerce/orders/:orderId/payment/intent`.

## Environment variables

Create `.env.local`. Only `API_GATEWAY_URL` is needed for most work.

```bash
# --- Server-side (Next.js route handlers; never sent to the browser) ---
API_GATEWAY_URL=http://localhost:8080       # the proxy's upstream
AUTH_SERVICE_URL=http://localhost:8081
CHAT_BACKEND_URL=http://localhost:8092/v1/chat
CHAT_PROXY_SIGNING_SECRET=local_dev_jwt_change_me
PROFILE_SERVICE_URL=
POST_SERVICE_URL=
GRAPH_SERVICE_URL=
JWT_KID=

# --- Public (inlined into the bundle) ---
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=                   # leave empty: use the proxy
NEXT_PUBLIC_WS_BASE_URL=ws://localhost:8093
NEXT_PUBLIC_AUTH_STRATEGY=remote
NEXT_PUBLIC_AUTH_REGISTER_PATH=/v1/auth/register
NEXT_PUBLIC_AUTH_LOGIN_PATH=/v1/auth/login
NEXT_PUBLIC_POSTMATCH_API_URL=              # leave empty: use the proxy
NEXT_PUBLIC_RAZORPAY_KEY_ID=
NEXT_PUBLIC_ENABLE_STUB_PAYMENTS=           # dev only; see below
```

`NEXT_PUBLIC_GEMINI_API_KEY` is no longer read anywhere and can be dropped.

## Auth / chat runtime notes

- `CHAT_PROXY_SIGNING_SECRET` must match the `JWT_SECRET` used by
  `chat-message-service` and `chat-ws-gateway`, or `/api/chat/*` and the chat
  WebSocket return 401.
- The client persists a per-browser device id in localStorage as
  `postbook_device_id` and sends it at login.
- Session state lives in localStorage under `postbook_session` and
  `postbook_auth_tokens`.
- PostMatch (dating) keeps its access token in memory only, with the refresh
  token in an httpOnly cookie scoped to `/api/postmatch`. Its auth BFF under
  `src/app/api/postmatch/auth/` still points at a retired service and does
  not work; the dating data calls themselves go through the gateway at
  `/v1/dating/*`.

## Payments

`NEXT_PUBLIC_ENABLE_STUB_PAYMENTS=true` enables a synthetic-payment path in
checkout. It is refused in a production build and additionally requires
`PAYMENTS_ALLOW_STUB=true` on commerce-service. Do not set it outside local
dev.

## Run locally

```bash
bun install
bun run dev          # http://localhost:3000
bun run build        # ~14 minutes
bun run start
bunx tsc --noEmit    # type-check
```

If `tsc` reports `TS2307` for a file under `src/app/api/` that you deleted,
it is Next's stale generated `.next/types/validator.ts` (which `tsconfig.json`
includes). Run `rm -rf .next/types` and re-check.

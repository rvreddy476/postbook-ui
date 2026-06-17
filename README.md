# Postbook UI (Next.js)

This project has been migrated to **Next.js App Router** with the existing Postbook visual identity (orchid/violet palette), responsive layout behavior, and SEO metadata.

## Tech stack

- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- Gemini SDK (`@google/genai`)

## Project structure

```text
src/
  app/                  # routes, layout, global styles, SEO files
  components/           # reusable UI components
  features/postbook/    # app-shell composition and page orchestration
  services/             # auth, chat, ai integrations
  types.ts              # shared types
```

## Environment variables

Create `.env.local` and set:

```bash
NEXT_PUBLIC_GEMINI_API_KEY=your_key_here
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_WS_BASE_URL=ws://localhost:8093
NEXT_PUBLIC_AUTH_REGISTER_PATH=/v1/auth/register
NEXT_PUBLIC_AUTH_LOGIN_PATH=/v1/auth/login
NEXT_PUBLIC_AUTH_STRATEGY=remote

# Server routes (Next.js API handlers)
API_GATEWAY_URL=http://localhost:8080
AUTH_SERVICE_URL=http://localhost:8081
CHAT_BACKEND_URL=http://localhost:8092/v1/chat
CHAT_PROXY_SIGNING_SECRET=local_dev_jwt_change_me
```

## Auth/chat runtime notes

- `CHAT_PROXY_SIGNING_SECRET` must match the backend `JWT_SECRET` used by `chat-message-service` and `chat-ws-gateway`; otherwise `/api/chat/*` and chat WebSockets will return 401.
- The web client now persists a per-browser device id in localStorage as `postbook_device_id` and sends it during login.
- Auth/session data is stored in localStorage keys:
  - `postbook_session`
  - `postbook_auth_tokens`

## Run locally

1. Install dependencies:
   `npm install`
2. Start development server:
   `npm run dev`
3. Production build:
   `npm run build && npm run start`

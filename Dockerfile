# syntax=docker/dockerfile:1.7
# Multi-stage Next.js 15 production build for postbook-ui.

FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* are inlined into the BROWSER bundle at build time, not read
# at runtime, so they are build args and changing one means rebuilding the
# image rather than restarting the container.
#
# The empty API and WS bases are deliberate: the client then derives both
# from window.location, so one image serves https://cleestudio.com for
# testers and http://localhost:3000 here with no rebuild. A hardcoded
# ws://localhost:8093 — which is what the local .env carries — would point
# every remote tester's browser at their own machine, and chat, presence and
# notifications would silently never connect. See wsUrlForPath() in
# src/services/messageService.ts.
ARG NEXT_PUBLIC_API_BASE_URL=""
ARG NEXT_PUBLIC_WS_BASE_URL=""
ARG NEXT_PUBLIC_SITE_URL="https://cleestudio.com"
ARG NEXT_PUBLIC_ENABLE_STUB_PAYMENTS="true"
ARG NEXT_PUBLIC_RAZORPAY_KEY_ID=""
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_WS_BASE_URL=$NEXT_PUBLIC_WS_BASE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_ENABLE_STUB_PAYMENTS=$NEXT_PUBLIC_ENABLE_STUB_PAYMENTS
ENV NEXT_PUBLIC_RAZORPAY_KEY_ID=$NEXT_PUBLIC_RAZORPAY_KEY_ID
ENV NEXT_TELEMETRY_DISABLED=1
# Turbopack's Google-font resolver rejects the generated Outfit query.
# Use Next's supported production Webpack path without changing the fonts.
RUN bun run build --webpack

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public ./public

USER nextjs
EXPOSE 3000

# /login is public in middleware.ts, so it answers 200 without a session —
# a gated path would report the app as unhealthy whenever nobody is signed in.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

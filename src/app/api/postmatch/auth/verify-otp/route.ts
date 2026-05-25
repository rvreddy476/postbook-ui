import { NextRequest, NextResponse } from 'next/server'

/**
 * P1-5 session redesign — Postmatch verify-OTP BFF route.
 *
 * The legacy postmatch auth backend returns
 *   { data: { access_token, refresh_token, user } }
 * which the original web client wrote into localStorage. localStorage
 * is XSS-readable; long-lived refresh tokens there are the highest-
 * value steal target. This BFF route splits the response so:
 *
 *   - refresh_token → httpOnly + Secure + SameSite=Strict cookie
 *     scoped to /api/postmatch (the only path that needs to read it)
 *   - access_token + user → JSON response the client puts in memory
 *
 * The client never writes either to localStorage. Refresh + logout
 * BFF routes read the cookie server-side.
 */

const POSTMATCH_BACKEND =
  process.env.POSTMATCH_BACKEND_URL || 'http://localhost:8090'

const COOKIE_NAME = 'pm_rt'
// Long enough to cover the upstream refresh-token lifetime; the
// upstream enforces its own expiry on every refresh attempt.
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

export async function POST(req: NextRequest) {
  const body = await req.text()
  const upstream = await fetch(
    `${POSTMATCH_BACKEND}/api/v1/auth/verify-otp`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  )
  const text = await upstream.text()
  if (!upstream.ok) {
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  type AuthPayload = {
    data?: {
      access_token?: string
      refresh_token?: string
      user?: { id: string; onboarding_status: string }
    }
  }
  let payload: AuthPayload
  try {
    payload = JSON.parse(text) as AuthPayload
  } catch {
    return NextResponse.json({ error: 'bad upstream response' }, { status: 502 })
  }
  const refresh = payload.data?.refresh_token ?? ''
  const access = payload.data?.access_token ?? ''
  const user = payload.data?.user

  if (!refresh || !access || !user) {
    return NextResponse.json({ error: 'incomplete upstream response' }, { status: 502 })
  }

  // Return access + user to the client; stash refresh in the cookie.
  const res = NextResponse.json({ data: { access_token: access, user } })
  res.cookies.set({
    name: COOKIE_NAME,
    value: refresh,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/postmatch',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })
  return res
}

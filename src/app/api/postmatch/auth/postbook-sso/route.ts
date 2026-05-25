import { NextRequest, NextResponse } from 'next/server'

/**
 * P1-5 — Postmatch SSO from Postbook BFF. Same split as verify-otp:
 * refresh token → httpOnly cookie, access token + user → JSON.
 */

const POSTMATCH_BACKEND =
  process.env.POSTMATCH_BACKEND_URL || 'http://localhost:8090'

const COOKIE_NAME = 'pm_rt'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export async function POST(req: NextRequest) {
  const body = await req.text()
  const upstream = await fetch(
    `${POSTMATCH_BACKEND}/api/v1/auth/postbook-sso`,
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
  type SSOPayload = {
    data?: {
      access_token?: string
      refresh_token?: string
      user?: { id: string; onboarding_status: string }
    }
  }
  let payload: SSOPayload
  try {
    payload = JSON.parse(text) as SSOPayload
  } catch {
    return NextResponse.json({ error: 'bad upstream response' }, { status: 502 })
  }
  const refresh = payload.data?.refresh_token ?? ''
  const access = payload.data?.access_token ?? ''
  const user = payload.data?.user
  if (!refresh || !access || !user) {
    return NextResponse.json({ error: 'incomplete upstream response' }, { status: 502 })
  }
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

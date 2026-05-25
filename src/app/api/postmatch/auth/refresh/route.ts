import { NextRequest, NextResponse } from 'next/server'

/**
 * P1-5 session redesign — Postmatch refresh BFF route.
 *
 * Reads pm_rt cookie (httpOnly, set by verify-otp BFF), forwards the
 * refresh-token to the upstream postmatch backend, returns the new
 * access_token to the client, and rotates the cookie with the new
 * refresh_token.
 *
 * The client never sees either token in JS; refresh tokens never
 * touch JS-readable storage.
 */

const POSTMATCH_BACKEND =
  process.env.POSTMATCH_BACKEND_URL || 'http://localhost:8090'

const COOKIE_NAME = 'pm_rt'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export async function POST(req: NextRequest) {
  const refresh = req.cookies.get(COOKIE_NAME)?.value
  if (!refresh) {
    return NextResponse.json({ error: 'no_refresh_token' }, { status: 401 })
  }

  const upstream = await fetch(
    `${POSTMATCH_BACKEND}/api/v1/auth/refresh`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    },
  )
  const text = await upstream.text()
  if (!upstream.ok) {
    // Bad refresh — clear the cookie so the client lands on the
    // login flow without a phantom session.
    const res = new NextResponse(text || JSON.stringify({ error: 'refresh_failed' }), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    })
    res.cookies.delete({ name: COOKIE_NAME, path: '/api/postmatch' })
    return res
  }
  type RefreshPayload = {
    data?: { access_token?: string; refresh_token?: string }
  }
  let payload: RefreshPayload
  try {
    payload = JSON.parse(text) as RefreshPayload
  } catch {
    return NextResponse.json({ error: 'bad upstream response' }, { status: 502 })
  }
  const newRefresh = payload.data?.refresh_token ?? ''
  const newAccess = payload.data?.access_token ?? ''
  if (!newAccess) {
    return NextResponse.json({ error: 'incomplete upstream response' }, { status: 502 })
  }
  const res = NextResponse.json({ data: { access_token: newAccess } })
  // Rotate the cookie if a new refresh came back; the upstream
  // optionally returns one when refresh-token rotation is enabled.
  if (newRefresh) {
    res.cookies.set({
      name: COOKIE_NAME,
      value: newRefresh,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/postmatch',
      maxAge: COOKIE_MAX_AGE_SECONDS,
    })
  }
  return res
}

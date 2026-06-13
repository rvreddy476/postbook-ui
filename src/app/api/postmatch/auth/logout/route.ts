import { NextRequest, NextResponse } from 'next/server'

/**
 * P1-5 session redesign — Postmatch logout BFF route.
 *
 * Reads pm_rt cookie, asks the upstream postmatch backend to revoke
 * the session (best-effort — even if upstream is unreachable, we
 * still clear the cookie so the user lands logged out client-side).
 */

const POSTMATCH_BACKEND =
  process.env.POSTMATCH_BACKEND_URL || 'http://localhost:8090'
const COOKIE_NAME = 'pm_rt'

export async function POST(req: NextRequest) {
  const refresh = req.cookies.get(COOKIE_NAME)?.value
  if (refresh) {
    try {
      await fetch(`${POSTMATCH_BACKEND}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      })
    } catch {
      // best-effort
    }
  }
  const res = NextResponse.json({ data: { status: 'ok' } })
  res.cookies.delete({ name: COOKIE_NAME, path: '/api/postmatch' })
  return res
}

import { NextRequest, NextResponse } from 'next/server'
import { portalRole } from '@/components/auth/portalRoles'
import { businessSelections } from '@/components/auth/partnerPortal'

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
        signal: AbortSignal.timeout(5000),
      })
    } catch {
      // best-effort
    }
  }
  const res = NextResponse.json({ data: { status: 'ok' } })
  res.cookies.delete({ name: COOKIE_NAME, path: '/api/postmatch' })
  return res
}

/** Navigation chain: receive pm_rt at its own path before clearing main auth. */
export async function GET(req: NextRequest) {
  const cleared = await POST(req)
  const role = portalRole(req.nextUrl.searchParams.get('portal'))
  const params = new URLSearchParams()
  if (role) params.set('portal', role.id)
  if (req.nextUrl.searchParams.get('partner') === '1') {
    params.set('partner', '1')
    const choices = businessSelections(req.nextUrl.searchParams.get('businesses'))
    if (choices.length) params.set('businesses', choices.join(','))
  }
  if (req.nextUrl.searchParams.get('intent') === 'register') params.set('intent', 'register')
  const target = '/api/auth/logout' + (params.size ? '?' + params : '')
  const res = new NextResponse(null, { status: 303, headers: { Location: target, 'Cache-Control': 'no-store, must-revalidate' } })
  for (const cookie of cleared.headers.getSetCookie()) res.headers.append('set-cookie', cookie)
  return res
}

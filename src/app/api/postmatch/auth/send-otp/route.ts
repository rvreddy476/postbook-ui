import { NextRequest, NextResponse } from 'next/server'

/**
 * P1-5 — send-OTP pass-through. No token is issued at this step so
 * we just proxy the request body to the upstream postmatch backend
 * and return the response unchanged.
 *
 * Routed via the BFF so the client doesn't talk to the legacy
 * postmatch host directly — useful in single-origin deployments
 * where CORS is restricted.
 */

const POSTMATCH_BACKEND =
  process.env.POSTMATCH_BACKEND_URL || 'http://localhost:8090'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const upstream = await fetch(
    `${POSTMATCH_BACKEND}/api/v1/auth/send-otp`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  )
  const text = await upstream.text()
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  })
}

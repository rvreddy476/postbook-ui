import { NextRequest } from "next/server"
import { passthroughAuth } from "../_lib/session"

/**
 * BFF register. Registration currently creates a PENDING account and returns
 * no session (auth-service LB-5), so normally there is no token to capture —
 * but it runs through the same passthrough so that if the upstream ever does
 * return a session again, the refresh token lands in the cookie rather than
 * in localStorage.
 */
export async function POST(req: NextRequest) {
    return passthroughAuth(req, "/v1/auth/register")
}

import { NextRequest } from "next/server"
import { passthroughAuth } from "../_lib/session"

/**
 * BFF login. Same upstream and same request/response contract the browser
 * used to reach through the /v1/* → /api/proxy/* rewrite; the only
 * difference is that the refresh token is captured into an httpOnly cookie
 * here and stripped from the body, so it never reaches JS at all.
 *
 * The access token still comes back in the JSON for the axios client.
 */
export async function POST(req: NextRequest) {
    return passthroughAuth(req, "/v1/auth/login")
}

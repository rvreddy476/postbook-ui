import { NextRequest } from "next/server"
import { passthroughAuth } from "../../_lib/session"

/** BFF 2FA verify — the second half of a login, so it mints a session too. */
export async function POST(req: NextRequest) {
    return passthroughAuth(req, "/v1/auth/2fa/verify")
}

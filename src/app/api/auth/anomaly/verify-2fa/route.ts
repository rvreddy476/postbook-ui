import { NextRequest } from "next/server"
import { passthroughAuth } from "../../_lib/session"

/** BFF A13 step-up (TOTP) — completes a held-back login. */
export async function POST(req: NextRequest) {
    return passthroughAuth(req, "/v1/auth/anomaly/verify-2fa")
}

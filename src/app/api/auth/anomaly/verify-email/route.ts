import { NextRequest } from "next/server"
import { passthroughAuth } from "../../_lib/session"

/** BFF A13 step-up (email OTP) — completes a held-back login. */
export async function POST(req: NextRequest) {
    return passthroughAuth(req, "/v1/auth/anomaly/verify-email")
}

import { NextRequest } from "next/server"
import { passthroughAuth } from "../../../_lib/session"
export async function POST(req: NextRequest) { return passthroughAuth(req, "/v1/auth/partner/phone/verify") }

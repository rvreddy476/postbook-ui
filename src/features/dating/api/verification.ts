/* The selfie liveness check. */

import { selfieBody, toSelfieChallenge, toSelfieResult, toVerificationStatus, type SelfieChallenge, type SelfieResult, type VerificationStatus } from "../model/verification"
import { get, post } from "./client"

export async function fetchVerificationStatus(): Promise<VerificationStatus> {
  return toVerificationStatus(await get("/verification/status"))
}

export async function createSelfieChallenge(): Promise<SelfieChallenge> {
  return toSelfieChallenge(await post("/verification/selfie/challenge"))
}

export async function submitSelfie(challengeId: string, mediaId: string): Promise<SelfieResult> {
  return toSelfieResult(await post("/verification/selfie", selfieBody(challengeId, mediaId)))
}

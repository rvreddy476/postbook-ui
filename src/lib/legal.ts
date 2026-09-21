/**
 * The terms and privacy version a new account consents to.
 *
 * This MUST match `service.CurrentTermsVersion` in
 * identity-platform/services/auth-service/internal/service/eligibility.go.
 * Registration sends it, and the server refuses a mismatch with
 * CONSENT_REQUIRED — it records WHICH text the person was shown so a
 * later audit answers that from data, not from a deployment timeline.
 *
 * When the server's version moves, change it here and update the pages in
 * src/app/terms and src/app/privacy in the same commit. Registration
 * surfaces a mismatch rather than silently failing, so the symptom is a
 * clear message rather than a form that cannot succeed.
 */
export const TERMS_VERSION = '2026-08-01'

/** Shown on the legal pages so a reader can see what they agreed to. */
export const TERMS_EFFECTIVE_DATE = '1 August 2026'

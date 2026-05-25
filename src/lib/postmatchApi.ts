import axios from 'axios'

// P1-5 session redesign — December 2026 lift to httpOnly cookies.
//
// Before: access + refresh tokens lived in localStorage. XSS-readable;
// long-lived refresh tokens there are the highest-value steal target.
//
// After: refresh token in httpOnly + Secure + SameSite=Strict cookie
// scoped to /api/postmatch (the only path that needs to read it),
// access token in module-level memory (not localStorage). Auth flow
// routes through Next.js BFF routes under /api/postmatch/auth/* which
// proxy to the upstream postmatch backend and split the response so
// JS never sees the refresh token.
//
// Trade-off: every fresh tab triggers a refresh roundtrip on first
// authed request. Acceptable for the security gain.
//
// The legacy session-key + token helpers below remain exported as
// no-op shims so callers compile during the rollout; calls eventually
// migrate to the new flow.

const POSTMATCH_SESSION_KEY = 'postmatch_session'

const canUseStorage = () =>
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'

// In-memory access token. Lost on tab close; refresh() on cold start.
let memAccessToken: string | null = null

export const getPostMatchAccessToken = (): string | null => memAccessToken

// Legacy refresh-token getter — refresh token now lives only in the
// httpOnly cookie. JS can't read it; this returns null and the
// response interceptor's refresh path uses the BFF instead.
export const getPostMatchRefreshToken = (): string | null => null

export const savePostMatchTokens = (accessToken: string, _refreshToken: string) => {
  // The BFF route has already stashed the refresh token in the
  // httpOnly cookie. We only keep the access token in memory.
  memAccessToken = accessToken || null
}

export const savePostMatchSession = (user: { id: string; onboarding_status: string }) => {
  if (!canUseStorage()) return
  // The user shape carries no token + no sensitive identifier; safe
  // to persist for cold-start UX (avoids the post-refresh user-fetch).
  localStorage.setItem(POSTMATCH_SESSION_KEY, JSON.stringify(user))
}

export const getPostMatchSession = () => {
  if (!canUseStorage()) return null
  try {
    const raw = localStorage.getItem(POSTMATCH_SESSION_KEY)
    return raw ? (JSON.parse(raw) as { id: string; onboarding_status: string }) : null
  } catch {
    return null
  }
}

export const clearPostMatchAuth = () => {
  memAccessToken = null
  if (!canUseStorage()) return
  localStorage.removeItem(POSTMATCH_SESSION_KEY)
  // Legacy keys from before P1-5 — clear so a returning user doesn't
  // carry an XSS-exposed refresh token around. One-shot migration.
  localStorage.removeItem('postmatch_auth_tokens')
}

// Same-origin BFF base — relative URL so the Next.js dev server +
// production deploy both work without env config.
const BFF_BASE = '/api/postmatch'

// Upstream base — the dating-service + chat-service backends. Routed
// through the api-gateway. Cross-origin is fine because we attach the
// access token as an Authorization header (no cookies needed for these
// calls).
const UPSTREAM_BASE =
  process.env.NEXT_PUBLIC_POSTMATCH_API_URL || 'http://localhost:8090'

const postmatchApi = axios.create({
  baseURL: UPSTREAM_BASE,
  withCredentials: false,
})

postmatchApi.interceptors.request.use((config) => {
  // /api/v1/auth/* paths get re-routed to the BFF (same-origin) so
  // the cookie attaches automatically. All other paths go upstream
  // with the Bearer header.
  const url = config.url ?? ''
  if (url.startsWith('/api/v1/auth/')) {
    // Map legacy paths onto the BFF surface:
    //   /api/v1/auth/send-otp     → /api/postmatch/auth/send-otp
    //   /api/v1/auth/verify-otp   → /api/postmatch/auth/verify-otp
    //   /api/v1/auth/refresh      → /api/postmatch/auth/refresh
    //   /api/v1/auth/logout       → /api/postmatch/auth/logout
    //   /api/v1/auth/postbook-sso → /api/postmatch/auth/postbook-sso
    const suffix = url.substring('/api/v1/auth/'.length)
    config.baseURL = ''
    config.url = `${BFF_BASE}/auth/${suffix}`
    // Cookie auto-attaches on same-origin.
    config.withCredentials = true
    return config
  }
  if (memAccessToken) {
    config.headers['Authorization'] = `Bearer ${memAccessToken}`
  }
  return config
})

postmatchApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (
      error.response?.status === 401 &&
      !error.config._retry &&
      !String(error.config.url ?? '').includes('/auth/refresh')
    ) {
      error.config._retry = true
      try {
        const res = await axios.post(
          `${BFF_BASE}/auth/refresh`,
          null,
          { withCredentials: true },
        )
        const access = res.data?.data?.access_token as string | undefined
        if (!access) throw new Error('refresh-bff-no-token')
        memAccessToken = access
        error.config.headers['Authorization'] = `Bearer ${access}`
        return postmatchApi(error.config)
      } catch {
        clearPostMatchAuth()
      }
    }
    return Promise.reject(error)
  },
)

export default postmatchApi

/**
 * Cold-start helper: try to mint a fresh access token from the
 * httpOnly refresh cookie. Returns true if a session is now active.
 * Call this on app boot before any authed request.
 */
export const tryBootstrapPostMatchSession = async (): Promise<boolean> => {
  try {
    const res = await axios.post(
      `${BFF_BASE}/auth/refresh`,
      null,
      { withCredentials: true },
    )
    const access = res.data?.data?.access_token as string | undefined
    if (!access) return false
    memAccessToken = access
    return true
  } catch {
    return false
  }
}

/**
 * Establish a PostMatch session from a Postbook user identity (SSO).
 * Returns true if a PostMatch session is now available.
 */
export const ssoFromPostbook = async (
  postbookUserID: string,
  email?: string,
): Promise<boolean> => {
  try {
    const res = await axios.post(
      `${BFF_BASE}/auth/postbook-sso`,
      { postbook_user_id: postbookUserID, email },
      { withCredentials: true },
    )
    const data = res.data?.data
    const access = data?.access_token as string | undefined
    const user = data?.user as { id: string; onboarding_status: string } | undefined
    if (!access || !user) return false
    memAccessToken = access
    savePostMatchSession(user)
    return true
  } catch {
    return false
  }
}

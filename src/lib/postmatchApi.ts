import axios from 'axios'

const POSTMATCH_TOKEN_KEY = 'postmatch_auth_tokens'
const POSTMATCH_SESSION_KEY = 'postmatch_session'

const canUseStorage = () =>
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'

export const getPostMatchAccessToken = (): string | null => {
  if (!canUseStorage()) return null
  try {
    const raw = localStorage.getItem(POSTMATCH_TOKEN_KEY)
    if (!raw) return null
    return (JSON.parse(raw) as { accessToken?: string }).accessToken ?? null
  } catch { return null }
}

export const getPostMatchRefreshToken = (): string | null => {
  if (!canUseStorage()) return null
  try {
    const raw = localStorage.getItem(POSTMATCH_TOKEN_KEY)
    if (!raw) return null
    return (JSON.parse(raw) as { refreshToken?: string }).refreshToken ?? null
  } catch { return null }
}

export const savePostMatchTokens = (accessToken: string, refreshToken: string) => {
  if (!canUseStorage()) return
  localStorage.setItem(POSTMATCH_TOKEN_KEY, JSON.stringify({ accessToken, refreshToken, updatedAt: Date.now() }))
}

export const savePostMatchSession = (user: { id: string; onboarding_status: string }) => {
  if (!canUseStorage()) return
  localStorage.setItem(POSTMATCH_SESSION_KEY, JSON.stringify(user))
}

export const getPostMatchSession = () => {
  if (!canUseStorage()) return null
  try {
    const raw = localStorage.getItem(POSTMATCH_SESSION_KEY)
    return raw ? JSON.parse(raw) as { id: string; onboarding_status: string } : null
  } catch { return null }
}

export const clearPostMatchAuth = () => {
  if (!canUseStorage()) return
  localStorage.removeItem(POSTMATCH_TOKEN_KEY)
  localStorage.removeItem(POSTMATCH_SESSION_KEY)
}

const postmatchApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_POSTMATCH_API_URL || 'http://localhost:8090',
  withCredentials: false,
})

postmatchApi.interceptors.request.use((config) => {
  const token = getPostMatchAccessToken()
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

postmatchApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = getPostMatchRefreshToken()
      if (refreshToken && !error.config._retry) {
        error.config._retry = true
        try {
          const res = await axios.post(
            `${postmatchApi.defaults.baseURL}/api/v1/auth/refresh`,
            { refresh_token: refreshToken },
          )
          const { access_token, refresh_token } = res.data.data
          savePostMatchTokens(access_token, refresh_token)
          error.config.headers['Authorization'] = `Bearer ${access_token}`
          return postmatchApi(error.config)
        } catch {
          clearPostMatchAuth()
        }
      } else {
        clearPostMatchAuth()
      }
    }
    return Promise.reject(error)
  },
)

export default postmatchApi

/**
 * Establish a PostMatch session from a Postbook user identity (SSO).
 * Returns true if a PostMatch session is now available.
 */
export const ssoFromPostbook = async (postbookUserID: string, email?: string): Promise<boolean> => {
  try {
    const res = await axios.post(
      `${postmatchApi.defaults.baseURL}/api/v1/auth/postbook-sso`,
      { postbook_user_id: postbookUserID, email },
    )
    const data = res.data.data
    savePostMatchTokens(data.access_token, data.refresh_token)
    savePostMatchSession({ id: data.user.id, onboarding_status: data.user.onboarding_status })
    return true
  } catch {
    return false
  }
}

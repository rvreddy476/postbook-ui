import axios, { AxiosError, InternalAxiosRequestConfig } from "axios"

const SESSION_KEY = "postbook_session"
const TOKEN_KEY = "postbook_auth_tokens"

const canUseStorage = () =>
    typeof window !== "undefined" && typeof localStorage !== "undefined"

const getAccessToken = (): string | null => {
    if (!canUseStorage()) return null
    try {
        const raw = localStorage.getItem(TOKEN_KEY)
        if (!raw) return null
        const record = JSON.parse(raw) as { accessToken?: string }
        return record.accessToken ?? null
    } catch {
        return null
    }
}

const getRefreshToken = (): string | null => {
    if (!canUseStorage()) return null
    try {
        const raw = localStorage.getItem(TOKEN_KEY)
        if (!raw) return null
        const record = JSON.parse(raw) as { refreshToken?: string }
        return record.refreshToken ?? null
    } catch {
        return null
    }
}

const saveTokens = (accessToken: string, refreshToken: string) => {
    if (!canUseStorage()) return
    const record = { accessToken, refreshToken, updatedAt: Date.now() }
    localStorage.setItem(TOKEN_KEY, JSON.stringify(record))
}

const getUserId = (): string | null => {
    if (!canUseStorage()) return null
    try {
        const raw = localStorage.getItem(SESSION_KEY)
        if (!raw) return null
        const user = JSON.parse(raw) as { id?: string }
        return user.id ?? null
    } catch {
        return null
    }
}

const ensureCsrfToken = (): string => {
    if (typeof document === "undefined") return ""
    const match = document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))
    if (match) return match.split("=")[1]
    const token = crypto.randomUUID()
    document.cookie = `csrf_token=${token}; path=/`
    return token
}

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "",
    withCredentials: true,
})

// Request interceptor — attach auth headers
api.interceptors.request.use((config) => {
    const token = getAccessToken()
    if (token) {
        config.headers["Authorization"] = `Bearer ${token}`
    }

    const userId = getUserId()
    if (userId) {
        config.headers["X-User-Id"] = userId
    }

    if (config.method && ["post", "put", "delete", "patch"].includes(config.method.toLowerCase())) {
        config.headers["X-Requested-With"] = "XMLHttpRequest"
        config.headers["X-CSRF-Token"] = ensureCsrfToken()
    }

    return config
})

// Response interceptor — auto-refresh on 401
let refreshPromise: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
    const refreshToken = getRefreshToken()
    if (!refreshToken) return false

    try {
        const res = await fetch("/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
        })

        if (!res.ok) return false

        const payload = await res.json()
        // Auth service returns { data: { tokens: { access_token, refresh_token } } }
        const tokens = payload?.data?.tokens ?? payload?.tokens ?? payload
        const newAccess = tokens?.access_token ?? tokens?.accessToken
        const newRefresh = tokens?.refresh_token ?? tokens?.refreshToken

        if (newAccess) {
            saveTokens(newAccess, newRefresh ?? refreshToken)
            return true
        }
        return false
    } catch {
        return false
    }
}

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
            originalRequest._retry = true

            // Deduplicate concurrent refresh calls
            if (!refreshPromise) {
                refreshPromise = refreshAccessToken().finally(() => {
                    refreshPromise = null
                })
            }

            const success = await refreshPromise
            if (success) {
                // Retry with new token
                const newToken = getAccessToken()
                if (newToken) {
                    originalRequest.headers["Authorization"] = `Bearer ${newToken}`
                }
                return api(originalRequest)
            }
        }

        return Promise.reject(error)
    }
)

export default api

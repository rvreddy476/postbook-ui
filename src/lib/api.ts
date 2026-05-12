import axios, { AxiosError, InternalAxiosRequestConfig } from "axios"

const SESSION_KEY = "postbook_session"
const TOKEN_KEY = "postbook_auth_tokens"
const SESSION_CHANGE_EVENT = "postbook:session-changed"

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

const clearStoredAuth = () => {
    if (!canUseStorage()) return
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(TOKEN_KEY)
    window.dispatchEvent(new Event(SESSION_CHANGE_EVENT))
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

    // Mopedu admin: every request to /v1/rider/admin/* carries the rider:admin
    // role header. Backend stubs this for now; production gateway will replace.
    const rawUrl = typeof config.url === "string" ? config.url : ""
    if (rawUrl.includes("/v1/rider/admin/")) {
        config.headers["X-Admin-Role"] = "rider:admin"
    }

    return config
})

type RefreshResult = "success" | "invalid" | "unavailable"

let refreshPromise: Promise<RefreshResult> | null = null

async function refreshAccessToken(): Promise<RefreshResult> {
    const refreshToken = getRefreshToken()
    if (!refreshToken) return "invalid"

    try {
        const res = await fetch("/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
        })

        if (!res.ok) {
            return res.status === 401 || res.status === 403 ? "invalid" : "unavailable"
        }

        const payload = await res.json()
        const tokens = payload?.data?.tokens ?? payload?.tokens ?? payload
        const newAccess = tokens?.access_token ?? tokens?.accessToken
        const newRefresh = tokens?.refresh_token ?? tokens?.refreshToken

        if (newAccess) {
            saveTokens(newAccess, newRefresh ?? refreshToken)
            return "success"
        }
        return "invalid"
    } catch {
        return "unavailable"
    }
}

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
            originalRequest._retry = true

            if (!refreshPromise) {
                refreshPromise = refreshAccessToken().finally(() => {
                    refreshPromise = null
                })
            }

            const result = await refreshPromise
            if (result === "success") {
                const newToken = getAccessToken()
                if (newToken) {
                    originalRequest.headers["Authorization"] = `Bearer ${newToken}`
                }
                return api(originalRequest)
            }

            if (result === "invalid") {
                clearStoredAuth()
            }
        } else if (error.response?.status === 401) {
            clearStoredAuth()
        }

        return Promise.reject(error)
    }
)

export default api

import { useMutation } from "@tanstack/react-query"
import api from "@/lib/api"

/*
  Writing help from ai-service (Architecture/services/ai-service
  internal/http/handler.go). The gateway proxies /v1/ai/* to it unchanged
  and stamps the internal key (api-gateway pkg/internalroutes StampPolicy
  "/v1/ai": true), so these are the public paths:

    POST /v1/ai/caption/suggest  {draft_id: uuid, text}               -> {data:{suggestions:[…], cached}}
    POST /v1/ai/hashtag/suggest  {draft_id: uuid, content}            -> {data:{hashtags:[…], cached}}
    POST /v1/ai/smart-reply      {conversation_id: uuid, last_messages} -> {data:{replies:[…], cached}}

  draft_id is required and the answer is cached per draft_id, so each ask
  sends a fresh id: the same id would hand back the first answer even after
  the text changed. The web used to call /v1/ai/caption-suggestions,
  /v1/ai/hashtag-suggestions and /v1/ai/smart-replies, which do not exist,
  and turned the 404 into an empty list; a failure now reads as a sentence.
*/

export const AI_ROUTES = {
    caption: "/v1/ai/caption/suggest",
    hashtags: "/v1/ai/hashtag/suggest",
    smartReply: "/v1/ai/smart-reply",
} as const

export interface AIHttp {
    post: (path: string, body: unknown) => Promise<unknown>
}

function newId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
    // Fallback for very old browsers: RFC 4122 v4 from Math.random.
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
        const r = (Math.random() * 16) | 0
        return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16)
    })
}

/** A short failure line for any refused or failed suggestion request. */
export class AISuggestionError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "AISuggestionError"
    }
}

export function aiErrorCopy(err: unknown): string {
    const e = err && typeof err === "object" ? (err as { response?: { status?: number }; isAxiosError?: boolean }) : null
    const status = e?.response?.status
    if (e?.isAxiosError && !e.response) return "Suggestions need a connection. Check yours and try again."
    if (status === 401) return "Sign in again to get suggestions."
    if (status === 429) return "Too many requests for suggestions. Wait a moment and try again."
    if (status === 404) return "Suggestions aren’t available right now."
    if (status === 400 || status === 422) return "Suggestions couldn’t be made for this text."
    if (status !== undefined && status >= 500) return "Suggestions aren’t available right now. Try again in a moment."
    return "Suggestions couldn’t be loaded. Try again."
}

/** The list under `key` in {data:{…}} (or a bare body), as trimmed non-empty strings. */
export function decodeSuggestionList(value: unknown, key: "suggestions" | "hashtags" | "replies"): string[] {
    const root = value && typeof value === "object" ? (value as Record<string, unknown>) : null
    const body = root && root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : root
    const list = body?.[key]
    if (!Array.isArray(list)) throw new AISuggestionError("Suggestions couldn’t be read. Try again.")
    const out: string[] = []
    for (const item of list) {
        if (typeof item !== "string") continue
        const s = item.trim()
        if (s && !out.includes(s)) out.push(s)
    }
    return out
}

async function ask(http: AIHttp, path: string, body: unknown, key: "suggestions" | "hashtags" | "replies"): Promise<string[]> {
    let value: unknown
    try {
        value = await http.post(path, body)
    } catch (err) {
        throw new AISuggestionError(aiErrorCopy(err))
    }
    return decodeSuggestionList(value, key)
}

export function suggestCaptions(http: AIHttp, text: string, draftId: string = newId()): Promise<string[]> {
    return ask(http, AI_ROUTES.caption, { draft_id: draftId, text }, "suggestions")
}

export function suggestHashtags(http: AIHttp, content: string, draftId: string = newId()): Promise<string[]> {
    return ask(http, AI_ROUTES.hashtags, { draft_id: draftId, content }, "hashtags")
}

export function suggestSmartReplies(http: AIHttp, conversationId: string, lastMessages: readonly string[]): Promise<string[]> {
    return ask(http, AI_ROUTES.smartReply, { conversation_id: conversationId, last_messages: [...lastMessages] }, "replies")
}

/** The app's client, shaped for the functions above. */
export const aiHttp: AIHttp = {
    post: async (path, body) => (await api.post<unknown>(path, body)).data,
}

export function useCaptionSuggestions() {
    return useMutation({ mutationFn: (text: string) => suggestCaptions(aiHttp, text) })
}

export function useHashtagSuggestions() {
    return useMutation({ mutationFn: (content: string) => suggestHashtags(aiHttp, content) })
}

export function useSmartReplies() {
    return useMutation({
        mutationFn: ({ conversationId, lastMessages }: { conversationId: string; lastMessages: readonly string[] }) =>
            suggestSmartReplies(aiHttp, conversationId, lastMessages),
    })
}

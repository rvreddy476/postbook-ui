import { str } from "./model"
import { parseChatMessage } from "./author"
import type { LivePinned } from "./chat"

// Chat moderation reads beyond bans and moderators (parity audit T-29).
// Every route below already exists in live-service-v2
// (internal/http/handler.go, Phase B chat moderation); none is invented:
//   POST   /v1/livestream/streams/:id/chat/mute               {user_id}   host, moderators
//   DELETE /v1/livestream/streams/:id/chat/mute/:userId                   host, moderators
//   GET    /v1/livestream/streams/:id/chat/mutes              → {data:{muted_user_ids:[...]}}  host, moderators
//   POST   /v1/livestream/streams/:id/chat/word-filters       {word}      host
//   DELETE /v1/livestream/streams/:id/chat/word-filters/:word             host
//   GET    /v1/livestream/streams/:id/chat/word-filters       → {data:{words:[...]}}  host
//   POST   /v1/livestream/streams/:id/chat/pin                {message_id} host
//   DELETE /v1/livestream/streams/:id/chat/pin?message_id=               host
//   GET    /v1/livestream/streams/:id/chat/pinned             → {data: chat row | null}  anyone
// A message caught by a word filter is refused with 400 CHAT_BLOCKED_WORD
// (features/live/errors.ts BLOCKED_WORD_COPY).

type Obj = Record<string, unknown>

function asObj(v: unknown): Obj | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null
}

function data(body: unknown): unknown {
  const o = asObj(body)
  return o && "data" in o ? o.data : body
}

function strings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return Array.from(new Set(raw.map(str).filter(Boolean)))
}

export const liveModerationPaths = {
  mute: (streamId: string) => `/v1/livestream/streams/${encodeURIComponent(streamId)}/chat/mute`,
  unmute: (streamId: string, userId: string) =>
    `/v1/livestream/streams/${encodeURIComponent(streamId)}/chat/mute/${encodeURIComponent(userId)}`,
  mutes: (streamId: string) => `/v1/livestream/streams/${encodeURIComponent(streamId)}/chat/mutes`,
  wordFilters: (streamId: string) => `/v1/livestream/streams/${encodeURIComponent(streamId)}/chat/word-filters`,
  wordFilter: (streamId: string, word: string) =>
    `/v1/livestream/streams/${encodeURIComponent(streamId)}/chat/word-filters/${encodeURIComponent(word)}`,
  pin: (streamId: string) => `/v1/livestream/streams/${encodeURIComponent(streamId)}/chat/pin`,
  pinned: (streamId: string) => `/v1/livestream/streams/${encodeURIComponent(streamId)}/chat/pinned`,
}

/** GET /chat/mutes. */
export function parseMuteList(body: unknown): string[] {
  return strings(asObj(data(body))?.muted_user_ids)
}

/** GET /chat/word-filters (words is null when there are none). */
export function parseWordFilters(body: unknown): string[] {
  return strings(asObj(data(body))?.words).sort((a, b) => a.localeCompare(b))
}

/** GET /chat/pinned: the pinned chat row (author card included), or null. */
export function parsePinned(body: unknown): LivePinned | null {
  const row = parseChatMessage(data(body))
  if (!row) return null
  return { message_id: row.id, user_id: row.user_id, text: row.text, author: row.author ?? null }
}

/* Kind messages (M13), hide from people I know (M16) and the client config (M18). */

import { toClientConfig, type ClientConfig } from "../model/clientConfig"
import { hideKnownBody, toHideKnown, type HideKnown } from "../model/hideKnown"
import { botheredBody, commentFilterBody, kindCheckBody, toBothered, toCommentFilter, toKindCheck, type Bothered, type CommentFilter, type KindCheck } from "../model/kindMessages"
import { get, post, put, seg } from "./client"

/** POST /kind-check — 404 while off, 429 KIND_CHECK_RATE_LIMITED past the hourly cap. Nothing about the text is stored. */
export async function kindCheck(text: string): Promise<KindCheck> {
  return toKindCheck(await post("/kind-check", kindCheckBody(text)))
}

/** POST /matches/:id/bothered — 201; offer_report when they said yes. Someone else's match is a 404. */
export async function sendBothered(matchId: string, bothered: boolean): Promise<Bothered> {
  return toBothered(await post(`/matches/${seg(matchId)}/bothered`, botheredBody(bothered)))
}

/** GET /comment-filter — 404 MECHANIC_NOT_ENABLED while off. */
export async function fetchCommentFilter(): Promise<CommentFilter> {
  return toCommentFilter(await get("/comment-filter"))
}

/** PUT /comment-filter — the whole filter; 400 INVALID_COMMENT_FILTER for a bad word list. */
export async function saveCommentFilter(filter: CommentFilter): Promise<CommentFilter> {
  return toCommentFilter(await put("/comment-filter", commentFilterBody(filter)))
}

/** GET /hide-known — 404 MECHANIC_NOT_ENABLED while off. */
export async function fetchHideKnown(): Promise<HideKnown> {
  return toHideKnown(await get("/hide-known"))
}

/** PUT /hide-known {enabled} — turning it on is 503 HIDE_KNOWN_UNAVAILABLE when the connections can't be read. */
export async function saveHideKnown(enabled: boolean): Promise<HideKnown> {
  return toHideKnown(await put("/hide-known", hideKnownBody(enabled)))
}

/** GET /client-config — read for parity with the apps; the web shows nothing from it (see model/clientConfig). */
export async function fetchClientConfig(): Promise<ClientConfig> {
  return toClientConfig(await get("/client-config"))
}

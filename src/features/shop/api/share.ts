// Recording a share (shop-engagement contract §4). PUBLIC; the gateway adds
// the user when there is one.
//   POST /products/:id/share {channel} → 204
// Fire and forget: a share that was made is never undone because the count
// could not be written, and a failure here is never shown.

import api from "@/lib/api"
import type { ShareChannel } from "../model/share"

const BASE = "/v1/commerce"

/** Never rejects; callers do not wait for it. */
export function recordShare(productId: string, channel: ShareChannel): Promise<void> {
  return api.post(`${BASE}/products/${encodeURIComponent(productId)}/share`, { channel }).then(() => undefined, () => undefined)
}

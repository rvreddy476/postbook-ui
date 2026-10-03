/*
  One Idempotency-Key per (order, action) intent. food-service REQUIRES the
  header on accept/reject/mark-preparing/mark-ready and replays a repeated
  key instead of acting twice. So:

  - the first press mints a key;
  - a press after an UNKNOWN outcome (no answer, 5xx) reuses it — the first
    attempt may have committed;
  - a definite answer (success or a 4xx) retires it, so a later, separate
    intent gets a fresh key.
*/

export interface ActionKeys {
  keyFor(orderId: string, action: string): string
  settle(orderId: string, action: string, outcomeUnknown: boolean): void
}

export function createActionKeys(generate: () => string = () => crypto.randomUUID()): ActionKeys {
  const keys = new Map<string, string>()
  return {
    keyFor(orderId, action) {
      const k = `${orderId}:${action}`
      let key = keys.get(k)
      if (!key) {
        key = generate()
        keys.set(k, key)
      }
      return key
    },
    settle(orderId, action, outcomeUnknown) {
      if (!outcomeUnknown) keys.delete(`${orderId}:${action}`)
    },
  }
}

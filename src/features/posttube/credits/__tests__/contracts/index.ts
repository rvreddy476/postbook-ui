import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/*
  The server's golden credits fixtures, byte copies (never re-serialised):

    post-service          internal/http/testdata/contracts/credits/*.json
    notification-service  internal/http/testdata/contracts/*credits*.json

  Responses are full {data|error, meta} envelopes. Requests are the
  server's request structs serialised by Go, so a field the client leaves
  out reads `null` there (a nil pointer: absent); `requestKeysSent` drops
  those, keeping the credit keys, where null is a real value (clear).
*/

export function contractFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(import.meta.dir, name), "utf8"));
}

/** The `data` object of a response envelope. */
export function contractData(name: string): Record<string, unknown> {
  return (contractFixture(name) as { data: Record<string, unknown> }).data;
}

/** The keys whose null means "clear" on the PATCH and draft routes. */
export const CREDIT_KEYS = ["credits", "genres", "release_year", "production_house"] as const;

/** A Go-serialised request body as the client sends it: null pointers (absent) dropped, credit keys kept. */
export function requestKeysSent(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== null || (CREDIT_KEYS as readonly string[]).includes(k)) out[k] = v;
  }
  return out;
}

/** Only the credit keys of a request body. */
export function creditKeysOf(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of CREDIT_KEYS) if (k in body) out[k] = body[k];
  return out;
}

/** An axios-shaped failure carrying a fixture's error envelope. */
export function contractError(name: string, status = 400): Error & { response: { status: number; data: unknown } } {
  return Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data: contractFixture(name) } });
}

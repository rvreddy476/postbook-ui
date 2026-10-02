/*
  Reading the wire, in one place.

  dating-service is Go: a zero value is omitted (`omitempty`) or sent as "" /
  0 / null depending on the field. So every mapper treats absent, null, "" and
  0 as "empty" — `??` alone would let an empty string through as a value.
*/

export type Wire = Record<string, unknown>

export interface Envelope<T = unknown> {
  data?: T
  meta?: Wire | null
  error?: { code?: string; message?: string; details?: unknown }
}

/** A plain object, or an empty one. */
export function obj(value: unknown): Wire {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Wire) : {}
}

/** An array, or an empty one (null and absent included). */
export function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** A trimmed non-empty string, or "". */
export function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/** A finite number, or 0. */
export function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

/** Only the literal `true`. */
export function bool(value: unknown): boolean {
  return value === true
}

export function strList(value: unknown): string[] {
  return arr(value).map(str).filter(Boolean)
}

/** A timestamp string that parses, or "". */
export function time(value: unknown): string {
  const s = str(value)
  return s && !Number.isNaN(Date.parse(s)) ? s : ""
}

/* ── errors ──────────────────────────────────────────────────────── */

export interface DatingError {
  /** HTTP status; 0 when there was no response (network). */
  status: number
  /** The server's stable code, or "". */
  code: string
  details: Wire
}

/** From an axios error (or anything thrown). Never carries the server's message. */
export function toDatingError(error: unknown): DatingError {
  const response = obj(obj(error).response)
  const body = obj(obj(response.data).error)
  return { status: num(response.status), code: str(body.code), details: obj(body.details) }
}

/** From an error envelope as it sits on disk in a fixture. */
export function errorFromEnvelope(envelope: unknown, status = 0): DatingError {
  const body = obj(obj(envelope).error)
  return { status, code: str(body.code), details: obj(body.details) }
}

export function errorCode(error: unknown): string {
  return toDatingError(error).code
}

export function errorStatus(error: unknown): number {
  return toDatingError(error).status
}

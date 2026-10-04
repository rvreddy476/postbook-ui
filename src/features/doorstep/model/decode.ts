/*
  A tiny decoder kit for doorstep-service's wire (contracts/doorstep/openapi.yaml).

  Two modes. Lenient (production): a missing optional field is null, a
  missing required one throws. Strict (the contract tests): additionally
  every key the server sent must be one this client knows, every key the
  contract lists must be PRESENT (Doorstep emits optional values as explicit
  null, never leaves them out), and every amount must be an integer — so a
  renamed, added or dropped field fails a test instead of rendering blank.
*/

export class WireError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = "WireError"
  }
}

export interface Ctx {
  strict: boolean
  path: string
}

export const LENIENT: Ctx = { strict: false, path: "$" }
export const STRICT: Ctx = { strict: true, path: "$" }

export function at(ctx: Ctx, key: string | number): Ctx {
  return { strict: ctx.strict, path: typeof key === "number" ? `${ctx.path}[${key}]` : `${ctx.path}.${key}` }
}

export type Obj = Record<string, unknown>

/**
  An object with exactly `known` keys (strict). `optional` keys are accepted
  when present but not required: they are fields the web reads that the
  contract does not carry yet (each one is named in the lane report).
*/
export function obj(raw: unknown, ctx: Ctx, known: readonly string[], optional: readonly string[] = []): Obj {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new WireError(ctx.path, "expected an object")
  const o = raw as Obj
  if (ctx.strict) {
    for (const key of Object.keys(o)) {
      if (!known.includes(key) && !optional.includes(key)) throw new WireError(`${ctx.path}.${key}`, "unknown field")
    }
    for (const key of known) {
      if (!(key in o)) throw new WireError(`${ctx.path}.${key}`, "missing field (nulls are explicit)")
    }
  }
  return o
}

export function reqStr(o: Obj, key: string, ctx: Ctx): string {
  const v = o[key]
  if (typeof v !== "string") throw new WireError(at(ctx, key).path, "expected a string")
  return v
}

export function optStr(o: Obj, key: string, ctx: Ctx): string | null {
  const v = o[key]
  if (v === undefined || v === null) return null
  if (typeof v !== "string") throw new WireError(at(ctx, key).path, "expected a string")
  return v
}

export function strOr(o: Obj, key: string, ctx: Ctx, fallback = ""): string {
  return optStr(o, key, ctx) ?? fallback
}

export function reqBool(o: Obj, key: string, ctx: Ctx): boolean {
  const v = o[key]
  if (typeof v !== "boolean") throw new WireError(at(ctx, key).path, "expected a boolean")
  return v
}

export function boolOr(o: Obj, key: string, ctx: Ctx, fallback = false): boolean {
  const v = o[key]
  if (v === undefined || v === null) return fallback
  if (typeof v !== "boolean") throw new WireError(at(ctx, key).path, "expected a boolean")
  return v
}

export function optNum(o: Obj, key: string, ctx: Ctx): number | null {
  const v = o[key]
  if (v === undefined || v === null) return null
  if (typeof v !== "number" || !Number.isFinite(v)) throw new WireError(at(ctx, key).path, "expected a number")
  return v
}

export function reqNum(o: Obj, key: string, ctx: Ctx): number {
  const v = optNum(o, key, ctx)
  if (v === null) throw new WireError(at(ctx, key).path, "expected a number")
  return v
}

export function optInt(o: Obj, key: string, ctx: Ctx): number | null {
  const v = optNum(o, key, ctx)
  if (v === null) return null
  if (!Number.isSafeInteger(v)) throw new WireError(at(ctx, key).path, "expected an integer")
  return v
}

export function intOr(o: Obj, key: string, ctx: Ctx, fallback = 0): number {
  return optInt(o, key, ctx) ?? fallback
}

/** A required integer paise field. Strict and lenient alike refuse a fractional or missing one. */
export function reqPaise(o: Obj, key: string, ctx: Ctx): number {
  const v = optInt(o, key, ctx)
  if (v === null) throw new WireError(at(ctx, key).path, "expected integer paise")
  return v
}

export function optPaise(o: Obj, key: string, ctx: Ctx): number | null {
  return optInt(o, key, ctx)
}

/** One of `values`; strict refuses anything else, lenient keeps the raw string. */
export function oneOf<T extends string>(o: Obj, key: string, ctx: Ctx, values: readonly T[]): T {
  const v = reqStr(o, key, ctx)
  if (ctx.strict && !(values as readonly string[]).includes(v)) throw new WireError(at(ctx, key).path, `unexpected value ${JSON.stringify(v)}`)
  return v as T
}

export function arr<T>(o: Obj, key: string, ctx: Ctx, each: (raw: unknown, ctx: Ctx) => T): T[] {
  const v = o[key]
  if (v === undefined || v === null) return []
  if (!Array.isArray(v)) throw new WireError(at(ctx, key).path, "expected an array")
  const c = at(ctx, key)
  return v.map((item, i) => each(item, at(c, i)))
}

export function strArr(o: Obj, key: string, ctx: Ctx): string[] {
  return arr(o, key, ctx, (raw, c) => {
    if (typeof raw !== "string") throw new WireError(c.path, "expected a string")
    return raw
  })
}

export function optObj<T>(o: Obj, key: string, ctx: Ctx, decode: (raw: unknown, ctx: Ctx) => T): T | null {
  const v = o[key]
  if (v === undefined || v === null) return null
  return decode(v, at(ctx, key))
}

export function reqObj<T>(o: Obj, key: string, ctx: Ctx, decode: (raw: unknown, ctx: Ctx) => T): T {
  const v = optObj(o, key, ctx, decode)
  if (v === null) throw new WireError(at(ctx, key).path, "expected an object")
  return v
}

/* ── the envelope ─────────────────────────────────────────────────── */

export interface WireErrorBody {
  code: string
  message: string
  details: Obj | null
}

/** `{data, meta}` → data. */
export function envelopeData(raw: unknown, ctx: Ctx): unknown {
  const o = obj(raw, ctx, ["data", "meta"])
  if (!("data" in o)) throw new WireError(ctx.path, "missing data")
  return o.data
}

/** `{error: {code, message, details?}, meta}` → the error. */
export function envelopeError(raw: unknown, ctx: Ctx): WireErrorBody {
  const o = obj(raw, ctx, ["error", "meta"])
  const c = at(ctx, "error")
  // details is optional on the wire (absent when there is nothing to add).
  const e = obj(o.error, { ...c, strict: false }, [])
  if (ctx.strict) {
    for (const key of Object.keys(e)) {
      if (!["code", "message", "details"].includes(key)) throw new WireError(`${c.path}.${key}`, "unknown field")
    }
  }
  const details = e.details
  return {
    code: reqStr(e, "code", c),
    message: strOr(e, "message", c),
    details: details && typeof details === "object" && !Array.isArray(details) ? (details as Obj) : null,
  }
}

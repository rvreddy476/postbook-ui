/*
  A tiny decoder kit for food-service's wire.

  Two modes. Lenient (production): a missing optional field is null, a
  missing required one throws. Strict (the contract tests): additionally
  every key the server sent must be one this client knows, and every amount
  must be an integer — so a renamed or added field fails a test instead of
  silently rendering blank.
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

export function obj(raw: unknown, ctx: Ctx, known: readonly string[]): Obj {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new WireError(ctx.path, "expected an object")
  const o = raw as Obj
  if (ctx.strict) {
    for (const key of Object.keys(o)) {
      if (!known.includes(key)) throw new WireError(`${ctx.path}.${key}`, "unknown field")
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

export function optBool(o: Obj, key: string, ctx: Ctx): boolean | null {
  const v = o[key]
  if (v === undefined || v === null) return null
  if (typeof v !== "boolean") throw new WireError(at(ctx, key).path, "expected a boolean")
  return v
}

export function boolOr(o: Obj, key: string, ctx: Ctx, fallback = false): boolean {
  return optBool(o, key, ctx) ?? fallback
}

export function optNum(o: Obj, key: string, ctx: Ctx): number | null {
  const v = o[key]
  if (v === undefined || v === null) return null
  if (typeof v !== "number" || !Number.isFinite(v)) throw new WireError(at(ctx, key).path, "expected a number")
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

/** An integer paise field. Strict and lenient alike refuse a fractional one: paise are never fractional. */
export function optPaise(o: Obj, key: string, ctx: Ctx): number | null {
  return optInt(o, key, ctx)
}

export function paiseOr(o: Obj, key: string, ctx: Ctx): number {
  return optPaise(o, key, ctx) ?? 0
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

/* ── the envelope ─────────────────────────────────────────────────── */

export interface WireErrorBody {
  code: string
  message: string
  details: Obj | null
}

/** `{data, meta}` → data (meta is optional: me/capabilities omits it). */
export function envelopeData(raw: unknown, ctx: Ctx): unknown {
  const o = obj(raw, ctx, ["data", "meta"])
  if (!("data" in o)) throw new WireError(ctx.path, "missing data")
  return o.data
}

/** `{error: {code, message, details?}, meta}` → the error. */
export function envelopeError(raw: unknown, ctx: Ctx): WireErrorBody {
  const o = obj(raw, ctx, ["error", "meta"])
  const c = at(ctx, "error")
  const e = obj(o.error, c, ["code", "message", "details"])
  const details = e.details
  return {
    code: reqStr(e, "code", c),
    message: strOr(e, "message", c),
    details: details && typeof details === "object" && !Array.isArray(details) ? (details as Obj) : null,
  }
}

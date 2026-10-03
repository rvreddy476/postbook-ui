/*
  A tiny strict decoder. Every response the console renders is decoded with
  these, so a renamed or retyped field fails loudly (a ContractError the
  screen shows as "the server sent something this page can't read") instead
  of rendering a zero, an empty name or — worst — a wrong amount.

  Unknown extra fields are allowed: the server may add, never silently change.
*/

export class ContractError extends Error {
  constructor(path: string, expected: string) {
    super(`unexpected response: ${path} should be ${expected}`)
    this.name = "ContractError"
  }
}

export type Obj = Record<string, unknown>

export function obj(v: unknown, path: string): Obj {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new ContractError(path, "an object")
  return v as Obj
}

export function str(o: Obj, key: string, path: string): string {
  const v = o[key]
  if (typeof v !== "string") throw new ContractError(`${path}.${key}`, "a string")
  return v
}

export function optStr(o: Obj, key: string, path: string): string | null {
  const v = o[key]
  if (v === undefined || v === null) return null
  if (typeof v !== "string") throw new ContractError(`${path}.${key}`, "a string or null")
  return v
}

export function num(o: Obj, key: string, path: string): number {
  const v = o[key]
  if (typeof v !== "number" || !Number.isFinite(v)) throw new ContractError(`${path}.${key}`, "a number")
  return v
}

export function optNum(o: Obj, key: string, path: string): number | null {
  const v = o[key]
  if (v === undefined || v === null) return null
  if (typeof v !== "number" || !Number.isFinite(v)) throw new ContractError(`${path}.${key}`, "a number or null")
  return v
}

export function int(o: Obj, key: string, path: string): number {
  const v = num(o, key, path)
  if (!Number.isSafeInteger(v)) throw new ContractError(`${path}.${key}`, "an integer")
  return v
}

/** A `*_paise` field: a non-negative safe integer, required. */
export function paise(o: Obj, key: string, path: string): number {
  const v = int(o, key, path)
  if (v < 0) throw new ContractError(`${path}.${key}`, "non-negative paise")
  return v
}

export function optPaise(o: Obj, key: string, path: string): number | null {
  if (o[key] === undefined || o[key] === null) return null
  return paise(o, key, path)
}

export function bool(o: Obj, key: string, path: string): boolean {
  const v = o[key]
  if (typeof v !== "boolean") throw new ContractError(`${path}.${key}`, "a boolean")
  return v
}

export function arr(o: Obj, key: string, path: string): unknown[] {
  const v = o[key]
  if (!Array.isArray(v)) throw new ContractError(`${path}.${key}`, "an array")
  return v
}

/** An optional array: absent or null reads as empty (Go nil slices encode as null). */
export function optArr(o: Obj, key: string, path: string): unknown[] {
  const v = o[key]
  if (v === undefined || v === null) return []
  if (!Array.isArray(v)) throw new ContractError(`${path}.${key}`, "an array or null")
  return v
}

export function strArr(o: Obj, key: string, path: string): string[] {
  return arr(o, key, path).map((v, i) => {
    if (typeof v !== "string") throw new ContractError(`${path}.${key}[${i}]`, "a string")
    return v
  })
}

/** The `{data: …}` envelope every food-service success answers with. */
export function envelopeData(body: unknown, path = "body"): unknown {
  const o = obj(body, path)
  if (!("data" in o)) throw new ContractError(`${path}.data`, "present")
  return o.data
}

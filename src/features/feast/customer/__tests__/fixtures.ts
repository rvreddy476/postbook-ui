/*
  food-service's golden fixtures, copied byte for byte into ./contracts from
  Architecture/services/food-service/internal/http/testdata/contracts. When the
  backend checkout is on this machine the copies are compared to it.
*/

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { envelopeData, envelopeError, STRICT, type WireErrorBody } from "../model/decode"

const HERE = import.meta.dir
export const LOCAL_DIR = resolve(HERE, "contracts")
export const BACKEND_DIR = "C:/workspace/modernsmapp/Architecture/services/food-service/internal/http/testdata/contracts"

export function localFixtureNames(): string[] {
  return readdirSync(LOCAL_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5))
    .sort()
}

export function localText(name: string): string {
  return readFileSync(resolve(LOCAL_DIR, `${name}.json`), "utf8")
}

export function backendText(name: string): string | null {
  const p = resolve(BACKEND_DIR, `${name}.json`)
  return existsSync(p) ? readFileSync(p, "utf8") : null
}

/** The fixture's `data`, through the strict envelope. */
export function fixtureData(name: string): unknown {
  return envelopeData(JSON.parse(localText(name)), STRICT)
}

export function fixtureError(name: string): WireErrorBody {
  return envelopeError(JSON.parse(localText(name)), STRICT)
}

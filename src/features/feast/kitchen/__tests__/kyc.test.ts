import { describe, expect, test } from "bun:test"

import { checkCompliance } from "../model/compliance"
import { GST_STATE_NAMES, gstinCheckDigit, LOCATION_STATE_NAMES, validateBankAccount, validateFSSAILicence, validateGSTIN, validateIFSC, validatePAN } from "../model/kyc"

/** Independent reference (shared/kyc gstin_test.go refGSTINCheck), written differently on purpose. */
function refCheck(first14: string): string {
  const alpha = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  let total = 0
  first14.split("").forEach((ch, i) => {
    const product = alpha.indexOf(ch) * (i % 2 === 0 ? 1 : 2)
    total += Math.trunc(product / 36) + (product % 36)
  })
  return alpha[(36 - (total % 36)) % 36]
}

const synth = (state: string, pan: string) => {
  const b = `${state}${pan}1Z`
  return b + refCheck(b)
}

describe("GSTIN checksum (mirrors shared/kyc)", () => {
  test("hand-computed golden 29ZZZPZ0000Z1Z6", () => {
    expect(refCheck("29ZZZPZ0000Z1Z")).toBe("6")
    expect(gstinCheckDigit("29ZZZPZ0000Z1Z")).toBe("6")
    const g = validateGSTIN("29ZZZPZ0000Z1Z6")
    expect(g.ok).toBe(true)
    if (g.ok) {
      expect(g.value.stateCode).toBe("29")
      expect(g.value.pan).toBe("ZZZPZ0000Z")
    }
  })

  test("the server's compliance fixture GSTIN passes", () => {
    expect(validateGSTIN("29ZZZPZ0000Z1Z6").ok).toBe(true)
  })

  test("every one of the 35 wrong check characters is refused as CHECKSUM", () => {
    const valid = synth("29", "ZZZHZ0000Z")
    const alpha = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    let wrong = 0
    for (const ch of alpha) {
      const r = validateGSTIN(valid.slice(0, 14) + ch)
      if (ch === valid[14]) {
        expect(r.ok).toBe(true)
        continue
      }
      wrong++
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.part).toBe("CHECKSUM")
    }
    expect(wrong).toBe(35)
  })

  test("every assigned state code passes; unassigned are STATE_CODE", () => {
    const codes = ["97", ...Array.from({ length: 38 }, (_, i) => String(i + 1).padStart(2, "0"))]
    for (const c of codes) expect(validateGSTIN(synth(c, "ZZZCZ0000Z")).ok).toBe(true)
    for (const c of ["00", "39", "40", "96", "98", "99"]) {
      const r = validateGSTIN(synth(c, "ZZZPZ0000Z"))
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.part).toBe("STATE_CODE")
    }
  })

  test("PAN-in-GSTIN: a holder type that is not one is refused as PAN (29ABCDE1234F1ZW)", () => {
    expect(synth("29", "ABCDE1234F")).toBe("29ABCDE1234F1ZW")
    const r = validateGSTIN("29ABCDE1234F1ZW")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.part).toBe("PAN")
    for (const bad of ["D", "E", "K", "Z", "X"]) {
      const v = validateGSTIN(synth("29", `ZZZ${bad}Z0000Z`))
      expect(v.ok).toBe(false)
      if (!v.ok) expect(v.part).toBe("PAN")
    }
  })

  test("normalises case and surrounding space; refuses non-ASCII and format slips", () => {
    const want = synth("27", "ZZZFZ0000Z")
    const r = validateGSTIN(`  ${want.toLowerCase()}\t`)
    expect(r.ok && r.value.normalized).toBe(want)
    for (const bad of [want.slice(0, 13) + "Y" + want.slice(14), want.slice(0, 12) + "0" + want.slice(13), want.slice(0, 14), want + "1", "", want.slice(0, 2) + "ſ" + want.slice(3)]) {
      const v = validateGSTIN(bad)
      expect(v.ok).toBe(false)
      if (!v.ok) expect(v.part).toBe("FORMAT")
    }
  })

  test("messages never echo the value", () => {
    const r = validateGSTIN("29ZZZPZ0000Z1Z7")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).not.toContain("29ZZZPZ0000Z1Z")
  })
})

describe("PAN", () => {
  test("every holder type", () => {
    for (const h of "PCHFATBLJG") expect(validatePAN(`ZZZ${h}Z0000Z`).ok).toBe(true)
  })
  test("unknown holder type and format failures", () => {
    expect(validatePAN("ABCDE1234F").ok).toBe(false)
    expect(validatePAN("ZZZPZ000Z").ok).toBe(false)
    expect(validatePAN(" zzzpz0000z ").ok).toBe(true)
  })
})

describe("compliance form mirrors onboarding.ValidateCompliance", () => {
  const base = { taxCategory: "RESTAURANT_STANDALONE", legalName: "Test Kitchens LLP", pan: "ZZZPZ0000Z", gstin: "", specifiedPremisesDeclaredAt: "" }
  test("ECO category: GSTIN optional", () => {
    expect(checkCompliance(base, "2026-10-03").ok).toBe(true)
  })
  test("supplier-liable category without GSTIN is refused (FOOD_GSTIN_REQUIRED's rule)", () => {
    const r = checkCompliance({ ...base, taxCategory: "OUTDOOR_CATERING" }, "2026-10-03")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.field).toBe("gstin")
  })
  test("the PAN inside the GSTIN must equal the PAN (FOOD_GSTIN_PAN_MISMATCH's rule)", () => {
    const r = checkCompliance({ ...base, pan: "ZZZCZ0000Z", gstin: "29ZZZPZ0000Z1Z6" }, "2026-10-03")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain("does not match")
    expect(checkCompliance({ ...base, gstin: "29zzzpz0000z1z6" }, "2026-10-03")).toEqual({
      ok: true,
      body: { tax_category: "RESTAURANT_STANDALONE", legal_name: "Test Kitchens LLP", pan: "ZZZPZ0000Z", gstin: "29ZZZPZ0000Z1Z6", specified_premises_declared_at: "" },
    })
  })
  test("specified premises needs a past-or-today declaration date", () => {
    const sp = { ...base, taxCategory: "RESTAURANT_SPECIFIED_PREMISES", gstin: "29ZZZPZ0000Z1Z6" }
    expect(checkCompliance(sp, "2026-10-03").ok).toBe(false)
    expect(checkCompliance({ ...sp, specifiedPremisesDeclaredAt: "2026-10-04" }, "2026-10-03").ok).toBe(false)
    expect(checkCompliance({ ...sp, specifiedPremisesDeclaredAt: "2026-09-01" }, "2026-10-03").ok).toBe(true)
  })
})

describe("bank, IFSC, FSSAI, states", () => {
  test("IFSC and account", () => {
    expect(validateIFSC("hdfc0000053").ok).toBe(true)
    expect(validateIFSC("HDFC1000053").ok).toBe(false)
    expect(validateBankAccount("123456789").ok).toBe(true)
    expect(validateBankAccount("12345678").ok).toBe(false)
    expect(validateBankAccount("1234567890123456789").ok).toBe(false)
  })
  test("FSSAI licence is 14 digits, spaces ignored", () => {
    expect(validateFSSAILicence("100 9999 9000 000").ok).toBe(true)
    expect(validateFSSAILicence("1009999900000").ok).toBe(false)
  })
  test("location states exclude 97 and 28, sorted", () => {
    expect(LOCATION_STATE_NAMES).not.toContain(GST_STATE_NAMES["97"])
    expect(LOCATION_STATE_NAMES).not.toContain(GST_STATE_NAMES["28"])
    expect(LOCATION_STATE_NAMES).toContain("Karnataka")
    expect([...LOCATION_STATE_NAMES].sort((a, b) => a.localeCompare(b))).toEqual([...LOCATION_STATE_NAMES])
  })
})

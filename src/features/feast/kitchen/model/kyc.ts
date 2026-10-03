/*
  Client-side format and checksum checks for the identifiers the onboarding
  steps collect. A line-for-line mirror of Architecture/shared/kyc (pan.go,
  gstin.go, statecodes.go, kyc.go, documents.go). They exist to catch a typo
  before a round trip; the SERVER is authoritative and its 422 is always shown
  as it says.

  Messages never echo the value typed.
*/

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const GSTIN_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/

/** PAN holder types (the fourth character), shared/kyc PANHolderType. */
export const PAN_HOLDER_TYPES: Readonly<Record<string, string>> = {
  P: "INDIVIDUAL",
  C: "COMPANY",
  H: "HUF",
  F: "FIRM",
  A: "AOP",
  T: "TRUST",
  B: "BOI",
  L: "LOCAL_AUTHORITY",
  J: "ARTIFICIAL_JURIDICAL_PERSON",
  G: "GOVERNMENT",
}

/** GST state and union-territory codes (shared/kyc statecodes.go). 99 is refused on purpose. */
export const GST_STATE_NAMES: Readonly<Record<string, string>> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman and Diu",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (before reorganisation)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
}

/**
 * The state names the location route accepts (onboarding.KnownStateNames):
 * the table above minus 97 and 28, sorted.
 */
export const LOCATION_STATE_NAMES: readonly string[] = Object.entries(GST_STATE_NAMES)
  .filter(([code]) => code !== "97" && code !== "28")
  .map(([, name]) => name)
  .sort((a, b) => a.localeCompare(b))

/** shared/kyc normalizeASCII: trim ASCII space, refuse non-ASCII, upper-case, drop `drop`. */
export function normalizeASCII(s: string, drop = ""): string | null {
  const trimmed = s.replace(/^[ \t\n\r\v\f]+|[ \t\n\r\v\f]+$/g, "")
  let out = ""
  for (const ch of trimmed) {
    const code = ch.codePointAt(0) ?? 0
    if (code >= 0x80) return null
    if (drop && drop.includes(ch)) continue
    out += ch >= "a" && ch <= "z" ? ch.toUpperCase() : ch
  }
  return out
}

export type CheckResult<T = string> = { ok: true; value: T } | { ok: false; message: string }

export function validatePAN(s: string): CheckResult {
  const n = normalizeASCII(s)
  if (n === null || !PAN_PATTERN.test(n)) return { ok: false, message: "PAN must be five letters, four digits and a letter." }
  if (!PAN_HOLDER_TYPES[n[3]]) return { ok: false, message: "The PAN's fourth character is not a recognised holder type." }
  return { ok: true, value: n }
}

/** The fifteenth GSTIN character for the first fourteen (shared/kyc GSTINCheckDigit). */
export function gstinCheckDigit(first14: string): string | null {
  if (first14.length !== 14) return null
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const v = GSTIN_ALPHABET.indexOf(first14[i])
    if (v < 0) return null
    const factor = i % 2 === 1 ? 2 : 1
    const p = v * factor
    sum += Math.floor(p / 36) + (p % 36)
  }
  return GSTIN_ALPHABET[(36 - (sum % 36)) % 36]
}

export type GstinPart = "FORMAT" | "STATE_CODE" | "PAN" | "CHECKSUM"

export interface Gstin {
  normalized: string
  stateCode: string
  pan: string
}

export function validateGSTIN(s: string): { ok: true; value: Gstin } | { ok: false; part: GstinPart; message: string } {
  const n = normalizeASCII(s)
  if (n === null || !GSTIN_PATTERN.test(n)) {
    return { ok: false, part: "FORMAT", message: "GSTIN must be a 2-digit state code, a 10-character PAN, an entity character, Z and a check character." }
  }
  const stateCode = n.slice(0, 2)
  if (!GST_STATE_NAMES[stateCode]) return { ok: false, part: "STATE_CODE", message: "The GSTIN's state code is not an assigned GST state code." }
  if (!PAN_HOLDER_TYPES[n[5]]) return { ok: false, part: "PAN", message: "The PAN inside the GSTIN has an unrecognised holder type." }
  if (gstinCheckDigit(n.slice(0, 14)) !== n[14]) return { ok: false, part: "CHECKSUM", message: "The GSTIN's check character does not match. Check it for a typo." }
  return { ok: true, value: { normalized: n, stateCode, pan: n.slice(2, 12) } }
}

/** The PAN inside the GSTIN must be the PAN given (onboarding.ValidateCompliance). */
export function gstinMatchesPAN(gstin: Gstin, pan: string): boolean {
  return gstin.pan === pan
}

export function validateIFSC(s: string): CheckResult {
  const n = s.trim().toUpperCase()
  return IFSC_PATTERN.test(n) ? { ok: true, value: n } : { ok: false, message: "IFSC is four letters, a zero and six letters or digits." }
}

export function validateBankAccount(s: string): CheckResult {
  const n = s.trim()
  return /^[0-9]{9,18}$/.test(n) ? { ok: true, value: n } : { ok: false, message: "Account number must be 9 to 18 digits." }
}

/** 14 digits; spaces are ignored (shared/kyc ValidateFSSAILicence). */
export function validateFSSAILicence(s: string): CheckResult {
  const n = normalizeASCII(s, " ")
  return n !== null && /^[0-9]{14}$/.test(n) ? { ok: true, value: n } : { ok: false, message: "The FSSAI licence number is 14 digits." }
}

/** A 12-digit run that looks like an Aadhaar number: the server refuses it anywhere (AADHAAR_NOT_ALLOWED). */
export function looksLikeAadhaar(s: string): boolean {
  return /^[2-9][0-9]{11}$/.test(s.replace(/[\s-]/g, ""))
}

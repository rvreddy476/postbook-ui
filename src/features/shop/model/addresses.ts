// Addresses: what `GET /addresses` sends (`postgres.CustomerAddress`), what
// the form holds, how it is checked before anything goes on the wire, and
// the body `POST /addresses` / `PATCH /addresses/:id` accept
// (handler.go addAddressReq).
//
// The form's validation is a pure function of its values, so the six rules
// (name, 10-digit phone, 6-digit pincode, line 1, city, state) are tested
// here and the component only draws the errors.

/** One saved address, as the read path returns it. `omitempty` on every field. */
export interface WireAddress {
  id?: string
  user_id?: string
  label?: string
  contact_name?: string
  phone?: string
  address_line_1?: string
  address_line_2?: string | null
  landmark?: string | null
  city?: string
  state?: string
  country?: string
  postal_code?: string
  address_type?: string
  /** omitempty: absent means false. */
  is_default?: boolean
  created_at?: string
}

export type AddressType = "home" | "work" | "other"

export interface Address {
  id: string
  contactName: string
  phone: string
  line1: string
  line2: string
  landmark: string
  city: string
  state: string
  pincode: string
  country: string
  type: AddressType
  isDefault: boolean
}

export function readAddressType(raw: string | null | undefined): AddressType {
  return raw === "work" || raw === "other" ? raw : "home"
}

export function toAddress(a: WireAddress): Address | null {
  if (!a || !a.id) return null
  return {
    id: a.id,
    contactName: a.contact_name || "",
    phone: a.phone || "",
    line1: a.address_line_1 || "",
    line2: a.address_line_2 || "",
    landmark: a.landmark || "",
    city: a.city || "",
    state: a.state || "",
    pincode: a.postal_code || "",
    country: a.country || "IN",
    type: readAddressType(a.address_type),
    isDefault: a.is_default === true,
  }
}

/** Every address with an id, the default first, then the rest in arrival order. */
export function toAddresses(rows: readonly WireAddress[] | null | undefined): Address[] {
  if (!Array.isArray(rows)) return []
  const out: Address[] = []
  for (const row of rows) {
    const address = toAddress(row)
    if (address) out.push(address)
  }
  return out
    .map((address, index) => ({ address, index }))
    .sort((a, b) => Number(b.address.isDefault) - Number(a.address.isDefault) || a.index - b.index)
    .map(({ address }) => address)
}

/** The one-line summary a card and a checkout picker show. */
export function formatAddressLine(a: Pick<Address, "line1" | "line2" | "landmark" | "city" | "state" | "pincode">): string {
  return [a.line1, a.line2, a.landmark, a.city, a.state, a.pincode].map((s) => s.trim()).filter(Boolean).join(", ")
}

// ── The form ───────────────────────────────────────────────────────────

/** What the form holds. The shape W2's checkout imports; pinned by the brief. */
export interface AddressFormValues {
  contactName: string
  phone: string
  line1: string
  line2: string
  landmark: string
  city: string
  state: string
  pincode: string
  type: AddressType
  isDefault: boolean
}

export const EMPTY_ADDRESS_FORM: AddressFormValues = {
  contactName: "",
  phone: "",
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
  type: "home",
  isDefault: false,
}

/** A saved address back into the form, for editing. */
export function addressToForm(a: Address | null | undefined): AddressFormValues {
  if (!a) return { ...EMPTY_ADDRESS_FORM }
  return {
    contactName: a.contactName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2,
    landmark: a.landmark,
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    type: a.type,
    isDefault: a.isDefault,
  }
}

export type AddressField = keyof AddressFormValues
export type AddressErrors = Partial<Record<AddressField, string>>

/** Digits only, so "98765 43210" and "+91 98765-43210" read as the same ten. */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  // A leading country code for India is dropped; the service wants the ten.
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1)
  return digits
}

export function normalisePincode(raw: string): string {
  return raw.replace(/\D/g, "")
}

/**
 * The form's rules. Every message names what to do, not what went wrong
 * in the abstract, because the person reading it is filling in a form.
 */
export function validateAddress(values: AddressFormValues): AddressErrors {
  const errors: AddressErrors = {}
  if (!values.contactName.trim()) errors.contactName = "Enter the name the parcel is addressed to."
  const phone = normalisePhone(values.phone)
  if (!phone) errors.phone = "Enter a mobile number."
  else if (!/^[6-9]\d{9}$/.test(phone)) errors.phone = "Enter a 10-digit Indian mobile number."
  if (!values.line1.trim()) errors.line1 = "Enter the house or flat number and street."
  if (!values.city.trim()) errors.city = "Enter the city."
  if (!values.state.trim()) errors.state = "Enter the state."
  const pincode = normalisePincode(values.pincode)
  if (!pincode) errors.pincode = "Enter the PIN code."
  else if (!/^[1-9]\d{5}$/.test(pincode)) errors.pincode = "Enter a 6-digit PIN code."
  return errors
}

export function isAddressValid(values: AddressFormValues): boolean {
  return Object.keys(validateAddress(values)).length === 0
}

/** The body `POST /addresses` and `PATCH /addresses/:id` accept. `contact_name` is the wire name the column and Android use. */
export interface AddressRequest {
  contact_name: string
  phone: string
  address_line_1: string
  address_line_2?: string
  landmark?: string
  city: string
  state: string
  postal_code: string
  country: string
  address_type: AddressType
  is_default: boolean
}

export function toAddressRequest(values: AddressFormValues): AddressRequest {
  const line2 = values.line2.trim()
  const landmark = values.landmark.trim()
  return {
    contact_name: values.contactName.trim(),
    phone: normalisePhone(values.phone),
    address_line_1: values.line1.trim(),
    ...(line2 ? { address_line_2: line2 } : {}),
    ...(landmark ? { landmark } : {}),
    city: values.city.trim(),
    state: values.state.trim(),
    postal_code: normalisePincode(values.pincode),
    country: "IN",
    address_type: values.type,
    is_default: values.isDefault,
  }
}

export const ADDRESS_TYPE_LABELS: Record<AddressType, string> = { home: "Home", work: "Work", other: "Other" }

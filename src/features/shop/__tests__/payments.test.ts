import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  forgetIntent,
  MERCHANT_FALLBACK_NAME,
  prefillFromSession,
  razorpayOptions,
  recallIntent,
  rememberIntent,
  showsStubButton,
  STUB_ORDER_PREFIX,
  stubConfirmBody,
  toPaymentIntent,
  type IntentStore,
  type WirePaymentIntent,
} from "@/features/shop/model/payments"

const razorpayWire: WirePaymentIntent = {
  payment_intent_id: "pi-1",
  amount_minor: 134800,
  currency: "INR",
  provider_ref: "order_Rzp123",
  status: "requires_action",
  client_session: { provider: "razorpay", order_id: "order_Rzp123", key_id: "rzp_test_fake", merchant_display_name: "MStore by Momentum" },
}

const stubWire: WirePaymentIntent = {
  payment_intent_id: "pi-2",
  amount_minor: 25000,
  currency: "INR",
  provider_ref: `${STUB_ORDER_PREFIX}1759200000`,
  status: "requires_action",
}

describe("the intent", () => {
  it("is razorpay from client_session.provider, with the key, order id and merchant name from the session", () => {
    const intent = toPaymentIntent(razorpayWire)
    expect(intent.provider).toBe("razorpay")
    expect(intent.keyId).toBe("rzp_test_fake")
    expect(intent.providerOrderId).toBe("order_Rzp123")
    expect(intent.merchantName).toBe("MStore by Momentum")
    expect(intent.amountMinor).toBe(134800)
  })
  it("is stub from client_session.provider = stub, or from the stub order prefix when the session is absent", () => {
    expect(toPaymentIntent({ ...stubWire, client_session: { provider: "stub" } }).provider).toBe("stub")
    expect(toPaymentIntent(stubWire).provider).toBe("stub")
  })
  it("is unknown otherwise — a razorpay-looking ref without a session is not opened blind", () => {
    expect(toPaymentIntent({ ...razorpayWire, client_session: undefined }).provider).toBe("unknown")
    expect(toPaymentIntent({ ...razorpayWire, client_session: { provider: "cashfree" } }).provider).toBe("unknown")
  })
})

describe("the stub button", () => {
  it("appears only for provider === stub", () => {
    expect(showsStubButton(toPaymentIntent(stubWire))).toBe(true)
    expect(showsStubButton(toPaymentIntent(razorpayWire))).toBe(false)
    expect(showsStubButton(toPaymentIntent({ ...razorpayWire, client_session: undefined }))).toBe(false)
    expect(showsStubButton(null)).toBe(false)
  })
  it("posts every field confirmPaymentReq binds as required, with gateway stub", () => {
    const body = stubConfirmBody(toPaymentIntent(stubWire), () => 42)
    expect(body).toEqual({
      payment_intent_id: "pi-2",
      razorpay_order_id: `${STUB_ORDER_PREFIX}1759200000`,
      razorpay_payment_id: "stub_pay_42",
      razorpay_signature: "stub",
      amount_minor: 25000,
      gateway: "stub",
    })
    expect(() => stubConfirmBody(toPaymentIntent(razorpayWire))).toThrow()
  })
})

describe("Razorpay options", () => {
  it("are built from client_session: key, order_id, amount, name", () => {
    const options = razorpayOptions(toPaymentIntent(razorpayWire), { orderNumber: "MS-1001", prefill: { name: "R", email: "r@example.com" } })
    expect(options).toEqual({
      key: "rzp_test_fake",
      order_id: "order_Rzp123",
      amount: 134800,
      currency: "INR",
      name: "MStore by Momentum",
      description: "Order MS-1001",
      prefill: { name: "R", email: "r@example.com" },
    })
  })
  it("fall back to the wordmark when the session names no merchant, and omit an empty prefill", () => {
    const wire = { ...razorpayWire, client_session: { ...razorpayWire.client_session, merchant_display_name: "" } }
    const options = razorpayOptions(toPaymentIntent(wire))
    expect(options.name).toBe(MERCHANT_FALLBACK_NAME)
    expect(options).not.toHaveProperty("prefill")
    expect(options).not.toHaveProperty("description")
  })
  it("refuse a session without a key or an order id, and any non-razorpay intent", () => {
    expect(() => razorpayOptions(toPaymentIntent({ ...razorpayWire, client_session: { provider: "razorpay", order_id: "o" } }))).toThrow()
    expect(() => razorpayOptions(toPaymentIntent({ ...razorpayWire, provider_ref: "", client_session: { provider: "razorpay", key_id: "k" } }))).toThrow()
    expect(() => razorpayOptions(toPaymentIntent(stubWire))).toThrow()
  })
  it("never come from process.env: no payment source reads it", () => {
    const dir = resolve(import.meta.dir, "..")
    for (const file of ["model/payments.ts", "checkout/startPayment.ts", "api/payments.ts", "hooks/payments.ts", "checkout/CheckoutScreen.tsx", "orders/OrderDetailScreen.tsx"]) {
      const source = readFileSync(resolve(dir, file), "utf8")
      expect(source, file).not.toMatch(/process\.env/)
      expect(source, file).not.toMatch(/RAZORPAY_KEY/)
    }
    const loader = readFileSync(resolve(dir, "../../lib/razorpay.ts"), "utf8")
    expect(loader).not.toMatch(/process\.env/)
  })
  it("prefill the name, and the email only when the login id is one", () => {
    expect(prefillFromSession({ name: "R", loginId: "r@x.in" })).toEqual({ name: "R", email: "r@x.in" })
    expect(prefillFromSession({ name: "R", loginId: "9876543210" })).toEqual({ name: "R" })
    expect(prefillFromSession(null)).toEqual({})
  })
})

describe("the intent handoff from checkout to the order page", () => {
  function store(): IntentStore {
    const map = new Map<string, string>()
    return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) }
  }
  it("round-trips the wire intent under the order id and forgets it", () => {
    const s = store()
    rememberIntent(s, "o-1", stubWire)
    expect(recallIntent(s, "o-1")).toEqual(stubWire)
    expect(recallIntent(s, "o-2")).toBeNull()
    forgetIntent(s, "o-1")
    expect(recallIntent(s, "o-1")).toBeNull()
  })
  it("answers null for garbage and for no storage", () => {
    const s = store()
    s.setItem("shop.payment.intent.o-1", "{not json")
    expect(recallIntent(s, "o-1")).toBeNull()
    expect(recallIntent(null, "o-1")).toBeNull()
  })
})

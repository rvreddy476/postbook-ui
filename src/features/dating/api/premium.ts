/* Passes and Boost. */

import { purchaseBody, toCatalogue, toMyPremium, toPaymentReading, toPurchase, type MyPremium, type PaymentReading, type Product, type Purchase } from "../model/premium"
import { get, post, seg } from "./client"

export async function fetchCatalogue(): Promise<Product[]> {
  return toCatalogue(await get("/premium/catalogue"))
}

/** The same key returns the same purchase, so a lost response is never a second purchase. */
export async function createPurchase(productId: string, idempotencyKey: string): Promise<Purchase> {
  return toPurchase(await post("/premium/purchases", purchaseBody(productId, idempotencyKey)))
}

/** The only read that may say "paid". */
export async function readPurchasePayment(purchaseId: string): Promise<PaymentReading> {
  return toPaymentReading(await get(`/premium/purchases/${seg(purchaseId)}/payment`))
}

export async function fetchMyPremium(): Promise<MyPremium> {
  return toMyPremium(await get("/premium/me"))
}

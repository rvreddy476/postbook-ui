/*
  Momentum Premium, axios only. Every URL and body comes from model.ts;
  this file only sends them. There is no "confirm" call: the pass is paid
  when GET /passes/:id says so (the signed payment event, server side).

  Tax documents go through the same client: it attaches the bearer token, so
  the document route is never a bare link and no token is ever put in a URL
  (the same way the dating data export is downloaded).
*/

import api from "@/lib/api"

import {
  checkoutRequest,
  invoiceDocumentUrl,
  INVOICES_URL,
  invoiceUrl,
  passUrl,
  PREMIUM_BASE,
  toCheckout,
  toInvoiceDetail,
  toInvoices,
  toPass,
  toPlans,
  toStatus,
  type PassReading,
  type PremiumCheckout,
  type PremiumInvoice,
  type PremiumInvoiceDetail,
  type PremiumPlan,
  type PremiumStatus,
} from "./model"

export async function fetchPremiumPlans(): Promise<PremiumPlan[]> {
  const res = await api.get(`${PREMIUM_BASE}/plans`)
  return toPlans(res.data)
}

export async function fetchMyPremium(): Promise<PremiumStatus> {
  const res = await api.get(`${PREMIUM_BASE}/me`)
  return toStatus(res.data)
}

/** POST /checkout with {"plan": code} and nothing else. */
export async function startPremiumCheckout(planCode: string): Promise<PremiumCheckout> {
  const r = checkoutRequest(planCode)
  const res = await api.post(r.url, r.body)
  return toCheckout(res.data)
}

export async function readPremiumPass(passId: string): Promise<PassReading> {
  const res = await api.get(passUrl(passId))
  return toPass(res.data)
}

export async function fetchPremiumInvoices(): Promise<PremiumInvoice[]> {
  const res = await api.get(INVOICES_URL)
  return toInvoices(res.data)
}

export async function fetchPremiumInvoice(id: string): Promise<PremiumInvoiceDetail | null> {
  const res = await api.get(invoiceUrl(id))
  return toInvoiceDetail(res.data)
}

/** The PDF as a file. Not an envelope: the body IS the document. */
export async function fetchPremiumInvoiceDocument(id: string): Promise<Blob> {
  const res = await api.get(invoiceDocumentUrl(id), { responseType: "blob", headers: { Accept: "application/pdf" } })
  return res.data as Blob
}

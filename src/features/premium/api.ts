/*
  Momentum Premium, axios only. Every URL and body comes from model.ts;
  this file only sends them. There is no "confirm" call: the pass is paid
  when GET /passes/:id says so (the signed payment event, server side).
*/

import api from "@/lib/api"

import { checkoutRequest, passUrl, PREMIUM_BASE, toCheckout, toPass, toPlans, toStatus, type PassReading, type PremiumCheckout, type PremiumPlan, type PremiumStatus } from "./model"

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

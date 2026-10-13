import type { decodeJobs, decodeEarnings } from "./model"

export const PARTNER_VIEWS = {
  dashboard: { title: "Dashboard", description: "Your work, availability and earnings in one place." },
  jobs: { title: "Your jobs", description: "Keep track of your assigned visits and completed work." },
  prices: { title: "Services & prices", description: "Review the services you offer and their current prices." },
  earnings: { title: "Earnings", description: "Review your recorded earnings and adjustments." },
  setup: { title: "Work settings", description: "Manage your details, working area and availability." },
} as const
export type PartnerView = keyof typeof PARTNER_VIEWS
export function partnerView(value: string | null): PartnerView {
  return value && Object.prototype.hasOwnProperty.call(PARTNER_VIEWS, value) ? value as PartnerView : "dashboard"
}
export type PartnerJob = ReturnType<typeof decodeJobs>["items"][number]
export type PartnerEarningsData = ReturnType<typeof decodeEarnings>
export type JobFilter = "all" | "active" | "completed"
// Keep unknown/new statuses visible under All; do not infer completion.
export function filterPartnerJobs(items: PartnerJob[], filter: JobFilter) {
  if (filter === "active") return items.filter(j => ["pending_payment", "assigned", "accepted", "en_route", "arrived", "in_progress", "awaiting_extras_payment"].includes(j.status))
  if (filter === "completed") return items.filter(j => ["completed"].includes(j.status))
  return items
}
export function partnerDate(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date) : "Time unavailable"
}

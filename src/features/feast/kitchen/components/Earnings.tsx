"use client"

/* Earnings and settlements, read-only. Every amount is a *_paise field. */

import { fetchSettlements, fetchSummary } from "../api/client"
import { formatDeduction, formatPaise } from "../model/money"
import { FailureNotice, formatDate, Pill, useLoad } from "./ui"

export function Earnings({ restaurantId }: { restaurantId: string }) {
  const summary = useLoad(() => fetchSummary(restaurantId), [restaurantId])
  const settlements = useLoad(() => fetchSettlements(restaurantId), [restaurantId])
  const s = summary.data

  return (
    <div className="kit-form" style={{ gap: 12 }}>
      <FailureNotice failure={summary.failure} />
      {s ? (
        <div className="kit-stats">
          <Stat label="Orders" value={String(s.orders)} />
          <Stat label="Delivered" value={String(s.delivered)} />
          <Stat label="Refunded" value={String(s.refunded)} />
          <Stat label="Gross sales" value={formatPaise(s.grossPaise)} />
          <Stat label="Feast commission" value={formatPaise(s.commissionPaise)} />
          <Stat label="Refunds" value={formatPaise(s.refundsPaise)} />
          <Stat label="Your payout" value={formatPaise(s.payoutPaise)} />
        </div>
      ) : summary.loading ? (
        <p className="kit-meta">Loading earnings…</p>
      ) : null}

      <section className="kit-card">
        <h2 className="kit-card__title">Settlements</h2>
        <FailureNotice failure={settlements.failure} />
        {settlements.data && settlements.data.length === 0 ? <div className="kit-empty">No settlements yet. They are made weekly once you have delivered orders.</div> : null}
        {settlements.data && settlements.data.length > 0 ? (
          <div className="kit-table-wrap">
            <table className="kit-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th className="kit-num">Gross</th>
                  <th className="kit-num">Commission</th>
                  <th className="kit-num">Refunds</th>
                  <th className="kit-num">Penalties</th>
                  <th className="kit-num">Payout</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {settlements.data.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                    </td>
                    <td className="kit-num">{formatPaise(r.grossPaise)}</td>
                    <td className="kit-num">{formatDeduction(r.commissionPaise)}</td>
                    <td className="kit-num">{formatDeduction(r.refundAdjustmentPaise)}</td>
                    <td className="kit-num">{formatDeduction(r.penaltyPaise)}</td>
                    <td className="kit-num">
                      <strong>{formatPaise(r.payoutPaise)}</strong>
                    </td>
                    <td>
                      <Pill tone={r.status === "PAID" ? "positive" : r.status === "PENDING" || r.status === "GENERATED" ? "warning" : "neutral"}>
                        {r.status === "PAID" ? "Paid" : r.status === "PENDING" || r.status === "GENERATED" ? "Pending" : r.status}
                      </Pill>
                      {r.paidAt ? <div className="kit-small">{formatDate(r.paidAt)}{r.paidReference ? ` · ${r.paidReference}` : ""}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="kit-stat">
      <div className="kit-stat__label">{label}</div>
      <div className="kit-stat__value">{value}</div>
    </div>
  )
}

"use client"

import type { decodeBank } from "./model"

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(date)
}

export function BankRecords({ bank }: { bank: NonNullable<ReturnType<typeof decodeBank>> }) {
  const records = bank.history
  const pending = bank.status === "pending" || records.some(r => r.status === "pending" && !r.superseded)
  return <section className="ds-stack" aria-label="Saved bank details">
    <h3 className="ds-h2">Saved bank details</h3>
    {pending && <p className="ds-info" role="status">{bank.status === "verified" ? "Your approved bank account remains active. Updated details are awaiting admin review." : "Your bank details are awaiting admin review."} No need to submit them again.</p>}
    {records.length ? records.map(record => <article className="ds-card ds-stack" key={record.id}>
      <div className="ds-row"><strong>{record.active && record.status === "verified" ? "Current payout account" : record.status === "pending" && !record.superseded ? "Pending submission" : "Previous record"}</strong><span className={record.status === "verified" ? "ds-ok" : record.status === "failed" ? "ds-alert" : "ds-note"}>{record.status === "verified" ? "Approved" : record.status === "failed" ? "Changes required" : record.superseded ? "Superseded" : "Awaiting review"}</span></div>
      <p><strong>{record.bank_name || "Bank account"}</strong> · Account ending {record.account_last4}</p>
      <p className="ds-sub">{record.account_holder} · IFSC {record.ifsc}</p>
      <p className="ds-note">Submitted {dateLabel(record.submitted_at)}{record.reviewed_at ? ` · Reviewed ${dateLabel(record.reviewed_at)}` : ""}</p>
      {!record.active && <p className="ds-note">{record.status === "pending" && !record.superseded ? "Not used for payouts until approved." : "Historical record · not the current payout account."}</p>}
      {record.reason && <p className="ds-sub">{record.reason}</p>}
    </article>) : <div className="ds-card"><strong>{bank.bank_name || "Bank account"}</strong><p>Account ending {bank.account_last4}</p><p className="ds-sub">{bank.account_holder} · IFSC {bank.ifsc}</p></div>}
    {records.length === 50 && <p className="ds-note">Showing the 50 most recent submissions.</p>}
  </section>
}

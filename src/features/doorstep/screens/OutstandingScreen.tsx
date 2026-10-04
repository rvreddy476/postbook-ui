"use client"

/*
  /doorstep/outstanding — unpaid extras (GET /me/outstanding). While any
  bill is unpaid, new bookings are refused (DOORSTEP_OUTSTANDING_DUE). Each
  bill is paid through its own intent (POST /extras-bills/:id/payment/intent);
  "paid" is the server's reading of that booking's payments.
*/

import { CircleCheck } from "lucide-react"
import Link from "next/link"

import { openExtrasPaymentIntent } from "../api/client"
import { ErrorState, Skel, StateBlock } from "../components/parts"
import { PayPanel } from "../components/PayPanel"
import { useOutstanding } from "../hooks/queries"
import { formatPaise } from "../model/money"
import { formatWhen } from "../model/slots"

export function OutstandingScreen() {
  const dues = useOutstanding()
  const d = dues.data

  return (
    <>
      <div className="ds-head">
        <div>
          <h1 className="ds-title">Dues</h1>
          <p className="ds-sub">Extras you approved during a visit that are still unpaid.</p>
        </div>
      </div>
      {dues.isLoading ? (
        <Skel h={120} />
      ) : dues.isError ? (
        <ErrorState error={dues.error} what="Your dues" onRetry={() => void dues.refetch()} />
      ) : !d || d.totalPaise <= 0 || !d.bills.length ? (
        <StateBlock
          icon={<CircleCheck size={22} />}
          title="Nothing due"
          text="You're all paid up."
          action={
            <Link href="/doorstep" className="ds-btn ds-btn--primary ds-btn--sm">
              Book a service
            </Link>
          }
        />
      ) : (
        <div className="ds-stack">
          <p className="ds-warnbox">
            <strong>{formatPaise(d.totalPaise)}</strong> is due. You can book again once it is paid.
          </p>
          {d.bills.map((bill) => (
            <div key={bill.id} className="ds-stack" style={{ gap: 6 }}>
              <p className="ds-meta" style={{ margin: 0 }}>
                <Link className="ds-link" href={`/doorstep/bookings/${encodeURIComponent(bill.bookingId)}`}>
                  From this booking
                </Link>
                {bill.dueAt ? ` · due since ${formatWhen(bill.dueAt)}` : ""} · includes GST {formatPaise(bill.taxPaise)}
              </p>
              <PayPanel
                title={`Extras · ${formatPaise(bill.amountPaise)}`}
                target={{
                  bookingId: bill.bookingId,
                  referenceType: "doorstep_extras",
                  referenceId: bill.id,
                  description: "Doorstep extras",
                  open: () => openExtrasPaymentIntent(bill.id),
                }}
                amountPaise={bill.amountPaise}
                readFirst
              />
            </div>
          ))}
        </div>
      )}
    </>
  )
}

"use client"

/* The tax invoice as the server issued it: one table per issuer (restaurant, platform). */

import { toFeastError } from "../api/client"
import { useInvoice } from "../hooks/queries"
import { formatPaise } from "../model/money"
import { Skel } from "./parts"

export function InvoiceView({ orderId }: { orderId: string }) {
  const invoice = useInvoice(orderId, true)

  if (invoice.isLoading) {
    return (
      <div className="fc-stack">
        <Skel h={14} w="40%" />
        <Skel h={120} />
      </div>
    )
  }
  if (invoice.isError) {
    const e = toFeastError(invoice.error)
    return (
      <p className="fc-alert" role="alert">
        {e.status === 404 ? "The invoice isn't ready yet. It's issued once the order is paid." : e.message}
      </p>
    )
  }
  const inv = invoice.data
  if (!inv) return null

  return (
    <div className="fc-stack">
      <div className="fc-meta">
        Invoice date {inv.invoiceDate} · Order {inv.orderNumber}
        {inv.placeOfSupplyState ? ` · Place of supply ${inv.placeOfSupplyState}` : ""}
      </div>
      {inv.buyerName ? (
        <div className="fc-meta">
          Billed to {inv.buyerName}
          {inv.buyerAddress ? `, ${inv.buyerAddress}` : ""}
        </div>
      ) : null}
      {inv.sections.map((s) => (
        <section key={s.invoiceNumber || s.issuer} className="fc-stack" style={{ gap: 6 }}>
          <div>
            <div style={{ fontWeight: 600 }}>{s.title}</div>
            <div className="fc-meta">
              {s.issuerName}
              {s.issuerGstin ? ` · GSTIN ${s.issuerGstin}` : ""} · {s.invoiceNumber}
            </div>
          </div>
          <div className="fc-table-wrap">
            <table className="fc-table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Taxable</th>
                  <th scope="col">GST</th>
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {s.lines.map((l, i) => (
                  <tr key={l.ref ?? i}>
                    <td>
                      {l.description}
                      {l.sac ? <span className="fc-meta"> · SAC {l.sac}</span> : null}
                    </td>
                    <td>{l.quantity}</td>
                    <td>{formatPaise(l.taxablePaise)}</td>
                    <td>
                      {formatPaise(l.taxPaise)} <span className="fc-meta">({l.ratePercent}%)</span>
                    </td>
                    <td>{formatPaise(l.totalPaise)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Section total</th>
                  <td />
                  <td>{formatPaise(s.taxablePaise)}</td>
                  <td>
                    {s.igstPaise ? `IGST ${formatPaise(s.igstPaise)}` : `CGST ${formatPaise(s.cgstPaise)} · SGST ${formatPaise(s.sgstPaise)}`}
                  </td>
                  <td>{formatPaise(s.totalPaise)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {s.notes.map((n) => (
            <p key={n} className="fc-note">{n}</p>
          ))}
        </section>
      ))}
      <dl className="fc-bill">
        <div className="fc-bill__row fc-bill__row--total">
          <dt>Grand total</dt>
          <dd>{formatPaise(inv.grandTotalPaise)}</dd>
        </div>
      </dl>
      {inv.notes.map((n) => (
        <p key={n} className="fc-note">{n}</p>
      ))}
      {inv.needsAdviserConfirmation && inv.adviserMarker ? <p className="fc-note">{inv.adviserMarker}</p> : null}
      <button type="button" className="fc-btn fc-btn--outline fc-btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => window.print()}>
        Print
      </button>
    </div>
  )
}

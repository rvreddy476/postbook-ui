"use client"

// The bank offers list (GET /payment-offers): title, "Save up to ₹X" (the
// server's estimate), the method, and on checkout the note that the offer
// is taken inside the Razorpay payment sheet, not off the order total.

import { Landmark } from "lucide-react"

import { inrMinor } from "../../money"
import { OFFER_METHOD_LABEL, saveUpToLine, type PaymentOffer } from "../../model/offers"

import "../../shop-offers.css"

export function BankOffers({
  offers,
  title,
  note,
  flush,
}: {
  offers: readonly PaymentOffer[]
  title: string
  /** The sentence under the list (checkout's "applies in the Razorpay sheet"). */
  note?: string
  /** No top margin, for a card section that spaces its own children. */
  flush?: boolean
}) {
  if (!offers.length) return null
  return (
    <section className={flush ? "shop-offers shop-offers--flush" : "shop-offers"} aria-label={title}>
      <h3 className="shop-offers__title">{title}</h3>
      <ul className="shop-offers__list">
        {offers.map((offer) => {
          const save = saveUpToLine(offer, inrMinor)
          return (
            <li key={offer.id} className="shop-offers__item">
              <Landmark size={16} aria-hidden="true" className="shop-offers__icon" />
              <span className="shop-offers__body">
                <span className="shop-offers__name">{offer.title}</span>
                {save ? <span className="shop-offers__save">{save}</span> : null}
                <span className="shop-offers__meta">
                  {OFFER_METHOD_LABEL[offer.method]}
                  {offer.description ? ` · ${offer.description}` : ""}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
      {note ? <p className="shop-offers__note">{note}</p> : null}
    </section>
  )
}

/** The order page's "Bank offer −₹X · Paid ₹Y", with the offer's title under it. */
export function OrderOfferLine({ line, title }: { line: string; title: string }) {
  return (
    <p className="shop-order-offer">
      <span>{line}</span>
      {title ? <span className="shop-order-offer__title">{title}</span> : null}
    </p>
  )
}

"use client"

/*
  /dating/premium — one-off passes and Boost. A purchase shows as paid only
  after the server's payment read says so; the checkout dialog closing is not
  a verdict.
*/

import { BadgeCheck, CircleAlert, Clock, Crown, Hourglass, Zap } from "lucide-react"

import { ErrorState, Guard } from "../components/Guard"
import { Button, Loading, Notice, PageHead, Panel, StatePanel } from "../components/kit"
import { useCatalogue, useCheckout, useMyPremium, type CheckoutState } from "../hooks/premium"
import { PASSES_UNAVAILABLE_COPY, isPremiumUnavailable } from "../model/errors"
import { boostLine, featureLabels, formatAmount, passLine, productBlurb, productTitle, type MyPremium, type Product } from "../model/premium"
import { DATING_BASE } from "../model/profile"

export function Holding({ me }: { me: MyPremium }) {
  return (
    <Panel title="What you have">
      <ul className="pulse-plain">
        <li className="pulse-plain__row">
          <span>
            <Crown size={14} aria-hidden="true" /> {passLine(me)}
          </span>
        </li>
        <li className="pulse-plain__row">
          <span>
            <Zap size={14} aria-hidden="true" /> {boostLine(me)}
          </span>
        </li>
      </ul>
    </Panel>
  )
}

export function ProductList({ products, buyingId, disabled, onBuy }: { products: Product[]; buyingId: string; disabled: boolean; onBuy: (p: Product) => void }) {
  return (
    <ul className="pulse-products">
      {products.map((p) => {
        const features = featureLabels(p.features)
        return (
          <li key={p.id} className="pulse-product">
            <div>
              <h3 className="pulse-product__name">{productTitle(p)}</h3>
              <p className="pulse-product__blurb">{productBlurb(p)}</p>
              {features.length ? (
                <ul className="pulse-product__features">
                  {features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="pulse-product__buy">
              <span className="pulse-product__price">{formatAmount(p.amountMinor, p.currency)}</span>
              <Button variant="primary" busy={buyingId === p.id} disabled={disabled} onClick={() => onBuy(p)} aria-label={`Buy ${productTitle(p)}`}>
                Buy
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function PassesUnavailable() {
  return <StatePanel icon={Clock} title={PASSES_UNAVAILABLE_COPY} body="We'll open them here when they're ready. Everything else on Pulse works without one." />
}

/** The states after the catalogue: confirming, paid, failed, still confirming. Null while browsing. */
export function CheckoutOutcome({ state, onDone, onCheckAgain }: { state: CheckoutState; onDone: () => void; onCheckAgain: () => void }) {
  switch (state.kind) {
    case "confirming":
      return <StatePanel icon={Hourglass} tone="info" title="Confirming your payment" body={`We're checking with the bank for your ${state.productName}. This usually takes a few seconds. Keep this page open.`} />
    case "paid":
      return (
        <StatePanel
          icon={state.refunding ? CircleAlert : BadgeCheck}
          tone={state.refunding ? "warning" : "success"}
          title={state.refunding ? "This payment is being refunded" : "Payment received"}
          body={state.refunding ? "The money is on its way back to you." : `Your ${state.productName} is ready to use.`}
        >
          <Button variant="primary" onClick={onDone}>
            Done
          </Button>
        </StatePanel>
      )
    case "failed":
      return (
        <StatePanel icon={CircleAlert} tone="danger" title="The payment didn't go through" body={state.reason || "You haven't been charged for this. If money left your account, it will be returned."}>
          <Button variant="primary" onClick={onDone}>
            Back to passes
          </Button>
        </StatePanel>
      )
    case "still_confirming":
      return (
        <StatePanel icon={Hourglass} tone="warning" title="Still confirming" body={`We haven't heard back about your ${state.productName} yet. If you paid, it can still arrive. You won't be charged twice.`}>
          <Button variant="primary" onClick={onCheckAgain}>
            Check again
          </Button>
          <Button variant="quiet" onClick={onDone}>
            Back to passes
          </Button>
        </StatePanel>
      )
    case "unavailable":
      return <PassesUnavailable />
    default:
      return null
  }
}

function PremiumBody() {
  const catalogue = useCatalogue()
  const me = useMyPremium()
  const checkout = useCheckout()
  const state = checkout.state

  if (catalogue.isPending) return <Loading />
  if (catalogue.isError) {
    return isPremiumUnavailable(catalogue.error) ? <PassesUnavailable /> : <ErrorState error={catalogue.error} onRetry={() => void catalogue.refetch()} />
  }
  const browsing = state.kind === "idle" || state.kind === "starting" || state.kind === "dialog"
  if (!browsing) return <CheckoutOutcome state={state} onDone={checkout.done} onCheckAgain={checkout.checkAgain} />

  const buyingId = state.kind === "starting" || state.kind === "dialog" ? state.productId : ""
  return (
    <>
      {me.data ? <Holding me={me.data} /> : null}
      {state.kind === "idle" && state.notice ? <Notice tone="danger">{state.notice}</Notice> : null}
      {catalogue.data.length === 0 ? <PassesUnavailable /> : <ProductList products={catalogue.data} buyingId={buyingId} disabled={buyingId !== ""} onBuy={(p) => void checkout.buy(p)} />}
      <p className="pulse-field__help">Each one is a single payment. A pass ends by itself on its last day; nothing is charged again.</p>
    </>
  )
}

export function PremiumScreen() {
  return (
    <Guard need="access">
      <div className="pulse-page pulse-page--narrow">
        <PageHead title="Premium" sub="One-off passes and Boost." back={{ href: DATING_BASE, label: "Pulse" }} />
        <PremiumBody />
      </div>
    </Guard>
  )
}

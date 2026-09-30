"use client"

import Link from "next/link"
import { AlertTriangle, Trash2 } from "lucide-react"
import { inrMinor } from "../../money"
import { isUnavailable, lineImage, lineMaxQuantity, priceChanged, type CartViewLine } from "../../model/bag"
import { SHOP_BASE } from "../../model/storefront"
import { QuantityStepper } from "../catalogue/QuantityStepper"
import { ProductPhoto } from "../storefront/ProductPhoto"

/**
 * One line of the bag: image, title, SKU, unit price, the badges the
 * service's signals earn (price changed, unavailable, only n left), the
 * stepper and remove. The wire carries no option values on a line — only
 * the SKU — so the SKU is what says which variant this is.
 */
export function BagLine({ line, onQuantity, onRemove, busy }: {
  line: CartViewLine
  onQuantity: (quantity: number) => void
  onRemove: () => void
  busy?: boolean
}) {
  const unavailable = isUnavailable(line)
  const changed = priceChanged(line)
  const max = lineMaxQuantity(line)
  const overstock = !unavailable && line.quantity > line.available_qty
  const href = `${SHOP_BASE}/products/${encodeURIComponent(line.product_id)}`
  return (
    <article className={`shop-bag-line${unavailable ? " shop-bag-line--unavailable" : ""}`} aria-label={line.title}>
      <Link href={href} className="shop-bag-line__photo" aria-hidden="true" tabIndex={-1}>
        <ProductPhoto src={lineImage(line)} alt="" />
      </Link>
      <div className="shop-bag-line__copy">
        {line.seller_name ? <span className="shop-bag-line__seller">Sold by {line.seller_name}</span> : null}
        <Link href={href} className="shop-bag-line__title">{line.title}</Link>
        {line.sku ? <span className="shop-bag-line__sku">SKU {line.sku}</span> : null}
        <span className="shop-bag-line__unit">
          {inrMinor(line.unit_price_minor)} each
          {changed ? <> · <s>was {changed.was}</s></> : null}
        </span>
        <div className="shop-bag-line__badges">
          {unavailable ? (
            <span className="shop-badge shop-badge--danger"><AlertTriangle size={11} aria-hidden="true" /> Unavailable</span>
          ) : null}
          {changed ? <span className="shop-badge shop-badge--warning">Price changed</span> : null}
          {overstock ? (
            <span className="shop-badge shop-badge--danger">
              {line.available_qty === 0 ? "Out of stock" : `Only ${line.available_qty} left`}
            </span>
          ) : !unavailable && line.available_qty <= 5 ? (
            <span className="shop-badge shop-badge--warning">Only {line.available_qty} left</span>
          ) : null}
        </div>
      </div>
      <div className="shop-bag-line__controls">
        <span className="shop-bag-line__total">{inrMinor(line.line_total_minor)}</span>
        <QuantityStepper
          value={line.quantity}
          min={1}
          max={Math.max(max, line.quantity)}
          onChange={onQuantity}
          disabled={busy || unavailable}
          label={line.title}
          small
        />
        <button type="button" className="shop-bag-line__remove" onClick={onRemove} disabled={busy} aria-label={`Remove ${line.title} from your bag`}>
          <Trash2 size={13} aria-hidden="true" /> Remove
        </button>
      </div>
    </article>
  )
}

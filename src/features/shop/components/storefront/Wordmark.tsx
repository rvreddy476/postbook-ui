import { STORE_NAME } from "../../model/storefront"

/**
 * The lockup: a heavier capital, then the rest of the word. ONE component
 * reading ONE constant (model/storefront.ts STORE_NAME), so a rename is one
 * line and not a search through the zone. Screen readers get the whole name
 * once, never the two halves separately.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={["shop-wordmark", className ?? ""].filter(Boolean).join(" ")}>
      <span className="shop-sr">{STORE_NAME}</span>
      <b aria-hidden="true">{STORE_NAME.charAt(0)}</b>
      <span aria-hidden="true">{STORE_NAME.slice(1)}</span>
    </span>
  )
}

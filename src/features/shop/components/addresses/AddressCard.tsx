import { Pencil, Star, Trash2 } from "lucide-react"
import { ADDRESS_TYPE_LABELS, formatAddressLine, type Address } from "../../model/addresses"

/** One saved address with its actions: edit, make default, delete. */
export function AddressCard({ address, onEdit, onMakeDefault, onDelete, busy }: {
  address: Address
  onEdit: () => void
  onMakeDefault: () => void
  onDelete: () => void
  busy?: boolean
}) {
  return (
    <article className={`shop-address-card${address.isDefault ? " shop-address-card--default" : ""}`}>
      <div className="shop-address-card__copy">
        <div className="shop-address-card__name">
          <span>{address.contactName}</span>
          <span className="shop-badge">{ADDRESS_TYPE_LABELS[address.type]}</span>
          {address.isDefault ? <span className="shop-badge">Default</span> : null}
        </div>
        <div className="shop-address-card__line">{formatAddressLine(address)}</div>
        <div className="shop-address-card__phone">{address.phone}</div>
      </div>
      <div className="shop-address-card__actions">
        <button type="button" className="shop-btn shop-btn--outline shop-btn--sm" onClick={onEdit} disabled={busy}>
          <Pencil size={13} aria-hidden="true" /> Edit
        </button>
        {!address.isDefault ? (
          <button type="button" className="shop-btn shop-btn--outline shop-btn--sm" onClick={onMakeDefault} disabled={busy}>
            <Star size={13} aria-hidden="true" /> Make default
          </button>
        ) : null}
        <button type="button" className="shop-btn shop-btn--danger shop-btn--sm" onClick={onDelete} disabled={busy} aria-label={`Delete address for ${address.contactName}`}>
          <Trash2 size={13} aria-hidden="true" /> Delete
        </button>
      </div>
    </article>
  )
}

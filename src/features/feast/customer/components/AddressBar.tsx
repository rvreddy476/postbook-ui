"use client"

import { MapPin } from "lucide-react"
import Link from "next/link"

import { addressLine, addressTitle } from "../model/address"
import type { Address } from "../model/wire"

/** "Deliver to" with a picker for the saved addresses and a way to add one. */
export function AddressBar({
  addresses,
  chosen,
  loading,
  failed,
  onChoose,
}: {
  addresses: Address[]
  chosen: Address | null
  loading: boolean
  failed: boolean
  onChoose: (id: string) => void
}) {
  return (
    <div className="fc-addr">
      <MapPin size={18} aria-hidden="true" />
      <div className="fc-grow">
        <div className="fc-meta">Deliver to</div>
        {loading ? (
          <div className="fc-skel" style={{ height: 14, width: 180 }} aria-hidden="true" />
        ) : failed ? (
          <div>Your addresses couldn&apos;t be loaded.</div>
        ) : chosen ? (
          <div className="fc-truncate" title={addressLine(chosen)}>
            <strong>{addressTitle(chosen)}</strong> · {addressLine(chosen)}
          </div>
        ) : (
          <div>No address yet</div>
        )}
      </div>
      {addresses.length > 1 ? (
        <label className="fc-row">
          <span className="sr-only">Choose an address</span>
          <select className="fc-select" value={chosen?.id ?? ""} onChange={(e) => onChoose(e.target.value)}>
            {[...addresses]
              .sort((a, b) => addressTitle(a).localeCompare(addressTitle(b)))
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {addressTitle(a)}
                </option>
              ))}
          </select>
        </label>
      ) : null}
      <Link href="/feast/addresses" className="fc-btn fc-btn--outline fc-btn--sm">
        {addresses.length ? "Manage" : "Add"}
      </Link>
    </div>
  )
}

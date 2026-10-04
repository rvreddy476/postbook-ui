"use client"

/* The visit address: Doorstep's own saved addresses, chosen per browser. */

import { MapPin } from "lucide-react"
import Link from "next/link"

import { useChosenAddress } from "../hooks/queries"
import { addressLine, sortAddresses } from "../model/address"

export function AddressBar() {
  const { addresses, chosen, choose } = useChosenAddress()
  const list = sortAddresses(addresses.data ?? [])
  return (
    <div className="ds-addr">
      <MapPin size={16} aria-hidden="true" />
      <div className="ds-grow">
        {addresses.isLoading ? (
          <span className="ds-meta">Loading your addresses…</span>
        ) : chosen ? (
          <>
            {list.length > 1 ? (
              <select className="ds-select" value={chosen.id} onChange={(e) => choose(e.target.value)} aria-label="Visit address">
                {list.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} · {a.locality}
                  </option>
                ))}
              </select>
            ) : (
              <strong>{chosen.label}</strong>
            )}
            <span className="ds-meta ds-truncate" style={{ display: "block" }}>
              {addressLine(chosen)}
            </span>
          </>
        ) : (
          <span>Add your address to see prices and slots for it.</span>
        )}
      </div>
      <Link href="/doorstep/addresses" className="ds-btn ds-btn--outline ds-btn--sm">
        {chosen ? "Change" : "Add address"}
      </Link>
    </div>
  )
}

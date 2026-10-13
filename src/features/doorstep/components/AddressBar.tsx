"use client"

/* The visit address: Doorstep's own saved addresses, chosen per browser. */

import { MapPin } from "lucide-react"

import { useCurrentAddress } from "@/features/maps/useCurrentAddress"
import type { Address } from "../model/wire"
import { addressLine } from "../model/address"

export function AddressBar() {
  const current = useCurrentAddress("doorstep")
  const chosen = current.data as Address | undefined
  return (
    <div className="ds-addr">
      <MapPin size={16} aria-hidden="true" />
      <div className="ds-grow">
        {current.isPending ? (
          <span className="ds-meta">Identifying your current address…</span>
        ) : chosen ? (
          <>
            <strong>Current location</strong>
            <span className="ds-meta">Address lookup by Google Maps</span>
            <span className="ds-meta ds-truncate" style={{ display: "block" }}>
              {addressLine(chosen)}
            </span>
          </>
        ) : (
          <span role="alert">{current.error instanceof Error ? current.error.message : "Your current address could not be identified."}</span>
        )}
      </div>
      {!chosen ? <button type="button" className="ds-btn ds-btn--outline ds-btn--sm" disabled={current.isFetching} onClick={() => void current.refetch()}>Try again</button> : null}
    </div>
  )
}

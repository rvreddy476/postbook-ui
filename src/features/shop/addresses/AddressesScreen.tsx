"use client"

import { useState } from "react"
import { MapPin, Plus } from "lucide-react"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useGlobalToast } from "@/contexts/ToastContext"
import { useAddAddress, useAddresses, useDeleteAddress, useSetDefaultAddress, useUpdateAddress } from "../hooks/addresses"
import { useShopSession } from "../hooks/storefront"
import { addressToForm, type Address, type AddressFormValues } from "../model/addresses"
import { isSignedOut, SHOP_BASE, signInHref } from "../model/storefront"
import { AddressCard } from "../components/addresses/AddressCard"
import { AddressForm } from "../components/addresses/AddressForm"
import { StateBlock } from "../components/storefront/StateBlock"

type Editing = { mode: "add" } | { mode: "edit"; address: Address } | null

/**
 * `/shop/addresses`: list, add, edit, delete (confirmed), set default. The
 * same form the checkout uses, so an address added here is the one the
 * checkout offers.
 */
export function AddressesScreen() {
  const { signedIn, known } = useShopSession()
  const addresses = useAddresses()
  const add = useAddAddress()
  const update = useUpdateAddress()
  const remove = useDeleteAddress()
  const setDefault = useSetDefaultAddress()
  const toast = useGlobalToast()
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<Address | null>(null)
  const busy = add.isPending || update.isPending || remove.isPending || setDefault.isPending

  if (known && !signedIn) {
    return (
      <StateBlock
        icon={<MapPin size={20} aria-hidden="true" />}
        title="Sign in to see your addresses"
        text="Your addresses are kept with your account."
        action={{ label: "Sign in", href: signInHref(`${SHOP_BASE}/addresses`) }}
      />
    )
  }
  if (addresses.isError) {
    if (isSignedOut(addresses.error)) {
      return <StateBlock title="Sign in to see your addresses" text="Your addresses are kept with your account." action={{ label: "Sign in", href: signInHref(`${SHOP_BASE}/addresses`) }} />
    }
    return <StateBlock text="Your addresses could not be loaded." action={{ label: "Try again", onClick: () => void addresses.refetch() }} />
  }

  const list = addresses.data ?? []
  const loading = !known || addresses.isLoading

  const save = async (values: AddressFormValues) => {
    try {
      if (editing?.mode === "edit") await update.mutateAsync({ id: editing.address.id, values })
      else await add.mutateAsync(values)
      setEditing(null)
      toast({ type: "success", title: editing?.mode === "edit" ? "Address updated" : "Address added" })
    } catch {
      toast({ type: "error", title: "The address could not be saved. Check the fields and try again." })
    }
  }

  return (
    <div>
      <div className="shop-page__head">
        <div>
          <h1 className="shop-page__title">Addresses</h1>
          <p className="shop-page__lede">Where your orders are delivered. The default is offered first at checkout.</p>
        </div>
        {!editing ? (
          <button type="button" className="shop-btn shop-btn--outline shop-btn--sm" onClick={() => setEditing({ mode: "add" })} disabled={busy}>
            <Plus size={14} aria-hidden="true" /> Add address
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="shop-panel" style={{ marginBottom: 16, maxWidth: 720 }}>
          <h2 className="shop-section__title" style={{ marginBottom: 12 }}>{editing.mode === "edit" ? "Edit address" : "New address"}</h2>
          <AddressForm
            key={editing.mode === "edit" ? editing.address.id : "new"}
            initial={editing.mode === "edit" ? addressToForm(editing.address) : undefined}
            onSubmit={save}
            onCancel={() => setEditing(null)}
            busy={add.isPending || update.isPending}
          />
        </div>
      ) : null}

      {loading ? (
        <div className="shop-addresses" aria-busy="true" aria-label="Loading your addresses">
          <div className="shop-skeleton" style={{ height: 96 }} />
          <div className="shop-skeleton" style={{ height: 96 }} />
        </div>
      ) : list.length === 0 && !editing ? (
        <StateBlock
          icon={<MapPin size={20} aria-hidden="true" />}
          text="No addresses yet. Add one and checkout will offer it."
          action={{ label: "Add address", onClick: () => setEditing({ mode: "add" }) }}
        />
      ) : (
        <div className="shop-addresses">
          {list.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              busy={busy}
              onEdit={() => setEditing({ mode: "edit", address })}
              onMakeDefault={() => setDefault.mutateAsync(address.id).catch(() => toast({ type: "error", title: "The default could not be changed." }))}
              onDelete={() => setDeleting(address)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return
          const target = deleting
          remove.mutateAsync(target.id)
            .then(() => { setDeleting(null); toast({ type: "success", title: "Address deleted" }) })
            .catch(() => toast({ type: "error", title: "The address could not be deleted." }))
        }}
        title="Delete this address?"
        description={deleting ? `${deleting.contactName}, ${deleting.city} ${deleting.pincode} will be removed from your address book.` : ""}
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
      />
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  useAddresses, useAddAddress, useUpdateAddress, useDeleteAddress, useSetDefaultAddress,
  type Address,
} from '@/hooks/useCommerce'
import { AddressForm, type AddressFormValues } from '@/components/commerce/AddressForm'

function toFormValues(a: Address): Partial<AddressFormValues> {
  return {
    full_name: a.contact_name,
    phone: a.phone,
    address_line_1: a.address_line_1,
    address_line_2: a.address_line_2 ?? '',
    city: a.city,
    state: a.state,
    postal_code: a.postal_code,
    is_default: a.is_default,
  }
}

export default function AddressBookPage() {
  const { data: addresses, isLoading } = useAddresses()
  const addAddr = useAddAddress()
  const updateAddr = useUpdateAddress()
  const deleteAddr = useDeleteAddress()
  const setDefault = useSetDefaultAddress()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const list = addresses ?? []

  if (isLoading) return <div className="p-8">Loading addresses…</div>

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link href="/settings" className="text-sm text-gray-500 hover:text-indigo-600">
        ← Settings
      </Link>
      <div className="flex items-center justify-between mt-2 mb-6">
        <h1 className="text-2xl font-semibold">Addresses</h1>
        {!adding ? (
          <button
            onClick={() => setAdding(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700"
          >
            + Add address
          </button>
        ) : null}
      </div>

      {adding ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 mb-4">
          <h2 className="text-sm font-semibold mb-3">New address</h2>
          <AddressForm
            showDefault
            onSubmit={async (v) => {
              await addAddr.mutateAsync(v)
              setAdding(false)
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : null}

      {list.length === 0 && !adding ? (
        <div className="text-gray-500 text-center py-12">
          No addresses yet. Add one to speed up checkout.
        </div>
      ) : null}

      <div className="space-y-3">
        {list.map((a) => (
          <div key={a.id} className="rounded-xl border border-gray-200 bg-white p-4">
            {editingId === a.id ? (
              <AddressForm
                showDefault
                submitLabel="Update"
                initialValues={toFormValues(a)}
                onSubmit={async (v) => {
                  await updateAddr.mutateAsync({ id: a.id, input: v })
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    {a.contact_name}
                    {a.is_default ? (
                      <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    ) : null}
                  </div>
                  <div className="text-gray-600">{a.phone}</div>
                  <div className="text-gray-600">
                    {a.address_line_1}
                    {a.address_line_2 ? `, ${a.address_line_2}` : ''}, {a.city}, {a.state} {a.postal_code}
                  </div>
                </div>
                <div className="flex flex-col gap-2 text-sm">
                  <button
                    onClick={() => setEditingId(a.id)}
                    className="text-indigo-600 hover:underline"
                  >
                    Edit
                  </button>
                  {!a.is_default ? (
                    <button
                      onClick={() => setDefault.mutate(a.id)}
                      className="text-indigo-600 hover:underline"
                    >
                      Set default
                    </button>
                  ) : null}
                  <button
                    onClick={() => {
                      if (confirm('Delete this address?')) deleteAddr.mutate(a.id)
                    }}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

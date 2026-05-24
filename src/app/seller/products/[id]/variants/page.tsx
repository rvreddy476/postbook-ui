'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import AppShell from '@/components/AppShell'
import {
  useProductVariants,
  useAddProductVariant,
  useUpdateProductVariant,
  useArchiveProductVariant,
  type ProductVariantSummary,
  type CreateVariantPayload,
} from '@/hooks/useSellerDashboard'

// SellerProductVariantsPage — commerce TODO H#5. Lets a seller add,
// edit, and archive variants on a product that's already been created.
// The product creation wizard captures the initial variant set; this
// page is for everything after launch.
//
// Archive is soft-delete (status='archived'); existing orders +
// cart_items keep resolving against the variant_id so we never lose
// history.
export default function SellerProductVariantsPage() {
  const params = useParams<{ id: string }>()
  const productId = params?.id ?? ''
  const { data: variants = [], isLoading } = useProductVariants(productId)
  const addVariant = useAddProductVariant(productId)
  const updateVariant = useUpdateProductVariant(productId)
  const archiveVariant = useArchiveProductVariant(productId)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateVariantPayload>(emptyForm())
  const [error, setError] = useState('')

  function emptyForm(): CreateVariantPayload {
    return {
      sku: '',
      option_1_name: 'size',
      option_1_value: '',
      mrp: 0,
      selling_price: 0,
      currency_code: 'INR',
    }
  }

  function resetForm() {
    setForm(emptyForm())
    setEditingId(null)
    setShowForm(false)
    setError('')
  }

  function startEdit(v: ProductVariantSummary) {
    setForm({
      sku: v.sku,
      barcode: v.barcode ?? '',
      option_1_name: v.option_1_name ?? '',
      option_1_value: v.option_1_value ?? '',
      option_2_name: v.option_2_name ?? '',
      option_2_value: v.option_2_value ?? '',
      option_3_name: v.option_3_name ?? '',
      option_3_value: v.option_3_value ?? '',
      mrp: v.mrp,
      selling_price: v.selling_price,
      cost_price: v.cost_price ?? undefined,
      currency_code: v.currency_code,
      weight_grams: v.weight_grams ?? undefined,
    })
    setEditingId(v.id)
    setShowForm(true)
    setError('')
  }

  async function handleSubmit() {
    setError('')
    if (!form.sku.trim()) {
      setError('SKU is required.')
      return
    }
    if (form.mrp <= 0 || form.selling_price <= 0) {
      setError('MRP and selling price must be positive.')
      return
    }
    if (form.selling_price > form.mrp) {
      setError('Selling price cannot exceed MRP.')
      return
    }
    try {
      if (editingId) {
        await updateVariant.mutateAsync({
          variantId: editingId,
          patch: stripEmpty(form),
        })
      } else {
        await addVariant.mutateAsync(form)
      }
      resetForm()
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to save variant.'
      setError(message)
    }
  }

  async function handleArchive(v: ProductVariantSummary) {
    if (v.status === 'archived') return
    if (
      !window.confirm(
        `Archive variant "${v.sku}"? Existing orders keep working, but customers can't add new units.`,
      )
    )
      return
    try {
      await archiveVariant.mutateAsync(v.id)
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to archive variant.'
      window.alert(message)
    }
  }

  return (
    <AppShell activeTab="Shop">
      <div className="min-h-screen bg-[#F5F0EB]">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <Link
                href="/seller/products"
                className="text-xs font-black uppercase tracking-widest text-[#8B5E3C] hover:text-[#1A1A1A] transition mb-1 block"
              >
                ← Products
              </Link>
              <h1 className="text-2xl font-black text-[#1A1A1A]">Variants</h1>
              <p className="text-[#6B5544] text-sm mt-1">
                Size, color, packaging — each one is a sellable SKU under this product.
              </p>
            </div>
            {!showForm && (
              <button
                onClick={() => {
                  setForm(emptyForm())
                  setEditingId(null)
                  setShowForm(true)
                }}
                className="px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl font-bold hover:bg-[#3A2E26] transition text-sm"
              >
                + Add Variant
              </button>
            )}
          </div>

          {showForm && (
            <div className="bg-white rounded-2xl border border-[#E8DDD3] p-6 mb-6">
              <h2 className="text-lg font-black text-[#1A1A1A] mb-4">
                {editingId ? 'Edit Variant' : 'New Variant'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="SKU"
                  required
                  disabled={!!editingId}
                  value={form.sku}
                  onChange={(v) => setForm({ ...form, sku: v })}
                  hint={editingId ? 'SKU cannot be changed after creation.' : ''}
                />
                <Field
                  label="Barcode"
                  value={form.barcode ?? ''}
                  onChange={(v) => setForm({ ...form, barcode: v })}
                />
                <Field
                  label="Option 1 name"
                  value={form.option_1_name ?? ''}
                  onChange={(v) => setForm({ ...form, option_1_name: v })}
                  hint="e.g. size, color"
                />
                <Field
                  label="Option 1 value"
                  value={form.option_1_value ?? ''}
                  onChange={(v) => setForm({ ...form, option_1_value: v })}
                />
                <Field
                  label="Option 2 name"
                  value={form.option_2_name ?? ''}
                  onChange={(v) => setForm({ ...form, option_2_name: v })}
                />
                <Field
                  label="Option 2 value"
                  value={form.option_2_value ?? ''}
                  onChange={(v) => setForm({ ...form, option_2_value: v })}
                />
                <FieldNum
                  label="MRP"
                  required
                  value={form.mrp}
                  onChange={(v) => setForm({ ...form, mrp: v })}
                />
                <FieldNum
                  label="Selling price"
                  required
                  value={form.selling_price}
                  onChange={(v) => setForm({ ...form, selling_price: v })}
                />
                <FieldNum
                  label="Cost price"
                  value={form.cost_price ?? 0}
                  onChange={(v) => setForm({ ...form, cost_price: v })}
                />
                <FieldNum
                  label="Weight (g)"
                  value={form.weight_grams ?? 0}
                  onChange={(v) => setForm({ ...form, weight_grams: v })}
                />
              </div>
              {error && (
                <p className="mt-4 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
                  {error}
                </p>
              )}
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={addVariant.isPending || updateVariant.isPending}
                  className="px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl font-bold hover:bg-[#3A2E26] transition text-sm disabled:opacity-50"
                >
                  {editingId ? 'Save Changes' : 'Create Variant'}
                </button>
                <button
                  onClick={resetForm}
                  className="px-5 py-2.5 bg-[#F5F0EB] text-[#6B5544] rounded-xl font-bold hover:bg-[#E8DDD3] transition text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="bg-white rounded-2xl border border-[#E8DDD3] p-12 text-center">
              <div className="w-8 h-8 border-2 border-[#8B5E3C] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : variants.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DDD3] p-12 text-center">
              <p className="font-bold text-[#1A1A1A] mb-1">No variants yet</p>
              <p className="text-[#6B5544] text-sm">
                Add a variant for each SKU you want to sell under this product.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8DDD3] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#F5F0EB] border-b border-[#E8DDD3]">
                  <tr>
                    <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
                      SKU
                    </th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
                      Options
                    </th>
                    <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
                      MRP
                    </th>
                    <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
                      Selling
                    </th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
                      Status
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DDD3]">
                  {variants.map((v) => (
                    <tr key={v.id} className="hover:bg-[#F5F0EB]/50 transition">
                      <td className="px-6 py-4 font-mono text-[13px] text-[#1A1A1A]">{v.sku}</td>
                      <td className="px-4 py-4 text-[#6B5544] text-xs">{optionsLabel(v)}</td>
                      <td className="px-4 py-4 text-right tabular-nums">
                        {v.currency_code ?? 'INR'} {v.mrp.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums font-bold text-[#1A1A1A]">
                        {v.currency_code ?? 'INR'} {v.selling_price.toFixed(2)}
                      </td>
                      <td className="px-4 py-4">
                        <StatusChip status={v.status} />
                      </td>
                      <td className="px-4 py-4 text-right space-x-3">
                        <button
                          onClick={() => startEdit(v)}
                          disabled={v.status === 'archived'}
                          className="text-[#8B5E3C] hover:text-[#1A1A1A] font-bold text-xs uppercase tracking-wider disabled:opacity-40 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleArchive(v)}
                          disabled={v.status === 'archived' || archiveVariant.isPending}
                          className="text-red-600 hover:text-red-700 font-bold text-xs uppercase tracking-wider disabled:opacity-40 transition"
                        >
                          Archive
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

function optionsLabel(v: ProductVariantSummary): string {
  const parts: string[] = []
  if (v.option_1_name && v.option_1_value) parts.push(`${v.option_1_name}: ${v.option_1_value}`)
  if (v.option_2_name && v.option_2_value) parts.push(`${v.option_2_name}: ${v.option_2_value}`)
  if (v.option_3_name && v.option_3_value) parts.push(`${v.option_3_name}: ${v.option_3_value}`)
  return parts.join(' / ') || '—'
}

function StatusChip({ status }: { status: string }) {
  const tone =
    status === 'active'
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : status === 'archived'
      ? 'bg-[#F5F0EB] text-[#6B5544]/50 border border-[#E8DDD3]'
      : 'bg-amber-50 text-amber-800 border border-amber-200'
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${tone}`}>
      {status}
    </span>
  )
}

function Field(props: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  disabled?: boolean
  hint?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-widest text-[#6B5544] mb-1.5">
        {props.label}
        {props.required ? <span className="text-red-600 ml-1">*</span> : null}
      </label>
      <input
        type="text"
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-[#E8DDD3] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]/30 disabled:bg-[#F5F0EB] disabled:text-[#6B5544]/60"
      />
      {props.hint && <p className="mt-1 text-[11px] text-[#6B5544]/70">{props.hint}</p>}
    </div>
  )
}

function FieldNum(props: {
  label: string
  value: number
  onChange: (v: number) => void
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-widest text-[#6B5544] mb-1.5">
        {props.label}
        {props.required ? <span className="text-red-600 ml-1">*</span> : null}
      </label>
      <input
        type="number"
        step="0.01"
        min="0"
        value={Number.isFinite(props.value) ? props.value : 0}
        onChange={(e) => {
          const n = parseFloat(e.target.value)
          props.onChange(Number.isFinite(n) ? n : 0)
        }}
        className="w-full px-3 py-2 rounded-lg border border-[#E8DDD3] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]/30"
      />
    </div>
  )
}

// stripEmpty removes empty-string optional fields so the PATCH body
// doesn't accidentally clear them server-side. The store allow-list
// rejects unknown keys, but a present-but-empty option_1_name = ""
// would still write "" — that's not what the user means when they
// leave a previously-set option blank during an edit.
function stripEmpty(form: CreateVariantPayload): Partial<CreateVariantPayload> & { status?: string } {
  const out: Partial<CreateVariantPayload> & Record<string, unknown> = {}
  for (const [k, v] of Object.entries(form)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'string' && v.trim() === '') continue
    out[k] = v
  }
  return out as Partial<CreateVariantPayload> & { status?: string }
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useCreateProduct } from '@/hooks/useSellerDashboard'

const inputCls = 'w-full border border-[#E8DDD3] rounded-xl px-4 py-3 text-[#1A1A1A] bg-white focus:ring-2 focus:ring-[#8B5E3C]/20 focus:border-[#8B5E3C] outline-none transition-all text-sm font-medium placeholder:text-[#6B5544]/30'
const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-[#6B5544] mb-1.5'

export default function NewProductPage() {
  const router = useRouter()
  const createProduct = useCreateProduct()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sku, setSku] = useState('')
  const [mrp, setMrp] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [stockQty, setStockQty] = useState('0')
  const [option1Name, setOption1Name] = useState('')
  const [option1Value, setOption1Value] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !sku || !mrp || !sellingPrice) return

    try {
      await createProduct.mutateAsync({
        title,
        description,
        variants: [
          {
            sku,
            mrp: parseFloat(mrp),
            selling_price: parseFloat(sellingPrice),
            stock_qty: parseInt(stockQty, 10),
            option_1_name: option1Name || undefined,
            option_1_value: option1Value || undefined,
          },
        ],
      })
      router.push('/seller/products')
    } catch (err) {
      console.error('create product error', err)
    }
  }

  return (
    <AppShell activeTab="Shop">
      <div className="min-h-screen bg-[#F5F0EB]">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link href="/seller/products" className="text-xs font-black uppercase tracking-widest text-[#8B5E3C] hover:text-[#1A1A1A] transition mb-4 block">← Products</Link>
          <h1 className="text-2xl font-black text-[#1A1A1A] mb-6">Add New Product</h1>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E8DDD3] p-8 space-y-6">
            <div>
              <label className={labelCls}>Product Title *</label>
              <input
                required
                className={inputCls}
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Handmade Ceramic Mug"
              />
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div className="border-t border-[#E8DDD3] pt-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-[#4A3728] mb-4">Variant / Pricing</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>SKU *</label>
                <input required className={inputCls} value={sku} onChange={e => setSku(e.target.value)} placeholder="e.g. MUG-001" />
              </div>
              <div>
                <label className={labelCls}>Stock Qty</label>
                <input type="number" min="0" className={inputCls} value={stockQty} onChange={e => setStockQty(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>MRP (₹) *</label>
                <input required type="number" min="0" step="0.01" className={inputCls} value={mrp} onChange={e => setMrp(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Selling Price (₹) *</label>
                <input required type="number" min="0" step="0.01" className={inputCls} value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Option Name (e.g. Size)</label>
                <input className={inputCls} value={option1Name} onChange={e => setOption1Name(e.target.value)} placeholder="Size" />
              </div>
              <div>
                <label className={labelCls}>Option Value</label>
                <input className={inputCls} value={option1Value} onChange={e => setOption1Value(e.target.value)} placeholder="M" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#E8DDD3]">
              <Link href="/seller/products" className="px-5 py-3 border border-[#E8DDD3] rounded-xl text-[#6B5544] font-bold hover:bg-[#F5F0EB] transition text-sm">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={createProduct.isPending}
                className="px-8 py-3 bg-[#1A1A1A] text-white rounded-xl font-bold hover:bg-[#3A2E26] disabled:opacity-50 transition text-sm"
              >
                {createProduct.isPending ? 'Creating…' : 'Create Product'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  )
}

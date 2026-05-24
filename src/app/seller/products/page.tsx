'use client'

import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useMyProducts, useSubmitProduct } from '@/hooks/useSellerDashboard'
import type { Product } from '@/types/commerce'

const statusLabel: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-[#F5F0EB] text-[#6B5544] border border-[#E8DDD3]' },
  submitted: { label: 'Under Review', color: 'bg-amber-50 text-amber-800 border border-amber-200' },
  under_review: { label: 'Under Review', color: 'bg-amber-50 text-amber-800 border border-amber-200' },
  approved: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  live: { label: 'Live', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  hidden: { label: 'Hidden', color: 'bg-[#F5F0EB] text-[#6B5544] border border-[#E8DDD3]' },
  rejected: { label: 'Rejected', color: 'bg-red-50 text-red-700 border border-red-200' },
  changes_requested: { label: 'Changes Requested', color: 'bg-orange-50 text-orange-800 border border-orange-200' },
  archived: { label: 'Archived', color: 'bg-[#F5F0EB] text-[#6B5544]/50 border border-[#E8DDD3]' },
}

export default function SellerProductsPage() {
  const { data: products = [], isLoading } = useMyProducts()
  const submitProduct = useSubmitProduct()

  if (isLoading) {
    return (
      <AppShell activeTab="Shop">
        <div className="min-h-screen flex items-center justify-center bg-[#F5F0EB]">
          <div className="w-8 h-8 border-2 border-[#8B5E3C] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell activeTab="Shop">
      <div className="min-h-screen bg-[#F5F0EB]">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <Link href="/seller/dashboard" className="text-xs font-black uppercase tracking-widest text-[#8B5E3C] hover:text-[#1A1A1A] transition mb-1 block">← Dashboard</Link>
              <h1 className="text-2xl font-black text-[#1A1A1A]">Products</h1>
            </div>
            <Link
              href="/seller/products/new"
              className="px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl font-bold hover:bg-[#3A2E26] transition text-sm"
            >
              + New Product
            </Link>
          </div>

          {products.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DDD3] p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#F5F0EB] border border-[#E8DDD3] flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📦</span>
              </div>
              <h3 className="text-lg font-black text-[#1A1A1A] mb-1">No products yet</h3>
              <p className="text-[#6B5544] text-sm mb-6">Add your first product to start selling.</p>
              <Link href="/seller/products/new" className="px-6 py-3 bg-[#1A1A1A] text-white rounded-xl font-bold hover:bg-[#3A2E26] transition text-sm">
                Add Product
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8DDD3] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#F5F0EB] border-b border-[#E8DDD3]">
                  <tr>
                    <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-[#6B5544]">Product</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#6B5544]">Status</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#6B5544]">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DDD3]">
                  {products.map((p: Product) => {
                    const st = statusLabel[p.approval_status] ?? { label: p.approval_status, color: 'bg-[#F5F0EB] text-[#6B5544]' }
                    return (
                      <tr key={p.id} className="hover:bg-[#F5F0EB]/50 transition">
                        <td className="px-6 py-4">
                          <p className="font-bold text-[#1A1A1A]">{p.title}</p>
                          <p className="text-[#6B5544]/50 text-xs mt-0.5">{p.slug}</p>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${st.color}`}>{st.label}</span>
                        </td>
                        <td className="px-4 py-4 text-[#6B5544] text-sm">
                          {new Date(p.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4 text-right space-x-3">
                          <Link
                            href={`/seller/products/${p.id}/variants`}
                            className="text-[#8B5E3C] hover:text-[#1A1A1A] font-bold text-xs uppercase tracking-wider transition"
                          >
                            Variants
                          </Link>
                          {(p.approval_status === 'draft' || p.approval_status === 'changes_requested') && (
                            <button
                              onClick={() => submitProduct.mutate(p.id)}
                              disabled={submitProduct.isPending}
                              className="text-[#8B5E3C] hover:text-[#1A1A1A] font-bold text-xs uppercase tracking-wider disabled:opacity-50 transition"
                            >
                              {p.approval_status === 'changes_requested' ? 'Resubmit' : 'Submit for Review'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useSellerDashboard } from '@/hooks/useSellerDashboard'
import { useOnboardingStatus } from '@/hooks/useSellerOnboarding'

export default function SellerDashboardPage() {
  const router = useRouter()
  const { data: seller, isLoading: loadingSeller } = useOnboardingStatus()
  const { data: stats, isLoading: loadingStats } = useSellerDashboard()

  if (loadingSeller || loadingStats) {
    return (
      <AppShell activeTab="Shop">
        <div className="min-h-screen flex items-center justify-center bg-[#F5F0EB]">
          <div className="w-8 h-8 border-2 border-[#8B5E3C] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  if (!seller) {
    return (
      <AppShell activeTab="Shop">
        <div className="min-h-screen flex items-center justify-center bg-[#F5F0EB]">
          <div className="bg-white rounded-2xl shadow-lg border border-[#E8DDD3] p-10 max-w-md text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#F5F0EB] border border-[#E8DDD3] flex items-center justify-center mx-auto mb-5">
              <span className="text-3xl">🛍️</span>
            </div>
            <h2 className="text-2xl font-black text-[#1A1A1A] mb-2">Start Selling on VChat</h2>
            <p className="text-[#6B5544] mb-6 text-sm">Reach millions of users. Set up your shop in minutes.</p>
            <button
              onClick={() => router.push('/seller/onboarding')}
              className="w-full py-3.5 bg-[#1A1A1A] text-white rounded-xl font-bold hover:bg-[#3A2E26] transition text-sm"
            >
              Open a Shop
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  const statusColor: Record<string, string> = {
    draft: 'bg-[#F5F0EB] text-[#6B5544] border border-[#E8DDD3]',
    submitted: 'bg-amber-50 text-amber-800 border border-amber-200',
    under_review: 'bg-blue-50 text-blue-800 border border-blue-200',
    changes_required: 'bg-orange-50 text-orange-800 border border-orange-200',
    approved: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    rejected: 'bg-red-50 text-red-800 border border-red-200',
    suspended: 'bg-red-50 text-red-800 border border-red-200',
  }

  const isApproved = seller.status === 'approved'

  return (
    <AppShell activeTab="Shop">
      <div className="min-h-screen bg-[#F5F0EB]">
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#8B5E3C] mb-1">Seller Dashboard</p>
              <h1 className="text-2xl font-black text-[#1A1A1A]">{seller.store_name}</h1>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusColor[seller.status] ?? 'bg-[#F5F0EB] text-[#6B5544]'}`}>
                {seller.status.replace('_', ' ')}
              </span>
            </div>
            {isApproved && (
              <Link
                href="/seller/products/new"
                className="px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl font-bold hover:bg-[#3A2E26] transition text-sm"
              >
                + New Product
              </Link>
            )}
          </div>

          {/* Pending / changes banner */}
          {seller.status === 'draft' && (
            <div className="mb-6 bg-white border border-[#E8DDD3] rounded-2xl p-5 flex items-center justify-between">
              <p className="text-[#6B5544] text-sm font-medium">Your application is incomplete. Complete onboarding to start selling.</p>
              <Link href="/seller/onboarding" className="text-sm font-bold text-[#8B5E3C] hover:text-[#1A1A1A] transition">Continue →</Link>
            </div>
          )}
          {seller.status === 'changes_required' && (
            <div className="mb-6 bg-white border border-orange-200 rounded-2xl p-5">
              <p className="text-[#1A1A1A] font-bold text-sm mb-1">Action Required</p>
              <p className="text-[#6B5544] text-sm">{seller.changes_requested}</p>
              <Link href="/seller/onboarding" className="mt-2 inline-block text-sm font-bold text-[#8B5E3C] hover:text-[#1A1A1A] transition">Update application →</Link>
            </div>
          )}
          {seller.status === 'rejected' && (
            <div className="mb-6 bg-white border border-red-200 rounded-2xl p-5">
              <p className="text-[#1A1A1A] font-bold text-sm mb-1">Application Rejected</p>
              <p className="text-[#6B5544] text-sm">{seller.rejection_reason}</p>
            </div>
          )}

          {/* Stats grid */}
          {isApproved && stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <StatCard label="Live Products" value={stats.live_products} accent="#8B5E3C" />
              <StatCard label="Orders Today" value={stats.orders_today} accent="#4A3728" />
              <StatCard label="Pending Review" value={stats.pending_products} accent="#6B5544" />
              <StatCard label="Total Revenue" value={`₹${stats.revenue_total.toFixed(0)}`} accent="#1A1A1A" />
            </div>
          )}

          {/* Quick actions */}
          {isApproved && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ActionCard title="Products" desc="Manage your product catalog" href="/seller/products" icon="📦" />
              <ActionCard title="Fulfillment" desc="Ship, label, track" href="/seller/fulfillment" icon="🚚" />
              <ActionCard title="Returns" desc="Approve & resolve" href="/seller/returns" icon="↩️" />
              <ActionCard title="Earnings" desc="Ledger & statements" href="/seller/earnings" icon="💰" />
            </div>
          )}

          {!isApproved && (seller.status === 'submitted' || seller.status === 'under_review') && (
            <div className="bg-white rounded-2xl border border-[#E8DDD3] p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#F5F0EB] border border-[#E8DDD3] flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⏳</span>
              </div>
              <h3 className="text-lg font-black text-[#1A1A1A] mb-1">Application Under Review</h3>
              <p className="text-[#6B5544] text-sm">We'll notify you once your application is reviewed. This typically takes 2-3 business days.</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8DDD3] p-5 hover:border-[#8B5E3C] transition">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#6B5544] mb-1">{label}</p>
      <p className="text-2xl font-black mt-1" style={{ color: accent }}>{value}</p>
    </div>
  )
}

function ActionCard({ title, desc, href, icon }: { title: string; desc: string; href: string; icon: string }) {
  return (
    <Link href={href} className="bg-white rounded-2xl border border-[#E8DDD3] p-5 hover:border-[#8B5E3C] transition group">
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-bold text-[#1A1A1A] group-hover:text-[#8B5E3C] transition">{title}</h3>
      <p className="text-[#6B5544] text-sm mt-0.5">{desc}</p>
    </Link>
  )
}

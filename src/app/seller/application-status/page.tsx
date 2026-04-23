'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/services/authService'
import AppShell from '@/components/AppShell'
import { useOnboardingStatus } from '@/hooks/useSellerOnboarding'

export default function ApplicationStatusPage() {
  const router = useRouter()
  const session = typeof window !== 'undefined' ? getSession() : null
  const { data: seller, isLoading } = useOnboardingStatus()

  useEffect(() => {
    if (!session) {
      router.replace('/login?redirect=/seller/application-status')
      return
    }
    if (!isLoading && seller) {
      if (seller.status === 'approved') {
        router.replace('/seller/dashboard')
      } else if (seller.status === 'draft') {
        router.replace('/seller/onboarding')
      }
    }
    if (!isLoading && !seller) {
      router.replace('/seller/onboarding')
    }
  }, [session, seller, isLoading, router])

  if (isLoading || !seller) {
    return (
      <AppShell activeTab="Shop">
        <div className="min-h-screen flex items-center justify-center bg-[#F5F0EB]">
          <div className="w-8 h-8 border-2 border-[#8B5E3C] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  const statusConfig: Record<string, { icon: string; title: string; borderColor: string }> = {
    submitted: { icon: '📋', title: 'Application Submitted', borderColor: 'border-[#8B5E3C]' },
    under_review: { icon: '🔍', title: 'Under Review', borderColor: 'border-amber-300' },
    changes_required: { icon: '📝', title: 'Changes Required', borderColor: 'border-orange-300' },
    rejected: { icon: '❌', title: 'Application Rejected', borderColor: 'border-red-300' },
    suspended: { icon: '⚠️', title: 'Account Suspended', borderColor: 'border-red-300' },
  }

  const cfg = statusConfig[seller.status] || statusConfig.submitted

  return (
    <AppShell activeTab="Shop">
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0EB] px-4">
        <div className={`max-w-md w-full bg-white rounded-2xl shadow-lg border-2 ${cfg.borderColor} p-10 text-center`}>
          <div className="w-16 h-16 rounded-2xl bg-[#F5F0EB] border border-[#E8DDD3] flex items-center justify-center mx-auto mb-5">
            <span className="text-3xl">{cfg.icon}</span>
          </div>
          <h2 className="text-2xl font-black text-[#1A1A1A] mb-2">{cfg.title}</h2>

          {(seller.status === 'submitted' || seller.status === 'under_review') && (
            <p className="text-[#6B5544] mb-6 text-sm leading-relaxed">
              Your seller application is being reviewed by our team. We typically respond within 2-3 business days.
              You'll receive a notification once a decision is made.
            </p>
          )}

          {seller.status === 'changes_required' && (
            <>
              <p className="text-[#6B5544] mb-4 text-sm">
                Our review team has requested some changes to your application.
              </p>
              {seller.changes_requested && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-orange-800 mb-1">Requested changes</p>
                  <p className="text-orange-700 text-sm">{seller.changes_requested}</p>
                </div>
              )}
              <button
                onClick={() => router.push('/seller/onboarding')}
                className="w-full py-3.5 bg-[#1A1A1A] text-white rounded-xl font-bold hover:bg-[#3A2E26] transition text-sm mb-3"
              >
                Make Changes
              </button>
            </>
          )}

          {seller.status === 'rejected' && (
            <>
              <p className="text-[#6B5544] mb-4 text-sm">
                Unfortunately, your application was not approved at this time.
              </p>
              {seller.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-800 mb-1">Reason</p>
                  <p className="text-red-700 text-sm">{seller.rejection_reason}</p>
                </div>
              )}
            </>
          )}

          {seller.status === 'suspended' && (
            <>
              <p className="text-[#6B5544] mb-4 text-sm">
                Your seller account has been suspended.
              </p>
              {seller.changes_requested && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-800 mb-1">Reason</p>
                  <p className="text-red-700 text-sm">{seller.changes_requested}</p>
                </div>
              )}
            </>
          )}

          <div className="space-y-3 mt-4">
            {seller.store_name && (
              <div className="bg-[#F5F0EB] border border-[#E8DDD3] rounded-xl p-4 text-left">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#6B5544] mb-1">Business</p>
                <p className="text-sm font-bold text-[#1A1A1A]">{seller.store_name}</p>
              </div>
            )}
            <button
              onClick={() => router.push('/commerce')}
              className="w-full py-3.5 border border-[#E8DDD3] rounded-xl text-[#6B5544] font-bold hover:bg-[#F5F0EB] transition text-sm"
            >
              Back to Commerce
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

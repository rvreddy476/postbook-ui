'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAcceptOrgInvite } from '@/hooks/useCommerce'

export default function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const router = useRouter()
  const accept = useAcceptOrgInvite()

  useEffect(() => {
    if (!token) return
    accept.mutate(token, {
      onSuccess: (inv: { organization_id: string }) => {
        setTimeout(() => router.push(`/organizations/${inv.organization_id}`), 800)
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <AppShell activeTab="Shop">
      <div className="min-h-screen bg-[#F5F0EB] flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-[#E8DDD3] p-8 max-w-md w-full text-center">
          {accept.isPending && (
            <p className="text-sm text-[#6B5544]">Accepting invitation…</p>
          )}
          {accept.isSuccess && (
            <>
              <h1 className="text-xl font-black text-[#1A1A1A] mb-1">Welcome aboard</h1>
              <p className="text-sm text-[#6B5544]">Redirecting to your organization…</p>
            </>
          )}
          {accept.isError && (
            <>
              <h1 className="text-xl font-black text-red-600 mb-1">Invitation invalid</h1>
              <p className="text-sm text-[#6B5544]">
                {(accept.error as Error).message ||
                  'Link may have expired or been used already. Ask the admin to send a new one.'}
              </p>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}

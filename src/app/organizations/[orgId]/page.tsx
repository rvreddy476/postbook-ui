'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import {
  useOrganization,
  useOrganizationMembers,
  useInviteOrgMember,
  useUpdateOrgMemberRole,
  useRemoveOrgMember,
  useOrgPendingApprovals,
  useOrgOrders,
  useApproveOrgOrder,
  useRejectOrgOrder,
  type OrgRole,
} from '@/hooks/useCommerce'

const ROLES: OrgRole[] = ['admin', 'buyer', 'approver', 'finance']

export default function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = use(params)
  const { data: org, isLoading } = useOrganization(orgId)
  const { data: membersData } = useOrganizationMembers(orgId)
  const { data: pendingData } = useOrgPendingApprovals(orgId)
  const { data: ordersData } = useOrgOrders(orgId)

  const members = membersData?.members ?? []
  const pending = pendingData?.orders ?? []
  const orders = ordersData?.orders ?? []

  const invite = useInviteOrgMember()
  const updateRole = useUpdateOrgMemberRole()
  const removeMember = useRemoveOrgMember()
  const approveOrder = useApproveOrgOrder()
  const rejectOrder = useRejectOrgOrder()

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<OrgRole>('buyer')
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  if (isLoading) {
    return (
      <AppShell activeTab="Shop">
        <div className="p-8 text-sm text-[#6B5544]">Loading organization…</div>
      </AppShell>
    )
  }
  if (!org) {
    return (
      <AppShell activeTab="Shop">
        <div className="p-8 text-sm text-red-600">Organization not found</div>
      </AppShell>
    )
  }

  const handleInvite = async () => {
    setInviteLink(null)
    const inv = await invite.mutateAsync({
      orgId,
      email: inviteEmail.trim(),
      role: inviteRole,
    })
    setInviteEmail('')
    setInviteLink(`${window.location.origin}/organizations/invites/${inv.token}/accept`)
  }

  return (
    <AppShell activeTab="Shop">
      <div className="min-h-screen bg-[#F5F0EB]">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <Link
            href="/organizations"
            className="text-xs font-black uppercase tracking-widest text-[#8B5E3C] hover:text-[#1A1A1A] transition mb-1 block"
          >
            ← Organizations
          </Link>
          <h1 className="text-2xl font-black text-[#1A1A1A]">{org.name}</h1>
          {org.legal_name && org.legal_name !== org.name && (
            <p className="text-sm text-[#6B5544]">{org.legal_name}</p>
          )}

          {/* Settings card */}
          <section className="mt-6 bg-white rounded-2xl border border-[#E8DDD3] p-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-[#6B5544] mb-3">
              Settings
            </h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Field label="GSTIN" value={org.gstin} mono />
              <Field label="PAN" value={org.pan} mono />
              <Field label="Billing email" value={org.billing_email} />
              <Field label="Billing phone" value={org.billing_phone} />
              <Field
                label="Approval threshold"
                value={org.approval_threshold ? `₹${org.approval_threshold.toFixed(2)}` : null}
              />
              <Field
                label="Credit terms"
                value={org.credit_terms_days > 0 ? `Net ${org.credit_terms_days} days` : 'Prepay only'}
              />
            </dl>
          </section>

          {/* Pending approvals */}
          {pending.length > 0 && (
            <section className="mt-6 bg-white rounded-2xl border border-amber-200 p-6">
              <h2 className="text-xs font-black uppercase tracking-widest text-amber-800 mb-3">
                Pending approvals ({pending.length})
              </h2>
              <ul className="space-y-2">
                {pending.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between border-b border-amber-100 last:border-0 pb-2"
                  >
                    <div>
                      <div className="font-bold text-[#1A1A1A]">{o.order_number}</div>
                      <div className="text-xs text-[#6B5544]">
                        ₹{o.final_amount.toFixed(2)}
                        {o.po_number ? ` · PO ${o.po_number}` : ''}
                        {o.cost_center ? ` · ${o.cost_center}` : ''}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => approveOrder.mutate({ orderId: o.id })}
                        disabled={approveOrder.isPending}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          const reason = window.prompt('Reason for rejection (shown to buyer):')
                          if (reason) rejectOrder.mutate({ orderId: o.id, reason })
                        }}
                        className="px-3 py-1.5 border border-red-300 text-red-700 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-red-50"
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Members */}
          <section className="mt-6 bg-white rounded-2xl border border-[#E8DDD3] p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-black uppercase tracking-widest text-[#6B5544]">
                Members ({members.filter((m) => m.status === 'active').length})
              </h2>
            </div>
            <div className="space-y-1.5">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between text-sm border-b border-[#E8DDD3] last:border-0 pb-1.5"
                >
                  <div className="min-w-0 truncate">
                    <span className="font-mono text-xs text-[#6B5544]">
                      {m.user_id.slice(0, 8)}…
                    </span>
                    {m.invited_email && (
                      <span className="ml-2 text-[#1A1A1A]">{m.invited_email}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={m.role}
                      onChange={(e) =>
                        updateRole.mutate({ orgId, userId: m.user_id, role: e.target.value as OrgRole })
                      }
                      className="text-xs border border-[#E8DDD3] rounded px-2 py-1"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        m.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {m.status}
                    </span>
                    {m.status === 'active' && (
                      <button
                        onClick={() => {
                          if (window.confirm('Remove this member?')) {
                            removeMember.mutate({ orgId, userId: m.user_id })
                          }
                        }}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-[#E8DDD3]">
              <h3 className="text-xs font-black uppercase tracking-widest text-[#6B5544] mb-2">
                Invite member
              </h3>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="email@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 border border-[#E8DDD3] rounded-lg px-3 py-2 text-sm"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                  className="border border-[#E8DDD3] rounded-lg px-3 py-2 text-sm"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleInvite}
                  disabled={!inviteEmail || invite.isPending}
                  className="px-4 py-2 bg-[#1A1A1A] text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-[#3A2E26] disabled:opacity-50"
                >
                  {invite.isPending ? 'Inviting…' : 'Invite'}
                </button>
              </div>
              {inviteLink && (
                <div className="mt-2 text-xs text-emerald-700 break-all">
                  Share this link: <span className="font-mono">{inviteLink}</span>
                </div>
              )}
            </div>
          </section>

          {/* Recent orders */}
          <section className="mt-6 bg-white rounded-2xl border border-[#E8DDD3] p-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-[#6B5544] mb-3">
              Recent orders ({orders.length})
            </h2>
            {orders.length === 0 ? (
              <p className="text-sm text-[#6B5544]">No orders yet.</p>
            ) : (
              <ul className="space-y-1">
                {orders.slice(0, 20).map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between text-sm border-b border-[#E8DDD3] last:border-0 py-2"
                  >
                    <Link
                      href={`/orders/${o.id}`}
                      className="font-medium text-[#1A1A1A] hover:text-[#8B5E3C]"
                    >
                      {o.order_number}
                    </Link>
                    <div className="text-xs text-[#6B5544] flex gap-3">
                      <span>{new Date(o.created_at).toLocaleDateString()}</span>
                      <span className="font-mono">₹{o.final_amount.toFixed(2)}</span>
                      <span>{o.status.replace(/_/g, ' ')}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  )
}

function Field({
  label,
  value,
  mono,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-xs text-[#6B5544]">{label}</dt>
      <dd
        className={`${mono ? 'font-mono' : ''} ${value ? 'font-medium text-[#1A1A1A]' : 'italic text-[#6B5544]/60'}`}
      >
        {value || '—'}
      </dd>
    </div>
  )
}
